# Cline Live Edit & Terminal Analysis

## Cline Files Analyzed

### Live Editing (12 files)
| File | Purpose |
|------|---------|
| `integrations/editor/DiffViewProvider.ts` | Abstract base: open → stream updates → truncate → save/revert → diagnostics diff |
| `hosts/vscode/VscodeDiffViewProvider.ts` | VSCode impl: `vscode.diff` tab, `WorkspaceEdit.applyEdit()`, `DecorationController`, trailing newline fix |
| `integrations/editor/EditPreview.ts` | Read-only virtual diff preview (no disk writes), sweep animation builder |
| `hosts/vscode/DecorationController.ts` | Decoration types: faded overlay (opacity 0.4) + active line highlight (yellow border, opacity 1) |
| `hosts/vscode/hostbridge/diff/replaceText.ts` | Throws — diffService not supported; use VscodeDiffViewProvider |
| `hosts/vscode/hostbridge/diff/scrollDiff.ts` | Reveal range with `TextEditorRevealType.InCenter` |
| `hosts/vscode/hostbridge/diff/truncateDocument.ts` | Delete range from line to end |
| `hosts/vscode/hostbridge/diff/saveDocument.ts` | Save document if dirty |
| `hosts/vscode/hostbridge/diff/getDocumentText.ts` | Read document text |
| `hosts/vscode/hostbridge/diff/openDiff.ts` | Open diff editor command |
| `hosts/vscode/hostbridge/diff/openMultiFileDiff.ts` | Multi-file diff view |
| `hosts/vscode/hostbridge/diff/closeAllDiffs.ts` | Close all cline-diff scheme tabs |

