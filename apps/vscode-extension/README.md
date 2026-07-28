# Zenuxs Code

AI coding assistant powered by the Zenuxs runtime — autonomous engineering, multi-file editing, tool execution, and streaming responses.

## Features

- **AI Chat** — conversational assistant in a dedicated webview panel
- **Explain Code** — select code and get an AI-powered explanation
- **Fix Code** — automatically fix selected code
- **Generate Tests** — generate unit tests for selected code
- **Refactor** — refactor selected code with AI
- **Inline Chat** — chat about selected code without leaving the editor
- **Ask About File** — ask questions about the current file from the explorer context menu
- **Fix Diagnostic** — automatically fix diagnostics (lint errors, etc.)
- **Autocomplete** — inline code suggestions as you type
- **Multiple Modes** — Act, Plan, Yolo, Zen, Ask, Debug, God
- **Custom Providers** — bring your own LLM provider and API key

## Installation

### From VSIX

1. Download the `.vsix` file
2. In VS Code, press `Ctrl+Shift+P` and run **Extensions: Install from VSIX...**
3. Select the downloaded file

### From VS Code Marketplace

Search for **"Zenuxs"** in the Extensions view (`Ctrl+Shift+X`).

## Getting Started

1. Open the Zenuxs panel by clicking the Zenuxs icon in the activity bar, or press `Ctrl+Shift+I`
2. Configure your LLM provider in settings (`Ctrl+,` → search for `zenuxs`)
3. Set your API key and provider
4. Start coding with AI assistance

## Commands

| Command | Keybinding | Description |
|---------|-----------|-------------|
| `Zenuxs: Open Chat` | `Ctrl+Shift+I` | Open Zenuxs chat panel |
| `Zenuxs: Explain Selection` | `Ctrl+Shift+E` | Explain selected code |
| `Zenuxs: Fix Selection` | `Ctrl+Shift+F` | Fix selected code |
| `Zenuxs: Generate Tests` | `Ctrl+Shift+T` | Generate tests for selection |
| `Zenuxs: Refactor Selection` | `Ctrl+Shift+R` | Refactor selected code |
| `Zenuxs: Inline Chat` | `Ctrl+Shift+K` | Chat about selection inline |
| `Zenuxs: Ask About This File` | `Ctrl+Shift+A` | Ask about current file |
| `Zenuxs: New Session` | `Ctrl+Shift+N` | Start a new session |
| `Zenuxs: Stop Session` | `Escape` | Stop current session |
| `Zenuxs: Fix Diagnostic` | `Ctrl+Shift+D` | Fix diagnostic at cursor |

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `zenuxs.providerId` | `"cline"` | LLM provider ID |
| `zenuxs.modelId` | `""` | Model ID (empty = provider default) |
| `zenuxs.apiKey` | `""` | API key for the provider |
| `zenuxs.baseUrl` | `""` | Custom base URL |
| `zenuxs.autoApproveTools` | `true` | Auto-approve tool executions |
| `zenuxs.thinking` | `false` | Enable reasoning mode |
| `zenuxs.reasoningEffort` | `"none"` | Reasoning effort (none/low/medium/high) |
| `zenuxs.maxIterations` | `100` | Max agent iterations per session |
| `zenuxs.backendUrl` | `"http://localhost:3000"` | Backend server URL |
| `zenuxs.enableAutocomplete` | `true` | Enable inline autocomplete |
| `zenuxs.theme` | `"auto"` | Webview theme (auto/light/dark) |
| `zenuxs.mode` | `"act"` | Agent mode (act/plan/yolo/zen/ask/debug/god) |
| `zenuxs.compaction` | `"off"` | Context compaction (off/basic/agentic) |
| `zenuxs.retries` | `3` | Max consecutive mistakes before aborting |
| `zenuxs.timeout` | `0` | Session timeout in seconds (0 = no limit) |
| `zenuxs.checkpointEnabled` | `false` | Enable git-based checkpoints |

## Development

```bash
# Install dependencies (from repo root)
bun install

# Build the extension
cd apps/vscode-extension
bun run build

# Package as VSIX
npx @vscode/vsce package --no-dependencies
```

## License

MIT
