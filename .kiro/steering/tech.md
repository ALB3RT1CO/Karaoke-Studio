# Technology Stack & Tooling

## Runtime & Languages
- **Node.js:** v22+ / v26+ (ES Modules, native test runner `node --test`).
- **TypeScript:** Strict type checking with `tsx` execution.
- **Python (Optional for ML):** Python 3.10+ for audio ML forced alignment (`yt-dlp`, `whisper-timestamped`).

## Testing Framework
- **Primary Test Runner:** `node --test` with built-in assertion module (`node:assert/strict`).
- **Test Reporters:**
  - Standard console reporter for rapid feedback.
  - `--test-reporter=junit --test-reporter-destination=test-report.xml` for CI/CD and AI parsing.
  - `--test-reporter=tap` for streaming log ingestion.

## Telemetry & Logging
- **Automation Log:** `logs/automation_results.jsonl` (Append-only JSON-L event stream).
- **Audit Manifest:** `docs/audit/audit-manifest.json`.
- **Subagent Transcripts:** Captured under system brain logs and archived on gate completion.
