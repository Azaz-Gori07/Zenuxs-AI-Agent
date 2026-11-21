# Fresh independent adversarial review — findings

## Scope / identity of reviewed artifact
- **Branch**: `fix/zenuxs-recovery`
- **SHA reviewed**: `e1e51d36c1921a1d01466b9fb501cca29669fc24` (`e1e51d3 chore(evidence): gate-green evidence on review-fix HEAD`)
- **Working tree at start**: clean (`git status --short` empty). Running the gate regenerated evidence files in the working tree (uncommitted) — expected; the reviewed, committed artifact is `e1e51d3`.
- Reviewer did not write product code, did not fix anything, and did **not** set STATUS to COMPLETE.

## Commands run (with results)
1. `git log -1 --oneline` → `e1e51d3 ...`; `git status --short` → clean; `git branch --show-current` → `fix/zenuxs-recovery`.
2. `export PATH="$HOME/.bun/bin:$PATH"; bun install --frozen-lockfile; bun run build && bun run build:extension; bash scripts/gate.sh` → **GATE_EXIT=0**, all 17 steps `PASS`, `=== FAILURES: 0 ===`. Steps: install, build, typecheck:cli/schema/engine, build:extension, vsix:build-install, test:unit:cli, test:unit:core, test:unit:engine, test:unit:schema, fake-provider:smoke, evidence:regenerate, tui:pty, security:check, matrix:reconcile, matrix:check.
3. `node scripts/reconcile-matrix.mjs --check` → exit 0; `{sha:e1e51d3..., rows:37, counts:{VERIFIED:35, BLOCKED:2}}`.
4. `node scripts/check-matrix.mjs` → exit 0; `problems: []`; SHA `e1e51d3`; 37 rows (35 VERIFIED, F-prov + F-toolrobust BLOCKED).
5. `node scripts/security-check.mjs` → exit 0, `problems: []`. `node scripts/security-check.test.mjs` → exit 0. Combined `node scripts/security-check.mjs && node scripts/security-check.test.mjs` → exit 0.
6. Security fail-closed repro (temp `ZENUXS_SECURITY_ROOT`, no product files touched):
   - leaked `ZCODE_OFFICIAL_ENDPOINT_TOKEN` in `apps/leak.ts` → exit 1 (`matches /ZCODE_OFFICIAL_ENDPOINT_TOKEN/`).
   - `sk-REDACTED-EXAMPLE` in `apps/key.ts` → exit 1 (`matches live API key pattern`).
   - only `Z.AI api.z.ai` + `foo.cline.bot` in `apps/ok.ts` → exit 0 (prior false positives gone).
   - tampered copy with `const forbidden = []` → exit 1 (`security-check self-test failed: detection patterns are not active`).
7. `git grep` over tracked `apps|packages|scripts` for reference markers / key shapes → only the intentional canary at `scripts/security-check.mjs:108`.
8. `git ls-files -s | awk '$1==120000'` → no tracked symlinks (no stray `escape -> /escape`). `git ls-files config.json` → NOT TRACKED; `.gitignore:55` contains `config.json`.
9. Runtime `clearFields` check (temp script, `migrateUnknownFields(file, ["weirdFlag"])`) → `changed=1`; `weirdFlag present? false`; unrelated unknown `customThing` preserved; `baseUrl` preserved. (`provider-settings-manager.ts:59`.)
10. Runtime plugin symlink-confinement check (temp descriptor with `path:"escape"` symlink to an outside dir) → `blocked with error: symlink escapes its root: escape`, `ESCAPED? false`. (`plugin-exchange.ts:86-102`.)
11. Gate-history integrity: `git diff b658202..HEAD -- scripts/gate.sh` → only steps added (`vsix:build-install`, `tui:pty`, `evidence:regenerate`, `tui:pty`/`security:check`, `matrix:reconcile`), no step removed. `check-matrix.mjs` rewritten but `reconcile-matrix.mjs:buildMatrix()` can emit only VERIFIED/BLOCKED/MISSING, so the removed strict `status!==VERIFIED` check cannot admit BROKEN/PARTIAL/IMPLEMENTED; MISSING/PARTIAL are still rejected and BLOCKED still requires `.work/BLOCKED.md` (`check-matrix.mjs:20-30`). `security-check.mjs` history: introduced `b658202`, hardened in `ab928ec` (added `process.exit(1)`), no threshold lowered since.

## Prior P1 — CLOSED
**Prior P1: F-sec-01 VERIFIED was false assurance** — `scripts/security-check.mjs` reported 19 violations but always exited 0, and its patterns produced Z.AI / `*.cline.bot` false positives.
- Now **FAILS CLOSED**: `scripts/security-check.mjs:116` `if (problems.length > 0) process.exit(1)`. Patterns scoped to unambiguous reference markers (`ZCODE_OFFICIAL_ENDPOINT_TOKEN`, `zcode.cjs`, `zcode.bot`) + live key shapes (`:20-26`); false positives removed (repro 5/6 above).
- Positive control (`:107-113`) requires exactly 4 detections; a fixed-count canary plus `scripts/security-check.test.mjs:15-41` prove that disabling the patterns makes the checker fail (repro 6).
- **Gate cannot be toothless**: `scripts/gate.sh:66` runs both checks under `run_step` (which records real exit codes, `:23-42`); `A && B` propagates a non-zero exit; gate then increments FAILURES and `status.json.failures > 0`. Any leakage → security step fails → gate fails. Verified live (gate step `security:check:0`, and direct fail-closed repro 6).
- **F-sec-01 VERIFIED is now honest**: its evidence is `docs/evidence/gate/status.json`, which after this gate run contains `{sha:e1e51d3..., failures:0}`; `check-matrix.mjs` only accepts it as VERIFIED when the gate (incl. strict security check) is green. Confirmed in the regenerated matrix.

