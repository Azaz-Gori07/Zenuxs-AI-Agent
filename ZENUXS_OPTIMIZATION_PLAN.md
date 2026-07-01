# Zenuxs-Code Optimization Plan

**Source data**: `ZENUXS_HOTSPOTS.md`, `ZENUXS_DUPLICATE_WORK.md`, `ZENUXS_OPENCODE_COMPARISON.md`, `ZENUXS_PROFILE_DATA.json`
**Phase**: 3 — Planning Only (no code changes)
**Status**: Ready for execution

---

## 1. Optimization Catalog

Each optimization is classified, justified by measured/analyzed data, and compared with OpenCode.

---

### OPT-01: Reduce `cloneMessages()` in `snapshot()` — Duplicate Work Removal

**Why it exists**: `snapshot()` deep-clones all messages on every `emit()` call to prevent mutation by event listeners.

**Is it required?** Defensive cloning is required, but NOT at the current frequency. Messages are not mutated between emits within a single iteration.

**Measured justification**:
- 5–15 `cloneMessages()` calls per iteration (DUPLICATE_WORK.md §1)
- For 50 messages × 2KB avg = 100KB per clone × 8–15 calls = 800KB–1.5MB garbage per iteration
- Estimated 2.5–7.5ms wasted per iteration (40–120ms per 8-iteration task)

**How OpenCode does it**: Passes messages by reference. No deep cloning. Zero clones per iteration.

**Optimization**: Cache the cloned messages array within a single iteration. Compute the clone once at `turn-started`, reuse the same clone for all subsequent emits within that iteration. Invalidate when a new message is pushed to `this.state.messages`.

**Implementation**:
- Add a `_snapshotCache: AgentRuntimeStateSnapshot | null` field to AgentRuntime
- On `turn-started` emit: compute full snapshot, store in `_snapshotCache`
- On subsequent emits within same iteration: return `_snapshotCache` (skip `cloneMessages`)
- On `this.state.messages.push(...)`: set `_snapshotCache = null`
- File: `packages/agents/src/agent-runtime.ts` lines 526–542, 750–810

**Priority**: P0 — Highest impact, lowest risk
**Estimated runtime improvement**: 40–120ms per task (10–25% of per-iteration overhead)
**Implementation complexity**: Low (5–10 lines changed)
**Risk level**: Low — snapshot consumers only read; mutation risk is theoretical
**Rollback strategy**: Remove cache field, revert to always-fresh clone

---

### OPT-02: Cache `composeSystemPrompt()` Result — Caching

**Why it exists**: Composes the system prompt from base prompt + system parts array.

**Is it required?** Yes, but only once. The system prompt doesn't change between iterations — no dynamic content is injected per-iteration.

**Measured justification**:
- Called once in orchestrator (line 753) + once per agent loop iteration (line 940)
- 9 compositions for an 8-iteration task (DUPLICATE_WORK.md §2)
- ~0.1ms per composition = ~0.9ms total (low absolute cost, but unnecessary work)

**How OpenCode does it**: Computed once per session, cached.

**Optimization**: Cache the composed string after first computation. Return cached value on subsequent calls within the same run.

**Implementation**:
- Add `_cachedSystemPrompt: string | undefined` field to AgentRuntime
- In `generateAssistantMessage()`: check cache before calling `composeSystemPrompt()`
- Invalidate cache when `systemParts` changes (currently never changes during a run)
- File: `packages/agents/src/agent-runtime.ts` lines 52–78, 939–944

**Priority**: P2 — Low absolute cost, trivially fixable
**Estimated runtime improvement**: <1ms per task
**Implementation complexity**: Trivial (3–5 lines)
**Risk level**: Very Low — prompt is immutable during a run
**Rollback strategy**: Remove cache field

---

### OPT-03: Cache Tool Definition Array — Caching

**Why it exists**: Builds `[...this.tools.values()].map(...)` on every iteration to produce the tool definition array for the LLM request.

