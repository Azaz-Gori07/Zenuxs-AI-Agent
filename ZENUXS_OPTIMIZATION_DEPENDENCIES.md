# Zenuxs-Code Optimization Dependencies

**Companion document**: `ZENUXS_OPTIMIZATION_PLAN.md`
**Purpose**: Dependency graph, execution order, and component relationships for all optimizations.

---

## 1. Dependency Graph

```
OPT-04 (alias map → module const)  ←── independent, no dependencies
OPT-02 (cache composeSystemPrompt) ←── independent, no dependencies
OPT-03 (cache tool definition)     ←── independent, no dependencies

OPT-01 (reduce cloneMessages)      ←── independent, no dependencies
    │
    └──▶ OPT-12 (lazy snapshot in emit)
         [OPT-12 depends on OPT-01: lazy snapshot only makes sense
          after clone frequency is reduced]

OPT-08 (parallelize userInstruction) ←── independent, no dependencies

OPT-10 (non-blocking syncToZenuxs) ←── independent, no dependencies

OPT-05 (reduce MessageBuilder passes) ←── independent, no dependencies

OPT-06 (reduce format conversions) ←── depends on OPT-05
    │   [OPT-05 simplifies the inner passes; OPT-06 then
    │    eliminates the outer conversion round-trip]
    │
    └──▶ OPT-07 (cache per-run objects)
         [OPT-07 caches the output of the simplified conversion pipeline;
          must know the final conversion shape first]

OPT-09 (static imports)           ←── independent, no dependencies

OPT-11 (lazy system prompt)       ←── depends on OPT-02
    [OPT-02 caches the composed prompt; OPT-11 defers the resolution;
     caching must be in place before lazy resolution is added]
```

### Visual Dependency Layers

```
Layer 0 (No dependencies — can execute in any order, in parallel):
├── OPT-02  Cache composeSystemPrompt
├── OPT-03  Cache tool definition array
├── OPT-04  Move alias map to module constant
├── OPT-08  Parallelize userInstructionService.start
├── OPT-10  Make syncToZenuxsRemote non-blocking
└── OPT-09  Static imports for main path

Layer 1 (Depends on Layer 0):
├── OPT-01  Reduce cloneMessages in snapshot
├── OPT-05  Reduce MessageBuilder passes
└── OPT-11  Lazy system prompt resolution  [depends on OPT-02]

Layer 2 (Depends on Layer 1):
├── OPT-12  Lazy snapshot in emit          [depends on OPT-01]
└── OPT-06  Reduce format conversion chain [depends on OPT-05]

Layer 3 (Depends on Layer 2):
└── OPT-07  Cache per-run objects          [depends on OPT-06]
```

---

## 2. Execution Order

### Wave 1 — Trivial Fixes (Parallel, No Dependencies)

These optimizations are independent, low-risk, and can be implemented simultaneously.

| Order | ID | Optimization | File | Lines Changed | Est. Time |
|-------|----|-------------|------|---------------|-----------|
| 1a | OPT-02 | Cache composeSystemPrompt | `agent-runtime.ts` | 3–5 | 10 min |
| 1b | OPT-03 | Cache tool definition array | `agent-runtime.ts` | 5–8 | 15 min |
| 1c | OPT-04 | Move alias map to module constant | `agent-runtime.ts` | ~40 (move) | 10 min |
| 1d | OPT-08 | Parallelize userInstructionService | `main.ts` | 3 | 5 min |
| 1e | OPT-10 | Non-blocking syncToZenuxsRemote | `session-runtime-orchestrator.ts` | 5–10 | 15 min |

**Validation checkpoint**: Run profiler after Wave 1. Expected: startup -80–120ms, per-iteration -1–2ms.

### Wave 2 — Core Per-Iteration Fixes (Sequential)

These touch the agent loop's hot path and must be done carefully.

| Order | ID | Optimization | File | Lines Changed | Est. Time |
|-------|----|-------------|------|---------------|-----------|
| 2a | OPT-01 | Reduce cloneMessages in snapshot | `agent-runtime.ts` | 5–10 | 30 min |
| 2b | OPT-05 | Reduce MessageBuilder passes | `message-builder.ts` | 30–50 | 60 min |
| 2c | OPT-11 | Lazy system prompt resolution | `main.ts` + `session-runtime-orchestrator.ts` | 10–15 | 30 min |

**Validation checkpoint**: Run profiler after Wave 2. Expected: per-iteration overhead -10–30ms.

### Wave 3 — Architecture Changes (Sequential, Higher Risk)

These touch cross-package boundaries and require careful testing.

| Order | ID | Optimization | File | Lines Changed | Est. Time |
|-------|----|-------------|------|---------------|-----------|
| 3a | OPT-12 | Lazy snapshot in emit | `agent-runtime.ts` | 15–20 | 45 min |
| 3b | OPT-06 | Reduce format conversion chain | `session-runtime-orchestrator.ts` + `message-builder.ts` | 40–60 | 90 min |
| 3c | OPT-09 | Static imports for main path | `main.ts` | 10–20 | 30 min |

**Validation checkpoint**: Run profiler after Wave 3. Expected: startup -30–50ms, per-iteration -5–15ms.

### Wave 4 — Session-Level Caching (Sequential, Highest Complexity)

| Order | ID | Optimization | File | Lines Changed | Est. Time |
|-------|----|-------------|------|---------------|-----------|
| 4a | OPT-07 | Cache per-run objects across runs | `session-runtime-orchestrator.ts` | 50–80 | 120 min |

