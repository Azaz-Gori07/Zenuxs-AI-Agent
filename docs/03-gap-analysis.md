# 03 — Gap analysis / feature parity matrix

Status values: MISSING, BROKEN, PARTIAL, IMPLEMENTED, VERIFIED (VERIFIED requires L3 evidence on current code).
Evidence paths are relative to repo root. P0/P1 gaps must be closed before completion.

## A. Seeded feature catalog (mission section 4)

| ID | Feature | Reference behavior | Zenuxs status | Pri | Phase | Evidence path |
|----|---------|-------------------|---------------|-----|-------|---------------|
| F-core | Agent loop (multi-step, streaming, abort, retries, max-step, recovery) | Core loop in `apps/zcode-cli/packages/core`; retries/backoff; error recovery | VERIFIED | P0 | P2 | docs/evidence/regenerated/headless.log, docs/evidence/regenerated/multitool.log |
| F-prov | Providers (OpenAI, Anthropic, Gemini, OpenRouter, local), normalize, keys, accounting, 429/5xx, fallback, mid-session switch | `packages/provider`, `provider-node`, `adapters`; 3 API protocol types; state kept on model switch | BLOCKED | P0 | P2 | docs/evidence/live/l3-headless-live-4.log, .work/BLOCKED.md |
| F-mode | Modes with per-mode prompt/tool permissions; mid-session switch; report current mode | plan/build/edit/yolo/guarded; `/mode`; default yolo for prompt | VERIFIED | P0 | P3 | docs/evidence/regenerated/mode_act.log, docs/evidence/regenerated/mode_plan.log, docs/evidence/regenerated/yolo.log, docs/evidence/regenerated/guarded.log |
| F-prompt | System prompt assembly (mode, env, AGENTS.md, global/project memory) | User `~/.zcode/AGENTS.md` then project `AGENTS.md`; memory gated | VERIFIED | P0 | P4 | docs/evidence/regenerated/prompt.log |
| F-ctx | Token count, truncation, auto compaction, `/compact`, stale-file correction | compaction + `/compact [instructions]` + memory-bench | VERIFIED | P0 | P3 | docs/evidence/regenerated/compaction.log |
| F-sess | Persist, resume, list, fork, rewind/undo, export, crash recovery, concurrent | SQLite `~/.zcode/cli/db/db.sqlite`; `--resume`, `-c`, `/fork`, `/rewind`, `/new` | VERIFIED | P0 | P3 | docs/evidence/regenerated/resume.log |
| F-tools | read, write, precise edit/patch (multi-edit, diff), glob, grep, list, bash (timeouts/stream/cwd/bg/kill), web fetch (SSRF), web search, todo, git | 16 built-ins incl. Bash, KillShell, Agent, AskUserQuestion, EnterPlanMode, ExitPlanMode, Skill, Task | VERIFIED | P0 | P2 | docs/evidence/regenerated/multitool.log |
| F-toolrobust | Malformed JSON repair, parallel calls, per-tool timeouts, truncation, validation, graceful errors | Tool executor + result settlement; JSON repair from model | BLOCKED | P0 | P2 | docs/evidence/live/l3-headless-live-4.log, .work/BLOCKED.md |
| F-perm | allow/ask/deny per tool/path/command; always allow; workspace boundary; dangerous detection; redaction; injection resistance | 5 modes + rules + `permission.disallowedTools` + hook blocking + trust | VERIFIED | P0 | P3 | docs/evidence/regenerated/boundary.log, docs/evidence/P0-symlink/l3-summary.log |
| F-ckpt | Checkpoints and undo of file changes | `/rewind`, `/fork` checkpoints | VERIFIED | P1 | P3 | docs/evidence/regenerated/checkpoint.log |
| F-rag | Index, chunks, embeddings + BM25 fallback, watcher, ignore, symbol/AST, semantic search tool | Native search tools + `packages/core`, plugin search | VERIFIED | P1 | P4 | docs/evidence/regenerated/rag.log |
| F-mcp | MCP stdio + HTTP/SSE, tools/resources/prompts, reconnect, enable/disable, auth, isolation | `mcp.servers` type stdio/http/sse, oauth, protocolVersion, `mcp__` tools | VERIFIED | P1 | P5 | docs/evidence/regenerated/mcp.log |
| F-hooks | pre/post tool, session events | 7 events, matcher, process/command, trust digest, exit 2 blocks | VERIFIED | P1 | P5 | docs/evidence/regenerated/hook.log |
| F-skills | Discovery, progressive loading | `.zcode/skills`, `.agents/skills`, `skills.roots`, `skills list --json` | VERIFIED | P1 | P5 | docs/evidence/regenerated/skills.log |
| F-plug | Plugins loader/lifecycle/isolation | manifest + marketplaces + install/enable/disable/update/uninstall/validate | VERIFIED | P1 | P5 | docs/evidence/regenerated/mcp.log |
| F-cmd | Custom slash commands | markdown frontmatter, `$ARGUMENTS`, `commands list --json` | VERIFIED | P1 | P5 | docs/evidence/regenerated/skills.log |
| F-sub | Subagents with own context/tools, parallel, limits | Agent/Task tools; `features.subagent`; depth/cost limits | VERIFIED | P1 | P5 | docs/evidence/regenerated/subagent.log |
| F-auto | Headless `-p`, JSON/stream-json, exit codes, background/scheduled | `--prompt`, `--output-format`, `--workflow-mode`, `/dwf`, `/expert`, schedules | VERIFIED | P0 | P5 | docs/evidence/regenerated/headless.log |
| F-cli | Arg parse, subcommands, config precedence, doctor, signals, clear errors | 10 commands, 20 flags, `doctor --json`, exit 1 on errors | VERIFIED | P0 | P6 | docs/evidence/gate/latest.log |
| F-tui | Streaming markdown, diff, multiline, history, slash menu, approvals, status bar, session picker, keys, resize, no flicker | Full-screen TUI, `/mode`,`/model`,`/effort` pickers | VERIFIED | P1 | P6 | docs/evidence/regenerated/tui-pty.log |
| F-ext | VS Code extension: activation, webview chat, tool cards, diff apply/reject, approval UI, pickers, sessions, @file, diagnostics, terminal, SecretStorage, reconnect, .vsix | **No reference equivalent** (reference is desktop/web). Zenuxs-only surface; verify against own contract | PARTIAL | P0 | P7 | docs/evidence/gate/latest.log |
| F-cfg | Config global/project/env, schema validation, logging, telemetry off | 2 config files + project + env; telemetry exists in target | VERIFIED | P0 | P2 | docs/evidence/gate/latest.log |
| F-perf | Cold start, memory, large repo, streaming latency | SEA/bundle packaging, native search | VERIFIED | P2 | P8 | docs/evidence/gate/latest.log |
| F-pkg | Build, fresh clone, packaging, docs | `build:zcode`, SEA, bootstrap, docs | VERIFIED | P0 | P1/P9 | docs/evidence/gate/latest.log |

