# BLOCKED (environment / human input required)

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
