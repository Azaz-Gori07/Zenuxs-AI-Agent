# PENDING — unfinished / unverified work

## Matrix rows not yet VERIFIED (L3 evidence missing)
- F-ctx: automatic compaction trigger not observed live; unit tests pass.
- F-ckpt: checkpoints/undo not exercised live.
- F-rag: indexer/retrieval not exercised live on large fixture.
- F-mcp: MCP client not exercised live with a real MCP server.
- F-plug: plugin lifecycle not exercised live.
- F-cmd: custom slash commands not exercised live.
- F-sub: subagents not exercised live.
- F-auto: schedules/background tasks not exercised live (headless stream-json verified).
- F-prompt: AGENTS.md assembly not inspected via provider request.
- F-perf: no measured cold-start/memory targets.
- F-ext: webview E2E (@vscode/test-electron + CDP) not run; VSIX build/install verified.
- F-cli: doctor/flags verified; full command matrix not exercised.
- F-tui: pty transcript captured; full keybinding/scenario matrix not exercised.
- F-toolrobust: malformed JSON / parallel / timeouts not exercised live.
- web tools, git integration: not exercised live.

## Non-matrix
- BASE-08: CLI bin fields point to source; published wrapper handles this (P2).
- BASE-09: Cline package names/metadata remain (P2).
- config.json: untracked and gitignored (no secrets found); history still contains it — see .work/DECISIONS.md.
- Dogfooding: 10 real tasks not yet performed with the built CLI.
- Stress/chaos suite (Phase 8) not executed.
- Final adversarial review not executed.

## Skipped tests — full list and disposition (resume triage 2026-11-19)
Core suite reports 1281 passed / 4 skipped (133 files). The four skips:
1. `src/extensions/tools/executors/bash.test.ts > createWindowsExecutor > runs structured commands without shell parsing` — guarded by `describe.runIf(process.platform === "win32")` at bash.test.ts:257. Justified: Linux host, Windows-only executor path; cannot execute here.
2. `src/extensions/tools/executors/bash.test.ts > createWindowsExecutor > runs string commands through the shell` — same Windows-only describe block at bash.test.ts:257. Justified: same.
3. `src/hooks/hook-file-hooks.test.ts > createHookConfigFileHooks > executes PowerShell hook files on Windows` — guarded by `it.runIf(process.platform === "win32")` at hook-file-hooks.test.ts:348. Justified: requires PowerShell on Windows; pwsh not installed on Linux host.
4. `src/extensions/context/compaction.live.test.ts > live agentic compaction > summarizes oversized arbitrary tool results with a real provider` — gated by `CORE_LIVE_COMPACTION_TESTS=1` (compaction.live.test.ts:23). Justified: BLOCKED — no permitted live provider key in environment (only ZCODE_OFFICIAL_ENDPOINT_TOKEN exists, which mission rules forbid using in target).

No P0 feature has a skipped test.

## Resume-run remaining rows (2026-11-19)
- F-rag: no in-repo RAG indexer implementation found; only a static `.rag-index` artifact exists. Needs implementation + L3 retrieval verification.
- F-cmd: project/plugin custom slash command discovery not reachable from CLI; TUI slash registry exists but PTY keystrokes could not be verified. Needs investigation.
- F-sess-01: checkpoint git refs are created by real runs, but checkpoint history is not persisted in session metadata, so `/fork` and `/rewind` restore plans cannot find them. Needs a fix in checkpoint-hooks/local-runtime-host metadata persistence.

- F-rag intentionally excluded: target has no RAG indexer implementation (only a stale artifact). Needs a real chunking/BM25/watcher/semantic-search implementation before re-enabling the row.
