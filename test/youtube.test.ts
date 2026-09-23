import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Store, type SongKaraokeTrack } from '../src/server/store.ts';
import {
  getYouTubeClient,
  buildYouTubeSearchQuery,
  searchSongVideo,
  mapSongToYouTube,
  cleanSongTitle,
} from '../src/server/ingestion/youtube.ts';

function createTempLogPath(): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'karaoke-yt-test-'));
  return path.join(tmpDir, 'data.jsonl');
}

test('getYouTubeClient - throws error when YOUTUBE_API_KEY is not defined and no argument passed', () => {
  const originalKey = process.env.YOUTUBE_API_KEY;
  try {
    delete process.env.YOUTUBE_API_KEY;
    assert.throws(
      () => getYouTubeClient(),
      /YOUTUBE_API_KEY environment variable is not defined/
    );
  } finally {
    if (originalKey !== undefined) {
      process.env.YOUTUBE_API_KEY = originalKey;
    }
  }
});

test('getYouTubeClient - creates client when apiKey is provided or process.env.YOUTUBE_API_KEY is set', () => {
  const client1 = getYouTubeClient('custom-test-key');
  assert.ok(client1);
  assert.ok(client1.search);
  assert.equal(typeof client1.search.list, 'function');

  const originalKey = process.env.YOUTUBE_API_KEY;
  try {
    process.env.YOUTUBE_API_KEY = 'env-test-key';
    const client2 = getYouTubeClient();
    assert.ok(client2);
    assert.ok(client2.search);
    assert.equal(typeof client2.search.list, 'function');
  } finally {
    if (originalKey !== undefined) {
      process.env.YOUTUBE_API_KEY = originalKey;
    } else {
      delete process.env.YOUTUBE_API_KEY;
    }
  }
});

test('cleanSongTitle - cleans file extensions, chord annotations, and parentheses', () => {
  assert.equal(cleanSongTitle('Adiós Amor - rem.docx'), 'Adiós Amor');
  assert.equal(cleanSongTitle('Amor de Temporada - sim-Capo-1erTr.docx'), 'Amor de Temporada');
  assert.equal(cleanSongTitle('1PorMes.docx'), '1PorMes');
  assert.equal(cleanSongTitle('De Música Ligera (sim).rtf'), 'De Música Ligera');
  assert.equal(cleanSongTitle('Sabor a Mi - SolM.txt'), 'Sabor a Mi');
});

test('buildYouTubeSearchQuery - generates clean query with official audio suffix', () => {
  assert.equal(
    buildYouTubeSearchQuery('Adiós Amor - rem.docx'),
    'Adiós Amor official audio'
  );
  assert.equal(
    buildYouTubeSearchQuery('Amor de Temporada - sim-Capo-1erTr.docx'),
    'Amor de Temporada official audio'
  );
  assert.equal(
    buildYouTubeSearchQuery('De Música Ligera (sim).rtf'),
    'De Música Ligera official audio'
  );
  assert.equal(
    buildYouTubeSearchQuery('1 sola vez por Mes'),
    '1 sola vez por Mes official audio'
  );
  assert.equal(buildYouTubeSearchQuery(''), '');
  assert.equal(buildYouTubeSearchQuery('   '), '');
});

test('searchSongVideo - queries YouTube search API with video filter and returns videoId and title', async () => {
  let callParams: any = null;
  const mockYouTube = {
    search: {
      list: async (params: any) => {
        callParams = params;
        return {
          data: {
            items: [
              {
                id: { kind: 'youtube#video', videoId: 'yt-vid-456' },
                snippet: { title: 'Adiós Amor - Christian Nodal (Video Oficial)' },
              },
            ],
          },
        };
      },
    },
  };

  const result = await searchSongVideo('Adiós Amor official audio', mockYouTube);

  assert.ok(result);
  assert.equal(result.videoId, 'yt-vid-456');
  assert.equal(result.title, 'Adiós Amor - Christian Nodal (Video Oficial)');

  assert.deepEqual(callParams, {
    part: ['snippet'],
    q: 'Adiós Amor official audio',
    maxResults: 1,
    type: ['video'],
  });
});

