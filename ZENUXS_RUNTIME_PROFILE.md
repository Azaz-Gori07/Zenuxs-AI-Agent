# Zenuxs Runtime Profile

**Generated**: 2026-07-01T12:59:50.019Z
**Total duration**: 1967ms
**Peak memory**: 76MB
**Spans recorded**: 7
**Timeline events**: 6
**Tool calls**: 0
**Memory snapshots**: 4


---

## Runtime Timeline

```
     0ms  profiler.enabled
   230ms  process.start
   230ms  vcr.initialized
   231ms  ▶ cli.runCli
   234ms  cli.runCli.start
   330ms  ▶ cli.createProviderSettingsManager
   330ms  ▶ cli.loadCliRuntimeModules
   341ms  ◀ cli.createProviderSettingsManager (11.1ms)
   377ms  ◀ cli.loadCliRuntimeModules (47.5ms)
   379ms  ▶ cli.userInstructionService.start
   379ms  ◀ cli.userInstructionService.start (0.1ms)
   414ms  ▶ cli.resolveProviderConfig
   417ms  ◀ cli.resolveProviderConfig (2.6ms)
   422ms  cli.config.built
   422ms  ▶ cli.resolveSystemPrompt
   693ms  ◀ cli.resolveSystemPrompt (271.5ms)
   696ms  ▶ cli.runAgent
  1962ms  ◀ cli.runAgent (1265.7ms)
  1964ms  ◀ cli.runCli (1732.9ms)
  1964ms  profiler.finishing
```


---

## Startup Analysis

| Phase | Start | End | Duration |
|-------|-------|-----|----------|
| cli.runCli | 231ms | 1964ms | 1732.9ms |
| cli.createProviderSettingsManager | 330ms | 341ms | 11.1ms |
| cli.loadCliRuntimeModules | 330ms | 377ms | 47.5ms |
| cli.userInstructionService.start | 379ms | 379ms | 0.1ms |
| cli.resolveProviderConfig | 414ms | 417ms | 2.6ms |
| cli.resolveSystemPrompt | 422ms | 693ms | 271.5ms |

**Total startup time**: 1733ms


---

## Top 20 Slowest Functions (by total time)

| Rank | Function | Category | Calls | Total (ms) | Avg (ms) | Max (ms) | Min (ms) |
|------|----------|----------|-------|------------|----------|----------|----------|
| 1 | cli.runCli | startup | 1 | 1732.9 | 1732.92 | 1732.9 | 1732.9 |
| 2 | cli.runAgent | agent | 1 | 1265.7 | 1265.67 | 1265.7 | 1265.7 |
| 3 | cli.resolveSystemPrompt | startup | 1 | 271.5 | 271.53 | 271.5 | 271.5 |
| 4 | cli.loadCliRuntimeModules | startup | 1 | 47.5 | 47.47 | 47.5 | 47.5 |
| 5 | cli.createProviderSettingsManager | startup | 1 | 11.1 | 11.13 | 11.1 | 11.1 |
| 6 | cli.resolveProviderConfig | startup | 1 | 2.6 | 2.57 | 2.6 | 2.6 |
| 7 | cli.userInstructionService.start | startup | 1 | 0.1 | 0.14 | 0.1 | 0.1 |


---

## Top 20 Highest Call Count Functions

| Rank | Function | Category | Calls | Total (ms) | Avg (ms) |
|------|----------|----------|-------|------------|----------|
| 1 | cli.createProviderSettingsManager | startup | 1 | 11.1 | 11.13 |
| 2 | cli.loadCliRuntimeModules | startup | 1 | 47.5 | 47.47 |
| 3 | cli.userInstructionService.start | startup | 1 | 0.1 | 0.14 |
| 4 | cli.resolveProviderConfig | startup | 1 | 2.6 | 2.57 |
| 5 | cli.resolveSystemPrompt | startup | 1 | 271.5 | 271.53 |
| 6 | cli.runAgent | agent | 1 | 1265.7 | 1265.67 |
| 7 | cli.runCli | startup | 1 | 1732.9 | 1732.92 |


---

## LLM Analysis

No LLM spans recorded.

---

## Tool Call Analysis

No tool calls recorded.

---

## Message Pipeline Analysis

No message pipeline spans recorded.

---

## Hook & Event Analysis

No hook/event spans recorded.

---

## Memory Analysis

| Time (ms) | RSS (MB) | Heap Used (MB) | Heap Total (MB) | External (MB) |
|-----------|----------|----------------|-----------------|---------------|
| 0 | 254 | 26 | 29 | 9 |
| 693 | 328 | 75 | 78 | 18 |
| 1962 | 340 | 76 | 73 | 19 |
| 1964 | 340 | 76 | 73 | 19 |

**Peak heap usage**: 76MB at 1962ms
**Peak RSS**: 340MB


---

## Category Summary

| Category | Spans | Total Time (ms) | % of Total |
|----------|-------|-----------------|------------|
| startup | 6 | 2066 | 105.0% |
| agent | 1 | 1266 | 64.4% |