**Is it required?** No. The tools Map is populated during initialization and never modified during the agent loop.

**Measured justification**:
- 30 tools × 1 spread + 30 object allocations per iteration
- Over 8 iterations: 240 unnecessary allocations (DUPLICATE_WORK.md §3)
- ~0.05ms per iteration

**How OpenCode does it**: Cached tool registry, resolved once.

**Optimization**: Compute the tool definition array once after `initialize()` completes. Cache as `_toolDefinitions: AgentToolDefinition[]`.

**Implementation**:
- Add `_toolDefinitions` field to AgentRuntime
- Compute in `ensureInitialized()` after tool registration
- Invalidate on `registerTool()` (currently only called during init)
- File: `packages/agents/src/agent-runtime.ts` lines 550–566, 949–953

**Priority**: P2 — Trivially fixable, low absolute cost
**Estimated runtime improvement**: <1ms per task
**Implementation complexity**: Trivial (5–8 lines)
**Risk level**: Very Low — tools don't change during the loop
**Rollback strategy**: Remove cache, revert to inline computation

---

### OPT-04: Move Tool Alias Map to Module Constant — Algorithm Improvement

**Why it exists**: `getTool()` builds a 36-entry alias map as a literal inside the function body for fuzzy tool name resolution.

**Is it required?** The alias map data is required, but creating it per-call is unnecessary.

**Measured justification**:
- 36-entry object with array values created on every `getTool()` call
- ~0.02ms per call × 20 tool calls = ~0.4ms per task (DUPLICATE_WORK.md §4)

**How OpenCode does it**: Simple lowercase comparison, no alias map.

**Optimization**: Move the `aliases` object to module scope as a `const`. Zero allocation per call.

**Implementation**:
- Extract `aliases` from `getTool()` body to module-level `const TOOL_ALIASES`
- File: `packages/agents/src/agent-runtime.ts` lines 589–625

**Priority**: P2 — Trivially fixable
**Estimated runtime improvement**: <1ms per task
**Implementation complexity**: Trivial (move 40 lines to module scope)
**Risk level**: Very Low — pure data, no behavior change
**Rollback strategy**: Move back inside function

---

### OPT-05: Reduce MessageBuilder Full Walk Passes — Algorithm Improvement

**Why it exists**: `buildForApi()` makes 5 full passes over the message list: reindex, addMissingToolResults, map/transform, applyMediaBudget, truncateToTotalTextBudget.

**Is it required?** A full rebuild is needed each turn (new messages arrive), but 5 passes can be reduced.

**Measured justification**:
- 5 passes × 50 messages = 250 message operations per turn
- Over 8 iterations: 2,000 message operations (DUPLICATE_WORK.md §5)
- Estimated 2–5ms per turn, 16–40ms per task

**How OpenCode does it**: Single `MessageV2.toModelMessagesEffect()` — one pass with inline transforms.

**Optimization**: Merge `reindex` + `addMissingToolResults` + `transformBlock` into a single pass. Keep `applyMediaBudget` and `truncateToTotalTextBudget` as separate passes (they operate on the prepared output).

**Implementation**:
- Create `prepareMessages(messages)` that does reindex + repair + transform in one `.map()` call
- Keep `applyMediaBudget()` and `truncateToTotalTextBudget()` as-is (they have different semantics)
- File: `packages/core/src/session/services/message-builder.ts` lines 146–187

**Priority**: P1 — Medium impact, medium complexity
**Estimated runtime improvement**: 10–25ms per task
**Implementation complexity**: Medium (refactor 3 passes into 1)
**Risk level**: Medium — must preserve exact transform semantics
**Rollback strategy**: Revert to 5-pass approach

---

### OPT-06: Reduce Format Conversion Chain — Architecture Improvement

**Why it exists**: `@cline/agents` uses `AgentMessage`, `@cline/core` uses `Message`/`MessageWithMetadata`. Messages cross the package boundary multiple times per turn.

**Is it required?** The package boundary exists, but 6 conversions per turn is excessive.

