# Zenuxs Code Native Architecture — Module Reference

## Overview

Six new packages provide a complete native runtime that replaces the vendored `@cline/*` packages. Each package follows Zenuxs Code conventions with flat exports, TypeScript strict mode, and full type safety.

## Package Map

```
@zenuxs/schema       → Foundational types and validation (zod schemas)
@zenuxs/engine       → Core runtime (orchestrator, session, agent, tools, permissions)
@zenuxs/providers    → LLM provider integrations (Anthropic, OpenAI, Google, Bedrock)
@zenuxs/studio       → HTTP/WebSocket API server (Hono)
@zenuxs/lsp          → Language Server Protocol integration
@zenuxs/plugin-sdk   → Plugin SDK for custom tools/extensions
```

## @zenuxs/schema

**Purpose**: Shared types, validation schemas, and wire contracts used across all packages.

### Exports

| Path | Content |
|------|---------|
| `@zenuxs/schema` | Core types (SessionID, MessageID, ToolResult, Message, MessagePart) |
| `@zenuxs/schema/session` | Session, SessionEvent, SessionStatus schemas |
| `@zenuxs/schema/tool` | ToolDefinition, ToolExecutionContext, ToolExecutionResult |
| `@zenuxs/schema/provider` | ProviderAuth, ProviderModel, ProviderConfig, ProviderRoute |
| `@zenuxs/schema/agent` | AgentMode, AgentConfig, AgentEvent, AgentResult, ModeBehavior |
| `@zenuxs/schema/permission` | PermissionRule, PermissionRuleset, PermissionDecision |

### Key Types
- `SessionID` (UUID), `MessageID` (UUID), `ToolCallID` (UUID)
- `SessionEvent` — discriminated union with 12 event types
- `ToolDefinition` — full tool spec with parameters, modes, retry config
- `AgentMode` — `"act" | "plan" | "yolo" | "zen" | "ask" | "debug" | "god"`
- `PermissionRule` — `{ permission, pattern, action: "allow" | "ask" | "deny" }`
- All schemas use `zod` for validation

## @zenuxs/engine

**Purpose**: Complete runtime engine replacing `@cline/core` + `@cline/agents` + parts of `@cline/shared`.

### Exports

| Symbol | File | Description |
|--------|------|-------------|
| `ZenuxsEngine` | `engine.ts` | Main entry point. Creates orchestrator, agent runtime, tool registry, permission evaluator |
| `SessionOrchestrator` | `session/orchestrator.ts` | Session lifecycle: start, send, abort, subscribe |
| `SessionManager` | `session/manager.ts` | CRUD operations for sessions, message tracking, event persistence |
| `InMemoryStore` | `session/manager.ts` | In-memory implementation of SessionStore interface |
| `EventStore` | `store/event-store.ts` | Event sourcing: append, replay, project state from events |
| `AgentRuntime` | `agent/runtime.ts` | 7-mode agent execution, tool filtering, auto-approve logic |
| `createModeBehavior` | `agent/runtime.ts` | Factory for custom mode behaviors |
| `ToolRegistry` | `tool/registry.ts` | Register/unregister tools, filter by mode, execute with permission checks |
| `PermissionEvaluator` | `permission/evaluator.ts` | Rule-based permission evaluation with pattern matching |
| `buildCoreTools` | `tools/index.ts` | Registers 8 core tools (read, write, edit, shell, grep, glob, webfetch, websearch) |
| `EDIT_STRATEGIES` | `tools/edit-strategies.ts` | Array of 9 edit replacer strategies |
| `findBestStrategy` | `tools/edit-strategies.ts` | Auto-select best strategy for a given edit operation |

### Mode Behaviors

| Mode | Can Edit | Can Exec | Needs Approval | Auto-Approve |
|------|----------|----------|----------------|--------------|
| act | ✅ | ✅ | ✅ | read, glob, grep, webfetch |
| plan | ❌ | ❌ | ✅ | read, glob, grep, webfetch, question |
| yolo | ✅ | ✅ | ❌ | all |
| zen | ✅ | ✅ | ❌ | all |
| ask | ❌ | ❌ | ❌ | all (but restricted toolset) |
| debug | ❌ | ✅ | ✅ | read, grep, glob, shell |
| god | ✅ | ✅ | ❌ | all |

### 9 Edit Replacer Strategies