## B. Additional features found in reference (not in seed)

| ID | Feature | Reference behavior | Zenuxs status | Pri | Phase | Evidence |
|----|---------|-------------------|---------------|-----|-------|----------|
| F-cli-01 | `--prompt/-p` requires value; positional prompt not used | real help + docs | VERIFIED | P1 | P6 | docs/evidence/regenerated/headless.log |
| F-cli-02 | `--output-format stream-json` NDJSON + final result line | docs | VERIFIED | P1 | P6 | docs/evidence/regenerated/headless.log |
| F-cli-03 | `--disallowed-tools` whole-tool removal | real help | PARTIAL | P2 | P6 | docs/evidence/gate/latest.log |
| F-cli-04 | `--attach`, `--surface`, `--browser-use`, `--locale`, `--no-color` | real help | PARTIAL | P2 | P6 | docs/evidence/gate/latest.log |
| F-mode-01 | `guarded` mode (dangerous cmds ask) | docs | VERIFIED | P1 | P3 | docs/evidence/regenerated/guarded.log |
| F-sess-01 | `/fork` + `/rewind` checkpoint IDs | real help | VERIFIED | P1 | P3 | docs/evidence/regenerated/resume.log, docs/evidence/regenerated/checkpoint.log |
| F-auto-01 | `--workflow-mode`, `/dwf`, `/expert`, `/goal`, `--target` | real help | MISSING | P2 | P5 | docs/evidence/gate/latest.log |
| F-hook-01 | Project hook trust review/grant/status/revoke with digest | docs | MISSING | P2 | P5 | docs/evidence/gate/latest.log |
| F-rag-01 | Native search tools + ToolSearch modes | help `--toolsearch-mode` | VERIFIED | P2 | P4 | docs/evidence/regenerated/rag.log |
| F-perm-01 | `permission.disallowedTools` config | docs | VERIFIED | P2 | P3 | docs/evidence/regenerated/boundary.log |
| F-plug-01 | Plugin marketplaces add/update/remove | real help | MISSING | P2 | P5 | docs/evidence/gate/latest.log |
| F-sys-01 | One core shared by all UIs via one protocol | app-server stdio protocol for CLI/TUI; client/server for desktop/web | VERIFIED | P0 | P2 | docs/evidence/gate/latest.log |
| F-sec-01 | No ZCode keys/endpoints/branding/telemetry in target | reference uses Z.AI endpoints | VERIFIED | P0 | P8 | docs/evidence/gate/latest.log |

## C. Intentionally excluded

None currently. Rows previously marked EXCLUDED were re-audited: "not implemented in the target"
is a MISSING gap, not an exclusion. Valid exclusions require a written reason why the
capability makes no sense for Zenuxs; none of the remaining rows meet that bar.
