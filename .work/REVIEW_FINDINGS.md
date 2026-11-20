# Independent review findings

Reviewer: fresh-context independent reviewer (this session did not write the code).
Target: branch `fix/zenuxs-recovery`, HEAD `80653580115beff80efc587f5865395a2508fc58`.
No fixes were made. All findings below were reproduced by building and running the product.

## P0 — Workspace boundary bypass via symlink (read AND write)

The "workspace boundary" protection in `packages/core/src/extensions/tools/path-kind.ts`
uses `path.relative(cwd, absolutePath)` only; it never resolves symlinks. A symlink inside
the workspace pointing outside lets the agent read and write arbitrary files outside the
workspace, despite the regression test that claims the boundary is enforced.

Exact repro (uses the repo's fake provider; all paths under /tmp):
```bash
cd /home/azaz/Projects/Zenuxs-AI-Agent
export PATH="$HOME/.bun/bin:$PATH"
rm -rf /tmp/review-ws /tmp/review-outside && mkdir -p /tmp/review-ws /tmp/review-outside
printf 'SECRET_OUTSIDE\n' > /tmp/review-outside/secret.txt
ln -s /tmp/review-outside /tmp/review-ws/escape
cat > /tmp/review-symlink.json <<'EOF'
{"name":"symlink","steps":[
 {"type":"tool","tool_calls":[{"id":"call_sym","name":"read","arguments":{"path":"escape/secret.txt"}}]},
 {"type":"text","content":"done"}]}
EOF
node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync("tests/fixtures/l3/providers.json","utf8"));p.providers["openai-compatible"].settings.baseUrl="http://127.0.0.1:4331/v1";fs.writeFileSync("/tmp/review-providers.json",JSON.stringify(p,null,2));'
node tests/fake-provider/server.mjs /tmp/review-symlink.json 4331 & FP=$!; sleep 1
ZENUXS_PROVIDER_SETTINGS_PATH=/tmp/review-providers.json CLINE_DIR=/tmp/review-data CLINE_DATA_DIR=/tmp/review-data \
  bun apps/cli/src/index.ts -c /tmp/review-ws -P openai-compatible -m fake-model --auto-approve true --json "read via symlink"
kill $FP
```
Observed: tool result contains `SECRET_OUTSIDE` (file outside workspace was read).
Write variant with `write` tool and `filePath: "escape/owned.txt"` produced
`OWNED_BY_AGENT` in `/tmp/review-outside/owned.txt`. Exit code 0 in both cases.
Impact: arbitrary file read/write outside workspace under auto-approve; defeats F-perm.

## P1 — `--id` headless resume creates a NEW session instead of resuming

`apps/cli/src/main.ts` sets `resumeSessionId` from `--id`, but the headless path still
creates a fresh session. Repro:
```bash
export PATH="$HOME/.bun/bin:$PATH"
node tests/fake-provider/server.mjs tests/fixtures/l3/scenarios/single.json 4331 & FP=$!; sleep 1
rm -rf /tmp/review-resume
E="ZENUXS_PROVIDER_SETTINGS_PATH=/tmp/review-providers.json CLINE_DIR=/tmp/review-resume CLINE_DATA_DIR=/tmp/review-resume"
env $E bun apps/cli/src/index.ts -P openai-compatible -m fake-model --json "first" >/dev/null
SID=$(ls /tmp/review-resume/sessions | head -1)
env $E bun apps/cli/src/index.ts -P openai-compatible -m fake-model --id "$SID" --json "second" >/dev/null
ls /tmp/review-resume/sessions    # two distinct session IDs
kill $FP
```
Observed: two session directories (`1795082307967_kl26n`, `1795082309633_arbav`).
No `session_resumed` event. F-sess is marked VERIFIED with a resume evidence file
from an older HEAD; the claim does not hold on current code.

## P1 — Gate does not pass; a CLI unit test is broken by the new compaction import

I re-ran `bash scripts/gate.sh`: exit 1, 2 failures.
- `test:unit:cli`: `src/runtime/run-agent.test.ts > ... zeros Cline free model costs ...`
  fails with `[vitest] No "toCompactionJsonEvent" export is defined on the "../utils/events"
  mock`. The new helper added in `apps/cli/src/utils/events.ts` was not added to the
  existing mock in the test. 746 tests pass, 1 fails.
- `matrix:check`: 26 VERIFIED, many `stale evidence (source changed after evidence)`
  plus PARTIAL/MISSING rows.

This contradicts any completion claim. Evidence: `docs/evidence/gate/latest.log`.

## P1 — Matrix statuses contradict current code and evidence is mostly stale

- `docs/03-gap-analysis.md` marks F-rag MISSING and F-ctx PARTIAL, although F-rag is
  implemented (`packages/core/src/extensions/rag/`, `zenuxs rag index|search`,
  `codebase_search` tool, 5 unit tests, L3 on 250/1000-file repos) and compaction events
  were surfaced with L3 evidence (`docs/evidence/F-ctx/l3-cli-compaction-event.log`).
  F-ckpt real file restoration is also demonstrated
  (`docs/evidence/F-ckpt/l3-file-restore.log`) but the row remains PARTIAL. The matrix
  under-reports in these cases, which will block the gate even if all code is correct.
- Evidence freshness: of 127 evidence files, 106 contain a SHA and only **1** matches
  current HEAD. 105 of them come from older commits. VERIFIED rows therefore do not
  have evidence on current code (mission R2 violation). Re-running representative
  commands is required; I did not trust the files.

## P2 — Live provider parity remains unverified

Endpoint is live: `/v1/models` returns 12 models; tiny completions with
`mimo-v2.6-flash-free`, `big-pickle`, `hy4-flash-free`, `beam-free` return valid responses.
The announced `glm-5.3-flash-free` is retired (`model_deprecated`). CLI-shaped requests
return `FreeUsageLimitError` 429. F-prov and F-toolrobust are correctly PARTIAL, but this
means the completion condition cannot be met without a quota reset or an alternative key.
Evidence: `docs/evidence/live/l3-headless-live-*.log`.

## P2 — Extension SecretStorage is wired but never used; reconnect untested

`apps/vscode-extension/src/extension.ts:46` calls `authService.setSecretStorage(context.secrets)`,
but `AuthService` only stores the reference (`src/services/auth-service.ts:39,55-56`) and
never calls `store`/`get`/`delete`. No credential is persisted in SecretStorage. The
F-ext row is PARTIAL (correctly); the remaining scenarios (SecretStorage keys, reconnect
after core process kill) are not covered.

## Checks that PASSED under adversarial re-run

- Build: `bun install --frozen-lockfile`, `bun run build`, `bun run build:extension` all exit 0.
- Ctrl-C mid-stream: CLI exits cleanly (exit 0), no unhandled rejection or hang.
- Compaction under real use: with a large two-turn history and a system-prompt marker,
  `type:"compaction"` events appeared on both turns and the marker remained in the
  provider request messages (no critical-instruction loss in this scenario).
- Checkpoint restore in a clean isolated git fixture: file content was restored from
  `MODIFIED_CONTENT` to the checkpoint state (single run count). Multi-run checkpoint
  history only contained run 1 (see F-sess resume defect above).
- RAG: 1000-file index completes; a 5 MB file is skipped by `maxFileBytes`.
- Secrets: no credential-shaped values in tracked files or `config.json` history;
  no rotation required (counts only, no values inspected). `config.json` remains in
  git history, so the scrub command was evidently not run (consistent with R7).
- Gate history: only two steps were added (`vsix:build-install`, `tui:pty`); no step
  removed and no threshold lowered. Matrix checker gained annotated-status parsing and
  evidence-freshness enforcement; the required VERIFIED status and evidence existence
  checks remain.

## Bottom line
I found one P0 security defect and four P1 correctness/integrity defects. The completion
condition is NOT met, and even the submission's own gate currently exits 1.
