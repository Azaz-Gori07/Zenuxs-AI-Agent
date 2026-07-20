# Zenuxs VS Code Extension — UI Feature Inventory

> Generated from `apps/vscode-extension/` source code analysis.

---

# Activity Bar

## Zenuxs Activity Bar Icon

**Location**
- `package.json:107-112` — viewsContainers.activitybar contribution
- `assets/ChatGPT-3.png` — icon asset

**UI Type**
Activity Bar Container

**Visible Label**
Zenuxs

**Icon**
`assets/ChatGPT-3.png`

**Trigger**
- Click on Activity Bar icon

**Current Behavior**
Opens the Zenuxs sidebar panel showing the chat webview.

**Backend Flow**
- VS Code activates the extension via `onView:zenuxs-chat` activation event
- `extension.ts:52-65` — registers `ZenuxsChatViewProvider` as the webview provider for `zenuxs-chat` view

**Status**
- ✅ Working

---

# Sidebar / Panel

## Zenuxs Chat Panel (zenuxs-chat)

**Location**
- `package.json:114-122` — views contribution
- `extension.ts:52-65` — WebviewViewProvider registration
- `providers/chat-view-provider.ts:251-1586+` — provider class

**UI Type**
Webview Panel (VS Code Sidebar)

**Visible Label**
Zenuxs

**Icon**
`assets/ChatGPT-3.png`

**Trigger**
- Click Activity Bar icon
- Command Palette: `Zenuxs: Open Chat`
- Keyboard: `Ctrl+Shift+I` (no selection)
- Programmatic: `zenuxs-chat.focus`

**Current Behavior**
Displays the React-based chat webview with message history, input area, status bar, and controls.

**Backend Flow**
- `ZenuxsChatViewProvider.resolveWebviewView()` (line 272) sets up webview HTML, style, and message listener
- `webview-html.ts` generates the HTML/CSS/JS for the webview
- `webview/index.tsx` mounts the React app
- `webview/App.tsx` renders the correct view based on `state.activeTab`

**Dependencies**
- `webview/webview-html.ts`
- `webview/index.tsx`
- `webview/App.tsx`
- `webview/context/ExtensionStateContext.tsx`
- `webview/context/stores.ts`

**Status**
- ✅ Working

---

# Chat

## Chat Input Textarea

**Location**
- `webview/components/ChatView.tsx:463-473`

**UI Type**
Textarea Input

**Visible Label**
Placeholder: "Ask Zenuxs... (/explain, /fix, /mode plan)"

**Icon**
N/A

**Trigger**
- Type text
- Enter to send (without Shift)
- Autocompletes `/` slash commands

**Current Behavior**
Multi-line text input with auto-resize (min 80px, max 150px). Supports slash command autocomplete.

**Backend Flow**
- `handleInputChange` (line 138) — updates local state, triggers autocomplete
- `handleKeyDown` (line 151) — handles Enter, ArrowUp/Down, Escape for autocomplete
- `handleSend` (line 171) — dispatches `ADD_USER_MESSAGE`, publishes `user_message_sent`, posts `send` message

**Status**
- ✅ Working

## Send Button

**Location**
- `webview/components/ChatView.tsx:531-538`

**UI Type**
Icon Button

**Visible Label**
Send (Enter)

**Icon**
Paper-plane SVG icon

**Trigger**
- Click (only visible when input has text)
- Enter key

**Current Behavior**
Sends the current input text as a prompt. Disabled while `executionState.isRunning`.

**Backend Flow**
- Calls `handleSend()` → `sendMessage()` → dispatches `ADD_USER_MESSAGE`, publishes `user_message_sent`, posts `{type:"send", prompt}` to extension
- Extension receives in `chat-view-provider.ts:430-432` → `handleSend(prompt)`

**Status**
- ✅ Working

## Slash Command Autocomplete

**Location**
- `webview/components/ChatView.tsx:14-21` (commands list), `446-460` (autocomplete dropdown)

**UI Type**
Dropdown (autocomplete popup)

**Visible Label**
Commands listed: `/explain`, `/fix`, `/test`, `/refactor`, `/new`, `/mode`

**Icon**
N/A

**Trigger**
- Typing `/` in the input
- Arrow keys to navigate
- Enter/Tab to select
- Escape to dismiss

**Current Behavior**
Filters `SLASH_COMMANDS` array based on typed prefix. Highlights selected item.

**Backend Flow**
- Client-only filtering of `SLASH_COMMANDS` constant
- `/explain` → dispatches `ADD_USER_MESSAGE`, `APPEND_ASSISTANT_TEXT`
- `/fix` → dispatches `ADD_USER_MESSAGE`, `APPEND_ASSISTANT_TEXT`
- `/test` → dispatches `ADD_USER_MESSAGE`, `APPEND_ASSISTANT_TEXT`
- `/refactor` → dispatches `ADD_USER_MESSAGE`, `APPEND_ASSISTANT_TEXT`
- `/new` → dispatches `RESET_SESSION`
- `/mode <mode>` → dispatches `UPDATE_CONFIG`, saves settings, dispatches `ADD_USER_MESSAGE`, `APPEND_ASSISTANT_TEXT`

**Dependencies**
- `ExtensionStateContext.tsx` actions: `dispatch`, `saveSettings`

**Status**
- ✅ Working

## Model Switcher Button

**Location**
- `webview/components/ChatView.tsx:477-498`

**UI Type**
Button + Dropdown

**Visible Label**
Model name (short form) with ▾ arrow

**Icon**
N/A

**Trigger**
- Click to toggle dropdown

**Current Behavior**
Shows available models for the current provider in a dropdown above the button. Selecting a model updates config and saves settings.

**Backend Flow**
- `selectModel()` (line 107) — dispatches `UPDATE_CONFIG`, calls `saveSettings()`
- Models list from `state.models[providerId]` or `["default"]`

**Status**
- ✅ Working

## Mode Switcher Button

**Location**
- `webview/components/ChatView.tsx:505-528`

**UI Type**
Button + Dropdown

**Visible Label**
Mode name with ▾ arrow (color-coded by mode)

**Icon**
N/A

**Trigger**
- Click to toggle dropdown

**Current Behavior**
Dropdown with modes: Act, Plan, Ask, Debug, God Mode. Each color-coded. Selecting a mode updates config and saves.

**Backend Flow**
- `selectMode()` (line 101) — dispatches `UPDATE_CONFIG`, calls `saveSettings()`
- Modes defined in `MODE_LABELS` (line 23): act, plan, yolo, zen, ask, debug, god

**Status**
- ✅ Working

## Attach File Context Button

**Location**
- `webview/components/ChatView.tsx:541-547`

**UI Type**
Button

**Visible Label**
Attach File Context

**Icon**
Paperclip SVG icon

**Trigger**
- Click

**Current Behavior**
Sends a message to the extension to attach the current active file's content as context.

**Backend Flow**
- Calls `attachFile()` → posts `{type:"askAboutFile"}` to extension
- Extension receives at `chat-view-provider.ts:481-483` → `handleAttachFileContext()` (line 1016)
- `captureEditorContext()` reads active file, formats it, and posts `assistant_delta` with file info

**Status**
- ✅ Working

## Stop Execution Button

**Location**
- `webview/components/ChatView.tsx:540`

**UI Type**
Button

**Visible Label**
Stop Execution

**Icon**
N/A

**Trigger**
- Click (only visible when `executionState.isRunning`)

**Current Behavior**
Aborts the current agent execution.

**Backend Flow**
- Calls `abort()` → dispatches `SET_RUNNING(false)`, posts `{type:"abort"}` to extension
- Extension receives at `chat-view-provider.ts:434-436` → `handleAbort()` (line 1531)
- Extension calls `core.abort(this.activeSessionId)`

**Status**
- ✅ Working

## Sticky Status Bar (Chat)

**Location**
- `webview/components/ChatView.tsx:254-263`

**UI Type**
Sticky bar

**Visible Label**
Status emoji + label + duration counter

**Icon**
Status dot with pulse animation

**Trigger**
- Automatic (reactive to execution state)

**Current Behavior**
Shows current agent state (idle/thinking/searching/reading/writing/calling/testing/finished/error) with emoji and text. Shows elapsed seconds while running.

**Backend Flow**
- Reads from `executionState.status`, `executionState.isRunning`, `executionState.durationMs`
- `STATUS_EMOJIS` and `STATUS_LABELS` maps at lines 43-65

