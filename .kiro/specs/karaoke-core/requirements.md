# Requirements: Karaoke Core

## 1. Goal
Provide a functional, testable set of requirements for the In-Memory Karaoke application.

## 2. EARS Requirements

### Ingestion & Security
- **REQ-1**: While ingesting files from Google Drive, the system MUST stream binary `.docx` files directly into memory without writing to the local disk.
- **REQ-2**: If an ingested document stream exceeds 5MB, the system MUST abort the stream and log a decompression bomb security warning.
- **REQ-3**: When parsing XML from `.docx` packages, the system MUST use a safe parser (e.g., `mammoth`) that does not expand external DTD entities.

### In-Memory Datastore & Transaction Log
- **REQ-4**: When the server starts, it MUST load all song mappings and timestamps from a local `data.jsonl` file into a global RAM state map.
- **REQ-5**: Whenever a song is mapped to a new YouTube Video ID, the system MUST synchronously append the update to `data.jsonl` before responding to the client.
- **REQ-6**: The system MUST run as a persistent Node.js process to maintain the in-memory state map across client requests.

### Client Playback & Sync
- **REQ-7**: While a YouTube video is playing, the frontend MUST NOT use React state (`setState`) to update the playback time.
- **REQ-8**: The frontend MUST bind the video's current playback time to a Framer Motion `MotionValue` via `requestAnimationFrame`.
- **REQ-9**: If a word's timestamp matches the current `MotionValue`, the UI MUST visually fill the word using a CSS clipping or gradient technique.

## 3. Acceptance Criteria (TDD Targets)
- `test_docx_zip_slip_rejection`: A mocked `.docx` file containing a path traversal entry throws a specific `SecurityException`.
- `test_transaction_log_recovery`: Writing 3 updates to the in-memory store, killing the process, and restarting correctly loads the exact final state from `data.jsonl`.
- `test_framer_motion_zero_renders`: The React profiler shows 0 component re-renders while the video time advances from 0s to 10s.
