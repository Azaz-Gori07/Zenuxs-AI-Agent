# Phase 2 + 3: Reachability Audit + Call Graph (Compiled)

**Date**: 2026-06-26

---

## Phase 2: Runtime Reachability Matrix

### packages/agents — Reachability

| Component | Lines | Exists | Imported | Instantiated | Executed | Reachable |
|---|---|---|---|---|---|---|
| `agent-runtime.ts` | 1,626 | ✅ | ✅ | ✅ | ✅ | ✅ |
| `index.ts` | 58 | ✅ | ✅ | N/A | N/A | ✅ |
| `mcp/types.ts` | ~30 | ✅ | ✅ (type only) | ❌ | ❌ | **TYPE-ONLY** |
| `agent-graph.ts` | 984 | ✅ | ❌ | ❌ | ❌ | **❌ DEAD** |
| `reasoning/selfCritique.ts` | 153 | ✅ | ❌ | ❌ | ❌ | **❌ DEAD** |
| `subagents/subAgentNode.ts` | 160 | ✅ | ❌ | ❌ | ❌ | **❌ DEAD** |
| `subagents/roles.ts` | 129 | ✅ | ❌ | ❌ | ❌ | **❌ DEAD** |
| `subagents/types.ts` | 15 | ✅ | ❌ | ❌ | ❌ | **❌ DEAD** |
| `mcp/mcpClient.ts` | ~300 | ✅ | ❌ | ❌ | ❌ | **❌ DEAD** |
| `mcp/toolRegistry.ts` | ~150 | ✅ | ❌ | ❌ | ❌ | **❌ DEAD** |
| `mcp/capabilityRegistry.ts` | ~100 | ✅ | ❌ | ❌ | ❌ | **❌ DEAD** |
| `mcp/connectionManager.ts` | ~100 | ✅ | ❌ | ❌ | ❌ | **❌ DEAD** |
| `mcp/discoveryEngine.ts` | ~150 | ✅ | ❌ | ❌ | ❌ | **❌ DEAD** |
| `mcp/healthMonitor.ts` | ~100 | ✅ | ❌ | ❌ | ❌ | **❌ DEAD** |
| `mcp/permissionManager.ts` | ~80 | ✅ | ❌ | ❌ | ❌ | **❌ DEAD** |
| `mcp/sessionManager.ts` | ~80 | ✅ | ❌ | ❌ | ❌ | **❌ DEAD** |
| `mcp/dynamicLoader.ts` | ~100 | ✅ | ❌ | ❌ | ❌ | **❌ DEAD** |
| `mcp/userMcpManager.ts` | ~200 | ✅ | ❌ | ❌ | ❌ | **❌ DEAD** |
| **Total Dead** | **~2,644** | | | | | |

### packages/llms — Reachability