**Status**
- ✅ Working

## Context Meter (Token Budget)

**Location**
- `webview/components/ChatView.tsx:280-286`

**UI Type**
Progress bar + label

**Visible Label**
Percentage (e.g., "45%")

**Icon**
"Compacted" badge shown when context was compacted

**Trigger**
- Automatic

**Current Behavior**
Shows context window usage as a horizontal bar. Badge shows "Compacted" when compaction has occurred.

**Backend Flow**
- `contextPercentage` computed from `executionState.contextTokens / executionState.contextMaxTokens`
- Values come from `ExecutionStore` which updates on `turn_done`, `reset_done`

**Status**
- ✅ Working

## Rename Session Button

**Location**
- `webview/components/ChatView.tsx:271-275`

**UI Type**
Icon Button

**Visible Label**
✏️

**Icon**
Pencil emoji

**Trigger**
- Click

**Current Behavior**
Prompts for a new session name via `prompt()` dialog. Calls `renameSession()` if valid.

**Backend Flow**
- Calls `renameSession()` → posts `{type:"rename_session", sessionId, title}` to extension
- Extension receives at `chat-view-provider.ts:461-463` → `handleRenameSession()` (line 838)
- Shows `showInputBox` dialog, calls `core.update(sessionId, { title })`

**Status**
- ✅ Working

## Checkpoint Dropdown Button

**Location**
- `webview/components/ChatView.tsx:288-291`, `575-621`

**UI Type**
Icon Button + Dropdown

**Visible Label**
⏱️

**Icon**
Clock emoji

**Trigger**
- Click to toggle dropdown

**Current Behavior**
Shows list of session checkpoints with Restore and Delete buttons for each.

**Backend Flow**
- `listCheckpoints()` posts `{type:"checkpoint_list"}` to extension
- `restoreCheckpoint()` posts `{type:"checkpoint_restore", sessionId, checkpointRef}`
- `deleteCheckpoint()` posts `{type:"checkpoint_delete", sessionId, checkpointRef}`
- Extension handles at `chat-view-provider.ts:519-527`

**Status**
- ✅ Working

## Session Info Toggle Button

**Location**
- `webview/components/ChatView.tsx:298-299`

**UI Type**
Button

**Visible Label**
"▶ Show Session Info" / "▼ Hide Session Info"

**Icon**
N/A

**Trigger**
- Click

**Current Behavior**
Toggles a session health panel with provider, checkpoint count, memory status, network status.

**Backend Flow**
- Local state `showHealth` toggle
- Reads from `sessionState` store

**Status**
- ✅ Working

## Message Copy Button

**Location**
- `webview/components/ChatView.tsx:355-357`

**UI Type**
Icon Button

**Visible Label**
Copy message

**Icon**
Clipboard SVG icon

**Trigger**
- Click (only visible on hover)

**Current Behavior**
Copies message text to clipboard.

**Backend Flow**
- `copyMessage(msg.text)` → `navigator.clipboard.writeText()`

**Status**
- ✅ Working

## Message Edit Button

**Location**
- `webview/components/ChatView.tsx:358-362`

**UI Type**
Icon Button

**Visible Label**
Edit and resend

**Icon**
Edit/pencil SVG icon

**Trigger**
- Click (only visible on hover, only for user messages)

**Current Behavior**
Replaces message with a textarea for editing. Shows "Save & Resend" and "Cancel" buttons.

**Backend Flow**
- `startEdit()` (line 213) — sets editing state
- `submitEdit()` (line 223) — updates message in store, calls `sendMessage()` with edited text
- `cancelEdit()` (line 218) — clears editing state

**Status**
- ✅ Working

## Welcome Placeholder

**Location**
- `webview/components/ChatView.tsx:313-347`

**UI Type**
Empty state

**Visible Label**
Zenuxs AI

**Icon**
Logo image or "Z" letter

**Trigger**
- Shown when no messages exist and not running

**Current Behavior**
Displays logo, "Zenuxs AI" heading, and up to 2 recent chat sessions as clickable items.

**Backend Flow**
- Recent sessions from `state.sessionHistories.slice(0, 2)`
- Clicking a recent chat calls `restoreSession()`

**Status**
- ✅ Working

## Thinking Placeholder

**Location**
- `webview/components/ChatView.tsx:403-408`

**UI Type**
Animated placeholder

**Visible Label**
Zenuxs (header)

**Icon**
Animated pulse dot

**Trigger**
- Shown when `executionState.isRunning` and no assistant messages exist yet

**Current Behavior**
Shows a "thinking" indicator with a pulsing dot while the agent is starting to respond.

**Status**
- ✅ Working

## Tool Progress Bar

**Location**
- `webview/components/ChatView.tsx:411-424`

**UI Type**
Progress bar

**Visible Label**
"Running tool: {toolName}" with percentage

**Icon**
N/A

**Trigger**
- Shown when `toolExecutionState.toolProgress` is set

**Current Behavior**
Shows a progress bar for the currently executing tool with tool name, percentage, and optional details.

**Backend Flow**
- `ToolExecutionStore` updates via `tool_event` bus events
- Running tools set progress to 30%, completed tools clear it

**Status**
- ✅ Working

## Enhanced Approval Card

**Location**
- `webview/components/ChatView.tsx:427-432`, `737-893`

**UI Type**
Card / Dialog

**Visible Label**
🛡️ Manual Approval Required

**Icon**
Shield emoji, Security Warning banner, Directory Escaping Warning banner

**Trigger**
- Shown when `toolExecutionState.pendingApproval` is set

**Current Behavior**
Shows tool approval request with tool name, arguments, security warnings. Provides: Run once, Always allow, Allow this session, Deny buttons. Supports editing arguments in JSON before approval.

**Backend Flow**
- `handleApprove()` (line 765) — posts `approval_response` with `approved: true`, optional edited input, and policy type
- `handleDeny()` (line 785) — posts `approval_response` with `approved: false` and reason
- Extension receives at `chat-view-provider.ts:445-447`
- `isDangerous()` checks if tool name contains bash/execute keywords
- `isPathOutOfWorkspace()` checks for path traversal

**Status**
- ✅ Working

## Error Recovery Panel

**Location**
- `webview/components/ChatView.tsx:435-440`, `896-936`

**UI Type**
Card

**Visible Label**
"⚠️ Tool Failure in '{toolName}'"

**Icon**
Warning emoji

**Trigger**
- Shown when `toolExecutionState.lastToolError` is set

**Current Behavior**
Shows error details with recovery actions: Ignore, Retry, Retry from checkpoint, View logs, Copy stack trace.

**Backend Flow**
- `handleRetryFromCheckpoint()` — restores latest checkpoint, calls `restoreCheckpoint()`
- `handleCopyStack()` — copies error + stack to clipboard
- Retry button posts `{type:"run_command", command:"retry"}` to extension

**Status**
- ✅ Working

## Usage Status Bar

**Location**
- `webview/components/ChatView.tsx:548-552`

**UI Type**
Text display

**Visible Label**
"{input} in / {output} out | ${cost}"

**Icon**
N/A

**Trigger**
- Automatic

**Current Behavior**
Shows token usage and cost for the current session.

**Backend Flow**
- Reads from `executionState.inputTokens`, `outputTokens`, `totalCost`

**Status**
- ✅ Working

## Developer Badge Button

**Location**
- `webview/components/ChatView.tsx:557-563`

**UI Type**
Floating Icon Button

**Visible Label**
🛠️ (fixed position, bottom-right)

**Icon**
Tool emoji

**Trigger**
- Click

**Current Behavior**
Toggles the Developer Drawer overlay with system metrics, last prompt, tool JSON, and architecture suggestions.

**Backend Flow**
- `DeveloperDrawer` sub-component (line 938)
- Reads from `ExecutionStore`, `SessionStore`, `TimelineStore`

**Status**
- ✅ Working

## Developer Drawer Overlay

**Location**
- `webview/components/ChatView.tsx:938-991`

**UI Type**
Slide-in drawer

**Visible Label**
"Developer Overlay"

**Icon**
N/A

**Trigger**
- Click the 🛠️ badge button

**Current Behavior**
Shows system metrics (CWD, session ID, duration, tokens, cost), last user prompt, tool JSON, architecture suggestions.

**Status**
- ✅ Working

## Message Rendering Area

