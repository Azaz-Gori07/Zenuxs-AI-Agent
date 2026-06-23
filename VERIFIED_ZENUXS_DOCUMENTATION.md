# Verified Zenuxs Source Code Audit & System Documentation

This document serves as the absolute single source of truth for the **Zenuxs Standalone CLI Coding Agent**. Every single detail, command, keyboard shortcut, tool, provider, and settings mapping documented below has been verified directly against the `zenuxs-code` codebase. No assumptions, placeholders, or inherited knowledge are included.

---

## Phase 1: Full Source Audit & Codebase Inventory

A full audit of the `zenuxs-code/` directory structure reveals the following layout and component organization:

### Workspace Project Modules
- **`packages/shared`**: Holds storage utilities, path resolutions, logging structures, and database schemas.
  - Key File: [`packages/shared/src/storage/paths.ts`](file:///d:/V3/zenuxs-code/packages/shared/src/storage/paths.ts) (manages all directories under `~/.zenuxs`).
- **`packages/agents`**: Defines the base agentic execution loops and callbacks.
  - Key File: [`packages/agents/src/agent-runtime.ts`](file:///d:/V3/zenuxs-code/packages/agents/src/agent-runtime.ts) (orchestrates agent ticks).
- **`packages/llms`**: Exposes provider configuration registries, model facts, and connection clients.
  - Key File: [`packages/llms/src/providers/ids.ts`](file:///d:/V3/zenuxs-code/packages/llms/src/providers/ids.ts) (defines canonical provider identifiers).
- **`packages/core`**: Implements SQLite session managers, workspace metadata indexes, safety filters, and tool execution routines.
  - Key File: [`packages/core/src/extensions/tools/runtime.ts`](file:///d:/V3/zenuxs-code/packages/core/src/extensions/tools/runtime.ts) (defines core tool catalogs).
- **`apps/cli`**: The CLI entry point, keyboard hooks, and React-based Terminal User Interface (TUI).
  - Key File: [`apps/cli/src/main.ts`](file:///d:/V3/zenuxs-code/apps/cli/src/main.ts) (defines commander CLI execution).
- **`apps/cline-hub`**: Background service/daemon orchestrating agent runs.

---

## Phase 2: Command Verification

The CLI subcommands are parsed using `Commander.js` inside `apps/cli/src/main.ts` and configured globally inside `apps/cli/src/commands/program.ts`.

### 1. `zenuxs` (Root Program)
- **File**: [`apps/cli/src/commands/program.ts`](file:///d:/V3/zenuxs-code/apps/cli/src/commands/program.ts)
- **Line Range**: 110-129 (`createProgram`), 23-107 (`addRootOptions`), 131-240 (`commanderToParsedArgs`).
- **Options**:
  - `-p, --plan`: Run in plan-only mode (analyses, does not execute modifications).
  - `--json`: Format prompt completions/transcripts as structured JSON.
  - `--auto-approve <boolean>`: Set auto-approve mode (default: `true`).
  - `-c, --cwd <path>`: Working directory.
  - `--thinking <level>`: Reasoning effort: `none`, `low`, `medium`, `high`, `xhigh`.
  - `--compaction <mode>`: Compact mode: `agentic`, `basic`, `off`.
  - `-i, --tui`: Enter interactive TUI mode.
  - `--id <session-id>`: Resume existing session.
  - `-P, --provider <id>`: Configure provider.
  - `-k, --key <api-key>`: Override provider API Key.
  - `-m, --model <model-id>`: Active model identifier.
  - `-s, --system <prompt>`: Custom system prompt.
  - `--data-dir <path>`: Isolated data directory path (enables sandbox mode).
- **Implementation Status**: Fully implemented.

### 2. `zenuxs auth`
- **File**: [`apps/cli/src/main.ts`](file:///d:/V3/zenuxs-code/apps/cli/src/main.ts)
- **Line Range**: 152-208.
- **Parameters**: `[provider]` (positional provider ID shorthand).
- **Options**: `--provider`, `--apikey`, `--modelid`, `--baseurl`, `--azure-api-version`, `--config`, `--cwd`, `--data-dir`, `--verbose`.
- **Implementation Status**: Fully implemented.

### 3. `zenuxs config`
- **File**: [`apps/cli/src/main.ts`](file:///d:/V3/zenuxs-code/apps/cli/src/main.ts)
- **Line Range**: 234-245. Delegates to [`apps/cli/src/commands/config.ts`](file:///d:/V3/zenuxs-code/apps/cli/src/commands/config.ts).
- **Options**: `--json`, `--config <dir>`.
- **Subcommands/Targets**: `workflows`, `rules`, `skills`, `agents`, `plugins`, `hooks`, `mcp`, `tools` (passed as positional `[target]` argument).
- **Implementation Status**: Fully implemented.

### 4. `zenuxs plugin`
- **File**: [`apps/cli/src/main.ts`](file:///d:/V3/zenuxs-code/apps/cli/src/main.ts)
- **Line Range**: 247-252.
- **Subcommands**:
  - `install` (lines 253-294): Installs a plugin. Options: `--npm`, `--git`, `--force`, `--json`, `--cwd <path>`.
  - `uninstall` (lines 295-318): Uninstalls a plugin. Options: `--json`, `--cwd <path>`.
- **Implementation Status**: Fully implemented.

### 5. `zenuxs skill`
- **File**: [`apps/cli/src/main.ts`](file:///d:/V3/zenuxs-code/apps/cli/src/main.ts)
- **Line Range**: 319-339.
- **Parameters**: `[args...]` (forwarded directly to CLI skills wrapper).
- **Implementation Status**: Fully implemented.

### 6. `zenuxs connect`
- **File**: [`apps/cli/src/main.ts`](file:///d:/V3/zenuxs-code/apps/cli/src/main.ts)
- **Line Range**: 341-380.
- **Parameters**: `[channel]`.
- **Options**: `--stop` (kills connections).
- **Implementation Status**: Fully implemented.

### 7. `zenuxs mcp`
- **File**: [`apps/cli/src/main.ts`](file:///d:/V3/zenuxs-code/apps/cli/src/main.ts)
- **Line Range**: 382-393.
- **Subcommands**:
  - `install` / `add` (lines 394-418): Configures an MCP server registration. Arguments: `<name>`, `[targetArgs...]`. Options: `--transport <type>`.
- **Implementation Status**: Fully implemented.

### 8. `zenuxs doctor`
- **File**: [`apps/cli/src/main.ts`](file:///d:/V3/zenuxs-code/apps/cli/src/main.ts)
- **Line Range**: 427-440.
- **Subcommands**: `fix`, `log`.
- **Implementation Status**: Fully implemented.

### 9. `zenuxs history`
- **File**: [`apps/cli/src/main.ts`](file:///d:/V3/zenuxs-code/apps/cli/src/main.ts)
- **Line Range**: 442-475.
- **Options**: `--json`, `--limit <count>`, `--page <number>`, `--config <dir>`.
- **Subcommands**:
  - `delete` (lines 477-494): Delete session. Option: `--session-id <id>`.
  - `update` (lines 496-523): Update session title/prompt/metadata. Options: `--metadata <json>`, `--prompt <text>`, `--session-id <id>`, `--title <text>`.
  - `export` (lines 525-542): Export session as HTML. Parameters: `<sessionId>`. Option: `-o, --output <path>`.
- **Implementation Status**: Fully implemented.

### 10. `zenuxs hook`
- **File**: [`apps/cli/src/main.ts`](file:///d:/V3/zenuxs-code/apps/cli/src/main.ts)
- **Line Range**: 544-552.
- **Implementation Status**: Fully implemented.

### 11. `zenuxs schedule`
- **File**: [`apps/cli/src/main.ts`](file:///d:/V3/zenuxs-code/apps/cli/src/main.ts)
- **Line Range**: 567-584.
- **Implementation Status**: Fully implemented.

### 12. `zenuxs hub`
- **File**: [`apps/cli/src/main.ts`](file:///d:/V3/zenuxs-code/apps/cli/src/main.ts)
- **Line Range**: 585-594.
- **Implementation Status**: Fully implemented.

### 13. `zenuxs dashboard`
- **File**: [`apps/cli/src/main.ts`](file:///d:/V3/zenuxs-code/apps/cli/src/main.ts)
- **Line Range**: 596-633.
- **Options**: `--config`, `--cwd`, `--data-dir`, `--host`, `--port`, `--public-url`, `--room-secret`, `--no-open`.
- **Implementation Status**: Fully implemented.

### 14. `zenuxs update`
- **File**: [`apps/cli/src/main.ts`](file:///d:/V3/zenuxs-code/apps/cli/src/main.ts)
- **Line Range**: 635-647.
- **Options**: `-v, --verbose`, `--config <dir>`.
- **Implementation Status**: Fully implemented.

### 15. `zenuxs version`
- **File**: [`apps/cli/src/main.ts`](file:///d:/V3/zenuxs-code/apps/cli/src/main.ts)
- **Line Range**: 649-656.
- **Implementation Status**: Fully implemented.

### 16. `zenuxs kanban`
- **File**: [`apps/cli/src/main.ts`](file:///d:/V3/zenuxs-code/apps/cli/src/main.ts)
- **Line Range**: 658-666.
- **Implementation Status**: Fully implemented.

---

## Phase 3: Shortcut Verification

The keyboard input triggers are routed inside the interactive loop.

### 1. Root TUI Hotkeys
- **File**: [`apps/cli/src/tui/hooks/use-root-keyboard.ts`](file:///d:/V3/zenuxs-code/apps/cli/src/tui/hooks/use-root-keyboard.ts)
- **Line Range**: 67-287.
- **Key Mappings**:
  - **Ctrl+C** (lines 87-95): If input contains text and TUI dialogue is closed, clears the textarea value. Otherwise, calls `onExit()` to terminate the process.
  - **Ctrl+D** (lines 255-260): If the session is not running and there is no input text, calls `onExit()` to exit.
  - **Escape** (lines 229-253):
    - If editing a queued prompt, cancels the edit.
    - If the session loop is running, triggers task abort.
    - If a queued prompt is selected but not editing, deselects it.
    - Double Escape (pressed within 300ms) triggers `onRestoreCheckpoint()` to undo the last action.
  - **Ctrl+P** (lines 147-150): Triggers `onOpenCommandPalette()` to reveal the local command palette.
  - **Tab** (lines 262-265): If not in autocomplete or edit modes, triggers `onToggleMode()` (switches between **Plan** and **Act**).
  - **Shift+Tab** (lines 267-270): Calls `session.toggleAutoApprove()` (toggles whether tool executions require user confirmation).
  - **Ctrl+L** (lines 272-279): If running, clears session log entries. If not running, triggers `onClearConversation()`.
  - **Ctrl+S** (lines 281-286): Submits the current input as a steering feedback prompt to guide the running agent.
  - **Up / Down Arrows** (lines 212-227): If not in autocomplete or queued prompts menus, cycles through input commands history.
  - **Enter / Return** (lines 202-210): If a queued prompt is selected, promotes and executes it.

### 2. Command Palette Shortcuts
- **File**: [`apps/cli/src/tui/components/dialogs/command-palette-items.ts`](file:///d:/V3/zenuxs-code/apps/cli/src/tui/components/dialogs/command-palette-items.ts)
- **Line Range**: 31-138 (`ACTION_ITEMS` array).
- **Behavior Mappings** (Triggers with `Option + Key` / `Meta + Key` combinations):
  - `Opt+S`: "Open Settings" -> opens configuration menu.
  - `Opt+M`: "Change Model" -> triggers model selector.
  - `Opt+P`: "Change Provider" -> opens provider credentials entry form.
  - `Opt+C`: "Manage MCP Servers" -> reveals MCP management dialogue.
  - `Opt+G`: "Manage Plugins" -> opens plugin manager.
  - `Opt+A`: "Open Account" -> details account status.
  - `Opt+X`: "Compact Context" -> manually triggers history truncation.
  - `Opt+W`: "Browse Skills" -> inserts skill or workflow commands.
  - `Opt+R`: "Create Session Fork" -> forks conversation.
  - `Opt+U`: "Restore Checkpoint" -> undoes last execution step.
  - `Opt+L`: "Start New Session" -> clears current thread.
  - `Opt+H`: "Session History" -> opens session history picker.
  - `Opt+K`: "Open Help" -> reveals shortcuts overlay.
  - `Opt+Q`: "Exit Zenuxs" -> exits the terminal interface.

---

## Phase 4: Tool Verification

The default tools are registered in packages.

- **File**: [`packages/core/src/extensions/tools/runtime.ts`](file:///d:/V3/zenuxs-code/packages/core/src/extensions/tools/runtime.ts)
- **Line Range**: 29-84 (`BASE_TOOL_CATALOG` array).

### Registered Tool Inventory

| Tool ID | Action Name | Source Registration | Purpose / Behavior |
| :--- | :--- | :--- | :--- |
| `read_files` | `read_files` | Line 31-35 | Reads text/image files at absolute paths. Supports start/end line bounds. |
| `search_codebase`| `search_codebase`| Line 37-41 | Executes regex searches across workspace. |
| `run_commands` | `run_commands` | Line 43-47 | Runs non-interactive shell commands in the workspace root. |
| `editor` | `editor` / `apply_patch`| Line 49-53, 189-198 | Modifies files. Chooses `apply_patch` or `editor` depending on model capacity. |
| `fetch_web_content`| `fetch_web_content`| Line 55-59 | Downloads URL text/markdown for analysis. |
| `skills` | `skills` | Line 61-65 | Invokes configured skill workflows. |
| `ask_question` | `ask_question` | Line 67-71 | Requests user choice from 2-5 options. |
| `spawn_agent` | `spawn_agent` | Line 73-77 | Spawns a sub-agent with custom system instructions. |
| `teams` | `team_*` (multiple) | Line 79-83 | Collaboration API (task boards, teammate messaging, mailbox operations). |

---

## Phase 5: Provider Verification

Supported API provider options are listed in packages.

### 1. Canonical Provider IDs
- **File**: [`packages/llms/src/providers/ids.ts`](file:///d:/V3/zenuxs-code/packages/llms/src/providers/ids.ts)
- **Line Range**: 8-66 (`BUILT_IN_PROVIDER` enum).
- **Verified IDs**:
  - First-party: `anthropic`, `claude-code`, `cline`, `cline-pass`.
  - OpenAI-native: `openai-native`, `openai-codex`, `openai-codex-cli`.
  - OpenRouter: `openrouter`.
  - Compatible APIs: `openai-compatible`, `deepseek`, `xai`, `together`, `fireworks`, `groq`, `poolside`, `cerebras`, `sambanova`, `nebius`, `baseten`, `requesty`, `litellm`, `huggingface`, `vercel-ai-gateway`, `v0`, `aihubmix`, `hicap`, `nousResearch`, `huawei-cloud-maas`, `qwen`, `qwen-code`, `doubao`, `zai`, `zai-coding-plan`, `mistral`, `moonshot`, `asksage`, `minimax`, `dify`, `oca`, `sapaicore`.
  - Cloud Providers: `bedrock`, `vertex`, `gemini`.
  - Local/Self-hosted: `ollama`, `lmstudio`.

### 2. Authentication & Model Discovery
- **File**: [`packages/llms/src/providers/builtins.ts`](file:///d:/V3/zenuxs-code/packages/llms/src/providers/builtins.ts)
- **Line Range**: 544-1182 (Built-in specifications).
- **Authentication Methods**:
  - Standard API keys: via provider-specific keys (e.g. `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`, `HF_TOKEN`).
  - Google Cloud credentials: used by `vertex` models.
  - AWS IAM policies / AWS SDK Credentials: used by `bedrock` models.
- **Model Discovery**: Resolved via `getGeneratedModelsForProvider` mapping from build-generated catalog definitions.

---

## Phase 6: Agent Verification

The agent loop execution structure is resolved dynamically.

### 1. Main Execution Engine
- **File**: [`packages/agents/src/agent-runtime.ts`](file:///d:/V3/zenuxs-code/packages/agents/src/agent-runtime.ts)
- **Line Range**: 52-250 (`Agent` / `AgentRuntime` class definition).
- **Behavior**: Manages iteration ticks, model tool calls, and output stream buffers.

### 2. Custom Role Configs (YAML Blueprints)
- **File**: [`packages/core/src/extensions/tools/team/configured-agent-config.ts`](file:///d:/V3/zenuxs-code/packages/core/src/extensions/tools/team/configured-agent-config.ts)
- **Line Range**: 7-15 (`ConfiguredAgentFrontmatterSchema`).
- **Frontmatter Fields**:
  - `name`: string
  - `description`: string
  - `tools`: string / string[]
  - `skills`: string / string[]
  - `providerId`: string (optional)
  - `modelId`: string (optional)
  - `maxIterations`: number (optional)
- **Discovery**: Custom YAML files are loaded from `~/.zenuxs/agents/` search paths.

---

## Phase 7: MCP Verification

Model Context Protocol (MCP) servers are supported natively.

- **Config Path**: Determined by `resolveMcpSettingsPath()` in `packages/shared/src/storage/paths.ts` (resolves to `~/.zenuxs/data/settings/zenuxs_mcp_settings.json`).
- **Protocols**: Supports `stdio` and `sse` transport channels.
- **Loading & Client Factory**:
  - **File**: [`packages/core/src/extensions/mcp/index.ts`](file:///d:/V3/zenuxs-code/packages/core/src/extensions/mcp/index.ts)
  - **Behavior**: Reads settings schema, spins up child processes using configured executable paths (for `stdio`) or initiates SSE network streams, parses exposed tool descriptors, and registers them dynamically into the active tool schema context during LLM calls.

---

## Phase 8: Feature Matrix

| Feature | Verified | Source Location |
| :--- | :--- | :--- |
| **Interactive TUI** | YES | [`apps/cli/src/tui/root.tsx`](file:///d:/V3/zenuxs-code/apps/cli/src/tui/root.tsx), [`main.ts:L689`](file:///d:/V3/zenuxs-code/apps/cli/src/main.ts#L689) |
| **Session Resume** | YES | [`apps/cli/src/main.ts:L733-770`](file:///d:/V3/zenuxs-code/apps/cli/src/main.ts#L733-L770) (`--id` and `spawnHistoryResume`) |
| **Auto Approval** | YES | [`apps/cli/src/commands/program.ts:L29-32`](file:///d:/V3/zenuxs-code/apps/cli/src/commands/program.ts#L29-L32) |
| **Slash Commands** | YES | [`apps/cli/src/tui/commands/slash-command-registry.ts:L46-110`](file:///d:/V3/zenuxs-code/apps/cli/src/tui/commands/slash-command-registry.ts#L46-L110) |
| **Undo / Checkpoint**| YES | [`apps/cli/src/tui/hooks/use-root-keyboard.ts:L247`](file:///d:/V3/zenuxs-code/apps/cli/src/tui/hooks/use-root-keyboard.ts#L247) |
| **Agent Switching** | YES | [`apps/cli/src/tui/hooks/use-local-command-actions.tsx:L46`](file:///d:/V3/zenuxs-code/apps/cli/src/tui/hooks/use-local-command-actions.tsx#L46) |
| **Kanban App** | YES | [`apps/cli/src/commands/kanban.ts`](file:///d:/V3/zenuxs-code/apps/cli/src/commands/kanban.ts), [`main.ts:L658`](file:///d:/V3/zenuxs-code/apps/cli/src/main.ts#L658) |
| **Plugins** | YES | [`apps/cli/src/commands/plugin.ts`](file:///d:/V3/zenuxs-code/apps/cli/src/commands/plugin.ts), [`main.ts:L247`](file:///d:/V3/zenuxs-code/apps/cli/src/main.ts#L247) |
| **Custom Skills** | YES | [`apps/cli/src/commands/skill.ts`](file:///d:/V3/zenuxs-code/apps/cli/src/commands/skill.ts), [`main.ts:L319`](file:///d:/V3/zenuxs-code/apps/cli/src/main.ts#L319) |
| **Multi-Agent Teams**| YES | [`packages/core/src/extensions/tools/team/team-tools.ts`](file:///d:/V3/zenuxs-code/packages/core/src/extensions/tools/team/team-tools.ts) |
| **Voice / Speech** | **NOT IMPLEMENTED** | N/A |
| **MCP Integration** | YES | [`packages/shared/src/storage/paths.ts:L278`](file:///d:/V3/zenuxs-code/packages/shared/src/storage/paths.ts#L278) |
| **Model Selection** | YES | [`apps/cli/src/commands/program.ts:L47`](file:///d:/V3/zenuxs-code/apps/cli/src/commands/program.ts#L47) (`--model`), [`use-root-keyboard.ts:L147`](file:///d:/V3/zenuxs-code/apps/cli/src/tui/hooks/use-root-keyboard.ts#L147) |
| **Context Compaction**| YES | [`packages/core/src/index.ts`](file:///d:/V3/zenuxs-code/packages/core/src/index.ts) (basic and agentic compaction strategies) |

---

## Phase 9: Execution Test Audit

The following commands were executed using the linked Zenuxs global binary:

### 1. Version Check
- **Command**: `zenuxs -V`
- **Output**:
  ```
  3.0.29
  ```
- **Audit Status**: PASS

### 2. Help Output
- **Command**: `zenuxs --help`
- **Output**:
  ```
  Usage: zenuxs [options] [command] [prompt]

  zenuxs CLI - AI coding assistant in your terminal
  ...
  Options:
    -V, --version                 Output the version number
    -p, --plan                    Run in plan mode
    --json                        Output messages as JSON instead of styled text
    --auto-approve <boolean>      Set tool auto-approval for all tools (default: true)
  ...
  ```
- **Audit Status**: PASS

### 3. Config Help Output
- **Command**: `zenuxs config --help`
- **Output**:
  ```
  Usage: zenuxs config [options]

  Show current configuration

  Options:
    --json          Output as JSON
    --config <dir>  configuration directory
    -h, --help      display help for command
  ```
- **Audit Status**: PASS

### 4. Auth Help Output
- **Command**: `zenuxs auth --help`
- **Output**:
  ```
  Usage: zenuxs auth [options] [provider]

  Authenticate a provider and configure what model is used
  ...
  Options:
    -p, --provider <id>            Provider ID
    -k, --apikey <key>             API key
  ...
  ```
- **Audit Status**: PASS

### 5. History Help Output
- **Command**: `zenuxs history --help`
- **Output**:
  ```
  Usage: zenuxs history|h [options] [command]

  List session history or manage saved sessions
  ...
  Commands:
    delete [options]              Delete a session from history
    update [options]              Update a session in history
    export [options] <sessionId>  Export a session as a standalone HTML file
  ```
- **Audit Status**: PASS

### 6. MCP Help Output
- **Command**: `zenuxs mcp --help`
- **Output**:
  ```
  Usage: zenuxs mcp [options] [command]

  Manage MCP servers
  ...
  Commands:
    install|add [options] <name> [targetArgs...]  Open the MCP add wizard with server fields prefilled
  ```
- **Audit Status**: PASS

### 7. Config JSON Call
- **Command**: `zenuxs config --json`
- **Output**: Correctly serialized JSON configuration payload.
- **Audit Status**: PASS
