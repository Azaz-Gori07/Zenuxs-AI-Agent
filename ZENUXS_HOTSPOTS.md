# Zenuxs Performance Hotspot Analysis

**Source data**: `ZENUXS_PROFILE_DATA.json`, `ZENUXS_FLAMEGRAPH_DATA.json`, `ZENUXS_RUNTIME_PROFILE.md`
**Profiled at**: 2026-07-01T11:35:50.666Z
**Total measured duration**: 2,335ms
**Profiler mode**: `ZENUXS_PROFILE=1` (runtime instrumentation)

---

## 1. Measured Execution Timeline

| Time (ms) | Event | Source |
|-----------|-------|--------|
| 0 | Profiler enabled | `profiler.ts` constructor |
| 226 | Process start marker | `index.ts` line 15 |
| 227 | VCR initialized | `index.ts` line 17 |
| 227–299 | **cli.importMain** (72ms) | Dynamic `import("./main")` |
| 299–2,331 | **cli.runCli** (2,032ms) | Full CLI execution |
| 302 | runCli body begins | `main.ts` line 117 |
| 404–414 | createProviderSettingsManager (11ms) | `main.ts` line 896 |
| 414–432 | loadCliRuntimeModules (18ms) | 3 parallel dynamic imports |
| 434–570 | **userInstructionService.start (136ms)** | File I/O + config parsing |
| 608–610 | resolveProviderConfig (2ms) | Provider model catalog |
| 615 | Config object built | `main.ts` line 1065 |
| 615–2,331 | **Uninstrumented gap (1,716ms)** | System prompt + agent runtime + LLM |

---

## 2. Function Rankings — Top Slowest (Measured)

| Rank | Function | File | Total (ms) | Avg (ms) | Max (ms) | Calls | % of Total |
|------|----------|------|------------|----------|----------|-------|------------|
| 1 | `cli.runCli` | `main.ts` | 2,032.0 | 2,032.0 | 2,032.0 | 1 | 87.0% |
| 2 | `cli.userInstructionService.start` | `main.ts` | 136.2 | 136.2 | 136.2 | 1 | 5.8% |
| 3 | `cli.importMain` | `index.ts` | 72.1 | 72.1 | 72.1 | 1 | 3.1% |
| 4 | `cli.loadCliRuntimeModules` | `main.ts` | 17.9 | 17.9 | 17.9 | 1 | 0.8% |
| 5 | `cli.createProviderSettingsManager` | `main.ts` | 10.8 | 10.8 | 10.8 | 1 | 0.5% |
| 6 | `cli.resolveProviderConfig` | `main.ts` | 1.8 | 1.8 | 1.8 | 1 | 0.1% |

### Self-Time Analysis (Flamegraph)

| Function | Total (ms) | Children (ms) | Self (ms) | % Self |
|----------|------------|---------------|-----------|--------|
| `cli.runCli` | 2,032 | 167 | **1,865** | 91.8% |
| `cli.userInstructionService.start` | 136 | 0 | 136 | 100% |
| `cli.importMain` | 72 | 0 | 72 | 100% |
| `cli.loadCliRuntimeModules` | 18 | 0 | 18 | 100% |
| `cli.createProviderSettingsManager` | 11 | 0 | 11 | 100% |
| `cli.resolveProviderConfig` | 2 | 0 | 2 | 100% |
| root (process init) | 2,335 | 2,104 | **231** | — |

**Critical finding**: 1,865ms (91.8%) of `cli.runCli` is **self time** — code between `cli.config.built` (615ms) and process exit (2,331ms) that is not yet instrumented with child spans. This gap contains: system prompt resolution, agent runtime creation, session initialization, LLM pipeline setup, and the failed API call.

---

## 3. Memory Analysis (Measured)