**Location**
- `webview/components/ChatView.tsx:350-401`

**UI Type**
Message list

**Visible Label**
"You" (user), "Zenuxs" (assistant), "Error" (error)

**Icon**
N/A

**Trigger**
- Automatic (renders from `timelineState.messages`)

**Current Behavior**
Renders user, assistant, and error messages with role-based styling. Shows reasoning/thinking blocks for assistant messages with "💭 Thinking Process" header. Shows tool event timelines for assistant messages with expandable tool steps.

**Backend Flow**
- Reads from `timelineState.messages` (TimelineStore)
- `MarkdownBlock` renders message text with custom markdown parser
- `TimelineStep` renders tool events with expand/collapse
- `FileDiffViewer` renders diff preview for file-writing tools

**Status**
- ✅ Working

## File Diff Viewer

**Location**
- `webview/components/ChatView.tsx:701-735`

**UI Type**
Inline diff display

**Visible Label**
Filename with "Preview" label

**Icon**
N/A

**Trigger**
- Click "Show File Preview (Diff)" button inside a tool step

**Current Behavior**
Shows a side-by-side diff of target content vs replacement content with added (green) and removed (red) lines.

**Status**
- ✅ Working

---

# Dashboard

## Dashboard Tab

**Location**
- `webview/App.tsx:13-19` — tab definition
- `webview/components/DashboardView.tsx:1-94`

**UI Type**
Full tab view

**Visible Label**
Dashboard

**Icon**
N/A

**Trigger**
- Click "Dashboard" tab in the header

**Current Behavior**
Shows metrics grid (Total Cost, Total Runs, Input Tokens, Output Tokens) and bar charts for Usage by Provider, Usage by Model, and Most Used Tools.

**Backend Flow**
- Reads from `state.dashboardData` populated from `initial_data` message
- `calculateFallback()` computes from session histories if no dashboard data provided

**Status**
- ✅ Working

---

# History

## History Tab

**Location**
- `webview/App.tsx:13-19` — tab definition
- `webview/components/HistoryView.tsx:1-161`

**UI Type**
Full tab view

**Visible Label**
History

**Icon**
Clock SVG icon in header

**Trigger**
- Click "History" tab in header
- Click "View All" link in welcome placeholder
- Command: `Zenuxs: Toggle History Panel`
- Keyboard: `Ctrl+Shift+H`

**Current Behavior**
Shows all past sessions grouped by Today/Yesterday/Older with search, rename, delete, and restore actions.

**Backend Flow**
- `restoreSession()` posts `{type:"restore_session", sessionId}` to extension
- `deleteSession()` posts `{type:"delete_session", sessionId}`
- `renameSession()` posts `{type:"rename_session", sessionId, title}`
- `clearHistory()` posts `{type:"clear_history"}` to extension
- `newSession()` posts `{type:"new_session"}` to extension
- Extension handlers in `chat-view-provider.ts`

**Dependencies**
- `ExtensionStateContext.tsx`

**Status**
- ✅ Working

## History Search Input

**Location**
- `webview/components/HistoryView.tsx:65-71`

**UI Type**
Text input with search icon

**Visible Label**
Placeholder: "Search sessions..."

**Icon**
Search SVG icon

**Trigger**
- Type text

**Current Behavior**
Filters session list by title/prompt/sessionId in real-time (case-insensitive).

**Backend Flow**
- Client-side filtering via `useMemo`

**Status**
- ✅ Working

## History Back Button

**Location**
- `webview/components/HistoryView.tsx:74-79`

**UI Type**
Icon Button

**Visible Label**
Back to Chat

**Icon**
Left arrow SVG

**Trigger**
- Click

**Current Behavior**
Switches back to the Chat tab.

**Backend Flow**
- `switchTab("chat")`

**Status**
- ✅ Working

## History New Chat Button

**Location**
- `webview/components/HistoryView.tsx:80-85`

**UI Type**
Icon Button

**Visible Label**
New Chat

**Icon**
Plus SVG icon

**Trigger**
- Click

**Current Behavior**
Creates a new session and switches to Chat tab.

**Backend Flow**
- `newSession()` → dispatches `RESET_SESSION`, posts `{type:"new_session"}`
- `switchTab("chat")`

**Status**
- ✅ Working

## History Clear All Button

**Location**
- `webview/components/HistoryView.tsx:86-91`

**UI Type**
Icon Button

**Visible Label**
Clear All History

**Icon**
Trash SVG icon

**Trigger**
- Click

**Current Behavior**
Clears all session histories (with confirmation from extension side).

**Backend Flow**
- `clearHistory()` → posts `{type:"clear_history"}` to extension
- Extension receives at `chat-view-provider.ts:485-487` → `handleClearHistory()` (line 1033)
- Iterates all sessions, calls `core.delete()` for each

**Status**
- ✅ Working

## History Session Item

**Location**
- `webview/components/HistoryView.tsx:113-153`

**UI Type**
List item

**Visible Label**
Session title, provider badge, model, cost

**Icon**
Provider icon badge

**Trigger**
- Click session item → restore session
- Click rename icon → rename session
- Click delete icon → delete session

**Current Behavior**
Shows each session with provider badge, title, model name, and cost. Hover reveals rename and delete action buttons.

**Backend Flow**
- `restoreSession()` sends restore message
- `handleRename()` sends rename message
- `handleDelete()` sends delete message

**Status**
- ✅ Working

---

# Settings

## Settings Tab

**Location**
- `webview/App.tsx:13-19` — tab definition
- `webview/components/SettingsView.tsx:1-554`

**UI Type**
Full tab view with sidebar

**Visible Label**
Settings

**Icon**
Settings gear SVG

**Trigger**
- Click "Settings" tab in header
- Command: `Zenuxs: Toggle Settings Panel`
- Keyboard: `Ctrl+Shift+.`

**Current Behavior**
Multi-section settings panel with vertical icon sidebar and content area. Sections: Provider, Skills, Auto Approves, Execution, MCP, Plugins, About, Developer.

**Backend Flow**
- Section switching via local state `section`
- All settings saved via `saveSettings()` → posts `{type:"save_settings"}` to extension
- Extension receives at `chat-view-provider.ts:449-451` → `handleSaveSettings()` (line 746)
- Updates VS Code configuration + ProviderSettingsManager

**Status**
- ✅ Working

## Back to Chat Button (Settings)

**Location**
- `webview/components/SettingsView.tsx:457-459`

**UI Type**
Button

**Visible Label**
← Back to Chat

**Icon**
Left arrow

**Trigger**
- Click

**Current Behavior**
Switches back to the Chat tab.

**Backend Flow**
- `switchTab("chat")`

**Status**
- ✅ Working

## Settings Sidebar Tabs

**Location**
- `webview/components/SettingsView.tsx:462-502`

**UI Type**
Vertical icon button bar

**Visible Label**
Provider, Skills, Auto Approves, Execution, MCP, Plugins, About, Developer

**Icon**
Zap, Wrench, CheckSquare, Settings, Plug, Puzzle, Info, Code SVG icons

**Trigger**
- Click

**Current Behavior**
Highlights active section. Content area shows the corresponding settings form.

**Backend Flow**
- Local state `section` — no extension message needed

**Status**
- ✅ Working

### Provider Settings Section

**Location**
- `webview/components/SettingsView.tsx:184-258`

**UI Type**
Form

**Visible Label**
Provider, Model, API Key, Custom Base URL

**Trigger**
- Select provider from dropdown
- Select model from dropdown
- Type API key
- Type base URL
- Click "Save Connection"
- Click "Login / Authenticate via Browser" (OAuth)

**Current Behavior**
Provider selection dropdown, model selection dropdown (loaded dynamically), API key field with show/hide toggle, custom base URL input. For OAuth providers, shows authentication button.

**Backend Flow**
- `handleProviderChange()` — sets local config and fetches models
- `fetchModelsFor()` — posts `{type:"models_request", providerId}` to extension
- Extension receives at `chat-view-provider.ts:489-491` → `handleModelsRequest()` (line 730)
- `handleOAuth()` — posts `{type:"login_oauth", providerId}` → `handleLoginOAuth()` (line 1056)

**Status**
- ✅ Working

### Skills Settings Section

**Location**
- `webview/components/SettingsView.tsx:261-287`

**UI Type**
Toggle list

**Visible Label**
Skills

