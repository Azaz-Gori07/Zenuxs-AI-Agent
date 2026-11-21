# BLOCKED (environment / human input required)

## Promotion command (run when a working endpoint exists)
```bash
ZENUXS_TEST_BASE_URL=https://... ZENUXS_TEST_API_KEY=... \
ZENUXS_TEST_MODEL=deepseek-v4.1-flash-free bash scripts/verify-live.sh
```
This is the only command allowed to flip F-prov/F-toolrobust to VERIFIED, and only with
real successful CLI evidence (`=== LIVE_VERIFY: PASS ===`). 429s are retried with
exponential backoff; live scenarios use a long timeout (`ZENUXS_LIVE_TIMEOUT_SECONDS`,
default 300s). With no working endpoint it exits 2 and leaves the matrix unchanged.

## 2026-11-19 — Live provider verification (F-prov, F-toolrobust live paths, F-ctx live compaction)
- **Exact error/condition**: `env | grep -iE 'API_KEY|TOKEN|...'` yields only `ZCODE_OFFICIAL_ENDPOINT_TOKEN`. No OpenAI/Anthropic/Gemini/OpenRouter/Ollama endpoint or key is available.
- **Why blocked**: Mission rules forbid using ZCode branding, keys, endpoints or accounts in the target. No other provider credentials exist.
- **Closest alternative**: Deterministic OpenAI-compatible fake provider (`tests/fake-provider/server.mjs`) drives all headless L3 scenarios; fake-provider chaos scenarios cover 429/500/malformed/slow/cut streams. Live-provider checks remain unverified.
- **Affected rows**: F-prov (live provider portion), F-ctx live compaction test, F-toolrobust live portion.

## 2026-11-19 — User-provided live endpoint not visible in this shell
- **Exact error/condition**: `printenv ZENUXS_TEST_BASE_URL`, `printenv ZENUXS_TEST_API_KEY`, `printenv ZENUXS_TEST_MODEL` all return UNSET; `env | grep -i ZENUXS` shows only `CLAUDE_PROJECT_DIR` and `ZCODE_PROJECT_DIR`. `curl "$ZENUXS_TEST_BASE_URL/models"` therefore expands to `/models` and returns nothing.
- **Why blocked**: The endpoint announced in the user message is not exported into this Bash session's environment. Per rules, no questions to the user and no endpoint details may be committed.
- **Closest alternative**: Continue all L3 live scenarios on the deterministic fake provider; fake-provider chaos covers 429/500/malformed/slow/cut streams. Live streaming/tool normalization/compaction/dogfooding/side-by-side remain BLOCKED.
- **If it becomes available later**: check `models` and one tiny chat completion first, then run bounded live scenarios with timeouts; on failure re-run fake provider, retry live up to 3 times, and classify model-quality failures separately.

## 2026-11-19 — Windows-only unit tests
- **Condition**: Linux host (kernel 7.0.0-43-generic x64); three core unit tests are guarded by `process.platform === "win32"` and one requires PowerShell.
- **Closest alternative**: Linux equivalents are covered by the same test files' non-Windows paths; no skip is a P0 feature.
- **Affected**: bash.test.ts (2 tests), hook-file-hooks.test.ts (1 test).

## 2026-11-19 — VS Code Extension Development Host GUI
- **Condition**: `code` CLI is present (snap) but no DISPLAY/Wayland GUI session is confirmed; @vscode/test-electron is not yet installed.
- **Next action**: Install @vscode/test-electron, attempt headless/Xvfb launch; if no display can be created, record exact error and mark webview GUI scenarios PARTIAL (not VERIFIED).

## 2026-11-19 — Live provider quota blocks CLI L3 runs (resume run)
- **Endpoint check PASSED**: `GET /v1/models` returned 12 models; tiny completions with `deepseek-v4.1-flash-free`, `mimo-v2.6-flash-free`, `big-pickle`, `hy4-flash-free`, `beam-free` all returned valid `PONG`/`LIVE_OK` responses.
- **Announced model unavailable**: `glm-5.3-flash-free` is not in `/v1/models`; tiny completion returned `model_deprecated` ("retired upstream").
- **CLI-shaped live requests fail**: captured response body is `{"error":{"message":"Free usage limit reached. Free models work in OpenCode ... subscribe to OpenCode Go ...","type":"FreeUsageLimitError","code":429}}`. Evidence: docs/evidence/live/l3-headless-live-*.log (exit 124/1), /tmp/live-captured-response.txt.
- **Decision**: live L3/dogfooding scenarios are BLOCKED by per-model free quota; fake provider used for deterministic verification. Live checks are not counted as VERIFIED. Retry after quota reset is required for live-only rows.