## Prior P2s — CLOSED
- **Reserved marketplace self-certification**: `plugin-exchange.ts:192-204` rejects a descriptor claiming `publisherType:"official"` unless `trustedOfficial:true` is passed by a trusted caller. CLI `plugins marketplace add` (`apps/cli/src/commands/plugins-exchange.ts:27`) passes only `(descriptor, id)` — never the option. Regression test `plugin-exchange.test.ts:47-62` asserts rejection and trusted opt-in. (Static + code-path verified.)
- **Flow steps hardcoding provider/model/key/auto-approve**: `apps/cli/src/commands/flow.ts:27-48` `runAgentStep` spawns the CLI with only `[entry, "--json", prompt]`, `env: process.env`, `cwd: process.cwd()` — no provider/model/key/auto-approve. FlowRunner carries only `prompt` (`flow-runner.ts:9-16, 100-108, 200-210`). A flow cannot switch providers or bypass approval via step data.

## Prior P3s — CLOSED
- **`clearFields` unknown-field removal**: `provider-settings-manager.ts:59` excludes any key listed in `clearFields` from raw re-injection; `:222` deletes cleared keys from the merge. Runtime repro 9 confirms an unknown field named in `clearFields` is removed while other unknown fields and `baseUrl` survive.
- **Plugin path symlink confinement**: `plugin-exchange.ts:86-102` checks lexical `relative` **and** `realpathSync`-resolved relative, throwing on either escape. Runtime repro 10 confirms an escaping symlink is refused.
- **Stray `escape` symlink**: no tracked symlinks (repro 8); no `escape` path on disk.

## Full-surface re-attack (per brief)
- **Matrix honesty**: `reconcile-matrix.mjs --check` and `check-matrix.mjs` both exit 0 on SHA `e1e51d3`; matrix regenerated by the gate's real-CLI `evidence:regenerate` step with per-case guards (`regenerate-evidence.sh:36-63`); no MISSING/PARTIAL/BROKEN/IMPLEMENTED rows; F-prov/F-toolrobust are BLOCKED with `.work/BLOCKED.md` pointer + `scripts/verify-live.sh` and `verify-live.log` shows `=== LIVE_VERIFY: BLOCKED ===` (no PASS without live evidence). No evidence of hand edits.
- **Gate integrity in git history**: see repro 11 — no test deleted, no threshold lowered, no failure ignored; `status.json` is written before matrix steps but records all prior step failures (`failures`), so a failed step cannot be masked by matrix evidence.
- **Hook trust**: `hook-governance.ts:51-95` fails closed on policy `deny`, corrupt store, revoked, stale, and pending; `execute()` (`:151-208`) re-authorizes and never spawns when `runnable=false`. Flow path calls `authorizeHook` then `executeHook` only when runnable (`flow-runner.ts:223-241`) and `execute` re-checks — no bypass via flow. Plugin hooks are declarations only (`plugin-exchange.ts:353-368`) and are never fed to an execution path (`hooksFor` used only by the read-only `plugins hooks` CLI), so community hooks cannot run. Security tests in `hook-governance.test.ts` and the gate's L3 `F-hook-01/l3-governance.log` regenerate successfully.
- **CLI flags**: L3 `cli-flags.log` regenerated with `--disallowed-tools`, `--attach`, `--no-color`, `--locale zh-CN` and checks `run_result` + `"locale":"zh-CN"` from `doctor --json`; unit test `main.test.ts:558` asserts no `\x1b[` with `--no-color`. All green.
- **Extension reconnect**: `reconnect.json` (regenerated at HEAD) records `core disposed (reset_done)`, `core re-initialized after kill` (init count 0→1), a fresh session id, and a completed turn after reconnect with the fake provider serving both phases — proves core dispose/recreate, not just UI survival.
- **Permissions/symlinks**: gate's `F-perm/symlink.sh` scenario and realpath-based boundary checks are exercised in `evidence:regenerate`; no tracked symlink escape.
- **Secrets/branding**: repro 7/8 — no credential values or reference markers in tracked product files; `config.json` untracked and ignored; no ZCode branding/endpoints in shipped source.

## Findings by severity

### P0 — none
### P1 — none. **There are ZERO open P0/P1 findings on HEAD `e1e51d3`.**
### P2 — none
### P3 — one non-blocking observation (behavior verified correct)
- **No dedicated regression test locks in `clearFields` removal of an *unknown* field.** The fix at `provider-settings-manager.ts:59` is present and I verified the behavior at runtime (repro 9), and `provider-settings-roundtrip.test.ts` covers unknown-field preservation generally — but no test asserts that naming an unknown field in `clearFields` actually removes it. A future refactor of `mergePreservingUnknown` could silently regress it. This does not affect correctness on the reviewed HEAD and is not a blocker; adding one `it(...)` would close it.

## Conclusion
All prior review findings (P1 security false-assurance; P2 marketplace self-certification and flow provider/key/auto-approve hardcoding; P3 clearFields, symlink confinement, stray symlink) are **closed and independently re-verified**. Build, gate (17/17), matrix checks, and security fail-closed behavior all pass on `e1e51d3`. No open P0/P1. The only remaining note is a P3 test-coverage suggestion above; it does not gate completion.