**Trigger**
- Click toggle switch on each skill item
- Click "+ Create Skill" button

**Current Behavior**
Lists installed skills with enable/disable toggles. Shows "No skills configured." when empty. Create Skill button shows a "coming soon" status message.

**Backend Flow**
- `toggleItem("skills", ...)` posts `{type:"toggle_setting_item", itemType:"skills"}` to extension
- Extension receives at `chat-view-provider.ts:453-455` → `handleToggleSetting()` (line 784)
- `CoreSettingsService.toggle()` is called

**Status**
- ✅ Working

### Auto Approves Settings Section

**Location**
- `webview/components/SettingsView.tsx:289-316`

**UI Type**
Toggle list

**Visible Label**
Write, Read, Read out of workspace, Write out of workspace, MCP, Mode changes, Subtasks, Execute, Questions

**Trigger**
- Click toggle switch for each approval type
- Click "Save Auto Approvals"
- Click "Reset Defaults"

**Current Behavior**
Nine approval categories with toggle switches. Save persists to extension. Reset restores defaults.

**Backend Flow**
- `handleSaveAutos()` — calls `saveSettings({...localCfg, autoApprovals: autos})` → posts to extension
- Extension saves to VS Code config as JSON string

**Status**
- ✅ Working

### Execution Settings Section

**Location**
- `webview/components/SettingsView.tsx:321-412`

**UI Type**
Form with checkboxes, selects, number inputs

**Visible Label**
Enable Version Checkpoints, Compaction Strategy, Enable Model Reasoning, Reasoning Effort, Max Iterations, Mistake Retries, Execution Timeout

**Trigger**
- Click checkboxes
- Select dropdown options
- Type numbers
- Click "Save Execution Settings"

**Current Behavior**
Controls checkpointing, compaction (off/basic/agentic), thinking/reasoning, max iterations, retries, timeout.

**Backend Flow**
- `saveSettings(localCfg)` posts to extension
- Extension updates VS Code configuration keys

**Status**
- ✅ Working

### MCP Settings Section

**Location**
- `webview/components/SettingsView.tsx:318-319`
- `webview/components/McpManagementView.tsx:1-109`

**UI Type**
Server list + Add form

**Visible Label**
MCP Servers, "+ Add MCP Server"

**Trigger**
- Connect/Disconnect/Refresh/Remove buttons per server
- Toggle switch to enable/disable
- Click "+ Add MCP Server" to show form

**Current Behavior**
Lists MCP servers with status dot, transport type, tool count. Each server has Connect/Disconnect, enable/disable toggle, Refresh, Remove buttons. Add form supports Stdio and SSE transport with command/args or URL fields.

**Backend Flow**
- `registerMcpServer()` → posts `{type:"mcp_register"}`
- `unregisterMcpServer()` → posts `{type:"mcp_unregister"}`
- `connectMcpServer()` → posts `{type:"mcp_connect"}`
- `disconnectMcpServer()` → posts `{type:"mcp_disconnect"}`
- `setMcpServerDisabled()` → posts `{type:"mcp_set_disabled"}`
- `refreshMcpTools()` → posts `{type:"mcp_refresh_tools"}`
- Extension handlers at `chat-view-provider.ts:497-517`

**Status**
- ✅ Working

### Plugins Settings Section

**Location**
- `webview/components/SettingsView.tsx:414-423`

**UI Type**
Empty state with button

**Visible Label**
Plugins

**Trigger**
- Click "+ Connect Plugin"

**Current Behavior**
Shows "coming soon" status message. No plugins configured.

**Backend Flow**
- Posts `{type:"status", text:"Connect plugin dialog coming soon"}`

**Status**
- ⚠ Partial (placeholder only)

### About Settings Section

**Location**
- `webview/components/SettingsView.tsx:425-444`

**UI Type**
Info card

**Visible Label**
Zenuxs-Code, Version 0.1.0

**Icon**
Logo image

**Trigger**
- Click "GitHub" link

**Current Behavior**
Shows extension logo, name, version, GitHub link.

**Backend Flow**
- Anchor link opens external URL

**Status**
- ✅ Working

### Developer Settings Section

**Location**
- `webview/components/SettingsView.tsx:446-447`

**UI Type**
Embedded component

**Visible Label**
Developer

**Trigger**
- Active when selecting Developer tab

**Current Behavior**
Embeds the full `DeveloperLogsView` component (see Developer Logs section below).

**Status**
- ✅ Working

---

# Teams

## Teams Tab

**Location**
- `webview/App.tsx:13-19` — tab definition
- `webview/components/TeamsView.tsx:1-232`

**UI Type**
Full tab view with subtabs

**Visible Label**
Teams

**Icon**
N/A

**Trigger**
- Click "Teams" tab in header

**Current Behavior**
Multi-subtab view for team management: Members, Tasks, Runs, Mailbox, and Connectors.

**Backend Flow**
- All actions post typed messages to extension
- Extension handlers at `chat-view-provider.ts:529-580`

**Status**
- ✅ Working

### Teams Members Subtab

**Location**
- `webview/components/TeamsView.tsx:58-95`

**UI Type**
List + Form

**Visible Label**
Team Members

**Trigger**
- Click "Shutdown" per teammate
- Type Agent ID and Role Prompt, click "Spawn"
- Click "Refresh Status"

**Current Behavior**
Lists active team members with status dot, agent ID, role. Spawn form creates a new teammate with ID and role prompt.

**Backend Flow**
- `spawnTeammate()` → posts `{type:"team_spawn"}`
- `shutdownTeammate()` → posts `{type:"team_shutdown"}`
- `getTeamStatus()` → posts `{type:"team_status"}`

**Status**
- ✅ Working

### Teams Tasks Subtab

**Location**
- `webview/components/TeamsView.tsx:98-132`

**UI Type**
List + Form

**Visible Label**
Team Tasks

**Trigger**
- Click "Complete" on in-progress tasks
- Type title and assignee, click "Create"
- Click "Refresh Tasks"

**Current Behavior**
Lists tasks with ID, title, status, assignee. Create form with title and optional assignee.

**Backend Flow**
- `createTeamTask()` → posts `{type:"team_create_task"}`
- `completeTeamTask()` → posts `{type:"team_complete_task"}`
- `listTeamTasks()` → posts `{type:"team_list_tasks"}`

**Status**
- ✅ Working

### Teams Runs Subtab

**Location**
- `webview/components/TeamsView.tsx:135-168`

**UI Type**
List + Form

**Visible Label**
Team Runs

**Trigger**
- Type agent ID and task, click "Run Task"
- Click "Cancel" on running/queued runs
- Click "Refresh Runs"

**Current Behavior**
Lists runs with agent ID, message preview, status. Run form and cancel button.

**Backend Flow**
- `runTeamTask()` → posts `{type:"team_run_task"}`
- `cancelTeamRun()` → posts `{type:"team_cancel_run"}`
- `listTeamRuns()` → posts `{type:"team_list_runs"}`

**Status**
- ✅ Working

### Teams Mailbox Subtab

**Location**
- `webview/components/TeamsView.tsx:170-191`

**UI Type**
Form

**Visible Label**
Team Mailbox

**Trigger**
- Type To/Subject/Body, click "Send Direct"
- Click "Broadcast"
- Click "Read Mailbox"

**Current Behavior**
Messaging form for inter-agent communication.

**Backend Flow**
- `sendTeamMessage()` → posts `{type:"team_send_message"}`
- `broadcastTeamMessage()` → posts `{type:"team_broadcast"}`
- `readTeamMailbox()` → posts `{type:"team_read_mailbox"}`

**Status**
- ✅ Working

### Connectors Section

**Location**
- `webview/components/TeamsView.tsx:193-229`

**UI Type**
List + Form

**Visible Label**
Connectors (Slack / Discord / Telegram)

**Trigger**
- Click "Disconnect" per connector
- Select provider, type name/token, click "Connect"
- Click "Refresh"

**Current Behavior**
Lists connected connectors with status dot, provider, last active. Connect form supports Slack, Discord, Telegram.

**Backend Flow**
- `connectConnector()` → posts `{type:"connector_connect"}`
- `disconnectConnector()` → posts `{type:"connector_disconnect"}`
- `listConnectors()` → posts `{type:"connector_list"}`

**Status**
- ✅ Working

---

# Dev Logs

## Developer Logs Tab

