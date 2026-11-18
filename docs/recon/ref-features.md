# Reference feature inventory (from real runs + source/docs)

Source: `/home/azaz/reference-outside-workspace/ZCode` (read-only). Built CLI: `apps/zcode-cli/packages/cli/dist/zcode.cjs`, version 0.17.0.
Evidence: `docs/evidence/reference/ref*.log`.

## CLI commands (real `--help`)
app-server, commands, doctor, login [zai|bigmodel], logout, plugins (list/install/uninstall/enable/disable/update/validate/marketplace...), skills list, tui, version. With no command → TUI.

## CLI flags (real `--help`)
`-p/--prompt <text>`, `--memory-bench`, `--browser-use <mode>`, `--surface <surface>`, `--browser-executable <path>`, `--attach <path>` (repeatable), `--cwd <path>`, `--disallowed-tools/--disallowedTools <tools...>`, `--toolsearch-mode <auto|native|local|off>`, `--force-mcs`, `--locale <en-US|zh-CN|auto>`, `--mode <build|edit|plan|yolo|guarded>`, `--resume <sessionId>`, `--target <text>`, `--target-replace`, `--workflow-mode <disabled|onDemand|alwaysOn>`, `-c/--continue`, `--json`, `--no-browser`, `--no-color`, `--verbose`, `-v/--version`.

Mode default for `--prompt`: `yolo`. Output formats: `--output-format text|json|stream-json` (NDJSON events + final `type:"result"` line). Exit: 0 success, 1 errors.

## Slash commands (real `--help`)
`/help`, `/login`, `/logout`, `/compact [instructions]`, `/expert [status|resume|stop|<task>]`, `/dwf [list|cancel|resume]`, `/fork [latest|checkpointId]`, `/mcp [list|status|connect|disconnect]`, `/mode [mode]`, `/model [id]`, `/new`, `/resume [sessionId]`, `/rewind [latest|checkpointId]`, `/skill [name] [task]`, `/goal [action]`.
TUI-only command registry also has `/effort`, `/variant`.

## Built-in tools (source, `packages/core/src/tool/handlers`)
Read, Write, Edit, Bash, Glob, Grep, WebFetch, WebSearch, TodoWrite, Skill, ExitPlanMode, AskUserQuestion, EnterPlanMode, Agent, Task, KillShell. (Plus plugin/MCP tools with `mcp__` prefix and namespacing.)

## Modes
plan (analysis, limited writes/commands), build (writes need approval), edit (workspace file edits auto-approved), yolo (skip prompts), guarded (dangerous commands still ask). `auto` is internal only.

## Config
- Personal provider/model: `~/.zcode/v2/provider_config.json` (schemaVersion 1). API types: `openai-chat-completions`, `openai-responses`, `anthropic-messages`.
- Runtime: `~/.zcode/cli/config.json`; project: `<project>/zcode.json`, `<project>/.zcode/config.json`.
- Keys: `features.{mcp,subagent,memory,skill}`, `memory.use`, `plugins.enabled`, `skills.enabled`, `hooks.enabled`, `ui.locale`, `modelStream.idleTimeoutMs`, `mcp.servers`, `hooks.events`, `permission.disallowedTools`, `network.httpProxy`, `mcp.servers.<name>.{type,command,args,url,headers,oauth,timeoutMs,enabled,protocolVersion}`.
- Env: `ZCODE_DATA_BASE_DIR`, `ZCODE_PERSONAL_PROVIDER_CONFIG_FILE`, `ZCODE_STORAGE_DIR`, `ZCODE_SESSION_DB_PATH`, `ZCODE_LOG_DIR`, `ZCODE_LOG_CONSOLE`, `ZCODE_HTTP_PROXY`, `ZCODE_NO_PROXY`, `ZCODE_AGENT_CA_CERT`, `ZCODE_MAX_TOOL_CONCURRENCY`.
- Precedence: built-in default → user → project → env → entry args (with field-specific exceptions; same-name MCP user wins over project).

## Hooks
Events: `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PermissionRequest`, `PostToolUse`, `PostToolUseFailure`, `Stop`.
Config: `hooks.events.<Event>[].{matcher, hooks:[{type:process|command, command, args, timeoutMs, async}]}`. stdin JSON with `hook_event_name`; stdout `{hookSpecificOutput:{hookEventName, permissionDecision: allow|ask|deny, permissionDecisionReason, updatedInput, additionalContext}}`. Exit 2 blocks. Project hooks need trust: `hooks trust review|grant|status|revoke --workspace --hook-digest [--all-current --bundle-digest]`.

## MCP
`mcp.servers` with `type: stdio|http|sse`; stdio uses `command`/`args`; http uses `url`/`headers`/`oauth`/`timeoutMs`; `protocolVersion: auto|legacy|2026-07-28`. `features.mcp` must be enabled. Tools commonly prefixed `mcp__`.

## Plugins
Manifest `.zcode-plugin/plugin.json`: `{name, version, description, skills, commands}`. Layout: `skills/`, `commands/`. Dirs: `~/.zcode/cli/plugins/{cache,data}/`. Commands: list, list --available, marketplace list|add|update|remove, install <name>@<market> --scope user|project, enable, disable, update, uninstall --keep-data, validate. Plugins contribute skills, commands, hooks, MCP servers.

## Skills / custom commands
Discovery paths: user/project `.zcode/skills`, `.agents/skills`; `skills.roots` adds roots. `SKILL.md` with frontmatter `name`, `description`. Custom command markdown with frontmatter `description`, `argument-hint`, `skills`; `$ARGUMENTS` placeholder. `zcode skills list --json`, `zcode commands list --json`.

## Memory / instructions
`~/.zcode/AGENTS.md` + workspace `AGENTS.md` (user first, then project). Memory gated by `features.memory` and `memory.use`; `--memory-bench` for extraction experiments.

## Sessions
SQLite at `~/.zcode/cli/db/db.sqlite` (override `ZCODE_SESSION_DB_PATH`). JSON result includes `sessionId`, `traceId`, `response`, `eventCount`, `projection`. `--resume`, `--continue`. Checkpoints: `/rewind`, `/fork`. Workflows: `--workflow-mode`, `/dwf`, `/expert`, `/goal`, `--target`.

## RPC / protocol
`app-server` = ZCode Protocol stdio app server. Package `packages/rpc`. Desktop/extension use a client/server split (`packages/client`, `packages/server`, `packages/services`, `packages/ui`, `packages/desktop`). Message names to enumerate further from `docs/zcode-protocol.md` if needed.

## UI surfaces
TUI (full-screen, slash commands, model/mode/effort pickers, diff/approval), desktop app (`packages/desktop`, Electron), web (`packages/web`, `packages/web-share`), server (`packages/server`), CLI headless. Extension surface is the desktop app + webview UI rather than a VS Code extension (important parity nuance).
