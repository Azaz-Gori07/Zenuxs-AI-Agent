# Zenuxs Terminal Key Mapping Specification
**Version**: 1.0.0  
**Status**: Proposal  

This specification defines the keyboard interaction layer for **Zenuxs**, a terminal-first autonomous AI coding agent. The design focuses on high efficiency, elimination of terminal protocol conflicts, and mouse-free operation across Linux, Windows, and macOS.

---

## The Modal Paradigm: Insert vs. Command Mode

To avoid conflicts with terminal emulator control codes (such as `Ctrl+S` and `Ctrl+Q` flow controls) and standard shell shortcuts, Zenuxs implements a **modal input system** inspired by vim and LazyGit.

```
                  +--------------------------------+
                  |                                |
                  |   COMMAND MODE (Default)       |
                  |   - Single-key hotkeys (j,k,u) |
                  |   - Focus on navigation/transcripts |
                  |                                |
                  +---------------+----------------+
                                  |
               i / Enter / /      |      Esc (Switch mode)
             (Focus Textarea)     |    (Unfocus Textarea)
                                  v
                  +--------------------------------+
                  |                                |
                  |   INSERT (PROMPT) MODE         |
                  |   - Focus on input text editor |
                  |   - Keypresses write characters|
                  |                                |
                  +--------------------------------+
```

---

## 1. Global Shortcuts

Global shortcuts are active across all modes and views. They use modifiers that are rarely intercepted by host systems.

- **`Ctrl+G`**: Toggle Quick Help overlay (overlay displays context-relevant shortcuts).
- **`Ctrl+P`**: Open Command Palette.
- **`Ctrl+Tab`**: Cycle focus forward through active panes (e.g., Explorer -> Chat -> Context Panel).
- **`Ctrl+Shift+Tab`**: Cycle focus backward through active panes.
- **`Ctrl+Esc`**: Emergency force-abort active agent loop (immediate process interrupt).
- **`Ctrl+\\`**: Toggle Sidebar (collapses/expands Workspace Explorer).

---

## 2. Chat Navigation

When focused on the **Chat Pane** in **Command Mode**:

- **`j` / `k`**: Move selection focus to the next/previous message block.
- **`h` / `l`**: Collapse / Expand reasoning trace block of the selected assistant message.
- **`g` `g`**: Jump focus to the first message.
- **`G`**: Jump focus to the last message.
- **`f`**: Open in-conversation text search filter.
- **`Enter`**: Open selected message details (reveals raw token breakdown, metadata, and exact prompt parameters).

---

## 3. Scrolling System

Zenuxs handles scroll offsets via discrete keyhooks to ensure performance in nested TUI windows.

- **`Ctrl+U`**: Scroll up half-page.
- **`Ctrl+D`**: Scroll down half-page.
- **`Ctrl+B`**: Page Up.
- **`Ctrl+F`**: Page Down.
- **`Shift+Up` / `Shift+Down`**: Smooth line scroll (scrolls window view offset without changing selected item focus).

---

## 4. Text Selection & Copy System

Traditional mouse selection in TUIs often captures window borders, borders of adjacent panes, or line numbers. Zenuxs resolves this with a visual selection system:

- **`v`**: Enter Visual Selection Mode (over the selected message/code block).
- **`Arrow Keys` / `h, j, k, l`**: Move cursor boundaries.
- **`o`**: Swap cursor focus between selection start and end anchors.
- **`y`**: Yank (copy) selected text to the host system clipboard.
- **`c`**: Yank only the *code block* (if focus is on an assistant message containing a markdown code snippet).
- **`a`**: Yank the entire message block (without borders/metadata).

---

## 5. Command Palette

The Command Palette is the central discovery index of the TUI.

- **Trigger**: **`Ctrl+P`**
- **Interface**: A fuzzy-search text input field overlaying the TUI.
- **Default Actions**: Displays a list of categorised actions (Settings, Model, MCP, Clear, Exit).
- **Navigation**:
  - **`Up` / `Down`** or **`Ctrl+K` / `Ctrl+J`**: Highlight items in the search results list.
  - **`Enter`**: Execute selected action.
  - **`Esc`**: Dismiss the Command Palette.

---