**Location**
- `webview/App.tsx:13-19` — tab definition
- `webview/components/DeveloperLogsView.tsx:1-963`

**UI Type**
Full tab view

**Visible Label**
Dev Logs

**Icon**
N/A

**Trigger**
- Click "Dev Logs" tab in header
- Click "View logs" in Error Recovery Panel
- From Developer Settings section

**Current Behavior**
Real-time log streaming with search, filter, export, pause, clear, and detail inspector. Virtualized list for performance.

**Backend Flow**
- Subscribes via `postMessage({type:"developer_logs", action:"subscribe"})` on mount
- Extension receives at `chat-view-provider.ts:578-580` → `handleDeveloperLogs()` (line 593)
- Backlog replayed via `loggerService.getEntries()`
- Live entries via `loggerService.subscribe()`
- Pause/Resume toggle forwarding to extension host

**Status**
- ✅ Working

## Dev Logs Toolbar Buttons

**Location**
- `webview/components/DeveloperLogsView.tsx:699-762`

**UI Type**
Button bar

**Visible Label**
Filters, ▶ Resume/⏸ Pause, 🔽 Auto/⏹ Manual, 🗑 Clear, 📋 Copy Details, 📋 Copy, 📥 Export, Build, Lint, Test, Doctor, Console

**Trigger**
- Click any button

**Current Behavior**
- Filters toggles filter panel
- Pause/Resume toggles live streaming
- Auto/Manual toggles auto-scroll
- Clear empties log entries
- Copy Details copies full JSON of filtered entries
- Copy copies summary text
- Export opens export format menu (JSON/CSV/TXT/MD)
- Build/Lint/Test/Doctor run respective commands
- Console switches to Console tab

**Backend Flow**
- Run commands via `runCommand()` → `postMessage({type:"run_command", command})`
- Extension receives at `chat-view-provider.ts:477-479` → `handleRunCommand()` (line 982)
- Creates or reuses VS Code terminal "Zenuxs Task" and runs the command

**Status**
- ✅ Working

## Dev Logs Filter Panel

**Location**
- `webview/components/DeveloperLogsView.tsx:766-877`

**UI Type**
Expandable filter panel

**Visible Label**
Level, Category, Provider, Model, Session, Date Range

**Trigger**
- Click filter chips to toggle
- Type in search input

**Current Behavior**
Filter chips for each log level (TRACE/DEBUG/INFO/SUCCESS/WARNING/ERROR/CRITICAL), categories (auth, provider, model, api_request, etc.), providers, models, sessions, and date range pickers.

**Status**
- ✅ Working

## Dev Logs Detail Inspector

**Location**
- `webview/components/DeveloperLogsView.tsx:573-652`

**UI Type**
Bottom detail panel

**Visible Label**
Log Details

**Trigger**
- Click any log row

**Current Behavior**
Shows full details for selected entry including ID, sequence, timestamp, level, category, source, provider, model, session, conversation, request IDs, message body, metadata JSON, and stack trace.

**Backend Flow**
- Copy button → `handleCopySelected()`
- Copy Session button → `handleCopySession()`

**Status**
- ✅ Working

---

# Console / Logs

## Console Tab

**Location**
- `webview/App.tsx:44` — conditional render
- `webview/components/LogsView.tsx:1-34`

**UI Type**
Full tab view

**Visible Label**
Console (accessed via Dev Logs "Console" button, not from tab bar)

**Trigger**
- Click "Console" button in Dev Logs toolbar

**Current Behavior**
Simple log viewer showing system logs with Run Build, Run Lint, Run Test, Doctor Fix, and Clear Panel buttons.

**Backend Flow**
- `runCommand()` for build/lint/test/doctor
- `dispatch({type:"CLEAR_LOGS"})` for clear

**Status**
- ⚠ Partial (hidden tab, not in tab bar)

---

# Header / Tab Bar

## Tab Navigation Bar

**Location**
- `webview/webview-html.ts:55-72` — CSS styles
- `webview/App.tsx:12-19` — tabs definition

**UI Type**
Horizontal tab bar

**Visible Label**
Chat, History, Settings, Teams, Dashboard, Dev Logs

**Icon**
N/A

**Trigger**
- Click tab

**Current Behavior**
Switches between views. Tapping Settings or History tab again toggles back to Chat.

**Backend Flow**
- `dispatch({type:"SET_TAB", tab})`
- `SET_TAB` reducer (line 123) — toggles back to chat if same tab clicked and it's settings or history

**Status**
- ✅ Working

---

# Toast Notifications

## Toast Container

**Location**
- `webview/App.tsx:45-49`
- `webview/webview-html.ts:513-525` — CSS

**UI Type**
Fixed-position toast

**Visible Label**
Variable (message from toast state)

**Trigger**
- `SHOW_TOAST` dispatch
- Auto-dismisses after 3 seconds

**Current Behavior**
Animated slide-in notification at bottom-right. Supports info, success, error severity with color coding.

**Backend Flow**
- Extension can send `{type:"toast", message, severity}` from `chat-view-provider.ts`

**Status**
- ✅ Working

---

# Status Bar

## Zenuxs Status Bar Item

**Location**
- `src/status/status-bar.ts:1-93`

**UI Type**
VS Code Status Bar Item

**Visible Label**
"$(zap) Zenuxs" (idle), "$(loading~spin) Zenuxs" (running), "$(error) Zenuxs" (error)

**Icon**
Zap/Loading/Error codicon

**Trigger**
- Click → opens chat panel (`zenuxs.chat` command)

**Current Behavior**
Shows icon + "Zenuxs" label with tooltip showing provider/model. Updates on config changes.

**Backend Flow**
- Created in `extension.ts:90`
- `setIdle()`, `setRunning()`, `setError()` methods
- Listens to `onDidChangeConfiguration` for "zenuxs" scope

**Status**
- ✅ Working

---

# Progress Notifications

## Session Progress Notification

**Location**
- `chat-view-provider.ts:1108-1124`

**UI Type**
VS Code Progress Notification

**Visible Label**
"Zenuxs Agent" — "Thinking..."

**Trigger**
- Automatically on `handleSend()`

**Current Behavior**
Shows a cancellable progress notification in VS Code during agent execution. Reports tool names and status messages. Cancel triggers `handleAbort()`.

**Backend Flow**
- `vscode.window.withProgress()` with `ProgressLocation.Notification`

**Status**
- ✅ Working

## OAuth Progress Notification

**Location**
- `chat-view-provider.ts:1059-1074`

**UI Type**
VS Code Progress Notification

**Visible Label**
"Zenuxs: Authenticating {providerId}..."

**Trigger**
- Click "Login / Authenticate via Browser" for OAuth providers

**Current Behavior**
Shows a cancellable progress notification during OAuth flow.

**Backend Flow**
- `vscode.window.withProgress()` around `loginAndSaveLocalProviderOAuthCredentials()`

**Status**
- ✅ Working

## Quick Ask Progress Notification

**Location**
- `commands/index.ts:173-220`

**UI Type**
VS Code Progress Notification

**Visible Label**
"Zenuxs" — "Thinking..."

**Trigger**
- Command: `Zenuxs: Quick Ask` (`Ctrl+Shift+Q`)
- cancellable: true

**Current Behavior**
Shows a notification with "Thinking..." while making a quick LLM call. Displays answer in an information message (max 200 chars). Falls back to opening chat panel if no answer or error.

**Backend Flow**
- Creates LLM handler via `Llms.createHandlerAsync()`
- Streams response, shows in `showInformationMessage()`

**Status**
- ✅ Working

---

# Inline Completion

## Autocomplete Provider

**Location**
- `providers/inline-completion-provider.ts:1-126`

**UI Type**
VS Code Inline Completion Provider

**Visible Label**
N/A (ghost text in editor)

**Icon**
N/A

**Trigger**
- Typing in editor (automatic after 300ms debounce)
- Explicit invoke

**Current Behavior**
Provides inline code completions based on context before/after cursor. Configurable via `zenuxs.enableAutocomplete` setting.

**Backend Flow**
- Registered in `extension.ts:81-87`
- `provideInlineCompletionItems()` → `getCompletion()` → creates LLM handler, calls `createMessage()`
- Uses provider and model from settings

**Status**
- ✅ Working

---

# Code Actions

## Zenuxs Code Action Provider

**Location**
- `providers/code-action-provider.ts:1-105`

