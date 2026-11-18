# FAILURES (defects, severity P0-P3)

## Baseline (captured 2026-11-18, SHA 816c9a7) — before any fixes

Evidence: `docs/evidence/P0/*.log`

| ID | Sev | Defect | Evidence | Status |
|----|-----|--------|----------|--------|
| BASE-01 | P0 | `bun run build` fails: `@zenuxs/schema` (Zod v4 `z.record()` needs 2 args), then cascades into providers/lsp/engine/plugin-sdk/studio | build.log | OPEN |
| BASE-02 | P0 | `bun run --cwd apps/cli build` fails: zenuxs-hub webview missing exports from `@cline/core`/`@cline/llms`/`@cline/shared` browser bundles | cli-build.log | OPEN |
| BASE-03 | P0 | `bun run --cwd apps/cli typecheck` fails: 15 errors (missing `node:sqlite`, `@zenuxs/engine`, renamed Cline types, etc.) | cli-typecheck.log | OPEN |
| BASE-04 | P0 | `bun run build:extension` fails (exit 2) | ext-build.log | OPEN |
| BASE-05 | P1 | CLI unit tests: 13 files / 30 tests failing (91 files / 714 tests pass) | cli-unit-test.log | OPEN |
| BASE-06 | P1 | Core unit tests: 20 files / 34 tests failing, 1 error (111 files / 1240 tests pass, 4 skipped) | core-unit-test.log | OPEN |
| BASE-07 | P1 | Broken self-reexports `export * as X from "."` cause `Cannot redeclare exported variable` across 75 files | build.log, ext-build.log | OPEN |
| BASE-08 | P1 | `bin` fields in apps/cli point to `src/index.ts` not built `dist/index.js` — published package likely broken | package.json inspection | OPEN |
| BASE-09 | P2 | Several packages still branded `@cline/*` (`core`, `agents`, `shared`, `llms`) and CLI metadata says Cline Bot Inc / cline.bot | package.json inspection | OPEN |

Note: BASE-01 root cause confirmed — multiple zod copies (3.25.76 and 4.4.3); code written for zod 3 API.