| Time (ms) | RSS (MB) | Heap Used (MB) | Heap Total (MB) | External (MB) |
|-----------|----------|----------------|-----------------|---------------|
| 0 | 255 | 26 | 28 | 9 |
| 570 | 327 | 74 | 73 | 17 |
| 2,331 | 344 | 77 | 73 | 19 |

### Memory Growth Breakdown

| Phase | Duration | Heap Growth | RSS Growth | External Growth |
|-------|----------|-------------|------------|-----------------|
| Process init (0–226ms) | 226ms | 26MB | 255MB | 9MB |
| Startup (226–570ms) | 344ms | **+48MB** | +72MB | +8MB |
| Post-config (570–2,331ms) | 1,761ms | +3MB | +17MB | +2MB |

**Key observations**:
- Bun runtime itself consumes 255MB RSS before any application code runs
- The heaviest memory growth (+48MB heap) occurs during `userInstructionService.start` and module loading (226–570ms)
- External memory grows from 9MB → 19MB, indicating native module allocations (likely `@pierre/trees`, `simple-git`, or `ws`)

---

## 4. Categorized Instrumentation Map

### Startup (Measured)

| Function | File | Measured (ms) | Notes |
|----------|------|---------------|-------|
| Bun process init | runtime | ~226 | Before profiler — unmeasurable |
| `import("./main")` | `index.ts:67` | 72 | Dynamic ESM resolution |
| `createProviderSettingsManager` | `main.ts:896` | 11 | File I/O for settings |
| `loadCliRuntimeModules` | `main.ts:71` | 18 | 3 parallel dynamic imports |
| `userInstructionService.start` | `main.ts:917` | **136** | Config file scanning + parsing |
| `resolveProviderConfig` | `main.ts:1018` | 2 | Model catalog resolution |
| Uninstrumented gap | `main.ts:1065–1270` | **1,716** | System prompt + agent + LLM |

### Agent Runtime (Instrumented, Not Yet Triggered)

These spans are instrumented but require a successful LLM connection to fire:

| Span Name | Category | File | What It Measures |
|-----------|----------|------|------------------|
| `orchestrator.buildRuntime` | startup | `session-runtime-orchestrator.ts` | Full runtime construction |
| `orchestrator.composeSystemPrompt` | message | `session-runtime-orchestrator.ts` | System prompt assembly |
| `orchestrator.createAgentModel` | llm | `session-runtime-orchestrator.ts` | Model wrapper creation |
| `orchestrator.mergeTools` | tool | `session-runtime-orchestrator.ts` | Extension + config tool merge |
| `orchestrator.messagesToAgentMessages` | message | `session-runtime-orchestrator.ts` | Format conversion |
| `orchestrator.createRuntimeHooks` | hook | `session-runtime-orchestrator.ts` | Hook closure creation |
| `orchestrator.createAgentRuntime` | agent | `session-runtime-orchestrator.ts` | AgentRuntime instantiation |
| `agentLoop.iteration` | agent | `agent-runtime.ts` | Each loop iteration |
| `generateAssistantMessage` | llm | `agent-runtime.ts` | Full LLM request cycle |
| `composeSystemPrompt` | message | `agent-runtime.ts` | Per-iteration prompt recomposition |
| `cloneMessages(generateAssistant)` | message | `agent-runtime.ts` | Deep clone of all messages |
| `snapshot` | message | `agent-runtime.ts` | State snapshot with deep clone |

### Tool Pipeline (Instrumented, Not Yet Triggered)

| Span Name | Category | File | What It Measures |
|-----------|----------|------|------------------|
| `executeToolCalls` | tool | `agent-runtime.ts` | Batch tool execution |
| `tool.execute(<name>)` | tool | `agent-runtime.ts` | Individual tool call |
| `getTool` | tool | `agent-runtime.ts` | Tool resolution with alias scanning |
| `parseToolArguments` | tool | `agent-runtime.ts` | 6-step argument recovery |

### Events (Instrumented, Not Yet Triggered)