**UI Type**
VS Code Code Action (lightbulb menu)

**Visible Label**
"Zenuxs: Explain this code", "Zenuxs: Fix issues", "Zenuxs: Generate tests", "Zenuxs: Refactor this code"

**Icon**
Lightbulb (VS Code standard)

**Trigger**
- Click lightbulb when code is selected
- Auto-detected for QuickFix and Refactor kinds

**Current Behavior**
Offers four Zenuxs actions in the editor lightbulb menu when code is selected. Each opens the chat panel and sends a pre-filled prompt.

**Backend Flow**
- Registered for all file: `vscode.languages.registerCodeActionsProvider({scheme:"file"})`
- Each action triggers a command: `zenuxs.explain`, `zenuxs.fix`, `zenuxs.test`, `zenuxs.refactor`
- Commands defined in `commands/index.ts`

**Status**
- ✅ Working

---

# VS Code Commands (Command Palette)

## Command: Zenuxs: Open Chat

**Location**
- `package.json:125-128`
- `commands/index.ts:16-19`

**UI Type**
Command Palette entry

**Visible Label**
Zenuxs: Open Chat

**Icon**
`$(comment-discussion)`

**Trigger**
- Command Palette → "Zenuxs: Open Chat"
- Keyboard: `Ctrl+Shift+I`
- Activity Bar icon click

**Current Behavior**
Focuses the zenuxs-chat view.

**Backend Flow**
- `vscode.commands.executeCommand("zenuxs-chat.focus")`

**Status**
- ✅ Working

## Command: Zenuxs: Explain Selection

**Location**
- `package.json:130-133`
- `commands/index.ts:22-37`

**UI Type**
Command Palette + Context Menu + Keyboard

**Visible Label**
Zenuxs: Explain Selection

**Icon**
`$(lightbulb)`

**Trigger**
- Command Palette (when selection exists)
- Editor context menu: "Zenuxs" group @1
- Keyboard: `Ctrl+Shift+E`

**Current Behavior**
Captures selected code, opens chat panel, sends "Explain this code" prompt.

**Backend Flow**
- `captureEditorContext()` → `chatProvider.sendPrompt("Explain...")`

**Status**
- ✅ Working

## Command: Zenuxs: Fix Selection

**Location**
- `package.json:135-138`
- `commands/index.ts:40-55`

**UI Type**
Command Palette + Context Menu + Keyboard

**Visible Label**
Zenuxs: Fix Selection

**Icon**
`$(wrench)`

**Trigger**
- Command Palette (when selection exists)
- Editor context menu: "Zenuxs" group @2
- Keyboard: `Ctrl+Shift+F`

**Current Behavior**
Captures selected code, opens chat, sends "Fix any issues" prompt.

**Status**
- ✅ Working

## Command: Zenuxs: Generate Tests

**Location**
- `package.json:140-143`
- `commands/index.ts:58-73`

**UI Type**
Command Palette + Context Menu + Keyboard

**Visible Label**
Zenuxs: Generate Tests

**Icon**
`$(beaker)`

**Trigger**
- Command Palette (when selection exists)
- Editor context menu: "Zenuxs" group @3
- Keyboard: `Ctrl+Shift+T`

**Current Behavior**
Captures selected code, opens chat, sends "Generate comprehensive tests" prompt.

**Status**
- ✅ Working

## Command: Zenuxs: Refactor Selection

**Location**
- `package.json:150-153`
- `commands/index.ts:76-91`

**UI Type**
Command Palette + Context Menu + Keyboard

**Visible Label**
Zenuxs: Refactor Selection

**Icon**
`$(symbol-method)`

**Trigger**
- Command Palette (when selection exists)
- Editor context menu: "Zenuxs" group @4
- Keyboard: `Ctrl+Shift+R`

**Current Behavior**
Captures selected code, opens chat, sends "Refactor this code" prompt with quality instructions.

**Status**
- ✅ Working

## Command: Zenuxs: Inline Chat

**Location**
- `package.json:145-148`
- `commands/index.ts:116-130`

**UI Type**
Command Palette + Context Menu + Keyboard

**Visible Label**
Zenuxs: Inline Chat

**Icon**
`$(comment)`

**Trigger**
- Command Palette (when selection exists)
- Editor context menu: "Zenuxs" group @5
- Keyboard: `Ctrl+Shift+K`

**Current Behavior**
Shows input box for a custom question about the current selection. Opens chat panel and sends prompt with editor context.

**Backend Flow**
- `vscode.window.showInputBox()` → `chatProvider.sendPrompt()`

**Status**
- ✅ Working

## Command: Zenuxs: Ask About This File

**Location**
- `package.json:155-158`
- `commands/index.ts:94-113`

**UI Type**
Command Palette + Explorer Context Menu + Keyboard

**Visible Label**
Zenuxs: Ask About This File

**Icon**
`$(file-text)`

**Trigger**
- Command Palette
- Explorer context menu: "Zenuxs" group @1
- Keyboard: `Ctrl+Shift+A`

**Current Behavior**
Shows input box asking about the selected file, opens chat panel, sends prompt with file path.

**Backend Flow**
- If invoked from explorer, receives `uri` parameter
- If from command, uses active editor file
- `vscode.window.showInputBox()` → `chatProvider.sendPrompt()`

**Status**
- ✅ Working

## Command: Zenuxs: New Session

**Location**
- `package.json:160-163`
- `commands/index.ts:133-138`

**UI Type**
Command Palette + View Title Button + Keyboard

**Visible Label**
Zenuxs: New Session

**Icon**
`$(add)`

**Trigger**
- Command Palette
- View title bar (navigation@1)
- Keyboard: `Ctrl+Shift+N` (when chat view open)

**Current Behavior**
Resets the current session to start fresh.

**Backend Flow**
- `chatProvider.newSession()` → resets core bridge, posts `reset_done`

**Status**
- ✅ Working

## Command: Zenuxs: Stop Current Session

**Location**
- `package.json:165-168`
- `commands/index.ts:141-145`

**UI Type**
Command Palette + Keyboard

**Visible Label**
Zenuxs: Stop Current Session

**Icon**
`$(debug-stop)`

**Trigger**
- Command Palette
- Keyboard: `Escape` (when chat view open)

**Current Behavior**
Aborts the currently running session.

**Backend Flow**
- `chatProvider.stopSession()` → `this.handleAbort()` → `core.abort()`

**Status**
- ✅ Working

## Command: Zenuxs: Toggle Settings Panel

**Location**
- `package.json:170-173`
- `commands/index.ts:148-153`

**UI Type**
Command Palette + View Title Button + Keyboard

**Visible Label**
Zenuxs: Toggle Settings Panel

**Icon**
`$(settings-gear)`

**Trigger**
- Command Palette
- View title bar (navigation@3)
- Keyboard: `Ctrl+Shift+.`

**Current Behavior**
Switches to the Settings tab in the webview.

**Backend Flow**
- `chatProvider.toggleSettings()` → posts `{type:"switch_tab", tab:"settings-tab"}`

**Status**
- ✅ Working

## Command: Zenuxs: Toggle History Panel

**Location**
- `package.json:175-178`
- `commands/index.ts:156-161`

**UI Type**
Command Palette + View Title Button

**Visible Label**
Zenuxs: Toggle History Panel

**Icon**
`$(history)`

**Trigger**
- Command Palette
- View title bar (navigation@2)

**Current Behavior**
Switches to the History tab in the webview.

**Backend Flow**
- `chatProvider.toggleHistory()` → posts `{type:"switch_tab", tab:"history-tab"}`

**Status**
- ✅ Working

## Command: Zenuxs: Quick Ask

**Location**
- `package.json:180-183`
- `commands/index.ts:164-222`

**UI Type**
Command Palette

**Visible Label**
Zenuxs: Quick Ask

**Icon**
`$(question)`

**Trigger**
- Command Palette

**Current Behavior**
Shows input box for a quick question. Makes a direct LLM call and shows answer in an information notification (max 200 chars). Falls back to opening chat panel on error or empty response.

**Backend Flow**
- `vscode.window.withProgress()` → creates LLM handler → streams response → `vscode.window.showInformationMessage()`

**Status**
- ✅ Working

## Command: Zenuxs: Fix Diagnostic

**Location**
- `package.json:185-188`
- `commands/index.ts:225-262`

**UI Type**
Command Palette + Keyboard