## 6. Session Management

When in **Command Mode**:

- **`s` `n`**: New session (wipes current memory, prompts for prompt input).
- **`s` `r`**: Rename active session.
- **`s` `d`**: Duplicate active session (clones the conversation state into a new fork).
- **`s` `a`**: Archive session (moves to archived SQLite status).
- **`s` `x`**: Delete active session (requires immediate confirmation overlay).
- **`s` `h`**: Open history manager (opens list of past sessions).
- **`s` `/`**: Search past session transcripts globally.

---

## 7. Agent Management

Allows changing custom role blueprints or spawning nested sub-agents.

- **`a` `a`**: Open Agent Selector (reveals list of built-in roles and custom YAML agents).
- **`a` `n`**: Cycle to the next agent role.
- **`a` `p`**: Cycle to the previous agent role.
- **`a` `c`**: Create new agent configuration file directly in the workspace explorer.
- **`a` `e`**: Edit the active agent's YAML blueprint file.

---

## 8. Model & Provider Management

- **`m` `m`**: Open Model/Provider Selector pane.
- **`m` `p`**: Toggle active provider configuration panel (enter API keys, Base URLs).
- **`m` `s`**: Quick switch between your top 3 pinned models.

---

## 9. MCP Management

- **`c` `c`**: Open MCP Server registry list.
- **`c` `a`**: Add a new MCP server configuration.
- **`c` `r`**: Force reload and reconnect all configured MCP servers.
- **`c` `d`**: Open MCP diagnostics (displays server console outputs and error logs).
- **`c` `x`**: Remove selected MCP server registration.

---

## 10. Tool Approval System

When an agent proposes a tool call (e.g. executing commands or writing files), Zenuxs halts for approval.

- **`y`** or **`Space`**: Approve the current tool call.
- **`n`** or **`Backspace`**: Reject the tool call (focuses textarea so you can explain why to the agent).
- **`a`**: Approve current tool call + auto-approve future executions of this specific tool in this session.
- **`A`**: Auto-approve all tool calls for this session (turns auto-approval ON globally).
- **`e`**: Edit tool arguments before execution (opens a modal editor with the JSON arguments).
- **`Esc`**: Cancel / Abort task.

---

## 11. Workspace Explorer

When focused on the **Workspace Explorer Pane**:

- **`j` / `k`**: Navigate files and folders.
- **`l`** / **`Right Arrow`**: Expand folder.
- **`h`** / **`Left Arrow`**: Collapse folder.
- **`Enter`**: Open file in workspace editor.
- **`p`**: Open side-by-side preview of selected file.
- **`/`**: Filter file list by name.

---

## 12. Multi-Pane Layout

Manage TUI layout grids:

- **`Ctrl+W` `v`**: Split layout vertically.
- **`Ctrl+W` `s`**: Split layout horizontally.
- **`Ctrl+W` `w`**: Switch focus to next pane.
- **`Ctrl+W` `Arrow Keys`**: Move pane focus directionally.
- **`Ctrl+W` `+` / `-`**: Resize pane height.
- **`Ctrl+W` `<` / `>`**: Resize pane width.
- **`Ctrl+W` `c`**: Close active pane.

---

## 13. History & Checkpoints

- **`u`**: Restore last checkpoint (undo).
- **`U`**: Open checkpoint picker dialog (scroll through list of stashed/committed files changes).
- **`c` `p`**: Manually record a file checkpoint (stashes workspace state).
- **`c` `d`**: Show diff comparing the active state with the selected checkpoint.

---

## 14. AI Agent Runtime Controls

Manage execution state while the agent is running:

- **`Pause`** or **`p`** (in Command Mode): Pause active execution tick.
- **`r`** (in Command Mode): Resume paused execution.
- **`s`** (in Command Mode): Halt execution loop immediately.
- **`t` `r`**: Restart the entire task from the beginning.
- **`t` `c`**: Instruct the agent to continue if it stopped due to iteration limits.

---

## 15. Kanban & Dashboard

- **`k` `k`**: Open Kanban Board panel.
- **`k` `c`**: Create new task card.
- **`k` `m`**: Move highlighted card to next status column.
- **`k` `d`**: Mark card as complete.
- **`d` `b`**: Toggle Dashboard overlay.