| Component | Reachable | Notes |
|---|---|---|
| `index.ts`, `index.browser.ts` | ✅ | Package entry points |
| `models.ts`, `providers.ts`, `providers.browser.ts` | ✅ | Barrel exports |
| `catalog/catalog.generated.ts` (23K lines) | ✅ | Auto-generated, reachable via access layer |
| `catalog/catalog.generated-access.ts` | ✅ | Imported by models.ts |
| `catalog/catalog-live.ts` | ✅ | Imported by models.ts |
| `catalog/catalog-zenuxs-recommended.ts` | **❌ DEAD** | Only imported by test file |
| `catalog/model-id-aliases.ts` | ✅ | Imported by models.ts, builtins.ts |
| `catalog/types.ts` | ✅ | Re-exports from @cline/shared |
| `providers/types.ts` | ✅ | Re-exports barrel |
| `providers/config.ts`, `handler.ts`, `messages.ts`, `stream.ts` | ✅ | Through types.ts |
| `providers/ids.ts` | ✅ | Through config.ts |
| `providers/compat.ts` | ✅ | Legacy bridge — live (called by createHandler) |
| `providers/factory-registry.ts` | ✅ | Live — custom handler registration |
| `providers/errors.ts` | ✅ | ClineNotSubscribedError thrown in builtins.ts |
| `providers/gateway.ts` | ✅ | Main streaming gateway |
| `providers/registry.ts` | ✅ | Gateway registry |
| `providers/builtins.ts` | ✅ | Built-in provider specs |
| `providers/builtins-runtime.ts` | ✅ | Runtime bridge |
| `providers/ai-sdk.ts` | ✅ | Central AI SDK integration |
| `providers/model-registry.ts` | ✅ | Model registry |
| `providers/format.ts`, `http.ts`, `model-facts.ts` | ✅ | Imported by ai-sdk.ts |
| `providers/async.ts` | ✅ | Imported by gateway.ts |
| `providers/billing.ts` | ✅ | Exported from barrels |
| `providers/provider-keys.ts` | ✅ | Imported by catalog-live.ts |
| `providers/provider-request-capture.ts` | ✅ | Imported by ai-sdk.ts |
| `providers/openai-codex-models.ts` | ✅ | Imported by models.ts, builtins.ts |
| `providers/routing/provider-options.ts` | ✅ | Imported by ai-sdk.ts |
| `providers/routing/provider-options-types.ts` | ✅ | Imported by routing modules |
| `providers/routing/provider-option-rules.ts` | ✅ | Main rule table |
| `providers/routing/anthropic-compatible.ts` | ✅ | Anthropic thinking/cache routing |
| `providers/routing/generic-compatible.ts` | ✅ | OpenAI-compatible thinking |
| `providers/routing/glm-thinking.ts` | ✅ | GLM thinking routing |
| `providers/routing/minimax-thinking.ts` | ✅ | MiniMax routing |
| `providers/routing/reasoning-codecs.ts` | ✅ | OpenRouter reasoning encoding |
| `providers/routing/utils.ts` | ✅ | Shared routing utilities |
| `providers/middleware/split-tool-images.ts` | ✅ | Imported by vendor modules |
| `providers/vendors/types.ts` | ✅ | Imported by ai-sdk.ts |
| `providers/vendors/anthropic.ts` | ✅ | Dynamic import |
| `providers/vendors/bedrock.ts` | ✅ | Dynamic import |
| `providers/vendors/community.ts` | ✅ | Dynamic import (claude-code, codex, opencode, dify, sapaicore) |
| `providers/vendors/google.ts` | ✅ | Dynamic import |
| `providers/vendors/mistral.ts` | ✅ | Dynamic import |
| `providers/vendors/openai.ts` | ✅ | Dynamic import |
| `providers/vendors/openai-compatible.ts` | ✅ | Dynamic import |
| `providers/vendors/vertex.ts` | ✅ | Dynamic import |
| `providers/vendors/codex-cli.ts` | ✅ | Static export from index.ts |
| `providers/vendors/minimax-thinking.ts` | **❌ DEAD** | Zero production imports |

### packages/core — Reachability

