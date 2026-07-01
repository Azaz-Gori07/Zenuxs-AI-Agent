# Zenuxs-Code Performance Roadmap

**Companion documents**: `ZENUXS_OPTIMIZATION_PLAN.md`, `ZENUXS_OPTIMIZATION_DEPENDENCIES.md`
**Purpose**: Phase-by-phase optimization schedule with milestones, validation checkpoints, and benchmark targets.

---

## Roadmap Overview

```
Phase 1: Quick Wins        ──── Wave 1 ──── P0+trivial fixes
    │                                        (OPT-01,02,03,04,08,10)
    ▼
Phase 2: Pipeline Fixes    ──── Wave 2 ──── Message pipeline optimization
    │                                        (OPT-05,11)
    ▼
Phase 3: Architecture      ──── Wave 3 ──── Cross-package + import changes
    │                                        (OPT-06,09,12)
    ▼
Phase 4: Session Caching   ──── Wave 4 ──── Multi-run optimization
                                             (OPT-07)
```

---

## Phase 1: Quick Wins

**Goal**: Eliminate the highest-impact, lowest-risk waste first.
**Duration**: ~2 hours implementation + validation
**Optimizations**: OPT-01, OPT-02, OPT-03, OPT-04, OPT-08, OPT-10

### Tasks

| # | Task | File | Est. Time |
|---|------|------|-----------|
| 1.1 | Move tool alias map to module constant | `agent-runtime.ts` | 10 min |
| 1.2 | Cache `composeSystemPrompt()` result | `agent-runtime.ts` | 10 min |
| 1.3 | Cache tool definition array after init | `agent-runtime.ts` | 15 min |
| 1.4 | Add snapshot cache to reduce `cloneMessages()` | `agent-runtime.ts` | 30 min |
| 1.5 | Parallelize `userInstructionService.start()` with module loading | `main.ts` | 5 min |
| 1.6 | Make `syncToZenuxsRemote()` non-blocking | `session-runtime-orchestrator.ts` | 15 min |
| 1.7 | Build shared + agents packages | build scripts | 10 min |
| 1.8 | Run profiler, validate improvements | CLI | 15 min |

### Milestone Criteria

- [ ] All 6 optimizations compile without errors
- [ ] Existing test suite passes
- [ ] Profiler shows:
  - Startup: `userInstructionService.start` no longer sequential bottleneck
  - Per-iteration: `cloneMessages` call count reduced from 5–15 to 1
  - Per-iteration: `composeSystemPrompt` call count reduced to 0 (cached)
  - Per-iteration: Tool array rebuild eliminated

### Expected Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Startup | 2,335ms | ~2,200ms | ~135ms (-5.8%) |
| Per-iteration overhead | ~19–72ms | ~10–50ms | ~9–22ms |
| Message clones/iteration | 5–15 | 1 | -80–93% |
| Heap garbage/task (est.) | 400MB–1.2GB | ~80MB | -80–93% |

### Validation Checkpoint

```bash
# Run profiler with valid API key
ZENUXS_PROFILE=1 bun ./apps/cli/src/index.ts --provider openai --model gpt-4o -k sk-valid-key --cwd d:\V3\zenuxs-code

# Compare ZENUXS_PROFILE_DATA.json against Phase 1 baseline
# Key metrics to check:
# 1. cloneMessages call count per iteration (should be 1, was 5-15)
# 2. composeSystemPrompt call count (should be 0 after first, was 1/iter)
# 3. userInstructionService.start overlap with loadCliRuntimeModules
```

---

## Phase 2: Pipeline Fixes

**Goal**: Reduce message pipeline overhead — the second-largest per-iteration cost.
**Duration**: ~2.5 hours implementation + validation
**Optimizations**: OPT-05, OPT-11
**Prerequisite**: Phase 1 complete

### Tasks

| # | Task | File | Est. Time |
|---|------|------|-----------|
| 2.1 | Merge `reindex` + `addMissingToolResults` + `transformBlock` into single pass | `message-builder.ts` | 60 min |
| 2.2 | Add unit tests for merged pass (verify identical output) | test file | 30 min |
| 2.3 | Implement lazy system prompt resolution | `main.ts` + `session-runtime-orchestrator.ts` | 30 min |
| 2.4 | Build affected packages | build scripts | 10 min |
| 2.5 | Run profiler, validate message pipeline improvement | CLI | 15 min |