**Validation checkpoint**: Run profiler after Wave 4. Expected: subsequent runs -50–150ms.

---

## 3. Component Relationships

### Package Dependency Map

```
apps/cli (main.ts, index.ts)
    │
    ├── OPT-08 (parallelize userInstruction)
    ├── OPT-09 (static imports)
    └── OPT-11 (lazy system prompt)
    │
    ▼
@cline/core (session-runtime-orchestrator.ts, message-builder.ts)
    │
    ├── OPT-05 (MessageBuilder pass reduction)
    ├── OPT-06 (format conversion reduction)
    ├── OPT-07 (per-run object caching)
    └── OPT-10 (non-blocking sync)
    │
    ▼
@cline/agents (agent-runtime.ts)
    │
    ├── OPT-01 (reduce cloneMessages)
    ├── OPT-02 (cache composeSystemPrompt)
    ├── OPT-03 (cache tool definitions)
    ├── OPT-04 (alias map → module const)
    └── OPT-12 (lazy snapshot in emit)
    │
    ▼
@cline/shared (profiler, types)
    │
    └── No changes required
```

### Cross-Optimization Interaction Matrix

| | OPT-01 | OPT-02 | OPT-03 | OPT-04 | OPT-05 | OPT-06 | OPT-07 | OPT-08 | OPT-09 | OPT-10 | OPT-11 | OPT-12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **OPT-01** | — | | | | | | | | | | | |
| **OPT-02** | | — | | | | | | | | | Dep | |
| **OPT-03** | | | — | | | | | | | | | |
| **OPT-04** | | | | — | | | | | | | | |
| **OPT-05** | | | | | — | Dep | | | | | | |
| **OPT-06** | | | | | | — | Dep | | | | | |
| **OPT-07** | | | | | | | — | | | | | |
| **OPT-08** | | | | | | | | — | | | | |
| **OPT-09** | | | | | | | | | — | | | |
| **OPT-10** | | | | | | | | | | — | | |
| **OPT-11** | | | | | | | | | | | — | |
| **OPT-12** | Dep | | | | | | | | | | | — |

**Dep** = Column depends on row. Empty = independent.

---

## 4. Conflict Analysis

### No Conflicts Detected

None of the 12 optimizations modify the same code region in conflicting ways:

| Optimization | Code Region | Overlap with Others |
|-------------|-------------|-------------------|
| OPT-01 | `snapshot()` method (lines 526–542) | None — only OPT-12 touches emit/snapshot |
| OPT-02 | `composeSystemPrompt()` free function (lines 52–78) | None |
| OPT-03 | `ensureInitialized()` (lines 550–566) | None |
| OPT-04 | `getTool()` alias map (lines 589–625) | None |
| OPT-05 | `buildForApi()` (lines 146–187) | OPT-06 touches caller, not callee |
| OPT-06 | `prepareMessagesForModelRequest()` (lines 1065–1071) | OPT-05 touches callee, not caller |
| OPT-07 | `executeRunInternal()` (lines 750–820) | None |
| OPT-08 | `runCli()` startup (lines 908–918) | None |
| OPT-09 | `runCli()` imports (lines 71–80) | None |
| OPT-10 | `handleRuntimeEvent()` (lines 1089–1098) | None |
| OPT-11 | Config construction (line 1075) | None |
| OPT-12 | `emit()` method (lines 2036–2091) | OPT-01 touches snapshot, not emit |

### Near-Miss: OPT-01 + OPT-12

Both touch the snapshot/emit path, but:
- OPT-01 modifies `snapshot()` to cache the cloned messages
- OPT-12 modifies `emit()` to pass snapshot lazily
- They compose cleanly: OPT-01 reduces clone frequency, OPT-12 defers snapshot computation

### Near-Miss: OPT-05 + OPT-06

Both touch the message pipeline, but:
- OPT-05 modifies `MessageBuilder.buildForApi()` internals (callee)
- OPT-06 modifies `prepareMessagesForModelRequest()` (caller)
- They compose cleanly: OPT-05 simplifies inner passes, OPT-06 eliminates outer round-trip

---

## 5. Rollback Dependencies

If an optimization must be rolled back:

| Rollback | Must Also Rollback | Reason |
|----------|-------------------|--------|
| OPT-01 | OPT-12 | OPT-12's lazy snapshot assumes OPT-01's caching |
| OPT-02 | OPT-11 | OPT-11's lazy resolution feeds into OPT-02's cache |
| OPT-05 | OPT-06 | OPT-06 assumes OPT-05's simplified passes |
| OPT-06 | OPT-07 | OPT-07 caches the output of OPT-06's pipeline |
| Any Layer 0 opt | Nothing | Independent, safe to rollback alone |

---

## 6. Testing Strategy per Wave

### Wave 1 Testing
- Unit tests: No new tests needed (behavior unchanged)
- Profiler validation: `ZENUXS_PROFILE=1` run, compare startup spans
- Regression: Run existing test suite, verify no failures

### Wave 2 Testing
- Unit tests: Add snapshot cache test (verify single clone per iteration)
- Integration tests: Run a multi-turn conversation, verify message integrity
- Profiler validation: Compare per-iteration span durations

### Wave 3 Testing
- Unit tests: Verify format conversion produces identical output
- Integration tests: Test with extension message builders
- Profiler validation: Compare message pipeline span durations

### Wave 4 Testing
- Unit tests: Verify cache invalidation on config change
- Integration tests: Run multiple sessions, verify isolation
- Profiler validation: Compare first-run vs second-run startup times