| Area | Reachable | Notes |
|---|---|---|
| `ZenuxsCore.ts` | ✅ | Instantiated by CLI and Hub |
| `engine/` (all) | ✅ | Imported by ZenuxsCore.ts |
| `cron/` (all) | ✅ | Conditional on automationOptions (guarded, not dead) |
| `extensions/agents/agent-system.ts` | ✅ | Exported |
| `extensions/config/` (all) | ✅ | Exported |
| `extensions/context/` (all) | ✅ | Exported |
| `extensions/mcp/` (all) | ✅ | Used by runtime-builder.ts |
| `extensions/plugin/` (all) | ✅ | Used by local-runtime-bootstrap.ts |
| `extensions/tools/definitions.ts` | ✅ | 10 tool creators, all used by createBuiltinTools |
| `extensions/tools/enhanced-index.ts` | ✅ | Exported (alternative tool system) |
| `extensions/tools/registry.ts` | ✅ | DoomLoopDetector + ToolRegistry |
| `extensions/tools/presets.ts` | ✅ | 5 presets, all used |
| `extensions/tools/executors/` (all) | ✅ | Used by definitions.ts |
| `extensions/tools/team/` (all) | ✅ | Used by runtime-builder.ts |
| `hooks/` (all) | ✅ | Exported and used |
| `hub/client/` (all) | ✅ | Used by host.ts |
| `hub/daemon/` (all) | ✅ | Standalone entry + used by host.ts |
| `hub/discovery/` (all) | ✅ | Exported |
| `hub/runtime-host/hub-runtime-host.ts` | ✅ | Conditional on hub mode |
| `hub/runtime-host/remote-runtime-host.ts` | ✅ | Conditional on remote mode |
| `hub/server/` (all) | ✅ | Used by daemon entry |
| `remote-config/integration.ts` | ✅ | Exported |
| `runtime/capabilities/` (all) | ✅ | Exported, used by ZenuxsCore |
| `runtime/config/agent-runtime-config-builder.ts` | ✅ | Used by session-runtime-orchestrator |
| `runtime/config/agent-message-codec.ts` | ✅ | Used by session-runtime-orchestrator |
| `runtime/host/host.ts` | ✅ | createRuntimeHost — main fork point |
| `runtime/host/local-runtime-host.ts` | ✅ | Instantiated by host.ts |
| `runtime/host/history.ts` | ✅ | Used by ZenuxsCore |
| `runtime/orchestration/runtime-builder.ts` | ✅ | DefaultRuntimeBuilder — live |
| `runtime/orchestration/session-runtime-orchestrator.ts` | ✅ | SessionRuntime — live, per-session |
| `runtime/safety/loop-detection.ts` | ✅ | LoopDetectionTracker — instantiated per session |
| `runtime/safety/mistake-tracker.ts` | ✅ | MistakeTracker — instantiated per session |
| `runtime/safety/rules.ts` | ✅ | Exported |
| `runtime/tools/subprocess-sandbox.ts` | ✅ | Exported |
| `runtime/tools/tool-approval.ts` | ✅ | Exported |
| `runtime/turn-queue/pending-prompt-service.ts` | ✅ | Used by local-runtime-host |
| `services/` (all 30+ files) | ✅ | All exported or transitively used |
| `session/` (all 15+ files) | ✅ | All exported or transitively used |
| `settings/` (all) | ✅ | Exported |
| `account/` (all) | ✅ | Exported |
| `auth/` (all) | ✅ | Exported |
| `types/` (all) | ✅ | Exported |

**Total dead modules in core: 0**

### packages/shared — Reachability

| Area | Reachable |
|---|---|
| All 49+ source modules | ✅ — every file reachable via `@cline/core` barrel re-export |

**Total dead modules in shared: 0**

### apps/cli — Reachability

| Area | Reachable |
|---|---|
| All source modules | ✅ — single entry point, all modules in import chain |

**Total dead modules in cli: 0**

### apps/zenuxs-hub — Reachability

| Area | Reachable |
|---|---|
| All server modules | ✅ — single Bun.serve entry point |
| Webview React components | ✅ — single Vite SPA entry point |

**Total dead modules in hub: 0 (server), untested webview tree-shaking**

### Complete Dead Code Summary

| Package | Dead Files | Dead Lines | % of Package |
|---|---|---|---|
| `packages/agents` | 15 files | ~2,644 | **~65%** |
| `packages/llms` | 2 files | ~500 | ~2% |
| `packages/core` | 0 | 0 | 0% |
| `packages/shared` | 0 | 0 | 0% |
| `apps/cli` | 0 | 0 | 0% |
| `apps/zenuxs-hub` | 0 | 0 | 0% |
| **Total** | **17 files** | **~3,144 lines** | |

---

## Phase 3: Call Graph — CLI to Tool Execution

### High-Level Chain

