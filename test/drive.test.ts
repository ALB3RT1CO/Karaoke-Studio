import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Readable } from 'node:stream';
import { Store } from '../src/server/store.ts';
import {
  getDriveClient,
  listFolderFiles,
  getFileStream,
  syncDriveFolder,
  cleanSongTitle,
  parseRawTextToLines,
  type DriveSongFile,
} from '../src/server/ingestion/drive.ts';

const SAMPLE_DOCX_PATH =
  'C:\\Users\\alver\\.gemini\\antigravity\\brain\\ebe9d28a-4dee-4cdc-bad1-ee69a0050b15\\scratch\\sample_1PorMes.docx';

function createTempLogPath(): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'karaoke-drive-test-'));
  return path.join(tmpDir, 'data.jsonl');
}

test('getDriveClient - throws error when credentials are not configured', () => {
  const originalKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  try {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    assert.throws(
      () => getDriveClient(),
      /GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not defined/
    );
  } finally {
    if (originalKey !== undefined) {
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY = originalKey;
    }
  }
});

test('getDriveClient - creates drive client from credentials JSON', () => {
  const fakeKey = JSON.stringify({
    client_email: 'test-service-account@test-project.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC6...\n-----END PRIVATE KEY-----\n',
  });
  const client = getDriveClient(fakeKey);
  assert.ok(client);
  assert.ok(client.files);
  assert.equal(typeof client.files.list, 'function');
  assert.equal(typeof client.files.get, 'function');
  assert.equal(typeof client.files.export, 'function');
});

test('cleanSongTitle - cleans file extension and chord annotations', () => {
  assert.equal(cleanSongTitle('Adiós Amor - rem.docx'), 'Adiós Amor');
  assert.equal(cleanSongTitle('Amor de Temporada - sim-Capo-1erTr.docx'), 'Amor de Temporada');
  assert.equal(cleanSongTitle('1PorMes.docx'), '1PorMes');
  assert.equal(cleanSongTitle('De Música Ligera (sim).rtf'), 'De Música Ligera');
  assert.equal(cleanSongTitle('Sabor a Mi - SolM.txt'), 'Sabor a Mi');
});

test('parseRawTextToLines - converts raw text to structured LyricLine array', () => {
  const text = 'Line one text\nLine two with words\n\nLine three';
  const lines = parseRawTextToLines(text);

  assert.equal(lines.length, 3);
  assert.equal(lines[0].lineIndex, 0);
  assert.equal(lines[0].words.length, 3);
  assert.equal(lines[0].words[0].text, 'Line');
  assert.equal(lines[0].words[1].text, 'one');
  assert.equal(lines[0].words[2].text, 'text');

  assert.equal(lines[1].lineIndex, 1);
  assert.equal(lines[1].words.length, 4);

  assert.equal(lines[2].lineIndex, 2);
  assert.equal(lines[2].words.length, 2);
});

test('listFolderFiles - queries drive with correct parent query, fields, and handles pagination', async () => {
  const folderId = 'folder-xyz-123';
  const calls: any[] = [];

  const mockDriveClient = {
    files: {
      list: async (params: any) => {
        calls.push(params);
        if (!params.pageToken) {
          return {
            data: {
              nextPageToken: 'page-token-2',
              files: [
                {
                  id: 'file-1',
                  name: 'Song One.docx',
                  mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                  md5Checksum: 'md5-1',
                  modifiedTime: '2026-01-01T00:00:00.000Z',
                  size: '12345',
                },
              ],
            },
          };
        } else if (params.pageToken === 'page-token-2') {
          return {
            data: {
              nextPageToken: null,
              files: [
                {
                  id: 'file-2',
                  name: 'Song Two.docx',
                  mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                  md5Checksum: 'md5-2',
                  modifiedTime: '2026-01-02T00:00:00.000Z',
                  size: '67890',
                },
              ],
            },
          };
        }
        return { data: { files: [] } };
      },
    },
  };

  const files = await listFolderFiles(folderId, mockDriveClient);

  assert.equal(calls.length, 2);
  assert.equal(calls[0].q, `'${folderId}' in parents and trashed = false`);
  assert.equal(calls[0].fields, 'nextPageToken, files(id, name, mimeType, md5Checksum, modifiedTime, size)');
  assert.equal(calls[0].pageToken, undefined);

  assert.equal(calls[1].pageToken, 'page-token-2');

  assert.equal(files.length, 2);
  assert.equal(files[0].id, 'file-1');
  assert.equal(files[0].name, 'Song One.docx');
  assert.equal(files[1].id, 'file-2');
  assert.equal(files[1].name, 'Song Two.docx');
});

