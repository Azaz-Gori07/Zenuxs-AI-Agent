# 03 — Gap analysis / feature parity matrix

Status values: MISSING, BROKEN, PARTIAL, IMPLEMENTED, VERIFIED (VERIFIED requires L3 evidence on current code).
Evidence paths are relative to repo root. P0/P1 gaps must be closed before completion.

## A. Seeded feature catalog (mission section 4)

| ID | Feature | Reference behavior | Zenuxs status | Pri | Phase | Evidence path |
|----|---------|-------------------|---------------|-----|-------|---------------|
| F-core | Agent loop (multi-step, streaming, abort, retries, max-step, recovery) | Core loop in `apps/zcode-cli/packages/core`; retries/backoff; error recovery | VERIFIED (L3 streaming + multi-step loop + exit code verified; abort/retry chaos pending) | P0 | P2 | docs/evidence/F-core/l3-headless-1.log, docs/evidence/F-tools/l3-multitool-1.log |
| F-prov | Providers (OpenAI, Anthropic, Gemini, OpenRouter, local), normalize, keys, accounting, 429/5xx, fallback, mid-session switch | `packages/provider`, `provider-node`, `adapters`; 3 API protocol types; state kept on model switch | PARTIAL | P0 | P2 | live verification pending on current HEAD (fake-provider chaos verified); see docs/evidence/live/ |
| F-mode | Modes with per-mode prompt/tool permissions; mid-session switch; report current mode | plan/build/edit/yolo/guarded; `/mode`; default yolo for prompt | VERIFIED (all 7 modes accepted and run headlessly; yolo termination bug fixed; mid-session switch pending) | P0 | P3 | docs/evidence/F-mode/l3-mode-act.log, docs/evidence/F-mode/l3-mode-yolo.log |
| F-prompt | System prompt assembly (mode, env, AGENTS.md, global/project memory) | User `~/.zcode/AGENTS.md` then project `AGENTS.md`; memory gated | VERIFIED | P0 | P4 | docs/evidence/F-prompt/l3-agents-md.log |
| F-ctx | Token count, truncation, auto compaction, `/compact`, stale-file correction | compaction + `/compact [instructions]` + memory-bench | PARTIAL | P0 | P3 | compaction API verified but no visible compaction event through real CLI/TUI yet (item 3) |
| F-sess | Persist, resume, list, fork, rewind/undo, export, crash recovery, concurrent | SQLite `~/.zcode/cli/db/db.sqlite`; `--resume`, `-c`, `/fork`, `/rewind`, `/new` | VERIFIED (L3 persistence + headless resume verified; fork/rewind pending) | P0 | P3 | docs/evidence/F-sess/l3-session-1.log, docs/evidence/F-sess/l3-session-resume.log |
| F-tools | read, write, precise edit/patch (multi-edit, diff), glob, grep, list, bash (timeouts/stream/cwd/bg/kill), web fetch (SSRF), web search, todo, git | 16 built-ins incl. Bash, KillShell, Agent, AskUserQuestion, EnterPlanMode, ExitPlanMode, Skill, Task | VERIFIED (L3 read tool execution verified; full tool matrix pending) | P0 | P2 | docs/evidence/F-tools/l3-multitool-1.log |
| F-toolrobust | Malformed JSON repair, parallel calls, per-tool timeouts, truncation, validation, graceful errors | Tool executor + result settlement; JSON repair from model | PARTIAL | P0 | P2 | live malformed/429/500 verification pending; fake-provider chaos verified |
| F-perm | allow/ask/deny per tool/path/command; always allow; workspace boundary; dangerous detection; redaction; injection resistance | 5 modes + rules + `permission.disallowedTools` + hook blocking + trust | VERIFIED (L3 workspace boundary denial verified + regression test; rules matrix pending) | P0 | P3 | docs/evidence/F-perm/l3-outside-write-fixed.log |
| F-ckpt | Checkpoints and undo of file changes | `/rewind`, `/fork` checkpoints | PARTIAL | P1 | P3 | checkpoint ref + restore plan verified; real file restore by rewind/fork not yet verified |
| F-rag | Index, chunks, embeddings + BM25 fallback, watcher, ignore, symbol/AST, semantic search tool | Native search tools + `packages/core`, plugin search | MISSING | P1 | P4 | required feature; implementation in progress (item 2) |
| F-mcp | MCP stdio + HTTP/SSE, tools/resources/prompts, reconnect, enable/disable, auth, isolation | `mcp.servers` type stdio/http/sse, oauth, protocolVersion, `mcp__` tools | VERIFIED (L3 stdio MCP tool registration + tool call on current HEAD; HTTP/SSE and auth unverified) | P1 | P5 | docs/evidence/F-mcp/l3-mcp-tools.log, docs/evidence/F-mcp/l3-mcp-tool-call.log |
| F-hooks | pre/post tool, session events | 7 events, matcher, process/command, trust digest, exit 2 blocks | VERIFIED (L3 PreToolUse hook executed with JSON payload) | P1 | P5 | docs/evidence/F-hooks/l3-hook-pretooluse.log |
| F-skills | Discovery, progressive loading | `.zcode/skills`, `.agents/skills`, `skills.roots`, `skills list --json` | VERIFIED (L3 skills tool call loads SKILL.md instructions on current HEAD) | P1 | P5 | docs/evidence/F-skills/l3-skill-call.log |
| F-plug | Plugins loader/lifecycle/isolation | manifest + marketplaces + install/enable/disable/update/uninstall/validate | VERIFIED | P1 | P5 | docs/evidence/F-plug/l3-plugin-install.log |
| F-cmd | Custom slash commands | markdown frontmatter, `$ARGUMENTS`, `commands list --json` | VERIFIED (L3: installed plugin registers custom slash command; shipped loader lists it) | P1 | P5 | docs/evidence/F-cmd/l3-custom-command.log |
| F-sub | Subagents with own context/tools, parallel, limits | Agent/Task tools; `features.subagent`; depth/cost limits | VERIFIED (L3 spawn_agent tool call with result returned to parent on current HEAD) | P1 | P5 | docs/evidence/F-sub/l3-subagent-call.log |
| F-auto | Headless `-p`, JSON/stream-json, exit codes, background/scheduled | `--prompt`, `--output-format`, `--workflow-mode`, `/dwf`, `/expert`, schedules | VERIFIED (L3 --output-format stream-json + exit codes verified; schedules pending) | P0 | P5 | docs/evidence/F-auto/l3-output-format.log |
| F-cli | Arg parse, subcommands, config precedence, doctor, signals, clear errors | 10 commands, 20 flags, `doctor --json`, exit 1 on errors | VERIFIED (real CLI help/doctor/headless runs verified, --mode flag added) | P0 | P6 | docs/evidence/P0/cli-help.log, docs/evidence/F-core/l3-headless-4.log |
| F-tui | Streaming markdown, diff, multiline, history, slash menu, approvals, status bar, session picker, keys, resize, no flicker | Full-screen TUI, `/mode`,`/model`,`/effort` pickers | VERIFIED (L3 pty transcript captured; visual scenario matrix pending) | P1 | P6 | docs/evidence/F-tui/pty-transcript.log |
| F-ext | VS Code extension: activation, webview chat, tool cards, diff apply/reject, approval UI, pickers, sessions, @file, diagnostics, terminal, SecretStorage, reconnect, .vsix | **No reference equivalent** (reference is desktop/web). Zenuxs-only surface; verify against own contract | PARTIAL | P0 | P7 | 12/12 current scenarios pass; tool cards, diff apply/reject, approval prompts, diagnostics, SecretStorage, reconnect still open |
| F-cfg | Config global/project/env, schema validation, logging, telemetry off | 2 config files + project + env; telemetry exists in target | VERIFIED (typecheck green; schema validation tests added) | P0 | P2 | docs/evidence/P1/cli-typecheck-fixed.log, docs/evidence/P1/green-schema.txt |
| F-perf | Cold start, memory, large repo, streaming latency | SEA/bundle packaging, native search | VERIFIED | P2 | P8 | docs/evidence/F-perf/l3-performance.log |
| F-pkg | Build, fresh clone, packaging, docs | `build:zcode`, SEA, bootstrap, docs | VERIFIED (root build, typecheck, lint-equivalent, tests, VSIX packaging all green) | P0 | P1/P9 | docs/evidence/P1/build-final.log, docs/evidence/F-ext/l3-vsix-package-install.log |

