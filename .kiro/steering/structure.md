# Architecture Structure & Anti-Duplication Standards

## Canonical Directory Structure (Single Source of Truth)

```
project_root/
├── .kiro/
│   ├── steering/              # Project-wide policies & standards
│   └── specs/                 # Feature specifications
│       └── <feature-name>/
│           ├── brief.md
│           ├── requirements.md
│           ├── design.md
│           ├── tasks.md
│           └── spec.json
├── src/                       # Production application source code
│   ├── server/
│   └── components/
├── test/                      # Tests mirroring src/ 1:1
├── scripts/                   # Canonical automation & maintenance scripts
├── logs/                      # Machine-readable telemetry (.jsonl)
├── docs/                      # Documentation, specs, and audits
│   └── audit/                 # Archived test reports & manifests
├── public/                    # Static assets & web client
└── data/                      # Structured catalogs & data files
```

## Anti-Duplication Rules
1. **1:1 Mirroring:** A source file at `src/foo/bar.ts` MUST have its corresponding test at `test/foo/bar.test.ts`. Duplicate naming styles (`bar_test.js`, `test_bar.ts`, `barTest.ts`) are strictly forbidden.
2. **Pre-Creation Verification:** Before creating any new file with `write_to_file`, agents must verify whether an equivalent file exists in `src/`, `test/`, or `scripts/`.
3. **No Root Clutter:** No scratch files, test dumps, or temporary scripts are permitted in the project root. Temporary work must live in `scratch/` or `.tmp/`.
4. **Boundary Isolation:** Tasks in `tasks.md` must strictly define `_Boundary:_`. Any file modified or created outside this boundary will cause the review gate to reject the task.