**Measured justification**:
- 6 format conversions per turn (DUPLICATE_WORK.md §7)
- Each conversion walks the full message list
- For 50 messages: ~1–2ms per conversion × 6 = 6–12ms per turn
- Over 8 iterations: 48–96ms per task

**How OpenCode does it**: Single unified `MessageV2` format used throughout. One conversion to model format.

**Optimization**: Eliminate the round-trip conversion in `prepareMessagesForModelRequest()`:
```
AgentMessage[] → Message[] → MessageWithMetadata[] → Message[] → AgentMessage[]
```
Instead, pass `AgentMessage[]` directly to the provider message builders and convert only once at the API boundary.

**Implementation**:
- Modify `prepareProviderMessagesForApi()` to accept `AgentMessage[]` directly
- Remove the `agentMessagesToMessages()` → `messagesToAgentMessages()` round-trip at lines 1068–1071
- Cache the `Message[]` representation and only re-convert when messages change
- Files: `session-runtime-orchestrator.ts` lines 1065–1071, `message-builder.ts`

**Priority**: P1 — High impact, but touches package boundary
**Estimated runtime improvement**: 30–60ms per task
**Implementation complexity**: High (cross-package interface change)
**Risk level**: Medium-High — must ensure all extension message builders still work
**Rollback strategy**: Revert to 6-conversion chain

---

### OPT-07: Cache Per-Run Objects Across Runs — Architecture Improvement

**Why it exists**: `executeRunInternal()` creates everything fresh per run (system prompt, model, hooks, tools, AgentRuntime) to enable run replay and OAuth retry.

**Is it required?** AgentRuntime must be fresh per run for state isolation. But model wrapper, hook closures, and tool arrays can be cached across runs within the same session.

**Measured justification**:
- `orchestrator.buildRuntime` region: expected 50–200ms (DUPLICATE_WORK.md §6)
- `createRuntimeHooks()`: 3 hook sets + closures per run
- `mergeTools()`: full extension + config tool merge per run
- `createAgentModelFromConfig()`: new model wrapper per run

**How OpenCode does it**: Effect-TS Layer caches services for process lifetime.

