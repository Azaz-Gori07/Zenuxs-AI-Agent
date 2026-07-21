# Zenuxs Code Complete Documentation

## Repository Overview

**Zenuxs Code** (`@zenuxs/workspace`) is an advanced, multi-modal AI coding assistant ecosystem and autonomous engineering runtime. Built on the core task execution engine of `@cline/core`, Zenuxs Code enhances the runtime with 7 specialized agent execution modes (`act`, `plan`, `yolo`, `zen`, `ask`, `debug`, `god`), integrated performance profiling and flamegraph analysis tools (`ZENUXS_PROFILE_DATA.json`, `ZENUXS_FLAMEGRAPH_DATA.json`), inline autocomplete suggestions, diagnostic auto-fix commands, and multi-interface deployment targets.

Zenuxs Code operates across three core interfaces:
1. **VSCode Extension (`apps/vscode-extension`)**: A rich sidebar and editor panel extension (`zenuxs-vscode`), providing chat panels, inline code actions, diagnostic error fixers, status bar indicators, and inline autocomplete completions.
2. **CLI Utility (`apps/cli`)**: A terminal binary (`zenuxs`) for executing autonomous coding tasks headlessly or interactively.
3. **Zenuxs Hub (`apps/zenuxs-hub`)**: A web dashboard interface for remote task management and organizational metrics.

### Key Architectural Characteristics
- **Direct Runtime Binding**: Unlike traditional extensions that connect to external server daemons via WebSocket wrappers, `apps/vscode-extension` binds directly to `@cline/core` via `ExtensionCoreBridge`, ensuring zero latency and 100% CLI feature parity.
- **7 Agent Modes**: Features seven specialized agent operational modes:
  - `act`: Full multi-file editing and tool execution.
  - `plan`: Read-only design, architecture, and step-by-step roadmap generation.
  - `yolo`: Unrestricted high-speed execution with auto-approved permissions.
  - `zen`: Focused minimal context mode for precision bug fixes.
  - `ask`: Conversational Q&A mode without workspace mutations.
  - `debug`: Diagnostic error investigation and stack trace analysis.
  - `god`: Unconstrained multi-agent orchestration mode.
- **Performance Profiling & Flamegraph Integration**: Includes built-in performance diagnostic data (`ZENUXS_PROFILE_DATA.json`, `ZENUXS_FLAMEGRAPH_DATA.json`) to track CPU execution overhead, token throughput, and tool execution latency.
- **Context Compaction Strategies**: Supports three context pruning strategies: `off`, `basic`, and `agentic`.
- **Bun Monorepo Architecture**: Managed as a Bun workspace (`bun@>=1.0.0`) organizing applications in `apps/` and shared packages in `packages/`.

---

## Tech Stack Matrix

| Layer / Subsystem | Primary Technologies | Key Libraries & Packages |
| :--- | :--- | :--- |
| **Runtime & Package Manager** | Bun, Node.js | `bun@>=1.0.0`, `node >=22`, `nanoid`, `ajv` |
| **VSCode Extension API** | VSCode Extension API, ESBuild | `@types/vscode`, `@types/react`, `esbuild` |
| **Webview Frontend (UI)** | React 19, Vite, HTML5 / CSS3 | `react`, `react-dom`, `@types/react-dom` |
| **Core Task Engine** | TypeScript | `@cline/core`, `@cline/shared`, `@zenuxs/core`, `@zenuxs/agents` |
| **LLM Provider Adapters** | Vercel AI SDK, Custom Adapters | `@cline/llms`, `@anthropic-ai/sdk`, `openai` |
| **Performance Profiling** | Flamegraph JSON Engine, Vitest | `ZENUXS_FLAMEGRAPH_DATA.json`, `ZENUXS_PROFILE_DATA.json`, `vitest` |
| **Diagnostic & Fix Engine** | VSCode Languages API | `vscode.languages.getDiagnostics`, `vscode.languages.registerInlineCompletionItemProvider` |

---

## Architecture

### System Process Hierarchy & Process Topology

