# Zenuxs-Code — Complete Tools Catalogue

> **Generated:** 2026-07-22  
> **Scope:** `d:\V3\zenuxs-code` only (no external codebases)  
> **Purpose:** Authoritative reference of every agent tool implemented in zenuxs-code

---

## Statistics

| Metric | Count |
| :--- | :---: |
| **Core Default Tools** | 11 |
| **Core Enhanced Tools** | 13 |
| **Team / Multi-Agent Tools** | 19 |
| **VS Code Extension Native Tools** | 2 |
| **Total Unique Tool IDs** | **45** |

---

## Layer 1 — Core Default Tools

> Defined in `packages/core/src/extensions/tools/definitions.ts`
> Constants declared in `packages/core/src/extensions/tools/constants.ts`

These are the foundational tools available to every Zenuxs agent by default.

| # | Tool ID / Name | Factory Function | Source Line | Description |
| :-- | :--- | :--- | :--- | :--- |
| 1 | `read_files` | `createReadFilesTool()` | definitions.ts:216 | Read content of text or image files at absolute paths. Supports line ranges (`start_line`/`end_line`). Returns up to ~500 lines per read; longer files are pageable. |
| 2 | `list_directory` | `createListDirectoryTool()` | definitions.ts:170 | List the contents of a directory. Returns a formatted listing with file/directory indicators. Useful for exploring project structure. |
| 3 | `search_codebase` | `createSearchTool()` | definitions.ts:310 | Perform regex pattern searches across the codebase. Supports multiple parallel queries in one call. Used for finding definitions, imports, class names. |
| 4 | `run_commands` | `createBashTool()` | definitions.ts:376 | Run shell commands (bash/sh) from workspace root. Concurrent-safe; supports multiple commands per call. 30s default timeout. |
| 4w | `run_commands` *(Windows)* | `createWindowsShellTool()` | definitions.ts:468 | Windows-specific variant of `run_commands`. Uses structured `{ command, args }` entries for portability. Auto-selected on `win32` platform. |
| 5 | `fetch_web_content` | `createWebFetchTool()` | definitions.ts:539 | Fetch content from URLs and analyse with a prompt. Multiple independent URLs can be fetched in a single call. |
| 6 | `editor` | `createEditorTool()` | definitions.ts:682 | Controlled filesystem edits on text files. Supports `create` (new file), `replace` (old to new text), and `insert` (at line number). |
| 6a | `apply_patch` | `createApplyPatchTool()` | definitions.ts:633 | Alternative editor using the canonical apply_patch grammar (`*** Begin Patch` / `*** End Patch`). Mutually exclusive with `editor`; controlled by `enableApplyPatch` flag. |
| 7 | `skills` | `createSkillsTool()` | definitions.ts:752 | Invoke a configured skill by name + optional args. Dynamically lists available (non-disabled) skills in its description. |
| 8 | `ask_question` | `createAskQuestionTool()` | definitions.ts:798 | Ask the user a single clarifying question with 2-5 selectable options. Used only in interactive (non-submit) modes. |
| 9 | `submit_and_exit` | `createSubmitAndExitTool()` | definitions.ts:822 | Submit final answer and terminate the agent run. Only enabled in headless/YOLO mode (`enableSubmitAndExit: true`). Marks run as completed. |

---

## Layer 2 — Core Enhanced Tools

> Defined in `packages/core/src/extensions/tools/enhanced-index.ts`
> Individual implementations in `packages/core/src/extensions/tools/`

These tools were ported from OpenCode to provide higher-intelligence, production-grade capabilities.

### File Read

| # | Tool ID / Name | Factory Function | Source File | Description |
| :-- | :--- | :--- | :--- | :--- |
| 10 | `read` | `createEnhancedFileReadTool()` | file-read-enhanced.ts:176 | BOM-aware, encoding-safe file reader. Supports line ranges, binary detection, large file windowing. |

### File Write / Edit

| # | Tool ID / Name | Factory Function | Source File | Description |
| :-- | :--- | :--- | :--- | :--- |
| 11 | `write` / `write_file` | `createEnhancedWriteTool()` | editor-enhanced.ts:651 | BOM-aware file writer with content verification, file locking (semaphore), line ending normalization, and disk-write confirmation. |
| 12 | `edit` / `editor` (enhanced) | `createEnhancedEditorTool()` | editor-enhanced.ts:511 | 9-strategy fuzzy text replacer (Levenshtein, whitespace, indentation, escape normalization, block anchors, multi-occurrence). LSP diagnostics + auto-format after edit. |

### File Operations

| # | Tool ID / Name | Factory Function | Source File | Description |
| :-- | :--- | :--- | :--- | :--- |
| 13 | `create_file` | `createCreateFileTool()` | file-ops-enhanced.ts:65 | Create a new empty or initial content file at a path. Creates parent directories automatically. |
| 14 | `delete_file` | `createDeleteFileTool()` | file-ops-enhanced.ts:106 | Delete a file or directory (recursive) at the specified path. |
| 15 | `move_file` | `createMoveFileTool()` | file-ops-enhanced.ts:150 | Move or rename a file/directory. Accepts `source`/`src`/`from` to `destination`/`dest`/`to`. |
| 16 | `copy_file` | `createCopyFileTool()` | file-ops-enhanced.ts:202 | Copy a file or directory (recursive) from source to destination. |

