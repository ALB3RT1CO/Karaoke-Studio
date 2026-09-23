# System Design: Karaoke Core

## 1. Goal
Provide the technical blueprint and boundary commitments for the in-memory karaoke web application, ensuring a secure ingestion pipeline and a zero-re-render Framer Motion sync engine.

## 2. File Structure Plan & Boundaries

### 2.1 Backend (Ingestion & State)
- `src/server/store.ts`: **Boundary**: Holds the global `inMemoryState` and `transactionLog` appender. Must not be imported by any client-side React components.
- `src/server/ingestion/drive.ts`: **Boundary**: Handles Google Drive API logic. Depends on `store.ts`.
- `src/server/ingestion/docx.ts`: **Boundary**: Pure functions using `mammoth` to extract text from buffers. Includes Zip Slip and Zip Bomb guards.

### 2.2 Frontend (Next.js & Sync)
- `src/app/page.tsx`: **Boundary**: Next.js Server Component. Fetches initial song list from `store.ts` (via local API call or direct import if running in a custom Node server).
- `src/components/KaraokePlayer.tsx`: **Boundary**: Client component. Mounts YouTube IFrame. Updates `currentTime` MotionValue.
- `src/components/KaraokeWord.tsx`: **Boundary**: Client component. Receives `WordTiming` and `currentTime`. Handles local CSS fill animation via `useTransform`.

## 3. Data Models

### 3.1 In-Memory State & Transaction Log
```typescript
interface InMemoryState {
  songs: Record<string, SongKaraokeTrack>;
  // Key: Drive File ID -> Value: Parsed Track Data
}

// Appended to data.jsonl
interface TransactionEvent {
  type: 'UPSERT_SONG' | 'DELETE_SONG' | 'UPDATE_TIMESTAMPS';
  payload: any;
  timestamp: string;
}
```

### 3.2 Enhanced LRC JSON (Word-Level Timing)
```typescript
interface WordTiming {
  text: string;
  start: number; // Seconds
  end: number;   // Seconds
}

interface LyricLine {
  lineIndex: number;
  start: number;
  end: number;
  chord?: string; // e.g. "rem" or "sim-Capo"
  words: WordTiming[];
}

interface SongKaraokeTrack {
  id: string; // Drive File ID
  driveMd5Checksum: string;
  youtubeVideoId?: string;
  lines: LyricLine[];
}
```

## 4. Security & Quota Architecture
- **Zip Slip Guard**: `src/server/ingestion/docx.ts` will strictly process `word/document.xml` in-memory. No file writes to disk during extraction.
- **Decompression Bomb Guard**: `stream.pipeline` limits read bytes to 5MB.
- **YouTube Quota**: Caching mapped `youtubeVideoId`s in `data.jsonl` prevents re-searching the same song twice. Searches only happen for new or updated drive files.