test('searchSongVideo - returns null when search returns no items or query is empty', async () => {
  const mockYouTube = {
    search: {
      list: async () => ({
        data: { items: [] },
      }),
    },
  };

  const resultEmptyItems = await searchSongVideo('Unknown Unreleased Song', mockYouTube);
  assert.equal(resultEmptyItems, null);

  let called = false;
  const mockShouldNotCall = {
    search: {
      list: async () => {
        called = true;
        return { data: { items: [] } };
      },
    },
  };

  const resultEmptyQuery = await searchSongVideo('   ', mockShouldNotCall);
  assert.equal(resultEmptyQuery, null);
  assert.equal(called, false, 'Should not invoke API when query is empty');
});

test('searchSongVideo - handles YouTube API quota exceeded (HTTP 403) gracefully returning null', async () => {
  const quotaError: any = new Error(
    'The request cannot be completed because you have exceeded your quota.'
  );
  quotaError.code = 403;
  quotaError.status = 403;
  quotaError.errors = [{ reason: 'quotaExceeded', message: 'Quota exceeded' }];

  const mockYouTube = {
    search: {
      list: async () => {
        throw quotaError;
      },
    },
  };

  const result = await searchSongVideo('Any Song official audio', mockYouTube);
  assert.equal(result, null, 'Should return null gracefully without throwing');
});

test('searchSongVideo - handles network failure gracefully returning null', async () => {
  const networkError = new Error('connect ECONNREFUSED 142.250.190.42:443');

  const mockYouTube = {
    search: {
      list: async () => {
        throw networkError;
      },
    },
  };

  const result = await searchSongVideo('Any Song official audio', mockYouTube);
  assert.equal(result, null, 'Should return null gracefully on network failure');
});

test('mapSongToYouTube - throws error when song does not exist in store', async () => {
  const logPath = createTempLogPath();
  const store = new Store();
  store.initStore(logPath);

  try {
    await assert.rejects(
      async () => {
        await mapSongToYouTube('non-existent-id', { store });
      },
      /Song with ID "non-existent-id" not found in store/
    );
  } finally {
    store.close();
    fs.rmSync(path.dirname(logPath), { recursive: true, force: true });
  }
});

test('mapSongToYouTube - cache-first: does NOT call YouTube API when song already has youtubeVideoId', async () => {
  const logPath = createTempLogPath();
  const store = new Store();
  store.initStore(logPath);

  try {
    const existingTrack: SongKaraokeTrack = {
      id: 'song-with-video-id',
      title: 'Already Cached Song',
      driveMd5Checksum: 'md5-123',
      youtubeVideoId: 'existing-yt-videoId-123',
      lines: [],
    };
    store.upsertSong(existingTrack);

    let searchCallCount = 0;
    const mockYouTube = {
      search: {
        list: async () => {
          searchCallCount++;
          return { data: { items: [] } };
        },
      },
    };

    const result = await mapSongToYouTube('song-with-video-id', {
      store,
      youtubeClient: mockYouTube,
      force: false,
    });

    assert.equal(searchCallCount, 0, 'YouTube search API must NOT be called when videoId is cached');
    assert.equal(result.id, 'song-with-video-id');
    assert.equal(result.youtubeVideoId, 'existing-yt-videoId-123');
  } finally {
    store.close();
    fs.rmSync(path.dirname(logPath), { recursive: true, force: true });
  }
});

test('mapSongToYouTube - force: true bypasses cache and re-queries YouTube API', async () => {
  const logPath = createTempLogPath();
  const store = new Store();
  store.initStore(logPath);

  try {
    const existingTrack: SongKaraokeTrack = {
      id: 'song-force-test',
      title: 'Force Re-search Song - rem.docx',
      driveMd5Checksum: 'md5-abc',
      youtubeVideoId: 'old-yt-id',
      lines: [],
    };
    store.upsertSong(existingTrack);

    let searchCallCount = 0;
    let queryUsed = '';
    const mockYouTube = {
      search: {
        list: async (params: any) => {
          searchCallCount++;
          queryUsed = params.q;
          return {
            data: {
              items: [
                {
                  id: { videoId: 'new-refreshed-yt-id' },
                  snippet: { title: 'Force Re-search Song Official' },
                },
              ],
            },
          };
        },
      },
    };

    const result = await mapSongToYouTube('song-force-test', {
      store,
      youtubeClient: mockYouTube,
      force: true,
    });

    assert.equal(searchCallCount, 1, 'Search API should be called when force: true');
    assert.equal(queryUsed, 'Force Re-search Song official audio');
    assert.equal(result.youtubeVideoId, 'new-refreshed-yt-id');

    const updatedInStore = store.getSong('song-force-test');
    assert.equal(updatedInStore?.youtubeVideoId, 'new-refreshed-yt-id');
  } finally {
    store.close();
    fs.rmSync(path.dirname(logPath), { recursive: true, force: true });
  }
});