### Search

| # | Tool ID / Name | Factory Function | Source File | Description |
| :-- | :--- | :--- | :--- | :--- |
| 17 | `glob` | `createEnhancedGlobTool()` | glob-grep-enhanced.ts:127 | Find files matching a glob pattern (`**/*.ts`, `src/**`) using fast FS traversal with directory/exclude support. Returns up to 100 matches. |
| 18 | `grep` | `createEnhancedGrepTool()` | glob-grep-enhanced.ts:233 | Search file contents using ripgrep (falls back to regex). Supports file type filtering (`include`) and context lines. |

### Shell

| # | Tool ID / Name | Factory Function | Source File | Description |
| :-- | :--- | :--- | :--- | :--- |
| 19 | `bash` / `run_commands` (enhanced) | `createEnhancedShellTool()` | shell-enhanced.ts:206 | Enhanced shell executor with built-in danger detection (blocks `rm -rf /`, `sudo rm`, etc.), configurable approval callback, and output streaming. |

### Web

| # | Tool ID / Name | Factory Function | Source File | Description |
| :-- | :--- | :--- | :--- | :--- |
| 20 | `webfetch` | `createWebFetchTool()` (enhanced) | web-enhanced.ts:137 | Fetch URL content with configurable timeout. Markdown conversion for HTML pages. |
| 21 | `websearch` / `web_search` | `createWebSearchTool()` | web-enhanced.ts:306 | Perform web searches and return structured results with URLs and snippets. Enabled when `enableWebSearch: true`. |

### Planning

| # | Tool ID / Name | Factory Function | Source File | Description |
| :-- | :--- | :--- | :--- | :--- |
| 22 | `todowrite` | `createTodoWriteTool()` | todo-enhanced.ts:64 | Update the session's todo list (tasks, statuses: pending/in_progress/completed/cancelled, priorities: high/medium/low). In-memory per session. |
| 23 | `plan_exit` | `createPlanExitTool()` | todo-enhanced.ts:97 | Exit plan mode and request switch to build/act mode. Enabled in `plan` preset (`enablePlanExit: true`). Requires user confirmation from UI. |

---

## Layer 3 — Team / Multi-Agent Tools

> Defined in `packages/core/src/extensions/tools/team/team-tools.ts`
> Registered as the `"teams"` catalog entry (all-or-nothing)

Tools enabling multi-agent collaboration, task delegation, messaging, and outcome tracking.

### Agent Lifecycle

| # | Tool Name | Line | Description |
| :-- | :--- | :---: | :--- |
| 24 | `team_spawn_teammate` | 299 | Spawn a new teammate agent with a given role and configuration. |
| 25 | `team_shutdown_teammate` | 349 | Shut down an active teammate agent. |
| 26 | `team_status` | 374 | Get the status of the current team and all active teammates. |

### Task Delegation

| # | Tool Name | Line | Description |
| :-- | :--- | :---: | :--- |
| 27 | `team_task` | 390 | Delegate a blocking synchronous task to a specific teammate. Waits for result. |
| 28 | `team_run_task` | 491 | Start a non-blocking async task run on a teammate. Returns a run ID immediately. |
| 29 | `team_cancel_run` | 559 | Cancel an in-progress async task run by run ID. |
| 30 | `team_list_runs` | 578 | List all active or completed async task runs. |
| 31 | `team_await_runs` | 594 | Block and wait for one or more async task runs to complete. |

### Communication

| # | Tool Name | Line | Description |
| :-- | :--- | :---: | :--- |
| 32 | `team_send_message` | 631 | Send a direct message to a specific teammate's mailbox. |
| 33 | `team_broadcast` | 656 | Broadcast a message to all active teammates simultaneously. |
| 34 | `team_read_mailbox` | 678 | Read messages from the current agent's mailbox. |
| 35 | `team_mission_log` | 699 | Write a mission log entry visible to all team members. |

### Cleanup

| # | Tool Name | Line | Description |
| :-- | :--- | :---: | :--- |
| 36 | `team_cleanup` | 726 | Cleanup team resources, shutdown all teammates, free allocated contexts. |

### Outcomes (Results Aggregation)

| # | Tool Name | Line | Description |
| :-- | :--- | :---: | :--- |
| 37 | `team_create_outcome` | 745 | Create a new shared outcome container for aggregating results. |
| 38 | `team_attach_outcome_fragment` | 772 | Attach a result fragment from a teammate to a shared outcome. |
| 39 | `team_review_outcome_fragment` | 800 | Review and validate a previously attached outcome fragment. |
| 40 | `team_finalize_outcome` | 824 | Finalize and seal the outcome after all fragments are reviewed. |
| 41 | `team_list_outcomes` | 846 | List all outcomes created during the current session. |

---

## Layer 3b — Sub-Agent Tool

> Defined in `packages/core/src/extensions/tools/team/spawn-agent-tool.ts`

