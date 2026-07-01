# Zenuxs Duplicate Work Analysis

**Methodology**: Code-level analysis of instrumented paths to identify operations that execute redundantly. Each finding references exact file, function, and line number.

**Status**: Startup duplicate analysis is backed by measured profiler data. Agent-runtime duplicates are identified via code instrumentation (spans are instrumented but not yet triggered due to API key blocker).

---

## 1. Message Deep Cloning — `cloneMessages()`

### Where It Occurs

| Location | File | Line | Trigger |
|----------|------|------|---------|
| `snapshot()` | `agent-runtime.ts` | 535 | Called on every `emit()` |
| `generateAssistantMessage()` | `agent-runtime.ts` | 936 | Once per iteration |
| `generateAssistantMessage()` (retry) | `agent-runtime.ts` | 948 | If pending user message exists |
| `messagesToAgentMessages()` | `session-runtime-orchestrator.ts` | 789 | Once per run |
| `agentMessagesToMessages()` | `session-runtime-orchestrator.ts` | 1070 | Once per `prepareProviderMessagesForApi` |

### How Many Times Per Iteration

`snapshot()` is called on every `emit()`. Per iteration, the agent emits:
- `turn-started` → `snapshot()` → `cloneMessages()`
- `message-added` → `snapshot()` → `cloneMessages()`
- `assistant-message` → `snapshot()` → `cloneMessages()`
- `message-added` (tool results) → `snapshot()` → `cloneMessages()` per tool
- `turn-finished` → `snapshot()` → `cloneMessages()`

**Minimum**: 5 `cloneMessages()` calls per iteration (no tool calls)
**Typical**: 8–15 `cloneMessages()` calls per iteration (with 2–5 tool calls)

### Why It Repeats

Each `emit()` creates a snapshot of the full runtime state for event subscribers. The snapshot deep-clones all messages to prevent mutation by listeners. This is a defensive copy pattern.

### Is Repetition Necessary

**No.** The messages array is not mutated between emits within a single iteration. A single clone per iteration would suffice. The current pattern clones the entire message history 5–15 times per iteration when only 1 clone is needed.

### Estimated Cost

For a conversation with 50 messages averaging 2KB each (~100KB total):
- Per-iteration cost: 5–15 clones × 100KB = 500KB–1.5MB of garbage per iteration
- For an 8-iteration task: 4,000–12,000 unnecessary clones = 400MB–1.2GB total garbage
- `JSON.parse(JSON.stringify())` on 100KB takes ~0.5ms → 2.5–7.5ms per iteration wasted

---

## 2. System Prompt Recomposition — `composeSystemPrompt()`

### Where It Occurs

| Location | File | Line | Trigger |
|----------|------|------|---------|
| `generateAssistantMessage()` | `agent-runtime.ts` | 932 | Once per iteration |
| `orchestrator.composeSystemPrompt()` | `session-runtime-orchestrator.ts` | 750 | Once per run |

### How Many Times

- **Once per run**: Orchestrator composes the system prompt at `session-runtime-orchestrator.ts:750`
- **Once per iteration**: Agent runtime recomposes it at `agent-runtime.ts:932`

For an 8-iteration task: **9 total compositions** (1 orchestrator + 8 agent loop)

### Why It Repeats

The orchestrator composes a system prompt and passes it to the AgentRuntime config. But the AgentRuntime's `generateAssistantMessage()` calls `composeSystemPrompt()` again on every iteration, re-walking the system parts array and re-joining strings.

### Is Repetition Necessary

**No.** The system prompt doesn't change between iterations (no dynamic content is injected per-iteration). The composed string could be computed once and cached.

### Estimated Cost

