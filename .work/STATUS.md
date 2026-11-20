# STATUS — HANDOFF (2026-11-20 recovery run)

**Completion condition NOT MET.** STATUS is deliberately not COMPLETE.

## Gate
`bash scripts/gate.sh`: 16/17 steps pass; `matrix:check` exits 1.
Evidence: `docs/evidence/gate/latest.log`.
All build, typecheck, unit suites (747 CLI + core + engine + schema), VSIX build/install,
fake-provider smoke, evidence regeneration (18 scenarios with fail-closed guards),
TUI PTY and security checks pass.

## Matrix
37 rows: 29 VERIFIED with regenerated L3 evidence on current HEAD, 2 BLOCKED with
evidence (F-prov, F-toolrobust — live provider quota), 6 open gaps:
- F-ext PARTIAL: extension reconnect after core kill untested (SecretStorage now implemented + unit-tested)
- F-cli-03 PARTIAL: `--disallowed-tools` accepted but not applied to tool policies
- F-cli-04 PARTIAL: `--attach`, `--no-color`, `--locale` partially implemented
- F-auto-01 MISSING: workflow-mode/dwf/expert/goal
- F-hook-01 MISSING: hook trust digest
- F-plug-01 MISSING: plugin marketplaces

## Fixes in this run
- P0 symlink/hardlink/race escape (read/write/edit/patch/glob/RAG, 9 regression tests, L3 denial of reviewer's exact repro).
- P1 headless `--id` resume (bisected to 237ba51); single session + preserved history, L3 regression scenario.
- P1 CLI unit mock (`toCompactionJsonEvent`) and runAgent call-shape regression.
- P1 provider-settings round-trip dropping `baseUrl` recorded as OPEN-SETTINGS-01 (pending); explicit `ZENUXS_PROVIDER_BASE_URL` override added.
- Evidence regeneration script with per-scenario isolated config/home dirs, explicit base-URL override, and fail-closed fake-provider request guards.
- Matrix reconciled from regenerated evidence + code; BLOCKED status allowed only with BLOCKED.md pointer.
- Extension SecretStorage store/get/delete implemented with unit check.
- Reviewer agent definition created with a working model (`~/.zcode/agents/independent-reviewer.md`) — subagent model list is cached in this session, so the fresh review must run in a new session.
- Live models probed: glm retired; deepseek/mimo 429; big-pickle/beam/hy4 answer tiny completions but full CLI-shaped runs timed out (BLOCKED.md proof).

## Next actions
1. Close the six open matrix rows above.
2. Fix OPEN-SETTINGS-01 (settings round-trip preserves `baseUrl` and unknown fields).
3. Live provider retry after quota reset; promote F-prov/F-toolrobust only on live evidence.
4. Re-run `scripts/gate.sh` to exit 0, then run the independent reviewer in a NEW session using `.work/REVIEW_BRIEF.md` and the `independent-reviewer` agent.
5. Set STATUS COMPLETE only when gate is green and the review has no P0/P1 findings.

No destructive actions or real secrets were used. Nothing was claimed VERIFIED without regenerated evidence on HEAD.
