# FAILURES (defects, severity P0-P3)

## Status: ZERO open P0/P1 defects

All baseline defects BASE-01 … BASE-09 and new defects P1-NEW-01 … P1-NEW-04
were fixed and verified by the gate (16/16 steps, exit 0). Historical details:

| ID | Sev | Defect | Resolution | Evidence |
|----|-----|--------|------------|----------|
| BASE-01 | P0 | Root build failed (Zod v3 API vs v4) | Zod v4 migration; build exits 0 | docs/evidence/P1/build-final.log |
| BASE-02 | P0 | CLI build failed (browser bundle missing exports) | browser-safe re-exports; CLI build exits 0 | docs/evidence/P1/build-final.log |
| BASE-03 | P0 | CLI typecheck failed | resolved; typecheck exits 0 | docs/evidence/P1/cli-typecheck-fixed.log |
| BASE-04 | P0 | Extension build failed | resolved | docs/evidence/P1/extension-build-fixed.log |
| BASE-05 | P1 | 30 CLI unit tests failing | all 744 pass | docs/evidence/gate/latest.log |
| BASE-06 | P1 | 34 core unit tests failing | all 1281 pass / 4 skipped | docs/evidence/gate/latest.log |
| BASE-07 | P1 | 44 broken self-reexports | removed | git history |
| BASE-08 | P1 | CLI bin fields pointed to source | fixed to dist/index.js | apps/cli/package.json |
| BASE-09 | P2 | Cline-era metadata | user-facing rebrand + NOTICE.md; internal @cline/* deps retained for lineage | NOTICE.md |
| P1-NEW-01..04 | P1/P2 | grep context, skills routing, Linux protected dirs, CI timeouts | fixed with regression tests | git history |

Defects found and fixed during the resume run:
- Cut-stream provider failures were fatal: added transient-error retry with regression test.
- Checkpoint metadata fallback wrote manifest on `updated !== true`, causing a duplicate write in one test: narrowed to `updated === false`.
- Checkpoint history was not restorable in headless hosts: fixed metadata persistence path; verified restore plan from real session data.
- Yolo headless runs never terminated on text-only responses: fixed by disabling the completion-tool requirement in yolo mode.
- Headless `--id` resume forced interactive mode: fixed.
- Filesystem tools could write outside the workspace: workspace boundary enforced with regression test.
- Matrix checker could not parse annotated statuses: fixed (threshold unchanged).

No open P0/P1 items remain.
