import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  Store,
  initStore,
  upsertSong,
  getSong,
  getAllSongs,
  deleteSong,
  close,
  type SongKaraokeTrack,
  type TransactionEvent,
} from '../src/server/store.ts';

function createTempLogPath(subfolder = ''): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'karaoke-store-test-'));
  if (subfolder) {
    return path.join(tmpDir, subfolder, 'data.jsonl');
  }
  return path.join(tmpDir, 'data.jsonl');
}

const mockSong1: SongKaraokeTrack = {
  id: 'drive-file-1',
  driveMd5Checksum: 'md5-checksum-1',
  youtubeVideoId: 'yt-12345',
  lines: [
    {
      lineIndex: 0,
      start: 1.0,
      end: 4.5,
      chord: 'Am',
      words: [
        { text: 'Hello', start: 1.0, end: 2.0 },
        { text: 'World', start: 2.5, end: 4.5 },
      ],
    },
  ],
};

const mockSong2: SongKaraokeTrack = {
  id: 'drive-file-2',
  driveMd5Checksum: 'md5-checksum-2',
  youtubeVideoId: 'yt-67890',
  lines: [
    {
      lineIndex: 0,
      start: 5.0,
      end: 8.0,
      words: [
        { text: 'La', start: 5.0, end: 6.0 },
        { text: 'La', start: 6.5, end: 8.0 },
      ],
    },
  ],
};

const mockSong3: SongKaraokeTrack = {
  id: 'drive-file-3',
  driveMd5Checksum: 'md5-checksum-3',
  youtubeVideoId: 'yt-abcde',
  lines: [
    {
      lineIndex: 0,
      start: 0.0,
      end: 3.0,
      words: [{ text: 'Intro', start: 0.0, end: 3.0 }],
    },
  ],
};

test('Store - Inserting songs stores them in memory and lookups return the song', () => {
  const logPath = createTempLogPath();
  const store = new Store();
  store.initStore(logPath);

  try {
    assert.equal(store.getSong('drive-file-1'), undefined);
    assert.deepEqual(store.getAllSongs(), []);

    store.upsertSong(mockSong1);

    assert.deepEqual(store.getSong('drive-file-1'), mockSong1);
    assert.deepEqual(store.getAllSongs(), [mockSong1]);

    store.upsertSong(mockSong2);
    assert.deepEqual(store.getSong('drive-file-2'), mockSong2);
    assert.equal(store.getAllSongs().length, 2);
  } finally {
    store.close();
    fs.rmSync(path.dirname(logPath), { recursive: true, force: true });
  }
});

test('Store - Transactions are synchronously recorded in data.jsonl', () => {
  const logPath = createTempLogPath();
  const store = new Store();
  store.initStore(logPath);

  try {
    store.upsertSong(mockSong1);

    // Verify file exists and has 1 line
    assert.ok(fs.existsSync(logPath));
    const content = fs.readFileSync(logPath, 'utf8').trim();
    const lines = content.split('\n');
    assert.equal(lines.length, 1);

    const event1: TransactionEvent = JSON.parse(lines[0]);
    assert.equal(event1.type, 'UPSERT_SONG');
    assert.deepEqual(event1.payload, mockSong1);
    assert.ok(event1.timestamp);
    assert.ok(!Number.isNaN(Date.parse(event1.timestamp)));

    // Upsert song 2 and delete song 1
    store.upsertSong(mockSong2);
    const deleted = store.deleteSong('drive-file-1');
    assert.equal(deleted, true);

    const contentAfter = fs.readFileSync(logPath, 'utf8').trim();
    const linesAfter = contentAfter.split('\n');
    assert.equal(linesAfter.length, 3);

    const event2: TransactionEvent = JSON.parse(linesAfter[1]);
    assert.equal(event2.type, 'UPSERT_SONG');
    assert.deepEqual(event2.payload, mockSong2);

    const event3: TransactionEvent = JSON.parse(linesAfter[2]);
    assert.equal(event3.type, 'DELETE_SONG');
    assert.equal(event3.payload.id, 'drive-file-1');
  } finally {
    store.close();
    fs.rmSync(path.dirname(logPath), { recursive: true, force: true });
  }
});