**Visible Label**
Zenuxs: Fix Diagnostic

**Icon**
`$(bug)`

**Trigger**
- Command Palette (when diagnostics exist)
- Keyboard: `Ctrl+Shift+D`

**Current Behavior**
Collects all errors and warnings from current file, sends them with file content to chat for fixing.

**Backend Flow**
- `vscode.languages.getDiagnostics()` → `chatProvider.sendPrompt(fix-prompt)`

**Status**
- ✅ Working

---

# Context Menus

## Editor Context Menu (Zenuxs Group)

**Location**
- `package.json:191-217`

**UI Type**
Editor right-click context menu

**Visible Label**
Zenuxs: Explain, Fix, Generate Tests, Refactor, Inline Chat

**Trigger**
- Right-click in editor when text is selected
- Appears in "Zenuxs" group at positions @1-@5

**Current Behavior**
Five Zenuxs actions in the editor context menu.

**Status**
- ✅ Working

## Explorer Context Menu

**Location**
- `package.json:219-223`

**UI Type**
File Explorer right-click context menu

**Visible Label**
Zenuxs: Ask About This File

**Trigger**
- Right-click a file in Explorer

**Current Behavior**
Asks about the selected file via the Ask About File command.

**Status**
- ✅ Working

---

# View Title Buttons

## Chat View Title Toolbar

**Location**
- `package.json:279-294`

**UI Type**
View title bar icons

**Visible Label**
New Session, Toggle History, Toggle Settings

**Icon**
Add, History, Settings gear

**Trigger**
- Click icons in the view title bar when zenuxs-chat is active

**Current Behavior**
Provides quick access to new session, history, and settings from the panel title bar.

**Status**
- ✅ Working

---

# Hidden Features

## Webview Error/Unhandled Rejection Logging

**Location**
- `webview/webview-html.ts:719-753`

**UI Type**
Automatic (invisible)

**Visible Label**
N/A

**Trigger**
- Any unhandled error or promise rejection in the webview
- All console.log/info/warn/error calls

**Current Behavior**
Intercepts errors and console calls in the webview and forwards them as `webview_log` messages to the extension host.

**Backend Flow**
- `window.addEventListener('error')`, `window.addEventListener('unhandledrejection')`
- Overrides `console.log`, `console.info`, `console.warn`, `console.error`
- Extension receives at `chat-view-provider.ts:417-419` → `handleWebviewLog()` (line 630)
- Forwards to `loggerService.log()` with category `CONSOLE`

**Status**
- ✅ Working

## Console Function Interception (Extension Host)

**Location**
- `extension.ts:30-49`

**UI Type**
Automatic (invisible)

**Visible Label**
N/A

**Trigger**
- Any `console.log/info/warn/error/debug` call in the extension host

**Current Behavior**
Intercepts all console output in the extension host and mirrors it to `devLogs.console.*`.

**Backend Flow**
- `devLogs.console.log/info/warn/error/debug()`

**Status**
- ✅ Working

## Extension Activation/Deactivation Logging

**Location**
- `extension.ts:21, 119`

**UI Type**
Automatic (invisible)

**Visible Label**
N/A

**Trigger**
- Extension activation and deactivation

**Current Behavior**
Logs `extension.activated` and `extension.deactivated` events with version info.

**Backend Flow**
- `devLogs.extension.activated()`, `devLogs.extension.deactivated()`

**Status**
- ✅ Working

## Webview Startup Logging

**Location**
- `webview/webview-html.ts:702-716`
- `webview/App.tsx:24-26`
- `webview/context/ExtensionStateContext.tsx:208, 220-228, 261-263`

**UI Type**
Automatic (invisible)

**Visible Label**
N/A

**Trigger**
- Webview initialization and state changes

**Current Behavior**
`logStartup()` function sends `webview_log` messages for debugging startup sequence.

**Status**
- ✅ Working

## Session Recovery Mechanism

**Location**
- `chat-view-provider.ts:1357-1425`

**UI Type**
Automatic (invisible)

**Visible Label**
N/A

**Trigger**
- `"session not found"` error during session execution

**Current Behavior**
When a `"session not found"` error occurs, attempts to recover by reading the session from persistent storage and hydrating the webview. If successful, shows "Session recovered" status. Falls back to clean reset.

**Backend Flow**
- `core.readMessages(lostSessionId)` → caches → `postToWebview({type:"session_hydrated"})`

**Status**
- ✅ Working

---

# IPC / Message Passing

## Webview → Extension Messages (41 types)

**Location**
- `chat-view-provider.ts:50-245` — type definition
- `chat-view-provider.ts:286-290` — listener setup
- `chat-view-provider.ts:412-586` — message handler

**Messages (handled):**
| Type | Handler | Line |
|------|---------|------|
| `webview_log` | `handleWebviewLog()` | 417 |
| `ready` | `sendInitialPayload()` | 421 |
| `send` | `handleSend()` | 430 |
| `abort` | `handleAbort()` | 434 |
| `new_session` | reset core, post reset_done | 438 |
| `approval_response` | `handleApprovalResponse()` | 445 |
| `save_settings` | `handleSaveSettings()` | 449 |
| `toggle_setting_item` | `handleToggleSetting()` | 453 |
| `delete_session` | `handleDeleteSession()` | 457 |
| `rename_session` | `handleRenameSession()` | 461 |
| `restore_session` | `handleRestoreSession()` | 465 |
| `export_session` | `handleExportSession()` | 469 |
| `import_session` | `handleImportSession()` | 473 |
| `run_command` | `handleRunCommand()` | 477 |
| `askAboutFile` | `handleAttachFileContext()` | 481 |
| `clear_history` | `handleClearHistory()` | 485 |
| `models_request` | `handleModelsRequest()` | 489 |
| `login_oauth` | `handleLoginOAuth()` | 493 |
| `mcp_register` | `handleMcpRegister()` | 497 |
| `mcp_unregister` | `handleMcpUnregister()` | 500 |
| `mcp_connect` | `handleMcpConnect()` | 503 |
| `mcp_disconnect` | `handleMcpDisconnect()` | 506 |
| `mcp_set_disabled` | `handleMcpSetDisabled()` | 509 |
| `mcp_refresh_tools` | `handleMcpRefreshTools()` | 512 |
| `mcp_list_servers` | `handleMcpListServers()` | 515 |
| `checkpoint_restore` | `handleCheckpointRestore()` | 519 |
| `checkpoint_list` | `handleCheckpointList()` | 522 |
| `checkpoint_delete` | `handleCheckpointDelete()` | 525 |
| `team_spawn` | `handleTeamSpawn()` | 529 |
| `team_shutdown` | `handleTeamShutdown()` | 532 |
| `team_status` | `handleTeamStatus()` | 535 |
| `team_run_task` | `handleTeamRunTask()` | 538 |
| `team_list_runs` | `handleTeamListRuns()` | 541 |
| `team_cancel_run` | `handleTeamCancelRun()` | 544 |
| `team_send_message` | `handleTeamSendMessage()` | 547 |
| `team_broadcast` | `handleTeamBroadcast()` | 550 |
| `team_read_mailbox` | `handleTeamReadMailbox()` | 553 |
| `team_mission_log` | `handleTeamMissionLog()` | 556 |
| `team_list_tasks` | `handleTeamListTasks()` | 559 |
| `team_create_task` | `handleTeamCreateTask()` | 562 |
| `team_complete_task` | `handleTeamCompleteTask()` | 565 |
| `connector_list` | `handleConnectorList()` | 568 |
| `connector_connect` | `handleConnectorConnect()` | 571 |
| `connector_disconnect` | `handleConnectorDisconnect()` | 574 |
| `developer_logs` | `handleDeveloperLogs()` | 578 |

## Extension → Webview Messages (25+ types)

**Location**
- `webview/types.ts:183-211` — `ExtensionMessage` type
- `webview/context/ExtensionStateContext.tsx:211-256` — message handler

