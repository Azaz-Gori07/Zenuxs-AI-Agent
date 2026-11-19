# 03 — Gap analysis / feature parity matrix

Status values: MISSING, BROKEN, PARTIAL, IMPLEMENTED, VERIFIED (VERIFIED requires L3 evidence on current code).
Evidence paths are relative to repo root. P0/P1 gaps must be closed before completion.

## A. Seeded feature catalog (mission section 4)

| ID | Feature | Reference behavior | Zenuxs status | Pri | Phase | Evidence path |
|----|---------|-------------------|---------------|-----|-------|---------------|
| F-core | Agent loop (multi-step, streaming, abort, retries, max-step, recovery) | Core loop in `apps/zcode-cli/packages/core`; retries/backoff; error recovery | IMPLEMENTED (L3 streaming + multi-step loop + exit code verified; abort/retry chaos pending) | P0 | P2 | docs/evidence/F-core/l3-headless-1.log, docs/evidence/F-tools/l3-multitool-1.log |
| F-prov | Providers (OpenAI, Anthropic, Gemini, OpenRouter, local), normalize, keys, accounting, 429/5xx, fallback, mid-session switch | `packages/provider`, `provider-node`, `adapters`; 3 API protocol types; state kept on model switch | VERIFIED (L3 OpenAI-compatible streaming + 429/500/slow/cut-stream recovery on current HEAD; live-provider checks BLOCKED, no key) | P0 | P2 | docs/evidence/resume/l3-headless.log, docs/evidence/F-toolrobust/chaos-rate-limit.log, docs/evidence/F-toolrobust/chaos-server-error.log, docs/evidence/F-toolrobust/chaos-slow.log, docs/evidence/F-toolrobust/chaos-cut.log |
| F-mode | Modes with per-mode prompt/tool permissions; mid-session switch; report current mode | plan/build/edit/yolo/guarded; `/mode`; default yolo for prompt | IMPLEMENTED (all 7 modes accepted and run headlessly; yolo termination bug fixed; mid-session switch pending) | P0 | P3 | docs/evidence/F-mode/l3-mode-act.log, docs/evidence/F-mode/l3-mode-yolo.log |
| F-prompt | System prompt assembly (mode, env, AGENTS.md, global/project memory) | User `~/.zcode/AGENTS.md` then project `AGENTS.md`; memory gated | PARTIAL (AGENTS.md exists in target; assembly unverified) | P0 | P4 | docs/01-as-is-hld-zenuxs.md |
| F-ctx | Token count, truncation, auto compaction, `/compact`, stale-file correction | compaction + `/compact [instructions]` + memory-bench | PARTIAL (`packages/core/src/extensions/context` + `packages/engine/src/session/compaction.ts` broken) | P0 | P3 | docs/evidence/P0/build.log |
| F-sess | Persist, resume, list, fork, rewind/undo, export, crash recovery, concurrent | SQLite `~/.zcode/cli/db/db.sqlite`; `--resume`, `-c`, `/fork`, `/rewind`, `/new` | IMPLEMENTED (L3 persistence + headless resume verified; fork/rewind pending) | P0 | P3 | docs/evidence/F-sess/l3-session-1.log, docs/evidence/F-sess/l3-session-resume.log |
| F-tools | read, write, precise edit/patch (multi-edit, diff), glob, grep, list, bash (timeouts/stream/cwd/bg/kill), web fetch (SSRF), web search, todo, git | 16 built-ins incl. Bash, KillShell, Agent, AskUserQuestion, EnterPlanMode, ExitPlanMode, Skill, Task | IMPLEMENTED (L3 read tool execution verified; full tool matrix pending) | P0 | P2 | docs/evidence/F-tools/l3-multitool-1.log |
| F-toolrobust | Malformed JSON repair, parallel calls, per-tool timeouts, truncation, validation, graceful errors | Tool executor + result settlement; JSON repair from model | PARTIAL | P0 | P2 | docs/01-as-is-hld-zenuxs.md |
| F-perm | allow/ask/deny per tool/path/command; always allow; workspace boundary; dangerous detection; redaction; injection resistance | 5 modes + rules + `permission.disallowedTools` + hook blocking + trust | IMPLEMENTED (L3 workspace boundary denial verified + regression test; rules matrix pending) | P0 | P3 | docs/evidence/F-perm/l3-outside-write-fixed.log |
| F-ckpt | Checkpoints and undo of file changes | `/rewind`, `/fork` checkpoints | PARTIAL | P1 | P3 | docs/evidence/reference/ref--help.log |
| F-rag | Index, chunks, embeddings + BM25 fallback, watcher, ignore, symbol/AST, semantic search tool | Native search tools + `packages/core`, plugin search | PARTIAL (`packages/agents/.rag-index` exists; unverified) | P1 | P4 | docs/01-as-is-hld-zenuxs.md |
| F-mcp | MCP stdio + HTTP/SSE, tools/resources/prompts, reconnect, enable/disable, auth, isolation | `mcp.servers` type stdio/http/sse, oauth, protocolVersion, `mcp__` tools | PARTIAL (CLI `mcp` command exists; broken engine MCP) | P1 | P5 | docs/evidence/P0/cli-help.log |
| F-hooks | pre/post tool, session events | 7 events, matcher, process/command, trust digest, exit 2 blocks | IMPLEMENTED (L3 PreToolUse hook executed with JSON payload) | P1 | P5 | docs/evidence/F-hooks/l3-hook-pretooluse.log |
| F-skills | Discovery, progressive loading | `.zcode/skills`, `.agents/skills`, `skills.roots`, `skills list --json` | PARTIAL (CLI `skill` cmd + core skills; unverified) | P1 | P5 | docs/evidence/reference/refskills_list___json.log |
| F-plug | Plugins loader/lifecycle/isolation | manifest + marketplaces + install/enable/disable/update/uninstall/validate | PARTIAL (CLI `plugin` cmd + plugin-sdk broken) | P1 | P5 | docs/evidence/reference/refplugins_list___json.log |
| F-cmd | Custom slash commands | markdown frontmatter, `$ARGUMENTS`, `commands list --json` | PARTIAL (TUI slash registry; custom unverified) | P1 | P5 | docs/recon/ref-features.md |
| F-sub | Subagents with own context/tools, parallel, limits | Agent/Task tools; `features.subagent`; depth/cost limits | PARTIAL (debug-agents cmd; unverified) | P1 | P5 | docs/recon/ref-features.md |
| F-auto | Headless `-p`, JSON/stream-json, exit codes, background/scheduled | `--prompt`, `--output-format`, `--workflow-mode`, `/dwf`, `/expert`, schedules | IMPLEMENTED (L3 --output-format stream-json + exit codes verified; schedules pending) | P0 | P5 | docs/evidence/F-auto/l3-output-format.log |
| F-cli | Arg parse, subcommands, config precedence, doctor, signals, clear errors | 10 commands, 20 flags, `doctor --json`, exit 1 on errors | IMPLEMENTED (real CLI help/doctor/headless runs verified, --mode flag added) | P0 | P6 | docs/evidence/P0/cli-help.log, docs/evidence/F-core/l3-headless-4.log |
| F-tui | Streaming markdown, diff, multiline, history, slash menu, approvals, status bar, session picker, keys, resize, no flicker | Full-screen TUI, `/mode`,`/model`,`/effort` pickers | IMPLEMENTED (L3 pty transcript captured; visual scenario matrix pending) | P1 | P6 | docs/evidence/F-tui/pty-transcript.log |
| F-ext | VS Code extension: activation, webview chat, tool cards, diff apply/reject, approval UI, pickers, sessions, @file, diagnostics, terminal, SecretStorage, reconnect, .vsix | **No reference equivalent** (reference is desktop/web). Zenuxs-only surface; verify against own contract | IMPLEMENTED (build + .vsix package + clean install verified; webview E2E pending) | P0 | P7 | docs/evidence/F-ext/l3-vsix-package-install.log |
| F-cfg | Config global/project/env, schema validation, logging, telemetry off | 2 config files + project + env; telemetry exists in target | IMPLEMENTED (typecheck green; schema validation tests added) | P0 | P2 | docs/evidence/P1/cli-typecheck-fixed.log, docs/evidence/P1/green-schema.txt |
| F-perf | Cold start, memory, large repo, streaming latency | SEA/bundle packaging, native search | PARTIAL (profiler in target; no targets measured) | P2 | P8 | docs/01-as-is-hld-zenuxs.md |
| F-pkg | Build, fresh clone, packaging, docs | `build:zcode`, SEA, bootstrap, docs | IMPLEMENTED (root build, typecheck, lint-equivalent, tests, VSIX packaging all green) | P0 | P1/P9 | docs/evidence/P1/build-final.log, docs/evidence/F-ext/l3-vsix-package-install.log |