```
CLI (index.ts)
  │  [FORK] isHubDaemonProcess?
  ├─ hub daemon → @cline/core/hub/daemon-entry
  └─ CLI mode → runCli() [main.ts]
       │
       │  [FORK] subcommand matched?
       ├─ auth, config, plugin, skill, connect, mcp, doctor, history, hook, schedule, hub, dashboard, update, version, kanban
       └─ DEFAULT FLOW:
            │
            │  [FORK] args.acpMode?
            ├─ runAcpMode() [acp/index.ts]
            │    → AgentSideConnection → AcpAgent → ZenuxsCore.create()
            │
            └─ Normal mode:
                 │
                 │  [FORK] piped stdin?
                 ├─ piped → read stdin
                 │   │  [FORK] isZenMode?
                 │   ├─ runZen() [run-zen.ts] → HubSessionClient → hub
                 │   └─ runAgent() [run-agent.ts]
                 │
                 │  [FORK] interactive mode?
                 ├─ runInteractive() [run-interactive.ts]
                 │    → renderOpenTui() → <Root> → Chat UI
                 │    → runAgent() per prompt
                 │
                 └─ Single prompt:
                      runAgent(prompt) [run-agent.ts]
                       │
                       ▼
                  createCliCore() [session/session.ts]
                       │
                       ▼
                  ZenuxsCore.create(options) [ZenuxsCore.ts:197]
                       │
                       ▼
                  createRuntimeHost(options) [host.ts:136]
                       │  [FORK] backendMode
                       ├─ "remote" → new RemoteRuntimeHost()
                       ├─ "hub"    → new HubRuntimeHost()
                       ├─ "auto"   → try HubRuntimeHost → fallback LocalRuntimeHost
                       └─ default  → new LocalRuntimeHost()
                       │
                       ▼
                  ZenuxsCore.start(input) [ZenuxsCore.ts:274]
                       │
                       ▼
                  LocalRuntimeHost.startSession(input) [local-runtime-host.ts:298]
                       │
                       ▼
                  DefaultRuntimeBuilder.build(input) [runtime-builder.ts:336]
                       │  [FORK] enableTools → createBuiltinToolsList
                       │  [FORK] !disableMcpSettingsTools → loadConfiguredMcpTools
                       │  [FORK] enableSpawnAgent → createConfiguredAgentTools
                       │  [FORK] enableAgentTeams → AgentTeamsRuntime
                       │
                       ▼
                  SessionRuntime.run(prompt) [session-runtime-orchestrator.ts:624]
                       │
                       ▼
                  createAgentRuntimeConfig() [agent-runtime-config-builder.ts:84]
                       │
                       ▼
                  createAgentRuntime(config) → new AgentRuntime(config) [agent-runtime.ts:441]
                       │
                       ▼
                  AgentRuntime.execute(input) [agent-runtime.ts:596]
                       │
                       ▼
                  generateAssistantMessage() [agent-runtime.ts:792]
                       │
                       ▼
                  model.stream(request) [GatewayModelAdapter → gateway.ts]
                       │
                       ▼
                  DefaultGateway.stream(request) [gateway.ts:258]
                       │
                       ▼
                  createAiSdkProvider(kind)(config) [ai-sdk.ts:893]
                       │  [SWITCH on kind]
                       │  "openai" → Dynamic import(./vendors/openai)
                       │  "anthropic" → Dynamic import(./vendors/anthropic)
                       │  "openai-compatible" → Dynamic import(./vendors/openai-compatible)
                       │  "google" → Dynamic import(./vendors/google)
                       │  "vertex" → Dynamic import(./vendors/vertex)
                       │  "bedrock" → Dynamic import(./vendors/bedrock)
                       │  "mistral" → Dynamic import(./vendors/mistral)
                       │  "claude-code" → Dynamic import(./vendors/community)
                       │  "openai-codex" → Dynamic import(./vendors/community)
                       │  "opencode" → Dynamic import(./vendors/community)
                       │  "dify" → Dynamic import(./vendors/community)
                       │  "sapaicore" → Dynamic import(./vendors/community)
                       │
                       ▼
                  streamText() from `ai` package [ai-sdk.ts:940-979]
                       │
                       ▼
                  emitAiSdkEvents() → yields text/reasoning/tool-call events
                       │
                       ▼  (back in AgentRuntime.execute loop)
                  toolCalls = filter tool-call parts from assistant message
                       │
                       ▼
                  executeToolCalls(toolCalls) [agent-runtime.ts:1116]
                       │  [FORK] parallel vs sequential
                       │
                       ▼
                  for each toolCall → prepareToolExecution(toolCall) [agent-runtime.ts:1159]
                       │  - lookup tool in registry
                       │  - check tool policy (enabled, autoApprove)
                       │  - [FORK] autoApprove === false → requestToolApproval()
                       │  - run beforeTool hooks
                       │
                       ▼
                  executePreparedTool(prepared) [agent-runtime.ts:1285]
                       │  [FORK] skipReason → return error
                       │  [FORK] !tool (unknown) → return error
                       │
                       ▼
                  prepared.tool.execute(input, context) [agent-runtime.ts:1309]
                       │  *** THIS IS THE ACTUAL TOOL EXECUTION ***
                       │
                       ▼
                  for (hook of afterTool hooks) [agent-runtime.ts:1343]
                       │
                       ▼
                  emit("tool-finished")

=== LOOP PREVENTION (parallel safety track) ===

                  SessionRuntime subscribe handler [session-runtime-orchestrator.ts:811-813]
                       │
                       ▼  (on tool-started event)
                  LoopDetectionTracker.inspect(toolName, toolInput)
                       │  [FORK] verdict
                       ├─ "soft" → append recovery notice to conversation
                       ├─ "hard" → MistakeTracker.record({ forceAtLimit: true })
                       └─ "ok"   → continue
                       │
                       ▼  (on turn-finished event)
                  MistakeTracker.record(reason) — if all tools failed
                       │  [FORK] at limit?
                       ├─ Yes → append stop message + abort runtime
                       └─ No  → append guidance message
```