---

## 16. Emergency Controls

Shortcuts for recovery when a shell or model output misbehaves:

- **`Ctrl+Esc`**: Immediate terminate (forces agent loop to stop, drops all MCP connections, and cleans database connections).
- **`Ctrl+R`**: Force redraw/reset terminal UI grid.
- **`Ctrl+Shift+R`**: Hard reset configuration states (clears corrupted memory files, restarts in safe mode).

---

## 17. Accessibility Layer

Provides alternative mappings for keyboard layouts and terminal constraints.

### Laptop & macOS Key Bindings
- macOS terminal emulators occasionally consume `Ctrl+C` or `Ctrl+Tab`.
- **Fallback for pane switching**: Use **`Opt+Tab`** instead of `Ctrl+Tab`.
- **Fallback for Command Palette**: Use **`Opt+P`** instead of `Ctrl+P`.

### Non-US Layout Mapping
- Mappings that rely on symbols (like `/` or `\\`) have keyboard equivalents:
  - Instead of `/` for search, use **`f`**.
  - Instead of `Ctrl+\\` for sidebar toggle, use **`Ctrl+E`**.

---

## 18. Final Keymap Table

The master register of all shortcuts:

| Shortcut | Action | Context | Priority |
| :--- | :--- | :--- | :--- |
| **`Ctrl+G`** | Toggle Help Overlay | Global | HIGH |
| **`Ctrl+P`** | Open Command Palette | Global | HIGH |
| **`Ctrl+Tab`** | Move focus to next pane | Global | HIGH |
| **`Ctrl+Esc`** | Emergency Force Abort | Global | CRITICAL |
| **`Ctrl+\\`** | Toggle Workspace Sidebar | Global | MEDIUM |
| **`Esc`** | Unfocus Textarea (Command Mode) | Insert Mode | HIGH |
| **`i`** | Focus Textarea (Insert Mode) | Command Mode | HIGH |
| **`/`** | Focus Textarea (Insert Mode) | Command Mode | HIGH |
| **`j`** | Scroll Down / Highlight Next | Command Mode | HIGH |
| **`k`** | Scroll Up / Highlight Prev | Command Mode | HIGH |
| **`h`** | Collapse node / folder | Command Mode | MEDIUM |
| **`l`** | Expand node / folder | Command Mode | MEDIUM |
| **`g g`** | Jump to top of list/chat | Command Mode | LOW |
| **`G`** | Jump to bottom of list/chat | Command Mode | LOW |
| **`v`** | Enter Visual Selection Mode | Command Mode | MEDIUM |
| **`y`** | Yank selection to clipboard | Visual Mode | HIGH |
| **`c`** | Yank code block to clipboard | Visual Mode | MEDIUM |
| **`Space`** | Approve Tool Call | Approval Screen | HIGH |
| **`Backspace`** | Reject Tool Call | Approval Screen | HIGH |
| **`a`** | Approve tool + remember rule | Approval Screen | MEDIUM |
| **`A`** | Auto-approve all tool calls | Approval Screen | LOW |
| **`e`** | Edit tool arguments | Approval Screen | MEDIUM |
| **`s n`** | Create new session | Command Mode | MEDIUM |
| **`s r`** | Rename active session | Command Mode | LOW |
| **`s d`** | Duplicate session (Fork) | Command Mode | MEDIUM |
| **`s x`** | Delete active session | Command Mode | HIGH |
| **`s h`** | Open History Picker | Command Mode | HIGH |
| **`a a`** | Open Agent Selector | Command Mode | HIGH |
| **`m m`** | Open Model Selector | Command Mode | HIGH |
| **`c c`** | Open MCP Server registry | Command Mode | HIGH |
| **`u`** | Restore last checkpoint (Undo) | Command Mode | HIGH |
| **`U`** | Open Checkpoint History | Command Mode | HIGH |
| **`p`** | Pause agent execution loop | Executing Mode | HIGH |
| **`r`** | Resume agent execution loop | Paused Mode | HIGH |
| **`k k`** | Open Kanban Board | Command Mode | MEDIUM |
| **`Ctrl+R`** | Force redraw UI grid | Global | HIGH |