## B. Additional features found in reference (not in seed)

| ID | Feature | Reference behavior | Zenuxs status | Pri | Phase | Evidence |
|----|---------|-------------------|---------------|-----|-------|----------|
| F-cli-01 | `--prompt/-p` requires value; positional prompt not used | real help + docs | PARTIAL (target uses positional prompt; `-p` = plan) | P1 | P6 | docs/evidence/reference/ref--help.log |
| F-cli-02 | `--output-format stream-json` NDJSON + final result line | docs | MISSING | P1 | P6 | docs/recon/ref-features.md |
| F-cli-03 | `--disallowed-tools` whole-tool removal | real help | MISSING | P2 | P6 | ref--help.log |
| F-cli-04 | `--attach`, `--surface`, `--browser-use`, `--locale`, `--no-color` | real help | MISSING | P2 | P6 | ref--help.log |
| F-mode-01 | `guarded` mode (dangerous cmds ask) | docs | MISSING | P1 | P3 | docs/recon/ref-features.md |
| F-sess-01 | `/fork` + `/rewind` checkpoint IDs | real help | MISSING | P1 | P3 | ref--help.log |
| F-auto-01 | `--workflow-mode`, `/dwf`, `/expert`, `/goal`, `--target` | real help | MISSING (target has `schedule`/`kanban`/`hub`) | P2 | P5 | ref--help.log |
| F-hook-01 | Project hook trust review/grant/status/revoke with digest | docs | MISSING | P2 | P5 | docs/recon/ref-features.md |
| F-rag-01 | Native search tools + ToolSearch modes | help `--toolsearch-mode` | PARTIAL | P2 | P4 | ref--help.log |
| F-perm-01 | `permission.disallowedTools` config | docs | PARTIAL | P2 | P3 | docs/recon/ref-features.md |
| F-plug-01 | Plugin marketplaces add/update/remove | real help | PARTIAL (target plugin cmd exists; markets unverified) | P2 | P5 | refplugins_list___json.log |
| F-sys-01 | One core shared by all UIs via one protocol | app-server stdio protocol for CLI/TUI; client/server for desktop/web | BROKEN (two cores in target) | P0 | P2 | docs/01-as-is-hld-zenuxs.md |
| F-sec-01 | No ZCode keys/endpoints/branding/telemetry in target | reference uses Z.AI endpoints | BLOCKED check (ZCODE token in env; unused) | P0 | P8 | docs/00-inventory.md |

## C. Intentionally excluded
None yet. If an item is excluded, it will be recorded here with a reason and will not count toward completion.
