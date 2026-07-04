# Zenuxs VS Code Extension

## Architecture Decision

**Integration approach: Direct library import (Option 1)**

The existing `ZenuxsCore` class at `packages/core/src/ZenuxsCore.ts` is already designed as an embeddable SDK. It supports:
- `ZenuxsCore.create({ backendMode: "local" })` -- in-process runtime
- `start()` / `send()` / `subscribe()` -- full session lifecycle with event streaming
- `CoreSessionEvent` union type -- chunk, agent_event, ended, hook, status, etc.

The CLI already uses this exact pattern in `apps/cli/src/session/session.ts` (`createCliCore()`) and `apps/cli/src/runtime/run-agent.ts`. The extension will follow the same pattern.

No HTTP server, no child process, no IPC layer needed. The extension host process loads `@cline/core` directly.

## Extension Structure

```
apps/vscode-extension/
  package.json            # Extension manifest
  tsconfig.json
  src/
    extension.ts          # activate() / deactivate()
    runtime/
      core-bridge.ts      # ZenuxsCore.create() wrapper, session lifecycle
      event-mapper.ts     # CoreSessionEvent -> webview protocol messages
      config-resolver.ts  # Provider/model resolution from VS Code settings
    webview/
      chat-panel.ts       # WebviewViewProvider for sidebar chat
      diff-provider.ts    # Diff preview for file changes
    commands/
      index.ts            # registerCommand definitions
      chat.ts             # Open chat panel
      explain.ts          # Explain selected code
      fix.ts              # Fix selected code
      test.ts             # Generate tests for selected code
      inline-chat.ts      # Inline chat input
    providers/
      chat-view-provider.ts   # WebviewViewProvider implementation
      inline-completion.ts    # (future) inline completions
    status/
      status-bar.ts       # Status bar item (model, status)
    context/
      editor-context.ts   # Selection, active file, workspace info
```

## Task 1: Extension Scaffold

Create `apps/vscode-extension/` with:
- `package.json` -- extension manifest declaring:
  - `activationEvents`: `onView:zenuxs-chat`, `onCommand:zenuxs.*`
  - `contributes.viewsContainers.activitybar` -- Zenuxs icon
  - `contributes.views` -- chat sidebar panel
  - `contributes.commands` -- `zenuxs.chat`, `zenuxs.explain`, `zenuxs.fix`, `zenuxs.test`, `zenuxs.inlineChat`
  - `contributes.menus` -- editor context menu entries
  - `contributes.configuration` -- settings for provider, model, API key
- `tsconfig.json` -- targeting ES2022, module Node16
- `.vscodeignore` -- exclude source from VSIX

## Task 2: Runtime Bridge (`core-bridge.ts`)

Thin wrapper around `ZenuxsCore` that mirrors `createCliCore()` from `apps/cli/src/session/session.ts`:

```ts
import { ZenuxsCore } from "@cline/core";

export async function createExtensionCore(options: {
  cwd: string;
  workspaceRoot: string;
  logger?: BasicLogger;
}): Promise<ZenuxsCore> {
  return ZenuxsCore.create({
    backendMode: "local",
    capabilities: {
      requestToolApproval: requestApprovalFromWebview,
    },
    cwd: options.cwd,
    workspaceRoot: options.workspaceRoot,
    logger: options.logger,
    clientName: "vscode-extension",
  });
}
```

The bridge is a singleton -- one `ZenuxsCore` instance per VS Code window, created on first use and disposed on deactivation.

## Task 3: Event Mapper (`event-mapper.ts`)

Converts `CoreSessionEvent` (from `packages/core/src/types/events.ts`) into the existing `WebviewOutboundMessage` protocol (from `apps/zenuxs-hub/src/webview-protocol.ts`):

- `chunk` (stream=agent) -> `assistant_delta`
- `agent_event` (content_start/text_delta) -> `assistant_delta` / `reasoning_delta`
- `agent_event` (tool_call/tool_result) -> `tool_event`
- `ended` -> `turn_done`
- `hook` (tool_call/tool_result) -> `tool_event`
- `status` -> `status`

This reuses the exact message types the existing webview already understands.

## Task 4: Chat View Provider (`chat-view-provider.ts`)

Implements `vscode.WebviewViewProvider` to render the chat UI in the sidebar:
- Loads the existing webview assets from `apps/zenuxs-hub/src/webview/` (already built with Vite)
- Communicates via `postMessage` using the existing `WebviewInboundMessage` / `WebviewOutboundMessage` protocol
- Handles `send` messages by calling `core.start()` / `core.send()`
- Streams events back via the event mapper
- Handles `abort`, `approval_response`, `attachSession`, etc.

The webview HTML/JS/CSS is already built and working -- the extension simply serves it inside a VS Code webview.

## Task 5: VS Code Commands (`commands/`)

Register commands that create pre-filled chat messages:
- `zenuxs.chat` -- Open chat panel
- `zenuxs.explain` -- "Explain this code: {selection}"
- `zenuxs.fix` -- "Fix this code: {selection}"
- `zenuxs.test` -- "Generate tests for: {selection}"
- `zenuxs.inlineChat` -- Inline chat widget (future)

Each command grabs editor context via `editor-context.ts` and sends a `send` message to the webview.

## Task 6: Editor Context (`editor-context.ts`)

Captures VS Code-specific context to enrich prompts:
- Active file path and language
- Selected code range
- Workspace root
- Open files
- Terminal state (future)

This context is injected into the `localRuntime.extensionContext` field of `StartSessionInput`, which the runtime already supports.

## Task 7: Status Bar (`status-bar.ts`)

- Shows current model/provider
- Shows session status (idle, running, error)
- Click to switch model/provider

## Task 8: Extension Activation (`extension.ts`)

```ts
export function activate(context: vscode.ExtensionContext) {
  // Register chat view provider
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("zenuxs-chat", chatViewProvider)
  );
  
  // Register commands
  registerCommands(context);
  
  // Register status bar
  registerStatusBar(context);
}

export function deactivate() {
  // Dispose ZenuxsCore instance
  coreBridge?.dispose();
}
```

## Task 9: Build and Package

- Add `apps/vscode-extension` to workspace in root `package.json`
- Add build script: `bun run --cwd apps/vscode-extension build`
- Use `@vscode/vsce` to package the VSIX
- The extension imports `@cline/core` from the workspace (already built by `bun run build:sdk`)

## Task 10: Validation

- Verify CLI still works unchanged (`bun run cli`)
- Verify extension loads in VS Code Extension Development Host
- Verify both CLI and extension can start sessions against the same runtime
- Verify streaming events appear in the chat panel
- Verify tool approval flow works through the webview
- Verify no runtime logic is duplicated

## Key Design Principles

1. **Zero duplication** -- The extension imports `@cline/core` and `@cline/shared`. No planner, builder, tool router, provider, or skill logic is reimplemented.
2. **Same runtime** -- `ZenuxsCore.create({ backendMode: "local" })` is the exact same entry point the CLI uses.
3. **Existing protocol** -- The webview communication uses the same `WebviewInboundMessage` / `WebviewOutboundMessage` types already defined in `webview-protocol.ts`.
4. **Existing webview UI** -- The chat UI is the existing Vite-built webview from `apps/zenuxs-hub/src/webview/`, not a new implementation.
5. **VS Code-only concerns** -- The extension only handles: activity bar, webview hosting, commands, editor context, status bar, keybindings.