### Edge Type Summary

| Type | Count | Examples |
|------|-------|---------|
| **Static** | ~40 | Direct function calls: `createCliCore()`, `new LocalRuntimeHost()`, `new SessionRuntime()` |
| **Dynamic** | ~20 | `await import(...)`, event subscriptions, async streams |
| **Conditional** | ~16 | Fork points: hub daemon, ACP, interactive, zen, yolo, backend mode, tool approval, loop detection |

### Key Fork Points with File:Line

| # | Fork | File:Line | Condition | Path A | Path B |
|---|------|-----------|-----------|--------|--------|
| 1 | Hub daemon | `index.ts:60` | `isHubDaemonProcess()` | `@cline/core/hub/daemon-entry` | `runCli()` |
| 2 | ACP mode | `main.ts:838` | `args.acpMode` | `runAcpMode()` | Normal flow |
| 3 | Input source | `main.ts:1106` | Piped stdin & !interactive | `runZen/runAgent` | Next check |
| 4 | Interactive mode | `main.ts:1138` | `interactive \|\| !prompt` | `runInteractive()` | Single prompt |
| 5 | Zen mode | `main.ts:948` | `mode === "zen"` | `runZen()` | `runAgent()` |
| 6 | Yolo mode | `main.ts:947` | `mode === "yolo"` | Local backend, no teams | Normal |
| 7 | Backend mode | `host.ts:141-247` | Resolved mode string | remote/hub/auto/local | Per case |
| 8 | Hub fallback | `host.ts:194-245` | `auto` + hub connect fails | `createLocalRuntimeHost()` | — |
| 9 | Prompt present | `local-runtime-host.ts:644` | `startInput.prompt?.trim()` | `executeTurn()` | Skip |
| 10 | Run vs Continue | `local-runtime-host.ts:1104` | `session.started` | `agent.continue()` | `agent.run()` |
| 11 | MCP tools | `runtime-builder.ts:453` | `!normalized.disableMcpSettingsTools` | `loadConfiguredMcpTools()` | Skip |
| 12 | Spawn agent | `runtime-builder.ts:495` | `enableSpawnAgent && configs.length > 0` | `createConfiguredAgentTools()` | Skip |
| 13 | Agent teams | `runtime-builder.ts:652` | `normalized.enableAgentTeams` | `ensureTeamRuntime()` | Skip |
| 14 | Tool parallel | `agent-runtime.ts:1124` | `toolExecution === "parallel"` | `Promise.all(...)` | Sequential |
| 15 | Tool approval | `agent-runtime.ts:1217` | `policy.autoApprove === false` | `requestToolApproval()` | Execute |
| 16 | Loop detection | `session-runtime-orch.ts:1189` | `LoopDetectionTracker.inspect()` | Soft recovery / Hard abort | Continue |
| 17 | Mistake limit | `session-runtime-orch.ts:1241` | `MistakeTracker.record()` returns stop | Append stop + abort | Continue |
| 18 | Provider kind | `ai-sdk.ts:829-890` | Switch on kind string | 12 vendor modules | — |

### Tool Execution Path (the final edge)