test('getFileStream - routes Google Docs to export({ mimeType: "text/plain" })', async () => {
  let exportCalledWith: any = null;
  let exportConfig: any = null;

  const mockStream = Readable.from(['Doc content line 1\nLine 2']);

  const mockDriveClient = {
    files: {
      export: async (params: any, config: any) => {
        exportCalledWith = params;
        exportConfig = config;
        return { data: mockStream };
      },
      get: async () => {
        throw new Error('get should not be called for Google Docs');
      },
    },
  };

  const stream = await getFileStream(
    'gdoc-id-1',
    'application/vnd.google-apps.document',
    mockDriveClient
  );

  assert.equal(stream, mockStream);
  assert.deepEqual(exportCalledWith, {
    fileId: 'gdoc-id-1',
    mimeType: 'text/plain',
  });
  assert.deepEqual(exportConfig, {
    responseType: 'stream',
  });
});

test('getFileStream - routes binary DOCX to get({ alt: "media" })', async () => {
  let getCalledWith: any = null;
  let getConfig: any = null;

  const mockStream = Readable.from([Buffer.from('binary data')]);

  const mockDriveClient = {
    files: {
      export: async () => {
        throw new Error('export should not be called for binary files');
      },
      get: async (params: any, config: any) => {
        getCalledWith = params;
        getConfig = config;
        return { data: mockStream };
      },
    },
  };

  const stream = await getFileStream(
    'docx-id-1',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    mockDriveClient
  );

  assert.equal(stream, mockStream);
  assert.deepEqual(getCalledWith, {
    fileId: 'docx-id-1',
    alt: 'media',
  });
  assert.deepEqual(getConfig, {
    responseType: 'stream',
  });
});

test('syncDriveFolder - downloads, extracts, and upserts new DOCX song into store', async () => {
  const logPath = createTempLogPath();
  const store = new Store();
  store.initStore(logPath);

  try {
    let getCalledCount = 0;
    const mockDriveClient = {
      files: {
        list: async () => ({
          data: {
            files: [
              {
                id: 'drive-docx-1',
                name: '1 sola vez por Mes - rem.docx',
                mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                md5Checksum: 'md5-hash-sample-1',
              },
            ],
          },
        }),
        get: async () => {
          getCalledCount++;
          return { data: fs.createReadStream(SAMPLE_DOCX_PATH) };
        },
      },
    };

    const result = await syncDriveFolder('folder-test', {
      store,
      driveClient: mockDriveClient,
    });

    assert.equal(getCalledCount, 1);
    assert.equal(result.synced.length, 1);
    assert.equal(result.skipped.length, 0);

    const song = store.getSong('drive-docx-1');
    assert.ok(song);
    assert.equal(song.id, 'drive-docx-1');
    assert.equal(song.driveMd5Checksum, 'md5-hash-sample-1');
    assert.equal(song.title, '1 sola vez por Mes');
    assert.ok(song.lines.length > 0);

    // Verify words are present in lines
    const allWords = song.lines.flatMap((l) => l.words.map((w) => w.text));
    assert.ok(allWords.includes('Antes'));
    assert.ok(allWords.includes('Mes'));
  } finally {
    store.close();
    fs.rmSync(path.dirname(logPath), { recursive: true, force: true });
  }
});

test('syncDriveFolder - incremental sync skips re-downloading existing file when md5Checksum matches', async () => {
  const logPath = createTempLogPath();
  const store = new Store();
  store.initStore(logPath);

  try {
    // Pre-populate store with an existing track having matching md5Checksum
    store.upsertSong({
      id: 'drive-docx-existing',
      title: 'Existing Song',
      driveMd5Checksum: 'matching-md5-value',
      lines: [
        {
          lineIndex: 0,
          start: 0,
          end: 0,
          words: [{ text: 'Hello', start: 0, end: 0 }],
        },
      ],
    });

    let getCalledCount = 0;
    const mockDriveClient = {
      files: {
        list: async () => ({
          data: {
            files: [
              {
                id: 'drive-docx-existing',
                name: 'Existing Song.docx',
                mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                md5Checksum: 'matching-md5-value',
              },
            ],
          },
        }),
        get: async () => {
          getCalledCount++;
          return { data: fs.createReadStream(SAMPLE_DOCX_PATH) };
        },
      },
    };

    // Incremental sync without force: should skip
    const result1 = await syncDriveFolder('folder-test', {
      store,
      driveClient: mockDriveClient,
      force: false,
    });

    assert.equal(getCalledCount, 0, 'Should not download file when md5Checksum matches');
    assert.equal(result1.synced.length, 0);
    assert.deepEqual(result1.skipped, ['drive-docx-existing']);

    // Now call with force: true - should re-download and re-sync
    const result2 = await syncDriveFolder('folder-test', {
      store,
      driveClient: mockDriveClient,
      force: true,
    });

    assert.equal(getCalledCount, 1, 'Should download file when force: true');
    assert.equal(result2.synced.length, 1);
    assert.equal(result2.skipped.length, 0);
  } finally {
    store.close();
    fs.rmSync(path.dirname(logPath), { recursive: true, force: true });
  }
});