```
                  +-----------------------------------+
                  |         VSCode Window             |
                  +-----------------+-----------------+
                                    |
            +-----------------------+-----------------------+
            |                                               |
            v                                               v
+-----------------------+                       +-----------------------+
|  VSCode Extension Host|                       |   Webview UI Context  |
| (apps/vscode-ext.)    |                       | (apps/vscode-extension|
|                       |  window.postMessage   |      /dist/webview.js)|
| - ZenuxsChatViewProv. |<=====================>| - Sidebar Chat UI     |
| - ExtensionCoreBridge |   (WebviewMessage     | - Settings Panel      |
| - ZenuxsStatusBar     |   /ExtensionMessage)  | - History View        |
+-----------+-----------+                       +-----------------------+
            |
            +-----------------------+
            |                       |
            v                       v
+-----------------------+ +-----------------------+
|     @cline/core       | |      @cline/llms      |
| (Task Engine & Loop)  | |  (Model Adapters)     |
|                       | |                       |
| - Task Execution Loop | | - Anthropic, OpenAI,  |
| - 7 Agent Modes       | |   DeepSeek, Bedrock,  |
| - Flamegraph Telemetry| |   OpenRouter, Ollama  |
| - Tool Execution      | +-----------+-----------+
+-----------+-----------+             |
            |                         v
            v             +-----------------------+
+-----------------------+ | External LLM Provider |
| Host OS Environment   | | APIs & MCP Servers    |
| (File System / Shell) | +-----------------------+
+-----------------------+
```

### Component Communication & Data Flow

1. **Extension Activation (`extension.ts`)**:
   - Fires on activation events (`onView:zenuxs-chat`, `onCommand:zenuxs.chat`, `onStartupFinished`).
   - Registers `ZenuxsChatViewProvider`, status bar item (`ZenuxsStatusBar`), inline completion provider (`ZenuxsInlineCompletionProvider`), and diagnostic code actions.
2. **Command & Context Capture (`commands/index.ts`)**:
   - Commands like `zenuxs.explain`, `zenuxs.fix`, `zenuxs.test`, `zenuxs.refactor`, and `zenuxs.fixDiagnostic` capture editor text selection, active file language, and diagnostic error lines (`vscode.languages.getDiagnostics`).
   - Formats the captured context and dispatches it directly to `ZenuxsChatViewProvider`.
3. **Task Loop & Agent Execution Modes**:
   - Evaluates active agent mode (`act`, `plan`, `yolo`, `zen`, `ask`, `debug`, `god`).
   - Executes recursive prompt loops via `@cline/core` with chosen model providers.
   - Collects execution profiling metrics into `ZENUXS_PROFILE_DATA.json`.

---

## Workspace Package Index

The repository is structured into `apps/` and `packages/`:

```
d:\V3\zenuxs-code
├── apps/
│   ├── cli/                      # Zenuxs CLI binary package (`zenuxs`)
│   ├── vscode-extension/         # Zenuxs VSCode extension package (`zenuxs-vscode`)
│   └── zenuxs-hub/               # Zenuxs Hub web dashboard application
├── packages/
│   ├── agents/                   # Agent orchestration, sub-agents, team delegation
│   ├── core/                     # Core task engine, tool execution, profiling telemetry
│   ├── llms/                     # AI model provider adapters and cost calculation
│   └── shared/                   # Shared TypeScript protocol contracts and types
├── skills/                       # Built-in agent skill definitions
├── config.json                   # Detailed workspace settings and default model configurations
├── .zenuxs-user-config.json      # Persistent user configuration file
├── QA-REPORT.md                  # Comprehensive QA verification report
├── ZENUXS_FLAMEGRAPH_DATA.json   # CPU execution flamegraph profile data
└── ZENUXS_PROFILE_DATA.json      # Memory and execution metric profile data
```

---

## Detailed File Index

### VSCode Extension (`apps/vscode-extension/src/`)
- `apps/vscode-extension/src/extension.ts`: Activation entrypoint. Intercepts console logs, registers `ZenuxsChatViewProvider`, status bar, commands, code actions, and inline completion provider.
- `apps/vscode-extension/src/commands/index.ts`: Command handler registry for 13 commands (`zenuxs.chat`, `zenuxs.explain`, `zenuxs.fix`, `zenuxs.test`, `zenuxs.refactor`, `zenuxs.askAboutFile`, `zenuxs.inlineChat`, `zenuxs.newSession`, `zenuxs.stopSession`, `zenuxs.toggleSettings`, `zenuxs.toggleHistory`, `zenuxs.quickAsk`, `zenuxs.fixDiagnostic`).
- `apps/vscode-extension/src/providers/chat-view-provider.ts`: Main webview provider managing `ExtensionCoreBridge` and postMessage IPC.
- `apps/vscode-extension/src/providers/inline-completion-provider.ts`: Inline ghost text code autocomplete provider.
- `apps/vscode-extension/src/providers/code-action-provider.ts`: Quick Fix lightbulb menu provider for code errors and refactoring.
- `apps/vscode-extension/src/status/status-bar.ts`: Status bar indicator component (Idle, Thinking, Executing, Error).