### Terminal Management (8 files)
| File | Purpose |
|------|---------|
| `hosts/vscode/terminal/VscodeTerminalRegistry.ts` | Static terminal pool: create, get, update, remove, auto-clean closed |
| `hosts/vscode/terminal/VscodeTerminalProcess.ts` | EventEmitter: execute command via `shellIntegration.executeCommand()`, OSC 633 parsing, line-by-line output, markerless fallback, "hot" state, Ctrl+C detection |
| `hosts/vscode/terminal/VscodeTerminalManager.ts` | `getOrCreateTerminal(cwd, profile)` with reuse by CWD+shell match, `runCommand()` with process tracking, CWD change via `cd`, shell integration timeout |
| `hosts/vscode/terminal/shellPromptHeuristics.ts` | Classify shell prompts as strong (bash $, root #, PS C:\) or weak (> %) for markerless completion |
| `hosts/vscode/terminal/osc633Parser.ts` | Parse OSC 633 P/A/C/D/E escape sequences for command boundary detection |
| `hosts/vscode/terminal/get-latest-output.ts` | Fallback: read active terminal content via clipboard |
| `hosts/vscode/terminal/ansiUtils.ts` | Strip ANSI escape sequences |
| `integrations/terminal/constants.ts` | Timeout/limit constants |

### SDK Executors (3 files)
| File | Purpose |
|------|---------|
| `extensions/tools/executors/editor.ts` | Filesystem-level: create file, replace text (exact match), insert at line. Uses `fs.writeFile()` directly. Generates line diff for feedback. |
| `extensions/tools/executors/apply-patch.ts` | Patch-based: parse unified diff → compute changes → apply to disk. Supports ADD/UPDATE/DELETE/MOVE. |
| `extensions/tools/executors/bash.ts` | Execute shell commands, capture output via stdin/stdout |

### Integration & Bridge (3 files)
| File | Purpose |
|------|---------|
| `hosts/vscode/hostbridge/workspace/executeCommandInTerminal.ts` | Simple `createTerminal + sendText` — bypasses full terminal management, used for simple one-off commands |
| `sdk/vscode-run-commands-tool.ts` | SDK-level: custom execution mode for running commands |
| `sdk/vscode-terminal-execution-mode.ts` | SDK-level: terminal execution mode coordination |

---

## How Live Editing Works (Cline)

### Architecture

```
┌─────────────────────────────────────────────┐
│            Controller (task flow)             │
│  ┌──────────────┐    ┌──────────────────┐    │
│  │ DiffViewProvider│  │ EditPreview      │    │
│  │ (abstract)      │  │ (abstract,       │    │
│  │  - open()       │  │  read-only)      │    │
│  │  - update()     │  └──────────────────┘    │
│  │  - saveChanges()│                           │
│  │  - revert()     │                           │
│  └───────┬────────┘                            │
│          │ extends                             │
│  ┌───────┴──────────────┐                     │
│  │ VscodeDiffViewProvider│                     │
│  │  - vscode.diff tab    │                     │
│  │  - WorkspaceEdit      │                     │
│  │  - DecorationController│                    │
│  │  - scroll/reveal      │                     │
│  └──────────────────────┘                     │
└─────────────────────────────────────────────┘
```

### Step-by-step Flow

1. **Tool detection**: Controller detects `write_to_file`, `edit_file`, or `apply_diff` tool
2. **Open**: `DiffViewProvider.open(relPath)` is called:
   - Determines edit type (create/modify/delete)
   - Saves dirty document if file exists
   - Reads original content from disk
   - Captures pre-edit diagnostics
   - Opens VS Code **diff editor** (`vscode.diff` command) with original (virtual URI) ↔ modified (real file URI)
   - Sets up `DecorationController`: faded overlay on all content + active line highlight
3. **Stream**: `DiffViewProvider.update(accumulatedContent, isFinal)` is called progressively:
   - Throttled to max 10 updates/second during streaming
   - Strips BOM from incoming content
   - Splits content into lines, compares with previously streamed lines
   - Calls `replaceText(content, rangeToReplace, currentLine)`:
     - Moves cursor to document start (keeps it out of the way)
     - Creates `vscode.WorkspaceEdit` with `edit.replace(document.uri, range, content)`
     - Applies via `vscode.workspace.applyEdit(edit)`
     - Fixes trailing newlines (VS Code normalizes them)
     - Updates decorations (faded overlay after current line, active line highlight)
   - Scrolls to current line via `revealRange()`
   - For large changes, creates smooth animation (10-step scroll)
4. **Finalize**: `update(content, isFinal=true)`:
   - Replaces full document content
   - Truncates remaining lines
   - Clears decorations
5. **Save/Approve or Revert**:
   - `saveChanges()`: Gets document text → saves → detects auto-formatting → detects new diagnostics → closes diff views → shows final file → returns newProblemsMessage + userEdits + finalContent
   - `revertChanges()`: Restores original content → saves → closes diff views

### VSCode APIs Used
- `vscode.commands.executeCommand("vscode.diff", ...)` — Open diff editor
- `vscode.workspace.applyEdit(edit)` — Apply text changes to document
- `vscode.WorkspaceEdit` — Edit builder
- `vscode.Range` / `vscode.Position` — Document positions
- `vscode.TextEditor.revealRange(range, InCenter)` — Scroll to position
- `vscode.TextEditor.selection` — Cursor position
- `vscode.window.tabGroups.close(tab)` — Close diff tabs
- `vscode.window.createTextEditorDecorationType()` — Visual decorations
- `vscode.TextDocument.save()` — Save document
- `vscode.Uri.parse("cline-diff:...")` — Virtual diff URI scheme
- `vscode.window.showTextDocument(uri, { preserveFocus: true })` — Open editor without stealing focus
- `vscode.window.onDidChangeActiveTextEditor` — Tab open detection

### Key Design Decisions
1. **Diff tab, not inline**: Edits stream into a diff view so the user can see original ↔ modified side by side
2. **`WorkspaceEdit` over `TextEditorEdit`**: Works with documents, not editors — survives editor closure
3. **Throttled streaming**: Max 10 updates/sec prevents flickering and performance issues
4. **Cursor at document start**: Keeps cursor out of the way during streaming
5. **Trailing newline fixup**: VS Code strips trailing newlines on full replacements; manually restores them
6. **Decorations**: Faded overlay (opacity 0.4) on unedited content + active line highlight → visual progress tracking
7. **Diagnostics pre/post**: Captures file diagnostics before and after editing to detect new problems

---

## How Terminal Management Works (Cline)

### Architecture

```
┌─────────────────────────────────────────────┐
│           VscodeTerminalManager               │
│  ┌────────────────┐ ┌──────────────────┐     │
│  │ getOrCreateTerminal│  runCommand()    │     │
│  │ (reuse pool)   │ │ (process mgmt)   │     │
│  └───────┬────────┘ └────────┬─────────┘     │
│          │                   │                │
│  ┌───────┴────────┐ ┌───────┴─────────┐     │
│  │ TerminalRegistry│ │ VscodeTerminal  │     │
│  │ (static pool)   │ │ Process         │     │
│  │  - id, busy,    │ │ (EventEmitter)  │     │
│  │    shellPath,   │ │  - 'line'       │     │
│  │    lastCommand  │ │  - 'completed'  │     │
│  │    cwd          │ │  - 'error'      │     │
│  │    pendingCwd   │ │  - 'continue'   │     │
│  └────────────────┘ │  - 'no_shell_   │     │
│                      │     integration'│     │
│                      └─────────────────┘     │
└─────────────────────────────────────────────┘
```

### Step-by-step Flow

1. **Get or create terminal**: `terminalManager.getOrCreateTerminal(cwd, profileId)`:
   - Searches registry for non-busy terminal with matching shell + CWD
   - If found, returns it (reuse)
   - If not found but terminal reuse enabled, finds non-busy terminal regardless of CWD → changes to target CWD via `cd`
   - If nothing available, creates new terminal with `vscode.window.createTerminal({ cwd, name: "Cline", iconPath, env: { CLINE_ACTIVE: "true" } })`

2. **Run command**: `terminalManager.runCommand(terminalInfo, command)` → `VscodeTerminalProcess`:
   - Sets terminal busy=true
   - Creates `VscodeTerminalProcess` (EventEmitter)
   - **With shell integration** (`terminal.shellIntegration.executeCommand(command)`):
     - Gets `execution.read()` async iterator
     - Parses output with `Osc633Parser` for C (CommandExecuted) / D (CommandFinished) markers
     - Before C marker: buffers text as fallback (prompt/echo)
     - Between C and D: collects command output → strips ANSI → emits 'line' events
     - After D: begins discarding (next prompt)
     - **Idle fallback**: If C never arrives (ssh/nested shells), uses markerless heuristics:
       - FIRST_DATA_TIMEOUT → MARKERLESS_IDLE_TIMEOUT → prompt strength classification → max_quiet_time
     - **Exit code**: Captured from `onDidEndTerminalShellExecution` event (reliable) or D marker (fallback)
     - **"Hot" state**: Sets `isHot=true` with timeout (3s normal, 30s for compiling output) — stalls API requests
     - **Ctrl+C**: Detects `^C` or `\u0003` in output → breaks
     - **Terminal closure**: Races an `onDidCloseTerminal` promise
   - **Without shell integration**: `terminal.sendText(command)` → wait 3s → capture fallback output
   - Returns `mergePromise(process, promise)` — both EventEmitter AND Promise-like (then/catch/finally)

3. **Completion**:
   - Emits `'completed'` with `{ exitCode, signal, terminalClosed }`
   - Emits `'continue'` → resolves the returned promise
   - Emits `'no_shell_integration'` → removes terminal from registry (can't be reused)

### VSCode APIs Used
- `vscode.window.createTerminal(options)` — Create terminal with name, icon, shell, env, CWD
- `vscode.Terminal.shellIntegration` — Get shell integration API (VS Code 1.93+)
- `terminal.shellIntegration.executeCommand(command)` — Execute via shell integration
- `execution.read()` — Get async iterable of raw terminal output
- `vscode.window.onDidEndTerminalShellExecution` — Exit code event
- `vscode.window.onDidCloseTerminal` — Terminal closed event
- `vscode.window.onDidStartTerminalShellExecution` — Pre-read stream (keeps output consistent)
- `vscode.window.onDidChangeTerminalState` — Detect CWD updates
- `terminal.sendText(command, addNewLine)` — Fallback without shell integration
- `terminal.show(preserveFocus)` — Focus/preview the terminal

### Key Design Decisions
1. **Shell integration preferred**: Reliable output capture, exit code, and command boundaries
2. **Markerless fallback**: For ssh/nested shells where OSC 633 sequences aren't emitted
3. **Terminal reuse**: By CWD + shell profile → avoids creating too many terminals
4. **Busy tracking**: Prevents sending commands to a terminal already running a command
5. **Per-task terminal set**: `terminalIds` set tracks which terminals belong to the current task
6. **Hot state**: Prevents API requests while terminal commands are still running/compiling
7. **Unretrieved output**: `getUnretrievedOutput()` fetches output that wasn't captured during streaming
8. **Process as Promise**: `mergePromise()` creates a thenable EventEmitter for flexible consumption

---

## Architectural Differences: Cline vs Zenuxs

| Aspect | Cline | Zenuxs |
|--------|-------|--------|
| **Task model** | Monolithic controller with per-task state | Tasks via `TaskDataV2` with event arrays |
| **Messaging** | Direct method calls + EventEmitter | `AgentEventBus` (pub/sub) + `TimelineStore` |
| **Core runtime** | Tightly integrated controller | `ExtensionCoreBridge` → `@cline/core` via SDK |
| **File operations** | Controller intercepts before SDK writes | SDK writes to disk directly, extension reacts to events |
| **Terminal** | Full `TerminalManager` + `TerminalProcess` | Primitive `handleRunCommand` — single shared terminal |
| **Diff view** | Full-featured `DiffViewProvider` with streaming | Minimal `ZenuxsDiffProvider` — post-hoc only |
| **File open** | Via `DiffViewProvider` during edit | Via `handleOpenFile` — user-initiated only |
| **Event mapping** | Custom per-event | `mapCoreEventToWebview()` in event-mapper.ts |
| **Webview state** | Single state object | Dual: `AppState` (reducer) + `TimelineStore`/`ExecutionStore` |

---

## Proposed Zenuxs Implementation

### Feature 1: Live Editing

**New file: `src/providers/live-edit-provider.ts`**

```
┌─────────────────────────────────────────────┐
│            ChatViewProvider                    │
│  Subscribes to core bridge events             │
│  ┌──────────────────────────────────────┐    │
│  │ When tool_event for file write arrives│    │
│  │  → notify LiveEditProvider            │    │
│  └──────────────────┬───────────────────┘    │
│                     │                         │
│  ┌──────────────────▼───────────────────┐    │
│  │        ZenuxsLiveEditProvider          │    │
│  │                                        │    │
│  │  openFileForEdit(filePath)             │    │
│  │    - Save original content             │    │
│  │    - Open file in VS Code editor       │    │
│  │    - Track active file                 │    │
│  │                                        │    │
│  │  watchForChanges()                     │    │
│  │    - Poll file content on timer        │    │
│  │    - Or use onDidChangeTextDocument    │    │
│  │    - Reveal new content to user        │    │
│  │                                        │    │
│  │  closeFileEdit()                       │    │
│  │    - Stop watching                     │    │
│  │    - Clean up decorations              │    │
│  └──────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

**Key differences from Cline:**
- Cline opens a diff tab and streams INTO it; Zenuxs opens the real file and watches for changes
- Cline controls the content being written; Zenuxs reacts to filesystem changes from the SDK
- Cline uses decorations; Zenuxs uses VS Code's built-in diff indicators from file watching

**Implementation flow:**
1. `ChatViewProvider` receives `tool_event` with `eventType: "writing"` or `eventType: "editing"` and a `filePath`
2. Calls `LiveEditProvider.openForEdit(filePath)`
3. `LiveEditProvider` saves original content, opens file in editor
4. Polls file content at 200ms intervals (or uses VS Code's `onDidChangeTextDocument`)
5. When content differs from last seen, the editor already reflects the change (VS Code picks up external changes)
6. Optionally shows a diff overlay using decorations
7. When the tool completes, stops watching

### Feature 2: Dedicated Agent Terminal

**New file: `src/providers/agent-terminal-manager.ts`**

```
┌─────────────────────────────────────────────┐
│          AgentTerminalManager                  │
│                                                │
│  ┌────────────────┐ ┌──────────────────┐     │
│  │ getOrCreateFor()│ │ executeCommand()  │     │
│  │ (taskId-based)  │ │ (run in terminal) │     │
│  └───────┬────────┘ └────────┬─────────┘     │
│          │                   │                │
│  ┌───────┴────────┐ ┌───────┴─────────┐     │
│  │ TerminalPool    │ │ TerminalProcess  │     │
│  │  - taskId→term  │ │ (output capture) │     │
│  │  - name format  │ │  - line stream   │     │
│  │  - reuse logic  │ │  - completion    │     │
│  │  - cleanup      │ │  - cancellation  │     │
│  └────────────────┘ └─────────────────┘     │
│                                                │
│  Notification → AgentEventBus                  │
│  (.publish("terminal_line", ...))               │
└─────────────────────────────────────────────┘
```

**Implementation flow:**
1. `ChatViewProvider` receives `tool_event` with `eventType: "command"` and `text` being the command
2. Calls `AgentTerminalManager.getOrCreateFor(taskId)` to get a terminal for this task
3. Calls `AgentTerminalManager.executeCommand(terminalInfo, command)`
4. `AgentTerminalManager` sends the command via `terminal.sendText()`
5. Output is polled (using shell integration via `read()`) and published to `AgentEventBus` as `terminal_line` events
6. On task completion, terminal is marked for reuse or disposed
7. On task cancellation, `terminal.sendText("\x03")` (Ctrl+C) is sent

### Integration

Both features integrate into `ChatViewProvider` via the existing event subscription:

```typescript
// In executeSession(), when subscribing to core bridge events:
bridge.subscribe((event: CoreSessionEvent) => {
    const messages = mapCoreEventToWebview(event);
    for (const msg of messages) {
        if (msg.type === "tool_event" && msg.event) {
            // Live editing
            if (msg.event.eventType === "writing" || msg.event.eventType === "editing") {
                liveEditProvider.openForEdit(msg.event.filePath);
            }
            // Terminal
            if (msg.event.eventType === "command") {
                agentTerminalManager.executeCommand(taskId, msg.event.text);
            }
        }
        this.postToWebview(msg);
    }
});
```

### Potential Risks and Edge Cases
1. **File already open with unsaved changes**: Must not overwrite user's unsaved work. `LiveEditProvider` checks `document.isDirty` before applying external content.
2. **Rapid consecutive edits**: Throttle file open/close to avoid flickering. Debounce at 300ms.
3. **User actively typing in another file**: Don't steal focus. Use `{ preserveFocus: true }` when opening.
4. **Task cancellation mid-edit**: Clean up decorations, stop polling, close diff views.
5. **Multiple concurrent tasks**: Each task gets its own terminal.
6. **Extension reload**: Persist terminal-task mapping in `globalState`.
7. **Very large files**: Don't poll; use `onDidChangeTextDocument` event instead.
8. **Commands that never exit**: Terminal timeout fallback.
9. **Shell integration not available**: Fall back to `sendText()` + timer-based output capture.
10. **Terminal closed by user**: Detect via `onDidCloseTerminal`, recreate if task is still running.
