# Implementation Tasks: Karaoke Core

## Wave P0: Foundation & Security

### Task 0.1: In-Memory Datastore & Transaction Log [COMPLETED]
- **Status**: Completed via strict TDD (6/6 unit tests passing).
- **Files**: `src/server/store.ts`, `test/store.test.ts`
- **Description**: Implemented `src/server/store.ts` with a global memory map and synchronous append to `data.jsonl`.
- **Boundary**: Server-side only. Pure state management.
- **Verification**: Restarting process reloads state accurately from `data.jsonl`.

### Task 0.2: Secure DOCX Extraction [COMPLETED]
- **Status**: Completed via strict TDD (7/7 unit tests passing).
- **Files**: `src/server/ingestion/docx.ts`, `test/docx.test.ts`
- **Description**: Implemented `src/server/ingestion/docx.ts` using `mammoth`. Enforced 5MB stream ceiling (decompression bomb guard) and in-memory parsing (Zip Slip & XXE safe).
- **Boundary**: Pure extraction utility. No external HTTP calls.
- **Verification**: Rejection on streams/buffers > 5MB, graceful malformed file handling.

## Wave P1: Integration & Mapping

### Task 1.1: Google Drive Ingestion Pipeline [COMPLETED]
- **Status**: Completed via strict TDD (12/12 unit tests passing, 25/25 total repository tests passing).
- **Files**: `src/server/ingestion/drive.ts`, `test/drive.test.ts`
- **Description**: Implemented `src/server/ingestion/drive.ts` using `googleapis` with Service Account. Stream files to Task 0.2 (`docx.ts`) and save to Task 0.1 (`store.ts`).
- **Boundary**: External API integration.
- **Verification**: Correctly routes binary files to stream download and Google Docs to export; handles pagination; incremental sync skips matching MD5 checksums.

### Task 1.2: YouTube Search Mapping & Quota Protection [COMPLETED]
- **Status**: Completed via strict TDD (13/13 unit tests passing, 38/38 total repository tests passing).
- **Files**: `src/server/ingestion/youtube.ts`, `test/youtube.test.ts`
- **Description**: Implemented YouTube Data API search mapping with strict cache-first quota protection. Clean song titles (strip chords/extensions), query single best video match, update store, persist to `data.jsonl`, and gracefully handle quota limits (HTTP 403) and network failures.
- **Boundary**: External API integration. Strictly respects 10k daily quota limit by skipping YouTube search when `youtubeVideoId` already exists.

## Wave P2: Frontend & Sync Engine

### Task 2.1: YouTube IFrame & MotionValue Sync [COMPLETED]
- **Status**: Completed via strict TDD (6/6 unit tests passing in `test/sync.test.ts`, 44/44 total repository tests passing).
- **Files**: `src/components/KaraokePlayer.tsx`, `src/components/KaraokePlayer.ts`, `test/sync.test.ts`
- **Description**: Implemented `src/components/KaraokePlayer.tsx` and `src/components/KaraokePlayer.ts`. Embeds YouTube IFrame with `enablejsapi=1`, maintains a shared `currentTime` Framer Motion `MotionValue`, runs `requestAnimationFrame` polling loop querying player and postMessage time events, and renders active lyric lines and `KaraokeWord` components without triggering `useState` re-renders.
- **Depends**: None (standalone UI component).
- **Boundary**: Client-side React. No DOM manipulation outside React/Framer. Zero `useState` hooks for playback time.

### Task 2.2: Word-Level Karaoke Component [COMPLETED]
- **Status**: Completed via strict TDD (6/6 unit tests passing in `test/sync.test.ts`, 44/44 total repository tests passing).
- **Files**: `src/components/KaraokeWord.tsx`, `src/components/KaraokeWord.ts`, `src/components/syncEngine.ts`, `test/sync.test.ts`
- **Description**: Implemented `src/components/KaraokeWord.tsx`, `src/components/KaraokeWord.ts`, and `src/components/syncEngine.ts`. Handles word progress calculation, gradient generation, Framer Motion `useTransform` and `createWordTransform` fill mapping (0% to 100%), and optional floating chord annotations above words.
- **Depends**: Task 2.1.
- **Boundary**: Client-side React. Zero `useState` hooks for time.
- **Test Target**: Verified 50% fill at exact halfway point, instantaneous seek forward/backward without drift, boundary clamping, and chord annotation rendering.
