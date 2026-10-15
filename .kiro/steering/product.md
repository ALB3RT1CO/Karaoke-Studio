# Product Strategy & Principles - Karaoke Studio

## Vision
Build a reliable, high-performance, local-first web application for karaoke singing, lyric synchronization, and backing track playback. Engineered using Spec-Driven Development (SDD) executed by autonomous AI agents with strict quality gates, zero hallucinated state, and real-time audio-lyric precision.

## Core Directives
1. **Spec-Driven Autonomy:** Code is never written without an approved specification (`requirements.md` -> `design.md` -> `tasks.md`).
2. **Quality Before Speed:** Every line of code is guarded by Test-Driven Development (TDD) and verified by fresh execution evidence.
3. **Fluid 60fps Experience:** Zero UI stutter during lyric fill. Use native CSS variables and optimized animation loops over heavy framework overhead.
4. **Resilient Data Persistence:** Append-only transaction logging (`data.jsonl`) guarantees that manual timestamp taps and automated alignments are permanently preserved.
5. **Auditability & Zero Regressions:** All subagent actions and test outcomes produce structured machine-readable telemetry (`logs/automation_results.jsonl`).