### Core Libraries (`packages/`)
- `packages/core/src/`: Core engine implementations.
- `packages/llms/src/`: Model provider adapters (Anthropic, OpenAI, DeepSeek, Bedrock, OpenRouter, Ollama).
- `packages/agents/src/`: Sub-agent orchestrator and execution graph handlers.
- `packages/shared/src/`: Protocol definitions and shared interfaces.

---

## Commands Inventory

### VSCode Extension Commands (`apps/vscode-extension/package.json`)

| Command ID | Title | Keybinding | When Clause | Description |
| :--- | :--- | :--- | :--- | :--- |
| **`zenuxs.chat`** | Zenuxs: Open Chat | `Ctrl+Shift+I` | `!editorHasSelection` | Focuses and opens the Zenuxs chat sidebar panel |
| **`zenuxs.explain`** | Zenuxs: Explain Selection | `Ctrl+Shift+E` | `editorHasSelection` | Explains selected code snippet in the chat panel |
| **`zenuxs.fix`** | Zenuxs: Fix Selection | `Ctrl+Shift+F` | `editorHasSelection` | Fixes bugs and logic errors in selected code |
| **`zenuxs.test`** | Zenuxs: Generate Tests | `Ctrl+Shift+T` | `editorHasSelection` | Auto-generates comprehensive unit tests for selected code |
| **`zenuxs.refactor`** | Zenuxs: Refactor Selection | `Ctrl+Shift+R` | `editorHasSelection` | Refactors selected code for readability and performance |
| **`zenuxs.inlineChat`** | Zenuxs: Inline Chat | `Ctrl+Shift+K` | `editorHasSelection` | Prompts input box for inline code modification |
| **`zenuxs.askAboutFile`** | Zenuxs: Ask About This File | `Ctrl+Shift+A` | None | Prompts input box to query specific workspace file |
| **`zenuxs.newSession`** | Zenuxs: New Session | `Ctrl+Shift+N` | `view.zenuxs-chat` | Starts a fresh Zenuxs session |
| **`zenuxs.stopSession`** | Zenuxs: Stop Current Session | `Escape` | `view.zenuxs-chat` | Aborts active task execution loop |
| **`zenuxs.toggleSettings`** | Zenuxs: Toggle Settings Panel | `Ctrl+Shift+.` | `view.zenuxs-chat` | Toggles settings panel in webview UI |
| **`zenuxs.toggleHistory`** | Zenuxs: Toggle History Panel | None | None | Toggles session history list |
| **`zenuxs.quickAsk`** | Zenuxs: Quick Ask | None | None | Runs quick question with progress notification without opening full chat |
| **`zenuxs.fixDiagnostic`** | Zenuxs: Fix Diagnostic | `Ctrl+Shift+D` | `editorHasDiagnostics` | Automatically extracts editor errors/warnings and dispatches fix prompt |

---

## Configuration Matrix

Zenuxs Code provides rich configuration options via VSCode settings and `.zenuxs-user-config.json`:

| Config Setting Key | Default Value | Allowed Values / Options | Description |
| :--- | :--- | :--- | :--- |
| `zenuxs.mode` | `"act"` | `"act"`, `"plan"`, `"yolo"`, `"zen"`, `"ask"`, `"debug"`, `"god"` | Agent operational mode |
| `zenuxs.providerId` | `"cline"` | Provider string | Primary LLM provider ID |
| `zenuxs.modelId` | `""` | Model ID string | Model selection (empty = provider default) |
| `zenuxs.apiKey` | `""` | API Key string | Provider API authorization key |
| `zenuxs.baseUrl` | `""` | URL string | Custom API endpoint URL |
| `zenuxs.autoApproveTools` | `true` | `true`, `false` | Automatically approve tool calls |
| `zenuxs.thinking` | `false` | `true`, `false` | Enable reasoning/thinking budget |
| `zenuxs.reasoningEffort` | `"none"` | `"none"`, `"low"`, `"medium"`, `"high"` | Extended reasoning effort level |
| `zenuxs.maxIterations` | `100` | Positive Integer | Maximum iteration limit per task session |
| `zenuxs.compaction` | `"off"` | `"off"`, `"basic"`, `"agentic"` | Conversation context compaction strategy |
| `zenuxs.retries` | `3` | Integer | Max retries on consecutive mistakes |
| `zenuxs.enableAutocomplete` | `true` | `true`, `false` | Enables inline ghost text code completion |
| `zenuxs.checkpointEnabled` | `false` | `true`, `false` | Enables git shadow commit checkpoints |

---