test('mapSongToYouTube - calls search API when youtubeVideoId is missing, updates store, and writes to log', async () => {
  const logPath = createTempLogPath();
  const store = new Store();
  store.initStore(logPath);

  try {
    const trackWithoutYt: SongKaraokeTrack = {
      id: 'song-unmapped-id',
      title: 'Adiós Amor - rem.docx',
      driveMd5Checksum: 'md5-unmapped',
      lines: [
        {
          lineIndex: 0,
          start: 0,
          end: 0,
          words: [{ text: 'Miro', start: 0, end: 0 }],
        },
      ],
    };
    store.upsertSong(trackWithoutYt);

    let searchCallCount = 0;
    let queryUsed = '';
    const mockYouTube = {
      search: {
        list: async (params: any) => {
          searchCallCount++;
          queryUsed = params.q;
          return {
            data: {
              items: [
                {
                  id: { videoId: 'yt-vid-fresh-888' },
                  snippet: { title: 'Adiós Amor Official Audio' },
                },
              ],
            },
          };
        },
      },
    };

    const result = await mapSongToYouTube('song-unmapped-id', {
      store,
      youtubeClient: mockYouTube,
    });

    assert.equal(searchCallCount, 1, 'Search API should be called once');
    assert.equal(queryUsed, 'Adiós Amor official audio');
    assert.equal(result.youtubeVideoId, 'yt-vid-fresh-888');
    assert.equal(result.id, 'song-unmapped-id');
    assert.equal(result.lines.length, 1);

    // Verify in-memory store is updated
    const inStore = store.getSong('song-unmapped-id');
    assert.ok(inStore);
    assert.equal(inStore.youtubeVideoId, 'yt-vid-fresh-888');

    // Verify transaction log contains the UPSERT_SONG event
    const logContent = fs.readFileSync(logPath, 'utf8');
    const logLines = logContent.trim().split('\n');
    assert.ok(logLines.length >= 2, 'Should have at least 2 events (initial upsert + youtube mapping)');
    const lastEvent = JSON.parse(logLines[logLines.length - 1]);
    assert.equal(lastEvent.type, 'UPSERT_SONG');
    assert.equal(lastEvent.payload.id, 'song-unmapped-id');
    assert.equal(lastEvent.payload.youtubeVideoId, 'yt-vid-fresh-888');

    // Verify restarting store from log file recovers youtubeVideoId
    const store2 = new Store();
    store2.initStore(logPath);
    const reloaded = store2.getSong('song-unmapped-id');
    assert.ok(reloaded);
    assert.equal(reloaded.youtubeVideoId, 'yt-vid-fresh-888');
    store2.close();
  } finally {
    store.close();
    fs.rmSync(path.dirname(logPath), { recursive: true, force: true });
  }
});

test('mapSongToYouTube - handles quota exceeded (HTTP 403) gracefully without crashing and preserves song in store', async () => {
  const logPath = createTempLogPath();
  const store = new Store();
  store.initStore(logPath);

  try {
    const unmappedSong: SongKaraokeTrack = {
      id: 'song-quota-fail',
      title: 'Quota Exceeded Song',
      driveMd5Checksum: 'md5-quota',
      lines: [],
    };
    store.upsertSong(unmappedSong);

    const quotaError: any = new Error('Daily quota exceeded');
    quotaError.code = 403;
    quotaError.status = 403;

    const mockYouTube = {
      search: {
        list: async () => {
          throw quotaError;
        },
      },
    };

    const result = await mapSongToYouTube('song-quota-fail', {
      store,
      youtubeClient: mockYouTube,
    });

    // Should return original song without crashing
    assert.ok(result);
    assert.equal(result.id, 'song-quota-fail');
    assert.equal(result.youtubeVideoId, undefined);

    // Store should remain intact
    const inStore = store.getSong('song-quota-fail');
    assert.ok(inStore);
    assert.equal(inStore.youtubeVideoId, undefined);
  } finally {
    store.close();
    fs.rmSync(path.dirname(logPath), { recursive: true, force: true });
  }
});
