# FAILURES (defects, severity P0-P3)

## Status: no open P0/P1 defects

All previously recorded defects are resolved. Historical detail is retained below.

### RESOLVED-SETTINGS-01 (P1) — provider-settings rewrite dropped fields
Observed: after a headless CLI run, `ZENUXS_PROVIDER_SETTINGS_PATH` was rewritten with
only `{provider, apiKey, model}`; `baseUrl`, `protocol`, `client` and unknown fields
disappeared. Root cause: Zod `.strip()` removed unknown fields and the write path did
not merge raw on-disk state.

Fix (commits `49f8f42`, `527ea07`): every provider-settings write goes through
`ProviderSettingsManager`, which merges unknown raw fields on write, migrates existing
files (`migrateUnknownFields`) and preserves `baseUrl`/`protocol`/`client` across routine
saves. Explicitly cleared known fields (`apiKey`, `headers`, `timeout`, …) are carried
through `clearFields` so clearing still works. Regression tests:
`packages/core/src/services/storage/provider-settings-roundtrip.test.ts`,
`provider-settings-manager.test.ts`, `provider-settings-legacy-migration.test.ts` and
`local-provider-service.test.ts` (96/96 passing). The `ZENUXS_PROVIDER_BASE_URL` override
remains as an explicit feature, not a workaround. L3 evidence:
`docs/evidence/regenerated/cli-flags.log`.

### RESOLVED-OPEN-P2-EXT-01 — extension reconnect after core kill
The core is in-process (`backendMode:"local"`); "kill" uses the extension's own
dispose path (`new_session` -> `resetCore` -> `coreBridge.dispose`). L3 evidence in
`docs/evidence/F-ext/reconnect.json` proves a fresh `Extension core runtime initialized`,
a new session id and a successful turn after disposal. Evidence driver:
`tests/extension-e2e/reconnect.cjs`, `tests/scenarios/F-ext/reconnect.sh`.

### RESOLVED-CLI-03/04 — CLI flag gaps
`--disallowed-tools`/`--disallowedTools` now strip `Bash(git *)` patterns and disable
whole tools; `--attach` is repeatable and forwarded as `@"path"` mentions; `--no-color`
removes all ANSI codes; `--locale en-US|zh-CN|auto` is validated and reflected in
`doctor --json`. Regression tests in `apps/cli/src/main.test.ts`, `utils/locale.test.ts`,
`utils/attachments.test.ts`, `utils/output.test.ts`. L3 evidence:
`docs/evidence/regenerated/cli-flags.log`.

### RESOLVED-FEATURES — hook trust / plugin exchange / flow automation
Clean-room features built with original names and structure after a behavior-only study
of the reference (`docs/recon/clean-room-specs.md`):
- F-hook-01: `packages/core/src/governance/hooks/` — digest-bound trust, review/grant/
  revoke, fail-closed corrupt store; an untrusted hook never spawns. Security tests:
  `hook-governance.test.ts` (6 tests). L3: `docs/evidence/F-hook-01/l3-governance.log`.
- F-plug-01: `packages/core/src/extensions/plugin-exchange/` — marketplaces, install/
  enable/validate, reserved-id protection, path confinement; community hooks are listed
  but not runnable until granted through the hook trust store. Security tests:
  `plugin-exchange.test.ts` (7 tests). L3: `docs/evidence/F-plug-01/l3-exchange.log`.
- F-auto-01: `packages/core/src/automation/flows/` — durable flows with hook/plugin/
  agent steps; cannot bypass hook trust or plugin enablement; resume reuses the journal.
  Security tests: `flow-runner.test.ts` (4 tests). L3: `docs/evidence/F-auto-01/l3-flows.log`.

Historical resolved defects (BASE-01..09, P1-NEW-01..04, P0 symlink escape, headless
`--id` resume, CLI unit mock, compaction events, checkpoint restore) remain documented
in git history and `docs/evidence/P0-symlink/`.