1. **Simple** — exact string match/replace
2. **LineTrimmed** — match ignoring leading/trailing whitespace on each line
3. **BlockAnchor** — anchor matching with Levenshtein similarity (85% threshold)
4. **WhitespaceNormalized** — normalize all whitespace before matching
5. **IndentationFlexible** — match with flexible indentation
6. **EscapeNormalized** — escape sequence tolerant matching
7. **TrimmedBoundary** — match with trimmed boundaries
8. **ContextAware** — context-aware with start/end anchor lines
9. **MultiOccurrence** — handles multiple occurrences (replace all)

## @zenuxs/providers

**Purpose**: LLM provider integrations with unified routing interface.

### Exports

| Symbol | Description |
|--------|-------------|
| `ProviderManager` | Registry for provider handlers, creates routes from config |
| `providerManager` | Default singleton instance |
| `anthropicProvider` | Anthropic API (Messages endpoint) |
| `openaiProvider` | OpenAI API (Chat Completions endpoint) |
| `googleProvider` | Google Gemini API |
| `bedrockProvider` | AWS Bedrock runtime |

### Provider Interface
```ts
interface ProviderHandler {
  readonly id: string
  readonly name: string
  createRoute(config: ProviderConfig, modelId: string): ProviderRoute
}
```

## @zenuxs/studio

**Purpose**: HTTP/WebSocket API server for remote clients.

### Exports

| Symbol | Description |
|--------|-------------|
| `Studio` | Hono-based server with middleware, REST API, and WebSocket support |

### API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/v1/sessions` | List sessions |
| POST | `/api/v1/sessions` | Create session |
| POST | `/api/v1/sessions/:id/send` | Send message to session |
| GET | `/api/v1/tools` | List registered tools |
| GET | `/api/v1/providers` | List providers |
| GET | `/api/v1/config` | Get engine config |

## @zenuxs/lsp

**Purpose**: Language Server Protocol integration for diagnostics and code actions.

### Exports

| Symbol | Description |
|--------|-------------|
| `LSPClient` | Manages a single LSP server process and connection |
| `LSPManager` | Manages multiple LSP clients by language |
| `SUPPORTED_LANGUAGES` | TypeScript, JavaScript, Python, Rust, Go |

### LSP Diagnostics Tool
The `lsp` tool returns diagnostics from language servers for a given file, enabling the agent to detect and fix code issues automatically.

## @zenuxs/plugin-sdk

**Purpose**: Public SDK for plugin authors to create custom tools and extensions.

### Exports

| Symbol | Description |
|--------|-------------|
| `Plugin` | Plugin instance with manifest, tools, hooks |
| `PluginRegistry` | Global registry for managing plugins |
| `createPlugin` | Factory function to create plugins |
| `pluginRegistry` | Default singleton registry |

### Plugin Interface
```ts
interface PluginManifest {
  name: string
  version: string
  description?: string
  author?: string
  hooks?: PluginHook[]
  tools?: PluginToolDefinition[]
}

interface PluginToolDefinition {
  id: string
  description: string
  parameters: ToolDefinition["parameters"]
  execute(args, ctx): Promise<ToolExecutionResult>
}

interface PluginHook {
  name: string
  handler: (context, data) => unknown
}
```

## Integration with Existing CLI

The new packages are designed to coexist with the existing `@cline/*` vendored packages during migration:

```ts
import { ZenuxsEngine, buildCoreTools } from "@zenuxs/engine"
import { providerManager, anthropicProvider, openaiProvider } from "@zenuxs/providers"

// Create engine
const engine = ZenuxsEngine.create({ workspaceRoot: process.cwd() })

// Register core tools (8 tools)
engine.tools.registerAll(buildCoreTools())

// Register providers
providerManager.register(anthropicProvider)
providerManager.register(openaiProvider)

// Create session
const session = await engine.orchestrator.start({
  mode: "act",
  modelId: "claude-sonnet-4-20250514",
  providerId: "anthropic",
  prompt: "Hello",
})

// Send messages
const message = await engine.orchestrator.send({
  sessionId: session.id,
  message: "Read the README",
})
```

## Migration Status

| Package | Status | Replaces |
|---------|--------|----------|
| @zenuxs/schema | ✅ Complete | @cline/shared (types) |
| @zenuxs/engine | ✅ Core complete | @cline/core + @cline/agents |
| @zenuxs/providers | ✅ Structure complete | @cline/llms |
| @zenuxs/studio | ✅ Server framework | New capability |
| @zenuxs/lsp | ✅ Client implementation | New capability |
| @zenuxs/plugin-sdk | ✅ SDK framework | @cline plugin system |