```
agent-runtime.ts:1309
  prepared.tool.execute(input, context)
  │
  ├─ execute() is defined in tools/definition.ts (makeTool)
  │   → calls the user-provided execute function
  │   → or for static tools: the execute function from definitions.ts
  │
  ├─ For default tools (definitions.ts):
  │   createReadFilesTool()    → executor: file-read.ts
  │   createSearchTool()       → executor: search.ts
  │   createBashTool()         → executor: bash.ts
  │   createWebFetchTool()     → executor: web-fetch.ts
  │   createEditorTool()       → executor: editor.ts
  │   createApplyPatchTool()   → executor: apply-patch.ts
  │   createSkillsTool()       → executor: skills (dynamic)
  │   createAskQuestionTool()  → inline executor
  │   createSubmitAndExitTool() → inline executor
  │
  ├─ For MCP tools:
  │   createMcpTools() → MCP tool.execute() calls MCP server
  │
  ├─ For configured agent tools:
  │   createConfiguredAgentTools() → spawn-agent-tool.ts
  │     → spawns a child ZenuxsCore/manages task lifecycle
  │
  └─ For team tools:
      AgentTeamsRuntime tools (18 team tools)
        → team-tools.ts each with typed executors
```

### Return Paths

```
runCli() exit:
├─ process.exit(exitCode)                    @ index.ts:78
├─ process.exitCode = N; return              @ main.ts (various)
├─ runAcpMode() → await connection.closed    @ acp/index.ts
├─ runInteractive() → until user exits       @ run-interactive.ts
├─ runZen() → process.exit(0)                @ run-zen.ts (fire-and-forget)
└─ runAgent() → process.exitCode = 0 | 1    @ run-agent.ts

AgentRuntime.run() returns AgentRunResult:
  status: "completed" | "aborted" | "failed"
  messages: AgentMessage[]
  usage: AgentUsage
  finishReason: "completed" | "error" | "aborted" | "length"
```

---

## Dead Code Hit List (Actionable)

| # | File | Lines | Reason | Action |
|---|------|-------|--------|--------|
| 1 | `packages/agents/src/agent-graph.ts` | 984 | Zero imports, missing dep @langchain/langgraph | DELETE |
| 2 | `packages/agents/src/reasoning/selfCritique.ts` | 153 | Only imported by dead graph | DELETE |
| 3 | `packages/agents/src/subagents/subAgentNode.ts` | 160 | Only imported by dead graph | DELETE |
| 4 | `packages/agents/src/subagents/roles.ts` | 129 | Only imported by dead graph | DELETE |
| 5 | `packages/agents/src/subagents/types.ts` | 15 | Only imported by dead subagents | DELETE |
| 6 | `packages/agents/src/mcp/mcpClient.ts` | ~300 | Only imported by dead graph | DELETE |
| 7 | `packages/agents/src/mcp/toolRegistry.ts` | ~150 | Only imported by dead graph | DELETE |
| 8 | `packages/agents/src/mcp/capabilityRegistry.ts` | ~100 | Only imported by dead graph | DELETE |
| 9 | `packages/agents/src/mcp/connectionManager.ts` | ~100 | Only imported by dead graph | DELETE |
| 10 | `packages/agents/src/mcp/discoveryEngine.ts` | ~150 | Only imported by dead graph | DELETE |
| 11 | `packages/agents/src/mcp/healthMonitor.ts` | ~100 | Only imported by dead graph | DELETE |
| 12 | `packages/agents/src/mcp/permissionManager.ts` | ~80 | Only imported by dead graph | DELETE |
| 13 | `packages/agents/src/mcp/sessionManager.ts` | ~80 | Only imported by dead graph | DELETE |
| 14 | `packages/agents/src/mcp/dynamicLoader.ts` | ~100 | Only imported by dead graph | DELETE |
| 15 | `packages/agents/src/mcp/userMcpManager.ts` | ~200 | Only imported by dead graph | DELETE |
| 16 | `packages/agents/src/mcp/index.ts` | ~50 | Barrel for dead modules | DELETE |
| 17 | `packages/llms/src/catalog/catalog-zenuxs-recommended.ts` | ~200 | Only imported by test file | DELETE |
| 18 | `packages/llms/src/providers/vendors/minimax-thinking.ts` | ~200 | Zero production imports | DELETE |