## UI Reverse Engineering & Button Inventory

Below is the audit of primary interactive elements, click handlers, component locations, and associated network/message actions:

| Button / UI Element Name | Visible Label / Icon | Component Location | Source File | Click Handler / Event | Business Logic & Action | IPC / Network Action |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **New Session Button** | `+` / Plus Icon | View Header Navigation | `apps/vscode-extension/src/commands/index.ts` | `registerCommand("zenuxs.newSession")` | Resets current task state, clears timeline, starts new session | `postMessage({ type: "newSession" })` |
| **Stop Session Button** | Stop Icon / Esc | View Header / Keyboard | `apps/vscode-extension/src/commands/index.ts` | `registerCommand("zenuxs.stopSession")` | Aborts active task runner loop and halts LLM stream | `postMessage({ type: "stopSession" })` |
| **Settings Panel Toggle** | Gear Icon | View Header Navigation | `apps/vscode-extension/src/commands/index.ts` | `registerCommand("zenuxs.toggleSettings")` | Toggles Webview UI settings view | `postMessage({ type: "toggleSettings" })` |
| **History Panel Toggle** | History Icon | View Header Navigation | `apps/vscode-extension/src/commands/index.ts` | `registerCommand("zenuxs.toggleHistory")` | Toggles Webview session history list | `postMessage({ type: "toggleHistory" })` |
| **Quick Fix Diagnostic** | Fix Diagnostic / Bug | Editor Lightbulb Menu | `apps/vscode-extension/src/commands/index.ts` | `registerCommand("zenuxs.fixDiagnostic")` | Reads `vscode.languages.getDiagnostics`, extracts error lines, dispatches fix prompt | `postMessage({ type: "sendPrompt", prompt })` |
| **Explain Selection** | Explain Selection | Editor Context Menu | `apps/vscode-extension/src/commands/index.ts` | `registerCommand("zenuxs.explain")` | Captures editor text selection and prompts explanation in chat | `postMessage({ type: "sendPrompt", prompt })` |
| **Refactor Selection** | Refactor Selection | Editor Context Menu | `apps/vscode-extension/src/commands/index.ts` | `registerCommand("zenuxs.refactor")` | Captures selected code and prompts refactoring instructions | `postMessage({ type: "sendPrompt", prompt })` |
| **Generate Tests** | Generate Tests | Editor Context Menu | `apps/vscode-extension/src/commands/index.ts` | `registerCommand("zenuxs.test")` | Captures selected function and generates unit tests | `postMessage({ type: "sendPrompt", prompt })` |

---

## Performance & Profiling Infrastructure

Zenuxs Code includes dedicated performance metrics engines:
- **`ZENUXS_PROFILE_DATA.json`**: Contains structured metrics tracking memory allocation, task execution times, tool invocation latency, and API stream throughput.
- **`ZENUXS_FLAMEGRAPH_DATA.json`**: Contains CPU execution stack trace data for rendering flamegraphs of task loop execution bottlenecks.
- **`QA-REPORT.md`**: Contains comprehensive QA validation test suites, verification benchmarks, and status metrics across all 7 agent modes.

---

## Security & Permissions Framework

1. **Auto-Approve Tools Configuration**: Managed via `zenuxs.autoApproveTools` setting.
2. **Consecutive Retry Limit (`zenuxs.retries`)**: Automatically aborts session if an agent encounters 3 consecutive failed tool calls, preventing infinite retry loops.
3. **Workspace Configuration Guards (`.zenuxs-user-config.json`)**: Isolates user credentials and custom parameters safely outside version control.

---

## Build System & CI/CD Pipeline

- **Monorepo Management**: Powered by Bun (`bun@>=1.0.0`) workspaces.
- **Webview Compilation**: `bun build --production ./src/webview/index.tsx --outfile ./dist/webview.js --target browser --format esm`
- **Extension Compilation**: `bun build ./src/extension.ts --outfile ./dist/extension.js --target node --format esm --external vscode`
- **Extension Packaging**: `bun run build && npx @vscode/vsce package --no-dependencies` (outputs `zenuxs-vscode-0.1.0.vsix`).

---

## Verification & Summary

This technical documentation provides a complete analysis of the **Zenuxs Code** repository. It documents `apps/vscode-extension`, `apps/cli`, `apps/zenuxs-hub`, core packages (`packages/core`, `packages/llms`, `packages/shared`, `packages/agents`), the 7 agent execution modes, performance profiling data (`ZENUXS_FLAMEGRAPH_DATA.json`), commands, configuration options, and UI button interactions, without modifying any other workspace documentation.