Each composition walks `systemParts` (typically 5–15 parts), calls `.trim()` on each, and joins with `\n\n'. For a 10KB system prompt: ~0.1ms per composition. Over 9 compositions: ~0.9ms. Low absolute cost but unnecessary work.

---

## 3. Tool Definition Array Rebuild

### Where It Occurs

| Location | File | Line | Trigger |
|----------|------|------|---------|
| `generateAssistantMessage()` | `agent-runtime.ts` | 937 | Once per iteration |

### How Many Times

Once per iteration. The code does:
```typescript
tools: [...this.tools.values()].map<AgentToolDefinition>((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
}))
```

This spreads the Map into an array and creates new objects for every tool definition on every iteration.

### Why It Repeats

The tool set doesn't change between iterations. The tools Map is populated once during initialization and never modified during the agent loop.

### Is Repetition Necessary

**No.** The tool definition array could be computed once after tool registration and cached.

### Estimated Cost

For 30 tools: 30 object allocations + 1 array spread per iteration. Over 8 iterations: 240 unnecessary object allocations. ~0.05ms per iteration.

---

## 4. Tool Alias Map Rebuild — `getTool()`

### Where It Occurs

| Location | File | Line | Trigger |
|----------|------|------|---------|
| `getTool()` | `agent-runtime.ts` | 588 | Once per tool call |

### How Many Times

Once per tool call. The alias map (36 entries, ~100 lines) is constructed as a literal inside the function body:

```typescript
const aliases: Record<string, string[]> = {
    write_file: ["write", "editor", "write_to_file", "create_file"],
    // ... 36 entries
};
```

### Why It Repeats

The alias map is a constant data structure defined inside the function body. JavaScript creates a new object on every function invocation.

### Is Repetition Necessary

**No.** The alias map should be a module-level constant, created once at module load time.

### Estimated Cost

Creating a 36-entry object with array values: ~0.02ms per call. For 20 tool calls: ~0.4ms. Low absolute cost but trivially fixable.

---

## 5. MessageBuilder Full Walk — `buildForApi()`

### Where It Occurs

| Location | File | Line | Trigger |
|----------|------|------|---------|
| `prepareProviderMessagesForApi()` | `session-runtime-orchestrator.ts` | 1083 | Once per turn (via `beforeModel` hook) |
| `buildForApi()` | `message-builder.ts` | 145 | Called by `prepareProviderMessagesForApi` |

### How Many Times

Once per turn. `buildForApi()` walks the entire message list:
1. `reindex(messages)` — walks entire list
2. `addMissingToolResults(messages)` — walks entire list
3. `.map()` over all messages — transforms each content block
4. `applyMediaBudget()` — walks all prepared messages
5. `truncateToTotalTextBudget()` — walks all prepared messages

**Total**: 5 full passes over the message list per turn.

### Why It Repeats

The message builder is called on every turn (every `beforeModel` hook invocation). It doesn't cache results from the previous turn.

### Is Repetition Necessary

**Partially.** New messages are added each turn, so a full rebuild is needed. However, messages that haven't changed since the last turn could be served from cache.

### Estimated Cost

For 50 messages: 5 passes × 50 messages = 250 message operations per turn. Over 8 iterations: 2,000 message operations. ~2–5ms per turn.

---

## 6. Per-Run Object Creation — `executeRunInternal()`

### Where It Occurs

| Location | File | Line | Created |
|----------|------|------|---------|
| `executeRunInternal()` | `session-runtime-orchestrator.ts` | 750–813 | Everything fresh |
| `createRuntimeHooks()` | `session-runtime-orchestrator.ts` | 933 | 3 hook sets + closures |
| `createAgentRuntimeImpl()` | `session-runtime-orchestrator.ts` | 813 | New AgentRuntime |
| `createAgentModelFromConfig()` | `session-runtime-orchestrator.ts` | 751 | New model wrapper |

### How Many Times

Once per run. Every call to `session.run()` creates:
- A new system prompt (via `composeSystemPrompt()`)
- A new agent model (via `createAgentModelFromConfig()`)
- New runtime hooks (via `createRuntimeHooks()` — 3 hook sets merged)
- A new AgentRuntime instance (via `createAgentRuntimeImpl()`)
- New tool arrays (via merge of extension + config tools)
- New initial messages (via `messagesToAgentMessages()`)

### Why It Repeats

The orchestrator creates a fresh AgentRuntime per run by design (documented in code comments: "A fresh AgentRuntime is instantiated per run"). This enables run replay and OAuth retry.

### Is Repetition Necessary

**Partially.** The AgentRuntime must be fresh per run for state isolation. However, the model wrapper, hook closures, and tool arrays could be cached across runs within the same session.

### Estimated Cost

Based on measured startup data:
- `createProviderSettingsManager`: 11ms (measured)
- `loadCliRuntimeModules`: 18ms (measured)
- `userInstructionService.start`: 136ms (measured)
- The uninstrumented `orchestrator.buildRuntime` region: expected 50–200ms based on code complexity

---

## 7. Format Conversion Chain

### Where It Occurs

| Conversion | From → To | File | Line |
|------------|-----------|------|------|
| 1 | `Message[]` → `AgentMessage[]` | `session-runtime-orchestrator.ts` | 789 |
| 2 | `AgentMessage[]` → `AgentModelRequest.messages` | `agent-runtime.ts` | 936 |
| 3 | `AgentMessage[]` → `Message[]` (clone) | `agent-runtime.ts` | 936 |
| 4 | `Message[]` → `MessageWithMetadata[]` | `session-runtime-orchestrator.ts` | 1068 |
| 5 | `MessageWithMetadata[]` → `Message[]` (via MessageBuilder) | `message-builder.ts` | 145 |
| 6 | `Message[]` → `AgentMessage[]` (back to agent format) | `session-runtime-orchestrator.ts` | 1071 |

### How Many Times

Per turn, messages go through **6 format conversions**:
1. `messagesToAgentMessages()` — ConversationStore → AgentRuntime
2. `cloneMessages()` — AgentRuntime → request
3. `agentMessagesToMessages()` — AgentRuntime → provider format
4. Extension message builders — provider format → provider format
5. `MessageBuilder.buildForApi()` — provider format → API format
6. `messagesToAgentMessages()` — API format → back to AgentRuntime

### Why It Repeats

The two systems (AgentRuntime in `@cline/agents` and SessionOrchestrator in `@cline/core`) use different message formats. Data crosses the package boundary multiple times per turn.

### Is Repetition Necessary

**No.** A shared message format or a single conversion with caching would eliminate 4 of the 6 conversions.

### Estimated Cost

Each conversion walks the full message list. For 50 messages: ~1–2ms per conversion × 6 conversions = 6–12ms per turn.

---

## 8. Summary — Duplicate Work Cost Matrix

| Duplicate Operation | Calls/Iteration | Calls/Task (8 iter) | Est. Cost/Task | Fix Complexity |
|--------------------|-----------------|--------------------| ---------------|----------------|
| `cloneMessages()` via `snapshot()` | 5–15 | 40–120 | **40–120ms** | Medium |
| `composeSystemPrompt()` | 1 | 9 | <1ms | Trivial |
| Tool definition array rebuild | 1 | 8 | <1ms | Trivial |
| Tool alias map rebuild in `getTool()` | 2–5 | 16–40 | <1ms | Trivial |
| `MessageBuilder.buildForApi()` full walk | 1 | 8 | 16–40ms | Medium |
| Per-run object creation | — | 1 | 50–200ms | Complex |
| Format conversion chain (6 passes) | 1 | 8 | 48–96ms | Complex |
| **Total estimated waste** | — | — | **155–458ms** | — |

**Note**: These estimates are based on code analysis and algorithmic complexity. Actual measurements require a valid API key to exercise the full agent loop. The profiler instrumentation is in place to capture exact numbers once the blocker is resolved.
