import fs from 'node:fs';
import path from 'node:path';

export interface WordTiming {
  text: string;
  start: number; // Seconds
  end: number;   // Seconds
}

export interface LyricLine {
  lineIndex: number;
  start: number;
  end: number;
  chord?: string; // e.g. "rem" or "sim-Capo"
  words: WordTiming[];
}

export interface SongKaraokeTrack {
  id: string; // Drive File ID
  title?: string;
  driveMd5Checksum: string;
  youtubeVideoId?: string;
  lines: LyricLine[];
}

export interface InMemoryState {
  songs: Record<string, SongKaraokeTrack>;
}

export interface TransactionEvent {
  type: 'UPSERT_SONG' | 'DELETE_SONG' | 'UPDATE_TIMESTAMPS';
  payload: any;
  timestamp: string;
}

export class Store {
  private logPath: string;
  private state: InMemoryState;

  constructor(defaultLogPath: string = path.resolve(process.cwd(), 'data.jsonl')) {
    this.logPath = defaultLogPath;
    this.state = { songs: {} };
  }

  public initStore(logPath?: string): void {
    if (logPath) {
      this.logPath = logPath;
    }

    this.state = { songs: {} };

    const dir = path.dirname(this.logPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(this.logPath)) {
      return;
    }

    const content = fs.readFileSync(this.logPath, 'utf8');
    const lines = content.split('\n');

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      try {
        const event: TransactionEvent = JSON.parse(line);
        this.applyEvent(event);
      } catch (err) {
        console.warn(`[Store] Skipping unparseable transaction log line: ${line}`, err);
      }
    }
  }

  private applyEvent(event: TransactionEvent): void {
    switch (event.type) {
      case 'UPSERT_SONG': {
        const song: SongKaraokeTrack = event.payload;
        if (song && song.id) {
          this.state.songs[song.id] = song;
        }
        break;
      }
      case 'DELETE_SONG': {
        const id = typeof event.payload === 'string' ? event.payload : event.payload?.id;
        if (id) {
          delete this.state.songs[id];
        }
        break;
      }
      case 'UPDATE_TIMESTAMPS': {
        const payload = event.payload;
        if (payload?.id && this.state.songs[payload.id]) {
          this.state.songs[payload.id].lines = payload.lines;
        }
        break;
      }
      default:
        console.warn(`[Store] Unknown event type: ${(event as any).type}`);
    }
  }

  private appendEvent(event: TransactionEvent): void {
    const dir = path.dirname(this.logPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.appendFileSync(this.logPath, JSON.stringify(event) + '\n', 'utf8');
  }

  public upsertSong(song: SongKaraokeTrack): void {
    this.state.songs[song.id] = song;
    const event: TransactionEvent = {
      type: 'UPSERT_SONG',
      payload: song,
      timestamp: new Date().toISOString(),
    };
    this.appendEvent(event);
  }

  public getSong(id: string): SongKaraokeTrack | undefined {
    return this.state.songs[id];
  }

  public getAllSongs(): SongKaraokeTrack[] {
    return Object.values(this.state.songs);
  }

  public deleteSong(id: string): boolean {
    if (!(id in this.state.songs)) {
      return false;
    }
    delete this.state.songs[id];
    const event: TransactionEvent = {
      type: 'DELETE_SONG',
      payload: { id },
      timestamp: new Date().toISOString(),
    };
    this.appendEvent(event);
    return true;
  }

  public close(): void {
    // Synchronous file appending does not keep persistent open handles,
    // but close hook is provided for lifecycle management and future stream adapters.
  }
}

// Global default singleton instance
export const defaultStore = new Store();

export function initStore(logPath?: string): void {
  return defaultStore.initStore(logPath);
}

export function upsertSong(song: SongKaraokeTrack): void {
  return defaultStore.upsertSong(song);
}

export function getSong(id: string): SongKaraokeTrack | undefined {
  return defaultStore.getSong(id);
}

export function getAllSongs(): SongKaraokeTrack[] {
  return defaultStore.getAllSongs();
}

export function deleteSong(id: string): boolean {
  return defaultStore.deleteSong(id);
}

export function close(): void {
  return defaultStore.close();
}
