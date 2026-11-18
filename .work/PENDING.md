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
- config.json: UTF-16 leaked personal config still tracked; needs redaction/removal commit.
- Dogfooding: 10 real tasks not yet performed with the built CLI.
- Stress/chaos suite (Phase 8) not executed.
- Final adversarial review not executed.

Note: skips are not allowed for P0 features; none recorded.