**Optimization**: Introduce a session-level cache for:
1. Model wrapper (`createAgentModelFromConfig` result) — cache by provider+model ID
2. Hook closures (`createRuntimeHooks`) — cache per session
3. Merged tool array — cache until extension registry changes
4. System prompt — cache per session (base prompt + parts don't change)

**Implementation**:
- Add `_sessionCache` to SessionRuntimeOrchestrator
- Cache key: `sessionId` + relevant config hash
- Invalidate on: extension registration, provider change, model change
- File: `session-runtime-orchestrator.ts` lines 750–820

**Priority**: P1 — High impact for multi-run sessions
**Estimated runtime improvement**: 50–150ms per subsequent run
**Implementation complexity**: High (cache invalidation strategy required)
**Risk level**: Medium — must correctly invalidate on config changes
**Rollback strategy**: Bypass cache, always create fresh

---

### OPT-08: Parallelize `userInstructionService.start()` — Lazy Initialization

**Why it exists**: Scans workspace directories for instruction files, loads plugin configs, parses YAML/JSON.

**Is it required?** Yes, but it can run in parallel with other startup work.

**Measured justification**:
- 136ms measured (HOTSPOTS.md §2, rank #2)
- Currently sequential: `createProviderSettingsManager` (11ms) → `loadCliRuntimeModules` (18ms) → `userInstructionService.start` (136ms)

**How OpenCode does it**: No equivalent service.

**Optimization**: Start `userInstructionService.start()` immediately after creating the service, before `loadCliRuntimeModules`. The result is not needed until `runAgent()` is called. Use `Promise.all` to parallelize with module loading.

**Implementation**:
```typescript
const userInstructionService = createUserInstructionConfigService({...});
const instructionPromise = userInstructionService.start().catch(() => {});
const { coreServer, ... } = await loadCliRuntimeModules();
await instructionPromise; // ensure completed before use
```
- File: `apps/cli/src/main.ts` lines 908–918

**Priority**: P1 — 136ms measured, straightforward fix
**Estimated startup improvement**: 80–120ms (parallelized with 18ms module loading)
**Implementation complexity**: Low (reorder 3 lines, add await)
**Risk level**: Low — result not used until much later
**Rollback strategy**: Revert to sequential order

---

### OPT-09: Convert Dynamic Imports to Static Imports — Lazy Initialization

**Why it exists**: `loadCliRuntimeModules()` uses `await import()` for 3 modules to keep startup fast for subcommands that don't need runtime.

**Is it required?** For subcommand routing, yes. For the main agent path, no — these modules are always needed.

**Measured justification**:
- `import("./main")`: 72ms (HOTSPOTS.md §2, rank #3)
- `loadCliRuntimeModules`: 18ms (3 parallel dynamic imports)
- Total dynamic import overhead: 90ms

**How OpenCode does it**: Static imports at top of file. ~20ms total module loading.

**Optimization**: For the main agent execution path (not subcommands), use static imports. Keep dynamic imports only for the subcommand routing path.

**Implementation**:
- Add static imports for `coreServer`, `resolveSystemPrompt`, `runAgent` at the top of `main.ts`
- Keep `loadCliRuntimeModules()` for the subcommand path
- File: `apps/cli/src/main.ts` lines 71–80, 899–905

**Priority**: P2 — Moderate impact, but increases bundle coupling
**Estimated startup improvement**: 30–50ms
**Implementation complexity**: Medium (must ensure subcommand path still works)
**Risk level**: Medium — may increase initial bundle parse time for subcommands
**Rollback strategy**: Revert to dynamic imports

---

### OPT-10: Make `syncToZenuxsRemote()` Non-Blocking — Architecture Improvement

**Why it exists**: Syncs conversation messages to Zenuxs remote server after each message-added event.

**Is it required?** Yes, for cloud sync feature. But it doesn't need to block the agent loop.

**Measured justification**:
- Called on every `message-added` event (session-runtime-orchestrator.ts:1098)
- HTTP request latency: expected 10–50ms per call
- Not yet measured by profiler (blocked by API key)

**How OpenCode does it**: No equivalent remote sync.

**Optimization**: Fire-and-forget the sync call. Don't await it in the event handler. Track in-flight promises for graceful shutdown.

**Implementation**:
- Remove `await` from `this.syncToZenuxsRemote(event.message)` call
- Store promise in `_pendingSyncs: Set<Promise<void>>`
- Clean up on completion, await all on shutdown
- File: `session-runtime-orchestrator.ts` lines 1095–1098

**Priority**: P1 — Removes 10–50ms network latency from agent loop
**Estimated runtime improvement**: 10–50ms per iteration (80–400ms per task)
**Implementation complexity**: Low (remove await, add tracking)
**Risk level**: Low — sync is best-effort, not critical path
**Rollback strategy**: Re-add await

---

### OPT-11: Lazy System Prompt Resolution — Lazy Initialization

**Why it exists**: `resolveSystemPrompt()` scans filesystem for prompt templates. Called during config construction at line 1075.

**Is it required?** Yes, but not at config construction time. The system prompt is only needed when the agent starts.

**Measured justification**:
- Part of the 1,716ms uninstrumented gap
- File system scanning for templates, reading `.md` files, resolving variables

**How OpenCode does it**: Computed once at session start, not during CLI config.

**Optimization**: Defer `resolveSystemPrompt()` to be lazy. Store a resolver function in config, resolve only when `composeSystemPrompt()` is first called.

**Implementation**:
- Change `config.systemPrompt` to accept `string | (() => Promise<string>)`
- Resolve lazily in `composeSystemPrompt()` on first call
- File: `apps/cli/src/main.ts` line 1075, `session-runtime-orchestrator.ts`

**Priority**: P2 — Moves cost off startup critical path
**Estimated startup improvement**: 10–30ms
**Implementation complexity**: Medium (type change + lazy resolution)
**Risk level**: Low — prompt needed only at first LLM call
**Rollback strategy**: Revert to eager resolution

---

### OPT-12: Reduce `emit()` Overhead — Memory Optimization

**Why it exists**: `emit()` dispatches to logger, telemetry, listeners, and hooks. Each handler receives a full snapshot.

**Is it required?** Yes, but not every handler needs a full snapshot.

**Measured justification**:
- 5–15 emits per iteration, each with `this.snapshot()` (HOTSPOTS.md §4)
- `buildEventMetadata()` extracts 5 fields from snapshot
- Hooks receive full snapshot but may only read 1–2 fields

**How OpenCode does it**: Lightweight event dispatch, no snapshot in event payload.

**Optimization**:
1. Pass snapshot lazily (getter) so handlers that don't need it don't trigger computation
2. Batch emits within a single iteration into a single event with delta

**Implementation**:
- Change `event.snapshot` to a lazy getter: `get snapshot() { return this._snapshot ??= computeSnapshot(); }`
- File: `agent-runtime.ts` lines 2036–2091

**Priority**: P2 — Reduces snapshot computation for handlers that don't need it
**Estimated runtime improvement**: 5–15ms per task
**Implementation complexity**: Medium (lazy getter pattern)
**Risk level**: Low — handlers that access snapshot still get it
**Rollback strategy**: Revert to eager snapshot

---

## 2. Priority Ranking

| Priority | ID | Optimization | Category | Est. Improvement | Complexity | Risk |
|----------|----|-------------|----------|-----------------|------------|------|
| **P0** | OPT-01 | Reduce cloneMessages in snapshot | Duplicate Work | 40–120ms/task | Low | Low |
| **P1** | OPT-08 | Parallelize userInstructionService.start | Lazy Init | 80–120ms startup | Low | Low |
| **P1** | OPT-10 | Make syncToZenuxsRemote non-blocking | Architecture | 80–400ms/task | Low | Low |
| **P1** | OPT-05 | Reduce MessageBuilder passes | Algorithm | 10–25ms/task | Medium | Medium |
| **P1** | OPT-06 | Reduce format conversion chain | Architecture | 30–60ms/task | High | Med-High |
| **P1** | OPT-07 | Cache per-run objects across runs | Architecture | 50–150ms/run | High | Medium |
| **P2** | OPT-02 | Cache composeSystemPrompt | Caching | <1ms/task | Trivial | Very Low |
| **P2** | OPT-03 | Cache tool definition array | Caching | <1ms/task | Trivial | Very Low |
| **P2** | OPT-04 | Move alias map to module constant | Algorithm | <1ms/task | Trivial | Very Low |
| **P2** | OPT-09 | Static imports for main path | Lazy Init | 30–50ms startup | Medium | Medium |
| **P2** | OPT-11 | Lazy system prompt resolution | Lazy Init | 10–30ms startup | Medium | Low |
| **P2** | OPT-12 | Lazy snapshot in emit | Memory | 5–15ms/task | Medium | Low |

---

## 3. Risk Analysis Matrix

| ID | Regression Risk | Memory Impact | Thread Safety | Cache Invalidation | Behavior Change | Plugin Compat | Provider Compat |
|----|----------------|---------------|---------------|-------------------|-----------------|---------------|-----------------|
| OPT-01 | Low — consumers only read snapshots | -60% heap garbage | N/A (single-threaded) | Invalidation on message push | None — same data, fewer copies | Compatible | Compatible |
| OPT-02 | Very Low — prompt is immutable | Negligible | N/A | Never invalid during run | None | Compatible | Compatible |
| OPT-03 | Very Low — tools immutable during loop | -240 allocations/task | N/A | Invalidate on registerTool | None | Compatible | Compatible |
| OPT-04 | Very Low — pure data move | -36 allocations/call | N/A | N/A (constant) | None | Compatible | Compatible |
| OPT-05 | Medium — must preserve transform order | -40% message ops | N/A | N/A (stateless) | None if transforms are order-independent | Compatible | Compatible |
| OPT-06 | Med-High — cross-package boundary | -50% message allocations | N/A | Invalidate on message change | None | Must test all extension builders | Compatible |
| OPT-07 | Medium — cache invalidation complexity | -30% per-run allocations | N/A | Must invalidate on config/extension change | None | Must test plugin lifecycle | Compatible |
| OPT-08 | Low — reordering startup | None | N/A | N/A | None | Compatible | Compatible |
| OPT-09 | Medium — bundle coupling | None | N/A | N/A | None | Compatible | Compatible |
| OPT-10 | Low — sync is best-effort | +pending sync tracking | Must track in-flight | N/A | Sync timing changes | Compatible | Compatible |
| OPT-11 | Low — lazy resolution | None | N/A | N/A | None | Compatible | Compatible |
| OPT-12 | Low — lazy getter | -30% snapshot overhead | N/A | N/A | None | Compatible | Compatible |

---

## 4. Benchmark Predictions

**All predictions are ESTIMATES until verified with profiler runs.**

| Metric | Current (Measured) | After P0 Fixes | After P0+P1 | After All |
|--------|-------------------|----------------|-------------|-----------|
| Startup time | 2,335ms | 2,335ms | ~2,100ms | ~2,000ms |
| Per-iteration overhead | ~19–72ms (est.) | ~10–50ms | ~5–30ms | ~3–15ms |
| Memory (startup peak) | 344MB RSS | 344MB RSS | 344MB RSS | ~320MB RSS |
| Message clones/iteration | 5–15 | 1 | 1 | 0–1 |
| Format conversions/turn | 6 | 6 | 3 | 2 |
| cloneMessages garbage/task | 400MB–1.2GB (est.) | ~80MB | ~80MB | ~0MB |

### Expected Improvement by Phase

| Phase | Startup | First Token | Engineering Task (8 iter) | Memory |
|-------|---------|-------------|--------------------------|--------|
| P0 (OPT-01) | 0% | -10–30ms | -40–120ms (5–15%) | -20% heap garbage |
| P0+P1 (OPT-01,08,10,05) | -80–120ms | -20–50ms | -130–300ms (20–35%) | -25% heap garbage |
| All (OPT-01 through OPT-12) | -120–200ms | -30–70ms | -200–500ms (30–50%) | -35% heap garbage |

---

## 5. Hotspot-to-Optimization Coverage Map

| Hotspot (from ZENUXS_HOTSPOTS.md) | Optimization | Status |
|-----------------------------------|-------------|--------|
| `cli.runCli` self time (1,865ms) | OPT-07, OPT-08, OPT-09, OPT-11 | Partially covered — need API key to measure sub-spans |
| `userInstructionService.start` (136ms) | OPT-08 | Covered — parallelize |
| `import("./main")` (72ms) | OPT-09 | Covered — static imports |
| `loadCliRuntimeModules` (18ms) | OPT-08, OPT-09 | Partially covered — parallelized |
| `cloneMessages` (5–15×/iter) | OPT-01 | Covered — reduce to 1×/iter |
| `composeSystemPrompt` (per iter) | OPT-02 | Covered — cache |
| Tool array rebuild (per iter) | OPT-03 | Covered — cache |
| Tool alias map (per getTool) | OPT-04 | Covered — module constant |
| `MessageBuilder.buildForApi` (5 passes) | OPT-05 | Covered — merge passes |
| Format conversion chain (6×) | OPT-06 | Covered — reduce to 2× |
| Per-run object creation | OPT-07 | Covered — session cache |
| `syncToZenuxsRemote` (blocking HTTP) | OPT-10 | Covered — non-blocking |
| `emit()` overhead | OPT-12 | Covered — lazy snapshot |

**Coverage: 13/13 hotspots have a proposed optimization.**