**Messages handled:**
| Type | Action | Line |
|------|--------|------|
| `initial_data` | SET_INITIAL_DATA | 223 |
| `assistant_delta` | APPEND_ASSISTANT_TEXT | 231 |
| `reasoning_delta` | APPEND_REASONING | 232 |
| `tool_event` | UPDATE_TOOL_EVENT | 233 |
| `approval_request` | SET_APPROVAL_REQUEST | 234 |
| `approval_resolved` | SET_APPROVAL_RESOLVED | 235 |
| `turn_done` | SET_TURN_DONE | 236 |
| `session_started` | SET_SESSION_STARTED | 237 |
| `session_hydrated` | HYDRATE_SESSION | 238 |
| `reset_done` | RESET_SESSION | 239 |
| `error` | ADD_ERROR + ADD_LOG | 240 |
| `status` | ADD_LOG | 241 |
| `logs_stream` | ADD_LOG | 242 |
| `switch_tab` | SET_TAB | 243 |
| `models` | SET_INITIAL_DATA (models) | 244 |
| `mcp_servers` | SET_MCP_SERVERS | 245 |
| `checkpoint_list` | SET_CHECKPOINTS | 246 |
| `checkpoint_restored` | ADD_LOG | 247 |
| `toast` | SHOW_TOAST | 248 |
| `team_status` | SET_TEAM_STATUS | 249 |
| `team_runs` | SET_TEAM_RUNS | 250 |
| `team_tasks` | SET_TEAM_TASKS | 251 |
| `team_teammate_spawned` | ADD_TEAM_MEMBER | 252 |
| `team_teammate_shutdown` | REMOVE_TEAM_MEMBER | 253 |
| `connector_status` | SET_CONNECTORS | 254 |

## AgentEventBus (Webview Internal Pub/Sub)

**Location**
- `webview/context/stores.ts:9-40` — EventBus class
- `webview/context/stores.ts:40` — `AgentEventBus` singleton

**Subscribers:**
| Event | Subscriber | File:Line |
|-------|-----------|-----------|
| `session_started` | SessionStore | stores.ts:98 |
| `session_started` | ExecutionStore | stores.ts:263 |
| `session_hydrated` | SessionStore | stores.ts:102 |
| `session_hydrated` | TimelineStore | stores.ts:200 |
| `user_message_sent` | TimelineStore | stores.ts:208 |
| `user_message_sent` | ExecutionStore | stores.ts:274 |
| `assistant_delta` | TimelineStore | stores.ts:147 |
| `reasoning_delta` | TimelineStore | stores.ts:158 |
| `reasoning_delta` | ExecutionStore | stores.ts:284 |
| `tool_event` | TimelineStore | stores.ts:169 |
| `tool_event` | ExecutionStore | stores.ts:288 |
| `tool_event` | ToolExecutionStore | stores.ts:410 |
| `turn_done` | ExecutionStore | stores.ts:307 |
| `reset_done` | SessionStore | stores.ts:106 |
| `reset_done` | TimelineStore | stores.ts:204 |
| `reset_done` | ExecutionStore | stores.ts:327 |
| `reset_done` | ToolExecutionStore | stores.ts:438 |
| `error_occurred` | TimelineStore | stores.ts:214 |
| `error_occurred` | ExecutionStore | stores.ts:341 |
| `checkpoint_list` | SessionStore | stores.ts:110 |
| `mcp_servers` | SessionStore | stores.ts:116 |
| `approval_request` | ToolExecutionStore | stores.ts:402 |
| `approval_resolved` | ToolExecutionStore | stores.ts:406 |
| `status` | ExecutionStore | stores.ts:347 |

**Publishers:**
| Event | Published From | File:Line |
|-------|---------------|-----------|
| `user_message_sent` | `sendMessage()` | ExtensionStateContext.tsx:268 |
| `error_occurred` | `error` message handler | ExtensionStateContext.tsx:240 |

---

# Extension Activation Events

**Location**
- `package.json:30-46`

| Event | When |
|-------|------|
| `onView:zenuxs-chat` | Chat view is opened |
| `onCommand:zenuxs.chat` | Open Chat command |
| `onCommand:zenuxs.explain` | Explain command |
| `onCommand:zenuxs.fix` | Fix command |
| `onCommand:zenuxs.test` | Test command |
| `onCommand:zenuxs.refactor` | Refactor command |
| `onCommand:zenuxs.inlineChat` | Inline Chat command |
| `onCommand:zenuxs.askAboutFile` | Ask About File command |
| `onCommand:zenuxs.newSession` | New Session command |
| `onCommand:zenuxs.stopSession` | Stop Session command |
| `onCommand:zenuxs.toggleSettings` | Toggle Settings command |
| `onCommand:zenuxs.toggleHistory` | Toggle History command |
| `onCommand:zenuxs.quickAsk` | Quick Ask command |
| `onCommand:zenuxs.fixDiagnostic` | Fix Diagnostic command |
| `onStartupFinished` | VS Code startup completed |

---

# Keyboard Shortcuts

| Shortcut | Command | When |
|----------|---------|------|
| `Ctrl+Shift+I` | Open Chat | `!editorHasSelection` |
| `Ctrl+Shift+E` | Explain Selection | `editorHasSelection` |
| `Ctrl+Shift+F` | Fix Selection | `editorHasSelection` |
| `Ctrl+Shift+T` | Generate Tests | `editorHasSelection` |
| `Ctrl+Shift+R` | Refactor Selection | `editorHasSelection` |
| `Ctrl+Shift+K` | Inline Chat | `editorHasSelection` |
| `Ctrl+Shift+N` | New Session | `view.zenuxs-chat` |
| `Escape` | Stop Session | `view.zenuxs-chat` |
| `Ctrl+Shift+.` | Toggle Settings | `view.zenuxs-chat` |
| `Ctrl+Shift+A` | Ask About File | (none) |
| `Ctrl+Shift+D` | Fix Diagnostic | `editorHasDiagnostics` |

---

# Configuration Settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `zenuxs.providerId` | string | "cline" | Default LLM provider ID |
| `zenuxs.modelId` | string | "" | Default model ID |
| `zenuxs.apiKey` | string | "" | API key |
| `zenuxs.baseUrl` | string | "" | Custom base URL |
| `zenuxs.autoApproveTools` | boolean | true | Auto-approve tool executions |
| `zenuxs.thinking` | boolean | false | Enable thinking/reasoning mode |
| `zenuxs.reasoningEffort` | enum | "none" | low/medium/high |
| `zenuxs.maxIterations` | number | 100 | Max agent iterations |
| `zenuxs.backendUrl` | string | "http://localhost:3000" | Backend server URL |
| `zenuxs.enableAutocomplete` | boolean | true | Enable inline autocomplete |
| `zenuxs.theme` | enum | "auto" | Webview theme |
| `zenuxs.mode` | enum | "act" | Agent mode (act/plan/yolo/zen/ask/debug/god) |
| `zenuxs.compaction` | enum | "off" | Context compaction |
| `zenuxs.retries` | number | 3 | Max consecutive mistakes |
| `zenuxs.timeout` | number | 0 | Session timeout (seconds) |
| `zenuxs.checkpointEnabled` | boolean | false | Git-based checkpoints |

---

# Summary

| Category | Count |
|----------|-------|
| **Total UI Views/Tabs** | 7 (Chat, History, Settings, Teams, Dashboard, Dev Logs, Console) |
| **Total Buttons** | ~72 (including icon buttons, action buttons, toolbar buttons) |
| **Total Commands** | 14 (registered in package.json) |
| **Total Keyboard Shortcuts** | 11 |
| **Total Context Menus** | 2 (Editor, Explorer) |
| **Total Dropdowns** | 6 (Model switcher, Mode switcher, Slash autocomplete, Checkpoint, Export format, MCP transport) |
| **Total Settings Sections** | 8 (Provider, Skills, Auto Approves, Execution, MCP, Plugins, About, Developer) |
| **Total Panels** | 1 (Chat Webview Panel) |
| **Total Tree Views** | 0 |
| **Total Modals/Dialogs** | 3 (Approval Card, Edit Message, Session Rename prompt) |
| **Total Notifications** | 3 (Session progress, OAuth progress, Quick Ask progress) |
| **Total Status Bar Items** | 1 |
| **Total Toasts** | 1 (webview toast notification) |
| **Total IPC Messages (Webview→Extension)** | 41 |
| **Total IPC Messages (Extension→Webview)** | 25 |
| **Total EventBus Subscriptions** | 24 |
| **Total Working Features** | ~95% |
| **Total Partial Features** | 2 (Plugins placeholder, Console hidden tab) |
| **Total Broken Features** | 0 |
| **Total Hidden Features** | 4 (Error logging, console interception, session recovery, startup logging) |
| **Total TODO Features** | 0 |
