# Spec Brief: Karaoke Core (Database-less Architecture)

## 1. Intent
Build a long-running Node.js web application that serves a Classic Karaoke experience (word-by-word highlighting). The application ingests `.docx` and `.rtf` files from a specified Google Drive folder, parses lyrics and chords, and maps them to YouTube video IDs.

## 2. Strategic Boundaries
- **In Scope:**
  - Secure in-memory ingestion and extraction of DOCX/RTF files via `googleapis` (Service Account auth).
  - In-memory state machine for storing song metadata, mapped YouTube IDs, and lyric timestamps.
  - Append-only JSONL transaction log for persistence.
  - React/Next.js frontend served by a custom Node.js/Express server (to preserve RAM state).
  - Framer Motion animation engine for word-level sync.
- **Out of Scope:**
  - External databases (Postgres, MySQL, Redis).
  - Serverless deployments (Vercel, AWS Lambda).
  - Raft consensus or multi-server High Availability (HA).

## 3. Revalidation Triggers
This spec must be re-evaluated if:
- The total memory footprint of the Drive folder files exceeds 1GB (unlikely for text).
- The deployment environment strictly forces Serverless execution.