test('Store - test_transaction_log_recovery: 3 updates, simulate restart, verify accurate state', () => {
  const logPath = createTempLogPath();
  const store1 = new Store();
  store1.initStore(logPath);

  try {
    // 1st update: upsert song 1
    store1.upsertSong(mockSong1);
    // 2nd update: upsert song 2
    store1.upsertSong(mockSong2);
    // 3rd update: modify song 1 with YouTube ID
    const song1Updated: SongKaraokeTrack = {
      ...mockSong1,
      youtubeVideoId: 'yt-recovered-123',
    };
    store1.upsertSong(song1Updated);

    assert.equal(store1.getAllSongs().length, 2);
    assert.equal(store1.getSong('drive-file-1')?.youtubeVideoId, 'yt-recovered-123');
  } finally {
    store1.close();
  }

  // Restart simulation: New instance loads from logPath
  const store2 = new Store();
  store2.initStore(logPath);

  try {
    const all = store2.getAllSongs();
    assert.equal(all.length, 2);
    assert.deepEqual(store2.getSong('drive-file-1'), {
      ...mockSong1,
      youtubeVideoId: 'yt-recovered-123',
    });
    assert.deepEqual(store2.getSong('drive-file-2'), mockSong2);
  } finally {
    store2.close();
    fs.rmSync(path.dirname(logPath), { recursive: true, force: true });
  }
});

test('Store - Replay supports UPDATE_TIMESTAMPS and skips corrupted lines gracefully', () => {
  const logPath = createTempLogPath();
  const store1 = new Store();
  store1.initStore(logPath);

  try {
    store1.upsertSong(mockSong1);
  } finally {
    store1.close();
  }

  // Manually append UPDATE_TIMESTAMPS, empty line, and a corrupted JSON line
  const timestampUpdateEvent: TransactionEvent = {
    type: 'UPDATE_TIMESTAMPS',
    payload: {
      id: 'drive-file-1',
      lines: [
        {
          lineIndex: 0,
          start: 2.0,
          end: 6.0,
          words: [{ text: 'Shifted', start: 2.0, end: 6.0 }],
        },
      ],
    },
    timestamp: new Date().toISOString(),
  };

  fs.appendFileSync(logPath, '\n\n', 'utf8');
  fs.appendFileSync(logPath, JSON.stringify(timestampUpdateEvent) + '\n', 'utf8');
  fs.appendFileSync(logPath, 'corrupted JSON line {{{ invalid\n', 'utf8');

  // Reload store
  const store2 = new Store();
  store2.initStore(logPath);

  try {
    const song = store2.getSong('drive-file-1');
    assert.ok(song);
    assert.equal(song.lines.length, 1);
    assert.equal(song.lines[0].words[0].text, 'Shifted');
    assert.equal(song.lines[0].start, 2.0);
  } finally {
    store2.close();
    fs.rmSync(path.dirname(logPath), { recursive: true, force: true });
  }
});

test('Store - Automatically creates nested directory for transaction log if not present', () => {
  const logPath = createTempLogPath('nested/sub/folder');
  const store = new Store();
  store.initStore(logPath);

  try {
    store.upsertSong(mockSong3);
    assert.ok(fs.existsSync(logPath));
    assert.deepEqual(store.getSong('drive-file-3'), mockSong3);
  } finally {
    store.close();
    // remove base temp dir
    const baseTempDir = path.resolve(logPath, '../../../..');
    fs.rmSync(baseTempDir, { recursive: true, force: true });
  }
});

test('Store - Module-level singleton functions operate correctly', () => {
  const logPath = createTempLogPath();
  initStore(logPath);

  try {
    assert.equal(getSong('drive-file-1'), undefined);
    upsertSong(mockSong1);
    assert.deepEqual(getSong('drive-file-1'), mockSong1);
    assert.deepEqual(getAllSongs(), [mockSong1]);

    const deleted = deleteSong('drive-file-1');
    assert.equal(deleted, true);
    assert.equal(getSong('drive-file-1'), undefined);
    assert.deepEqual(getAllSongs(), []);

    const deletedAgain = deleteSong('non-existent');
    assert.equal(deletedAgain, false);
  } finally {
    close();
    fs.rmSync(path.dirname(logPath), { recursive: true, force: true });
  }
});