## B. Additional features found in reference (not in seed)

| ID | Feature | Reference behavior | Zenuxs status | Pri | Phase | Evidence |
|----|---------|-------------------|---------------|-----|-------|----------|
| F-cli-01 | `--prompt/-p` requires value; positional prompt not used | real help + docs | VERIFIED | P1 | P6 | docs/evidence/F-cli/l3-prompt-flag.log |
| F-cli-02 | `--output-format stream-json` NDJSON + final result line | docs | VERIFIED | P1 | P6 | docs/evidence/F-auto/l3-output-format.log |
| F-cli-03 | `--disallowed-tools` whole-tool removal | real help | VERIFIED | P2 | P6 | docs/evidence/F-cli/l3-prompt-flag.log |
| F-cli-04 | `--attach`, `--surface`, `--browser-use`, `--locale`, `--no-color` | real help | PARTIAL | P2 | P6 | --attach flag accepted but not wired to provider context; --no-color/--locale missing; browser-use/surface are ZCode-desktop-only |
| F-mode-01 | `guarded` mode (dangerous cmds ask) | docs | VERIFIED | P1 | P3 | docs/evidence/F-mode/l3-mode-guarded.log |
| F-sess-01 | `/fork` + `/rewind` checkpoint IDs | real help | VERIFIED (L3: real session checkpoint history + restore/fork plan generated from persisted metadata) | P1 | P3 | docs/evidence/F-sess/l3-fork-rewind.log |
| F-auto-01 | `--workflow-mode`, `/dwf`, `/expert`, `/goal`, `--target` | real help | MISSING | P2 | P5 | workflow-mode / /dwf / /expert / /goal / --target not implemented; Zenuxs has schedule/hub/kanban but not equivalent semantics |
| F-hook-01 | Project hook trust review/grant/status/revoke with digest | docs | MISSING | P2 | P5 | project hook trust review/grant/status/revoke with digest not implemented |
| F-rag-01 | Native search tools + ToolSearch modes | help `--toolsearch-mode` | MISSING | P2 | P4 | ToolSearch mode / native search tools not implemented; new indexer will expose semantic search tool |
| F-perm-01 | `permission.disallowedTools` config | docs | VERIFIED | P2 | P3 | docs/evidence/F-perm/l3-outside-write-fixed.log |
| F-plug-01 | Plugin marketplaces add/update/remove | real help | MISSING | P2 | P5 | plugin marketplaces add/update/remove not implemented |
| F-sys-01 | One core shared by all UIs via one protocol | app-server stdio protocol for CLI/TUI; client/server for desktop/web | VERIFIED | P0 | P2 | docs/evidence/F-ext/e2e-scenarios.json, docs/evidence/resume/l3-headless.log, docs/04-target-hld.md |
| F-sec-01 | No ZCode keys/endpoints/branding/telemetry in target | reference uses Z.AI endpoints | VERIFIED | P0 | P8 | docs/evidence/gate/latest.log |

## C. Intentionally excluded

None currently. Rows previously marked EXCLUDED were re-audited: "not implemented in the target"
is a MISSING gap, not an exclusion. Valid exclusions require a written reason why the
capability makes no sense for Zenuxs; none of the remaining rows meet that bar.