test('syncDriveFolder - handles Google Docs export and syncs correctly into store', async () => {
  const logPath = createTempLogPath();
  const store = new Store();
  store.initStore(logPath);

  try {
    let exportCalledCount = 0;
    const mockDriveClient = {
      files: {
        list: async () => ({
          data: {
            files: [
              {
                id: 'gdoc-file-1',
                name: 'Cancion Google Doc (sim).gdoc',
                mimeType: 'application/vnd.google-apps.document',
                modifiedTime: '2026-09-20T12:00:00.000Z',
              },
            ],
          },
        }),
        export: async () => {
          exportCalledCount++;
          return {
            data: Readable.from([
              'Verso uno de la cancion\nVerso dos con mas palabras\n',
            ]),
          };
        },
      },
    };

    const result = await syncDriveFolder('folder-test', {
      store,
      driveClient: mockDriveClient,
    });

    assert.equal(exportCalledCount, 1);
    assert.equal(result.synced.length, 1);

    const song = store.getSong('gdoc-file-1');
    assert.ok(song);
    assert.equal(song.title, 'Cancion Google Doc');
    assert.equal(song.driveMd5Checksum, '2026-09-20T12:00:00.000Z');
    assert.equal(song.lines.length, 2);
    assert.equal(song.lines[0].words.length, 5);
  } finally {
    store.close();
    fs.rmSync(path.dirname(logPath), { recursive: true, force: true });
  }
});

test('syncDriveFolder - preserves existing youtubeVideoId when re-syncing song', async () => {
  const logPath = createTempLogPath();
  const store = new Store();
  store.initStore(logPath);

  try {
    store.upsertSong({
      id: 'song-with-yt',
      title: 'Old Title',
      driveMd5Checksum: 'old-md5',
      youtubeVideoId: 'yt-permanent-cached-id',
      lines: [],
    });

    const mockDriveClient = {
      files: {
        list: async () => ({
          data: {
            files: [
              {
                id: 'song-with-yt',
                name: 'New Title.docx',
                mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                md5Checksum: 'new-md5-updated',
              },
            ],
          },
        }),
        get: async () => ({
          data: fs.createReadStream(SAMPLE_DOCX_PATH),
        }),
      },
    };

    const result = await syncDriveFolder('folder-test', {
      store,
      driveClient: mockDriveClient,
    });

    assert.equal(result.synced.length, 1);
    const updated = store.getSong('song-with-yt');
    assert.ok(updated);
    assert.equal(updated.driveMd5Checksum, 'new-md5-updated');
    assert.equal(updated.youtubeVideoId, 'yt-permanent-cached-id', 'Must preserve youtubeVideoId');
  } finally {
    store.close();
    fs.rmSync(path.dirname(logPath), { recursive: true, force: true });
  }
});

test('syncDriveFolder - isolates file errors without stopping the remaining files in the batch', async () => {
  const logPath = createTempLogPath();
  const store = new Store();
  store.initStore(logPath);

  try {
    const mockDriveClient = {
      files: {
        list: async () => ({
          data: {
            files: [
              {
                id: 'file-corrupt',
                name: 'Corrupt.docx',
                mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                md5Checksum: 'md5-corrupt',
              },
              {
                id: 'file-valid',
                name: 'Valid Doc.docx',
                mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                md5Checksum: 'md5-valid',
              },
            ],
          },
        }),
        get: async (params: any) => {
          if (params.fileId === 'file-corrupt') {
            return {
              data: Readable.from([Buffer.from('not-a-valid-zip-corrupt-data')]),
            };
          }
          return {
            data: fs.createReadStream(SAMPLE_DOCX_PATH),
          };
        },
      },
    };

    const result = await syncDriveFolder('folder-test', {
      store,
      driveClient: mockDriveClient,
    });

    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0].fileId, 'file-corrupt');

    assert.equal(result.synced.length, 1);
    assert.equal(result.synced[0].id, 'file-valid');

    assert.equal(store.getSong('file-corrupt'), undefined);
    assert.ok(store.getSong('file-valid'));
  } finally {
    store.close();
    fs.rmSync(path.dirname(logPath), { recursive: true, force: true });
  }
});