### Milestone Criteria

- [ ] `MessageBuilder.buildForApi()` makes 3 passes instead of 5
- [ ] System prompt is resolved lazily (not during config construction)
- [ ] Message pipeline output is byte-identical to pre-optimization output
- [ ] Profiler shows reduced `MessageBuilder.buildForApi` duration

### Expected Improvements

| Metric | After Phase 1 | After Phase 2 | Improvement |
|--------|---------------|---------------|-------------|
| Per-iteration overhead | ~10–50ms | ~5–30ms | ~5–20ms |
| Message pipeline/turn | ~5–10ms | ~2–5ms | ~3–5ms |
| Startup (config build) | ~2,200ms | ~2,170ms | ~30ms |

### Validation Checkpoint

```bash
# Run a multi-turn task (8+ iterations) and compare:
# 1. MessageBuilder.buildForApi duration per call
# 2. Number of passes (verify 3 instead of 5)
# 3. System prompt resolution timing (should be deferred)
```

---

## Phase 3: Architecture Changes

**Goal**: Reduce cross-package conversion overhead and startup import cost.
**Duration**: ~3 hours implementation + validation
**Optimizations**: OPT-06, OPT-09, OPT-12
**Prerequisite**: Phase 2 complete

### Tasks

| # | Task | File | Est. Time |
|---|------|------|-----------|
| 3.1 | Implement lazy snapshot getter in `emit()` | `agent-runtime.ts` | 45 min |
| 3.2 | Reduce format conversion chain from 6 to 2 | `session-runtime-orchestrator.ts` + `message-builder.ts` | 90 min |
| 3.3 | Test with all extension message builders | integration test | 30 min |
| 3.4 | Convert dynamic imports to static for main path | `main.ts` | 30 min |
| 3.5 | Build affected packages | build scripts | 10 min |
| 3.6 | Run profiler, validate architecture improvements | CLI | 15 min |

### Milestone Criteria

- [ ] Format conversions reduced from 6 to 2 per turn
- [ ] Snapshot is computed lazily in emit (only when accessed)
- [ ] Main path uses static imports (no dynamic `import()` for core modules)
- [ ] All extension message builders produce identical output
- [ ] No regression in subcommand routing

### Expected Improvements

| Metric | After Phase 2 | After Phase 3 | Improvement |
|--------|---------------|---------------|-------------|
| Per-iteration overhead | ~5–30ms | ~3–15ms | ~2–15ms |
| Format conversions/turn | 6 | 2 | -67% |
| Startup (module loading) | ~2,170ms | ~2,120ms | ~50ms |
| Memory (snapshot) | Baseline | -30% snapshot overhead | Lazy computation |

### Validation Checkpoint

```bash
# Verify format conversion output is identical:
# 1. Run task with profiler, capture prepareProviderMessagesForApi output
# 2. Compare against pre-optimization output (byte-identical)
# 3. Verify startup spans: importMain should be shorter
```

---

## Phase 4: Session Caching

**Goal**: Cache reusable objects across runs within the same session.
**Duration**: ~2 hours implementation + validation
**Optimizations**: OPT-07
**Prerequisite**: Phase 3 complete

### Tasks

| # | Task | File | Est. Time |
|---|------|------|-----------|
| 4.1 | Design session cache structure + invalidation strategy | design doc | 30 min |
| 4.2 | Implement model wrapper cache (by provider+model) | `session-runtime-orchestrator.ts` | 30 min |
| 4.3 | Implement hook closure cache (per session) | `session-runtime-orchestrator.ts` | 30 min |
| 4.4 | Implement merged tool array cache | `session-runtime-orchestrator.ts` | 30 min |
| 4.5 | Add cache invalidation tests | test file | 30 min |
| 4.6 | Run profiler, validate multi-run improvement | CLI | 15 min |

### Milestone Criteria

- [ ] Second run in same session is 50–150ms faster than first run
- [ ] Cache invalidation works correctly on:
  - Extension registration change
  - Provider change
  - Model change
- [ ] No memory leaks from cached objects
- [ ] Existing test suite passes

### Expected Improvements

| Metric | After Phase 3 | After Phase 4 | Improvement |
|--------|---------------|---------------|-------------|
| First run | Baseline | Baseline | No change |
| Second run | Same as first | -50–150ms | Cached objects |
| Nth run (same session) | Same as first | -50–150ms | Cached objects |
| Memory overhead | Baseline | +~5MB (cache) | Acceptable tradeoff |

