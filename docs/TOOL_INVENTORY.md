# Tool Inventory

## Core Tool Definitions

### File Operations

| Tool Name | File Location | Schema | Executor | Purpose | Integrated |
|-----------|--------------|--------|----------|---------|------------|
| `read_files` | definitions.ts:160-246 | ReadFileRequestSchema | executors/file-read.ts | Read files with pagination | ✓ Yes |
| `read` | file-read-enhanced.ts:171-305 | ReadFileRequestSchema | Inline | Enhanced read with binary detection, fuzzy suggestions | ✗ No |

### Search Operations

| Tool Name | File Location | Schema | Executor | Purpose | Integrated |
|-----------|--------------|--------|----------|---------|------------|
| `search_codebase` | definitions.ts:253-308 | SearchCodebaseInputSchema | executors/search.ts | Regex codebase search | ✓ Yes |
| `grep` | glob-grep-enhanced.ts | Inline | - | Enhanced grep | ✗ No |
| `glob` | glob-grep-enhanced.ts | Inline | - | File globbing | ✗ No |

### Shell Operations

| Tool Name | File Location | Schema | Executor | Purpose | Integrated |
|-----------|--------------|--------|----------|---------|------------|
| `run_commands` / `run_command` | definitions.ts:315-400 | RunCommandsInputSchema | executors/bash.ts | Shell command execution | ✓ Yes |
| `bash` | shell-enhanced.ts:197-315 | ShellInputSchema | Inline | Enhanced shell with safety | ✗ No |

### Edit Operations

| Tool Name | File Location | Schema | Executor | Purpose | Integrated |
|-----------|--------------|--------|----------|---------|------------|
| `editor` | definitions.ts:625-681 | EditFileInputSchema | executors/editor.ts | File editing | ✓ Yes |
| `apply_patch` | definitions.ts:576-618 | ApplyPatchInputSchema | executors/apply-patch.ts | Patch format editing | ✓ Yes |
| `edit` | editor-enhanced.ts | Inline | - | Enhanced editor | ✗ No |
| `write` | editor-enhanced.ts | Inline | - | Enhanced write | ✗ No |

### Web Operations

| Tool Name | File Location | Schema | Executor | Purpose | Integrated |
|-----------|--------------|--------|----------|---------|------------|
| `fetch_web_content` | definitions.ts:483-531 | FetchWebContentInputSchema | executors/web-fetch.ts | URL fetching | ✓ Yes |
| `webfetch` | web-enhanced.ts | Inline | - | Enhanced fetch | ✗ No |
| `websearch` | web-enhanced.ts | Inline | - | Web search | ✗ No |

### Multi-Agent Team Tools

