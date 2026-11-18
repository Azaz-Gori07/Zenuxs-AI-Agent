# 05 — Phase plan with real task nodes and dependencies

Per mission section 6. Nodes are refined as recon completes; each node ends with a commit.

```mermaid
flowchart LR
  P0[P0 Recon] --> P1[P1 Green baseline]
  P1 --> P2[P2 Core runtime]
  P2 --> P3[P3 State/safety]
  P3 --> P4[P4 Intelligence]
  P4 --> P5[P5 Extensibility]
  P5 --> P6[P6 CLI/TUI]
  P6 --> P7[P7 Extension]
  P7 --> P8[P8 Integration/stress]
  P8 --> P9[P9 Parity/polish]
```

## P0 — Recon and plan (current)
- P0.1 Both-repo inventory + real builds/tests → `docs/00-inventory.md`
- P0.2 As-is HLD Zenuxs → `docs/01-as-is-hld-zenuxs.md` ✅
- P0.3 Reference HLD ZCode → `docs/02-reference-hld-zcode.md` (recon agents)
- P0.4 Gap matrix → `docs/03-gap-analysis.md` (depends P0.1-P0.3)
- P0.5 Target HLD → `docs/04-target-hld.md` ✅
- P0.6 Phase plan → `docs/05-phase-plan.md` ✅
- Exit: A-F exist and backed by real runs. Commit.

## P1 — Green baseline
- P1.1 Fix `@zenuxs/schema` Zod v4 API use (root cause of build cascade)
- P1.2 Fix 75 broken `export * as X from "."` self-reexports
- P1.3 Fix remaining package build errors (engine, providers, lsp, plugin-sdk, studio)
- P1.4 Fix `@zenuxs/zenuxs-hub` webview browser-bundle missing exports
- P1.5 Fix CLI typecheck errors (15)
- P1.6 Fix 30 CLI + 34 core failing unit tests
- P1.7 Build deterministic fake provider (canned streams, tool calls, malformed, 429/500, slow)
- P1.8 Build PTY E2E harness (node-pty or equivalent; tmux missing — see BLOCKED)
- P1.9 Build VS Code E2E harness (@vscode/test-electron)
- P1.10 Create `scripts/gate.sh` + CI workflow
- Exit: gate runs end-to-end; baseline failure list recorded.

## P2 — Core runtime
- P2.1 F-cfg config schema/precedence
- P2.2 F-prov provider normalization, fallback, accounting
- P2.3 F-core agent loop, abort, retries, max steps
- P2.4 F-tools built-in tool suite
- P2.5 F-toolrobust JSON repair, parallel calls, timeouts, truncation
- Exit: headless task completes a real multi-tool task with fake provider.

## P3 — State and safety
- P3.1 F-perm permission engine
- P3.2 F-mode mode manager
- P3.3 F-sess session persist/resume/fork/rewind
- P3.4 F-ctx compaction
- P3.5 F-ckpt checkpoints/undo
- Exit: mode-switch, compaction, resume, undo scenarios pass live.

## P4 — Intelligence
- P4.1 F-prompt system prompt assembly
- P4.2 F-rag indexer/retrieval
- P4.3 web tools SSRF + search
- P4.4 git integration
- Exit: retrieval-driven tasks work on a large fixture repo.

## P5 — Extensibility
- P5.1 F-mcp
- P5.2 F-hooks
- P5.3 F-skills
- P5.4 F-plug
- P5.5 F-cmd
- P5.6 F-sub
- P5.7 F-auto
- Exit: 10 dogfooding tasks pass.

## P6 — CLI/TUI
- P6.1 F-cli
- P6.2 F-tui (all scenarios in pty)
- Exit: TUI scenarios pass in pty.

## P7 — Extension
- P7.1 F-ext build/install/webview scenarios
- Exit: .vsix installs and scenarios pass.

## P8 — Integration and stress
- Cross-surface parity, chaos tests, performance, security.
- Exit: zero open P0/P1 defects.

## P9 — Parity and polish
- Close matrix rows, side-by-side, docs/packaging, improvements beyond reference.

## Dependencies and gating
- Gate runs every 5 nodes and at each phase exit.
- Defects found later are fixed in their own layer with a regression test.
- Completion condition from mission section 9 is the only stop condition.