### Validation Checkpoint

```bash
# Run 3 consecutive tasks in the same session:
# 1. First run: baseline timing
# 2. Second run: should show cached spans (shorter)
# 3. Third run: should match second run timing
# Compare orchestrator.buildRuntime duration across runs
```

---

## Summary: Cumulative Improvement Trajectory

### Startup Time

```
Current:     ████████████████████████████████████████████████████ 2,335ms
Phase 1:     ██████████████████████████████████████████████████░░ 2,200ms (-5.8%)
Phase 2:     █████████████████████████████████████████████████░░░ 2,170ms (-7.1%)
Phase 3:     ████████████████████████████████████████████████░░░░ 2,120ms (-9.2%)
Phase 4:     (no startup change — session caching affects multi-run)
```

### Per-Iteration Overhead

```
Current:     ████████████████████████████████████████████████████ ~19–72ms
Phase 1:     ██████████████████████████████░░░░░░░░░░░░░░░░░░░░ ~10–50ms (-30–47%)
Phase 2:     ████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ ~5–30ms  (-58–74%)
Phase 3:     ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ ~3–15ms  (-79–86%)
Phase 4:     (no per-iteration change — session caching affects multi-run)
```

### Engineering Task (8 iterations, estimated)

```
Current:     ████████████████████████████████████████████████████ Baseline
Phase 1:     ██████████████████████████████████░░░░░░░░░░░░░░░░ -40–120ms (5–15%)
Phase 2:     ██████████████████████████████░░░░░░░░░░░░░░░░░░░░ -50–145ms (7–18%)
Phase 3:     ████████████████████████████░░░░░░░░░░░░░░░░░░░░░░ -80–200ms (10–25%)
Phase 4:     ██████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░ -130–350ms (17–43%)
```

### Memory (Heap Garbage per Task)

```
Current:     ████████████████████████████████████████████████████ 400MB–1.2GB (est.)
Phase 1:     ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ ~80MB (-80–93%)
Phase 2:     ██████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ ~70MB (-83–94%)
Phase 3:     █████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ ~60MB (-85–95%)
Phase 4:     █████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ ~60MB (no change)
```

---

## Risk Mitigation

### Global Rollback Strategy

Each phase is independently deployable. If any phase causes regressions:

1. Revert the git commit for that phase
2. Re-run profiler to confirm regression is resolved
3. Investigate root cause before re-attempting

### Monitoring Plan

After each phase:
1. Run profiler with `ZENUXS_PROFILE=1`
2. Compare `ZENUXS_PROFILE_DATA.json` against previous baseline
3. Check for:
   - Increased span durations (regression)
   - Missing spans (broken instrumentation)
   - Memory growth (leak)
   - Unexpected call counts (behavior change)

### Success Criteria (Overall)

| Criterion | Target | Measurement |
|-----------|--------|-------------|
| Startup time | <2,100ms | `cli.runCli` span duration |
| Per-iteration overhead | <15ms | `agentLoop.iteration` span minus `generateAssistantMessage` |
| Message clones/iteration | 1 | `cloneMessages` call count |
| Format conversions/turn | 2 | Conversion span count |
| Heap garbage/task | <100MB | Memory snapshot delta |
| Multi-run cache hit | >50ms saved | `orchestrator.buildRuntime` delta (run 2 vs run 1) |

---

## OpenCode Gap Analysis (Post-Optimization)

After all 4 phases, the expected remaining gap vs OpenCode:

| Metric | Zenuxs (Post-Opt) | OpenCode | Remaining Gap |
|--------|-------------------|----------|---------------|
| Startup | ~2,120ms | ~270ms | 7.9× (was 8.6×) |
| Per-iteration | ~3–15ms | ~2–3ms | 1.5–5× (was 10–24×) |
| Memory | ~320MB RSS | ~250MB RSS | 1.3× (was 1.4×) |
| Message clones | 0–1 | 0 | ~0 (was ∞) |
| Format conversions | 2 | 1 | 2× (was 6×) |

**The remaining startup gap is primarily Bun process init (226ms) + module graph size.** Closing it further would require:
- Bundle splitting / lazy module loading
- Pre-compilation of TypeScript
- Reducing the dependency graph

**The remaining per-iteration gap is primarily the LLM network call.** The non-LLM overhead would be nearly at parity with OpenCode.
