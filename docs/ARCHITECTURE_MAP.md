# Zenuxs-Code Architecture Map

## Monorepo Structure
```
zenuxs-code/
├── packages/
│   ├── core/          # @cline/core - Core runtime, services, providers
│   ├── agents/        # @cline/agents - Agent execution engine
│   ├── llms/          # @cline/llms - LLM provider integrations
│   └── shared/        # @cline/shared - Shared types, utilities, storage
├── apps/
│   ├── cli/           # Zenuxs CLI - Terminal interface
│   ├── vscode-extension/  # VS Code Extension - Graphical interface
│   └── zenuxs-hub/    # Hub daemon server
```

## Shared Runtime Architecture

### @cline/core (Single Source of Truth)
- **ZenuxsCore** - Main runtime class (create, start, send, abort, dispose)
- **ProviderSettingsManager** - Provider config persistence
- **CoreSettingsService** - Rules, skills, workflows, tools, MCP toggles
- **InMemoryMcpManager** - MCP server lifecycle management
- **AgentTeamsRuntime** - Multi-agent team orchestration
- **Session management** - start, send, abort, list, delete, update, readMessages
- **Auth services** - OAuth, device auth, provider auth registry
- **Telemetry** - Event capture and usage tracking
- **Feature flags** - PostHog integration

### CLI Interface (apps/cli)
- **main.ts** - Entry point, command routing, config building
- **session/session.ts** - `createCliCore()` wraps ZenuxsCore.create()
- **runtime/run-agent.ts** - Agent execution with event handling
- **runtime/run-interactive.ts** - Interactive TUI mode
- **commands/** - Subcommand implementations (auth, config, history, etc.)
- **connectors/** - External channel adapters (Slack, Discord, etc.)
- **tui/** - Terminal UI components (Ink/React)
- **utils/** - Provider auth, feature flags, telemetry, helpers

### VS Code Extension Interface (apps/vscode-extension)
- **extension.ts** - Activation entry point
- **runtime/core-bridge.ts** - `ExtensionCoreBridge` wraps ZenuxsCore
- **runtime/backend-bridge.ts** - **LEGACY** HTTP backend bridge (to be removed)
- **runtime/event-mapper.ts** - Maps CoreSessionEvent → Webview messages
- **runtime/config-resolver.ts** - VS Code settings → ExtensionConfig
- **providers/chat-view-provider.ts** - Webview message handler
- **webview/** - React UI (Chat, Settings, History, Teams, Dashboard, Logs)

## Key Integration Points

### What the Extension Already Does Right:
1. Uses `ExtensionCoreBridge` to wrap `ZenuxsCore.create()` ✓
2. Maps core events to webview messages via `event-mapper.ts` ✓
3. Uses `ProviderSettingsManager` for provider config ✓
4. Uses `InMemoryMcpManager` for MCP servers ✓
5. Uses `createCoreSettingsService()` for toggles ✓
6. Uses `listLocalProviders()` for dynamic provider listing ✓

### What Needs to Change:
1. **Remove `ZenuxsBackendBridge`** - Replace all HTTP calls with direct @cline/core calls
2. **Fix `handleSend`** - Match CLI's `runAgent()` flow exactly
3. **Add missing CLI features** - Checkpoints, compaction, thinking, reasoning effort
4. **Add missing commands** - Doctor, MCP wizard, plugin management
5. **Fix provider auth** - Use shared `loginAndSaveLocalProviderOAuthCredentials`
6. **Add conversation sync** - Mirror CLI's `syncSessionConversation`
7. **Add file index prewarming** - Match CLI's `prewarmFileIndex`
8. **Add proper abort handling** - Match CLI's signal handling
9. **Add timeout support** - Match CLI's timeoutSeconds
10. **Add tool approval UI** - Proper approval request/response flow