| Tool Name | File Location | Schema | Executor | Purpose | Integrated |
|-----------|--------------|--------|----------|---------|------------|
| `team_spawn_teammate` | team-tools.ts:298-341 | TeamSpawnTeammateInputSchema | AgentTeamsRuntime | Spawn agent teammate | ✓ Yes |
| `team_shutdown_teammate` | team-tools.ts:347-370 | TeamShutdownTeammateInputSchema | AgentTeamsRuntime | Stop teammate | ✓ Yes |
| `team_status` | team-tools.ts:372-386 | TeamStatusInputSchema | AgentTeamsRuntime | Team status snapshot | ✓ Yes |
| `team_task` | team-tools.ts:388-482 | TeamTaskInputSchema | AgentTeamsRuntime | Shared task management | ✓ Yes |
| `team_run_task` | team-tools.ts:489-555 | TeamRunTaskInputSchema | AgentTeamsRuntime | Delegate task to teammate | ✓ Yes |
| `team_cancel_run` | team-tools.ts:557-574 | TeamCancelRunInputSchema | AgentTeamsRuntime | Cancel async run | ✓ Yes |
| `team_await_runs` | team-tools.ts:592-627 | TeamAwaitRunsInputSchema | AgentTeamsRuntime | Wait for completion | ✓ Yes |
| `team_send_message` | team-tools.ts:629-652 | TeamSendMessageInputSchema | AgentTeamsRuntime | Mailbox messaging | ✓ Yes |
| `team_broadcast` | team-tools.ts:654-674 | TeamBroadcastInputSchema | AgentTeamsRuntime | Broadcast to teammates | ✓ Yes |
| `team_read_mailbox` | team-tools.ts:676-695 | TeamReadMailboxInputSchema | AgentTeamsRuntime | Read mailbox | ✓ Yes |
| `team_mission_log` | team-tools.ts:697-722 | TeamMissionLogInputSchema | AgentTeamsRuntime | Mission log | ✓ Yes |
| `team_cleanup` | team-tools.ts:724-741 | TeamCleanupInputSchema | AgentTeamsRuntime | Team cleanup | ✓ Yes |
| `team_create_outcome` | team-tools.ts:743-765 | TeamCreateOutcomeInputSchema | AgentTeamsRuntime | Create outcome | ✓ Yes |
| `team_attach_outcome_fragment` | team-tools.ts:767-793 | TeamAttachOutcomeFragmentInputSchema | AgentTeamsRuntime | Attach outcome fragment | ✓ Yes |
| `team_review_outcome_fragment` | team-tools.ts:795-819 | TeamReviewOutcomeFragmentInputSchema | AgentTeamsRuntime | Review fragment | ✓ Yes |
| `team_finalize_outcome` | team-tools.ts:821-842 | TeamFinalizeOutcomeInputSchema | AgentTeamsRuntime | Finalize outcome | ✓ Yes |
| `team_list_outcomes` | team-tools.ts:844-857 | TeamListOutcomesInputSchema | AgentTeamsRuntime | List outcomes | ✓ Yes |

---

## Tool Registration Flow

### Currently Used Path
```
CLI (main.ts)
  └─> createDefaultExecutors (executors/index.ts)
      └─> createFileReadExecutor (executors/file-read.ts)
      └─> createBashExecutor (executors/bash.ts)
      └─> createEditorExecutor (executors/editor.ts)
      └─> createSearchExecutor (executors/search.ts)
      └─> createWebFetchExecutor (executors/web-fetch.ts)
```

### Available But Unused
```
Enhanced Tools (enhanced-index.ts)
  └─> createEnhancedFileReadTool (separate from executor)
  └─> createEnhancedShellTool (separate from executor)
  └─> createEnhancedEditorTool (separate from executor)
```

---

## Tool Parameters

### read_files
```typescript
{
  path: string;          // Required: file path
  offset?: number;       // Optional: start line (1-indexed)
  limit?: number;        // Optional: max lines (default 2000)
}
```

### run_commands
```typescript
{
  commands: string[];    // Commands to execute
  // or single command string
}
```

### editor
```typescript
{
  path: string;          // Required: file path
  new_text: string;      // Required: replacement text
  old_text?: string;     // Optional: text to replace (creates if missing)
  insert_line?: number;  // Optional: insert at line number
}
```

### apply_patch
```typescript
{
  input: string;         // Patch content in canonical format
}
```

---

## Tool Safety Features

### Active (in executors)
- Timeout support ✓
- AbortSignal handling ✓
- Path safety checks ✓

### Available (in enhanced)
- Dangerous pattern detection ✗
- File operation scanning ✗
- External directory permission ✗
- Binary file detection ✗
- Fuzzy suggestions ✗

---

## Tool Invocation Points

1. **AgentRuntime.generateAssistantMessage()** - Model generates tool calls
2. **AgentRuntime.executeToolCalls()** - Executes tool calls (sequential or parallel)
3. **ToolRuntime.dispatch()** - Shared dispatch with validation
4. **McpLayer.callTool()** - MCP tool invocation

---

## MCP Tool Integration Gap

The MCP layer provides tool descriptions via `getToolDescriptions()` but does NOT:
- Convert MCP schemas to AgentTool format
- Register tools with AgentRuntime.tools Map
- Wrap MCP tool calls for proper context/metadata handling

This means MCP-discovered tools appear in prompts but aren't executable as native tools.