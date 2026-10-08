# Testing & Verification Standards (TDD)

## Test-Driven Development (TDD) Protocol
1. **RED Phase:** Write the test first. Run the test command and record the failing output (`RED_PHASE_OUTPUT`) with a non-zero exit code. The failure must prove that the missing behavior is tested.
2. **GREEN Phase:** Write the minimal implementation to pass the test. Run the test command and prove `PASS` with exit code 0.
3. **REFACTOR Phase:** Clean up code, remove duplication, and optimize without breaking existing tests.
4. **REVIEW Gate:** An independent reviewer subagent validates test coverage, boundary adherence, and regressions before marking the task complete.

## AI-Friendly Test Output
- Every test run must produce a structured record appended to `logs/automation_results.jsonl`.
- Full-suite runs generate JUnit XML at `test-report.xml` and archive to `docs/audit/test-report.xml`.
- AI analysis tools parse `test-report.xml` and `logs/automation_results.jsonl` to detect flaky tests, regressions, or coverage gaps.

## Verification Gateways
- **G1 (Requirements):** EARS syntax, Acceptance Criteria defined.
- **G2 (Design):** Architectural boundary commitments, zero undeclared coupling.
- **G3 (TDD Red):** Verified failing test evidence.
- **G4 (Peer Review):** Subagent review with `git diff` inspection, zero placeholder markers (`TODO/TBD`), regression safety.
- **G5 (Feature GO):** Full suite pass, runtime smoke test, zero uncovered requirements.