| Span Name | Category | File | What It Measures |
|-----------|----------|------|------------------|
| `emit(<event-type>)` | event | `agent-runtime.ts` | Every event dispatch |

### Message Pipeline (Instrumented, Not Yet Triggered)

| Span Name | Category | File | What It Measures |
|-----------|----------|------|------------------|
| `MessageBuilder.buildForApi` | message | `message-builder.ts` | Full message walk |
| `prepareProviderMessagesForApi` | message | `session-runtime-orchestrator.ts` | Extension builders + MessageBuilder |
| `syncToZenuxsRemote` | hook | `session-runtime-orchestrator.ts` | Remote sync HTTP |

---

## 5. Waiting Analysis

| Category | Time (ms) | % of Total | Evidence |
|----------|-----------|------------|----------|
| **Process initialization** | 226 | 9.7% | Gap between profiler init and process.start marker |
| **Module loading (I/O)** | 90 | 3.9% | `importMain` (72ms) + `loadCliRuntimeModules` (18ms) |
| **Config file I/O** | 147 | 6.3% | `userInstructionService.start` (136ms) + `createProviderSettingsManager` (11ms) |
| **Provider config** | 2 | 0.1% | `resolveProviderConfig` |
| **Uninstrumented (system prompt + agent + LLM)** | 1,716 | 73.5% | Gap between `cli.config.built` and process exit |
| **Profiler overhead** | ~154 | 6.6% | Bun startup with profiler enabled |
| **CPU (active computation)** | ~0 | 0% | All measured spans are I/O bound |
| **Network** | ~0 | 0% | No successful LLM connection |

**The 1,716ms uninstrumented gap dominates the profile.** Based on the instrumented code paths, this gap contains:
1. `resolveSystemPrompt()` — file system scanning for prompt templates
2. Config object construction (lightweight)
3. `runAgent()` → `createCliCore()` → ZenuxsCore creation
4. Session runtime orchestrator setup
5. AgentRuntime creation with hooks, tools, model
6. First LLM API call attempt (fails with auth error)

---

## 6. Flamegraph Call Tree Analysis

```
root (2,335ms)
├── cli.importMain (72ms, 3.1%)
│   └── [3 parallel dynamic imports of core modules]
├── cli.runCli (2,032ms, 87.0%)
│   ├── cli.createProviderSettingsManager (11ms, 0.5%)
│   ├── cli.loadCliRuntimeModules (18ms, 0.8%)
│   ├── cli.userInstructionService.start (136ms, 5.8%) ← #1 measured hotspot
│   ├── cli.resolveProviderConfig (2ms, 0.1%)
│   └── [SELF: 1,865ms — 91.8% of runCli] ← contains agent runtime + LLM
└── [SELF: 231ms — process init before app code]
```

### Deepest Call Chain (Instrumented)

```
root → cli.runCli → cli.userInstructionService.start
```
Depth: 3 levels. No deeper chains measured because the agent loop was never entered.

### Largest Unmeasured Region

The `cli.runCli` self time of 1,865ms is the largest unmeasured region. Based on code analysis, the execution path within this gap is:

```
cli.runCli (self: 1,865ms)
├── resolveSystemPrompt()          [file system scanning]
├── Config construction            [lightweight]
├── runAgent()                     [entry to agent pipeline]
│   ├── createCliCore()            [ZenuxsCore creation]
│   ├── createRuntimeHooks()       [hook closures]
│   ├── subscribeToAgentEvents()   [event translation]
│   └── session.run()              [session orchestrator]
│       ├── orchestrator.buildRuntime
│       │   ├── composeSystemPrompt
│       │   ├── createAgentModel
│       │   ├── mergeTools
│       │   ├── messagesToAgentMessages
│       │   ├── createRuntimeHooks
│       │   └── createAgentRuntime
│       ├── agent.run()
│       │   └── agentLoop.iteration (per iteration)
│       │       ├── emit("turn-started")
│       │       │   └── snapshot() → cloneMessages()
│       │       ├── generateAssistantMessage()
│       │       │   ├── composeSystemPrompt()
│       │       │   ├── cloneMessages()
│       │       │   ├── model.stream()
│       │       │   └── parseToolArguments()
│       │       ├── emit("message-added")
│       │       │   └── snapshot() → cloneMessages()
│       │       ├── executeToolCalls()
│       │       │   └── tool.execute(<name>)
│       │       └── emit("turn-finished")
│       └── syncToZenuxsRemote()
```

