# FAILURES (defects, severity P0-P3)

## Status: OPEN defects exist (see below)

### RESOLVED-SETTINGS-01 (P1) — provider-settings rewrite dropped unknown fields
Observed: after a headless CLI run, the file at `ZENUXS_PROVIDER_SETTINGS_PATH` is
rewritten with only `{provider, apiKey, model}`; `baseUrl`, `protocol` and `client`
disappear. Repro: write a settings JSON with `baseUrl` pointing to a local fake
provider, run `zenuxs -P openai-compatible ...`, then read the file. Evidence:
`docs/evidence/regenerated/headless.log` (real request went to the default OpenAI
endpoint with the fake key) and `/tmp/regen-providers.json` at review time.
Root cause: Zod `.strip()` removed unknown fields; `baseUrl` itself was already
preserved. Fixed by merging raw on-disk settings into every write and adding
`migrateUnknownFields()` for existing files; `baseUrl` and unknown fields survive a
round-trip. Regression tests: `packages/core/src/services/storage/provider-settings-roundtrip.test.ts`.
L3 evidence: `docs/evidence/F-cfg/l3-settings-roundtrip.log`. The
`ZENUXS_PROVIDER_BASE_URL` override remains as an explicit feature, not a workaround.


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

### OPEN-P2-EXT-01 — Extension reconnect after core kill untested
SecretStorage is now implemented (`AuthService.storeCredential/readCredential/deleteCredential`) with a passing unit check at `tests/scenarios/F-ext/secret-storage.test.mjs`, but the .vsix webview scenario "reconnect after the core process is killed" has no L3 evidence. F-ext remains PARTIAL.

### OPEN-P2-CLI-03/04 — CLI flag gaps
`--disallowed-tools` is accepted but not applied to tool policies; `--attach`, `--no-color`, `--locale` are partially implemented. Rows remain PARTIAL.

### OPEN-P2-AUTO/HOOK/PLUG — reference features not implemented
F-auto-01 (workflow-mode/dwf/expert/goal), F-hook-01 (hook trust digest), F-plug-01 (plugin marketplaces) are MISSING in the target; recorded honestly rather than excluded.