| # | Tool ID / Name | Factory Function | Description |
| :-- | :--- | :--- | :--- |
| 42 | `spawn_agent` | `createSpawnAgentTool()` | Spawn a focused sub-agent with a custom system prompt and task. Returns text result, iteration count, finish reason, and token usage. 5-minute timeout. Enabled via `enableSpawnAgent: true`. |

---

## Layer 4 — VS Code Extension Native Tools

> Defined in `apps/vscode-extension/src/tools/`
> Wired into `ExtensionCoreBridge` as `toolExecutors` in `apps/vscode-extension/src/runtime/core-bridge.ts`

These tools are implemented using native VS Code Extension APIs and are only available inside the VS Code extension environment.

| # | Tool ID / Name | Class | Source File | Description |
| :-- | :--- | :--- | :--- | :--- |
| 43 | `editor` *(vscode)* | `VsCodeEditorTool` | tools/editor-tool.ts | Live file editing via `openTextDocument` + `showTextDocument`. Applies range edits using `TextEditor.edit` (with `WorkspaceEdit` fallback). Supports `targetContent` verification, auto-save, and descending edit ordering to prevent line shift. |
| 44 | `bash` *(vscode)* | `VsCodeTerminalTool` | tools/terminal-tool.ts | Dedicated "Zenuxs Agent Terminal" management with VS Code Shell Integration API streaming. Supports long-running background commands (dev servers, watchers). Falls back to `sendText` when Shell Integration is unavailable. |

---

## Preset Availability Matrix

> Defined in `packages/core/src/extensions/tools/presets.ts`

| Tool Group | `act` | `plan` | `search` | `minimal` | `yolo` |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `read_files` | yes | yes | yes | no | yes |
| `list_directory` | yes | yes | yes | no | yes |
| `search_codebase` | yes | yes | yes | no | no |
| `run_commands` | yes | yes | no | yes | yes |
| `fetch_web_content` | yes | yes | no | no | no |
| `editor` | yes | no | no | no | yes |
| `apply_patch` | no | no | no | no | no |
| `skills` | yes | yes | no | no | no |
| `ask_question` | yes | yes | no | no | no |
| `submit_and_exit` | no | no | no | no | yes |
| `spawn_agent` | yes | yes | yes | yes | no |
| `teams` (all team_* tools) | yes | yes | yes | no | no |
| `write_file` | yes | no | no | no | yes |
| `glob` | yes | yes | no | no | no |
| `grep` | yes | yes | no | no | no |
| `web_search` | yes | yes | no | no | no |
| `todowrite` | yes | yes | no | no | no |
| `plan_exit` | no | yes | no | no | no |

---

## Tool Catalog IDs (for `getCoreBuiltinToolCatalog`)

> Defined in `packages/core/src/extensions/tools/runtime.ts`

These are the stable catalog IDs used in tool selection, settings UI, and headless tool name resolution.

```
read_files        headless: ["read_files"]
search_codebase   headless: ["search_codebase"]
run_commands      headless: ["run_commands"]
editor            headless: ["editor"] or ["apply_patch"] (context-dependent)
fetch_web_content headless: ["fetch_web_content"]
skills            headless: ["skills"]
ask_question      headless: ["ask_question"]
spawn_agent       headless: ["spawn_agent"]
teams             headless: [...all 18 team_* tool names]
write_file        headless: ["write_file"]
glob              headless: ["glob"]
grep              headless: ["grep"]
web_search        headless: ["web_search"]
todo_write        headless: ["todo_write"]
plan_exit         headless: ["plan_exit"]
```

---

## Key Source Files

| File | Purpose |
| :--- | :--- |
| `packages/core/src/extensions/tools/constants.ts` | `DefaultToolNames` enum + `ALL_DEFAULT_TOOL_NAMES` array |
| `packages/core/src/extensions/tools/definitions.ts` | Default tool factory functions + `createDefaultTools()` |
| `packages/core/src/extensions/tools/executors/index.ts` | Built-in Node.js executors + `createDefaultExecutors()` |
| `packages/core/src/extensions/tools/enhanced-index.ts` | `createAllEnhancedTools()` + enhanced tool registry |
| `packages/core/src/extensions/tools/registry.ts` | `ToolRegistry` + `DoomLoopDetector` |
| `packages/core/src/extensions/tools/presets.ts` | `ToolPresets` (act/plan/search/minimal/yolo) + policies |
| `packages/core/src/extensions/tools/runtime.ts` | `getCoreBuiltinToolCatalog()` + catalog entry resolution |
| `packages/core/src/extensions/tools/team/team-tools.ts` | All 18 `team_*` tool definitions |
| `packages/core/src/extensions/tools/team/spawn-agent-tool.ts` | `spawn_agent` sub-agent delegation tool |
| `apps/vscode-extension/src/tools/editor-tool.ts` | VS Code native live file editor |
| `apps/vscode-extension/src/tools/terminal-tool.ts` | VS Code native dedicated terminal |
| `apps/vscode-extension/src/runtime/core-bridge.ts` | Wires VS Code native tools into `ZenuxsCore` |