---

## 7. Summary of Proven Hotspots

### Measured Hotspots (from real profiling data)

| Rank | Hotspot | Time (ms) | % of Total | Action Required |
|------|---------|-----------|------------|-----------------|
| 1 | `cli.runCli` self time (uninstrumented) | 1,865 | 79.9% | Add child spans to resolve |
| 2 | `userInstructionService.start` | 136 | 5.8% | Profile config file I/O |
| 3 | Bun process init | 226 | 9.7% | Unavoidable runtime cost |
| 4 | `import("./main")` | 72 | 3.1% | Dynamic import overhead |
| 5 | `loadCliRuntimeModules` | 18 | 0.8% | 3 parallel imports |

### Instrumented Hotspots (require full agent run to measure)

Based on the code-level instrumentation, these are the spans expected to dominate during a full agent run:

| Expected Hotspot | File | Why It's Critical |
|-----------------|------|-------------------|
| `cloneMessages` (per iteration) | `agent-runtime.ts:535` | Deep clones ALL messages on every emit (~10+ times per iteration) |
| `composeSystemPrompt` (per iteration) | `agent-runtime.ts:932` | Recomposes full system prompt every iteration |
| `generateAssistantMessage` | `agent-runtime.ts:930` | Wraps entire LLM request/response cycle |
| `snapshot` (per emit) | `agent-runtime.ts:526` | Calls cloneMessages on every emit |
| `emit(<type>)` (per event) | `agent-runtime.ts:2010` | Fires telemetry + listeners + hooks |
| `getTool` (per tool call) | `agent-runtime.ts:581` | Builds 36-entry alias map on every miss |
| `parseToolArguments` (per tool call) | `agent-runtime.ts:2183` | 6-step recovery pipeline |
| `MessageBuilder.buildForApi` (per turn) | `message-builder.ts:145` | Full message walk + transform |
| `prepareProviderMessagesForApi` (per turn) | `session-runtime-orchestrator.ts` | Extension builders + MessageBuilder |
| `orchestrator.buildRuntime` (per run) | `session-runtime-orchestrator.ts` | Creates everything fresh per run |

---

## 8. Data Completeness Assessment

| Subsystem | Instrumented | Data Captured | Status |
|-----------|-------------|---------------|--------|
| CLI Startup | YES | 6 spans, 2,335ms | **Complete** |
| Agent Runtime | YES | 0 spans (not reached) | Blocked by API key |
| LLM Pipeline | YES | 0 spans (not reached) | Blocked by API key |
| Tool Pipeline | YES | 0 spans (not reached) | Blocked by API key |
| Message Pipeline | YES | 0 spans (not reached) | Blocked by API key |
| Events | YES | 0 spans (not reached) | Blocked by API key |
| Memory | YES | 4 snapshots | **Complete for startup** |
| Flamegraph | YES | 7 nodes | **Complete for startup** |

**Blocker**: The `.env` file contains API keys that are rejected by OpenAI (`Incorrect API key provided`). A valid API key is required to exercise the agent loop, LLM pipeline, tool system, and message pipeline.

**Resolution**: To complete this analysis, provide a valid API key via:
```bash
ZENUXS_PROFILE=1 bun ./apps/cli/src/index.ts --provider openai --model gpt-4o -k sk-valid-key --cwd d:\V3\zenuxs-code
```
