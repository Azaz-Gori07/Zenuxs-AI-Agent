# Zenuxs Runtime Profile

**Generated**: 2026-07-03T07:03:19.068Z
**Total duration**: 902ms
**Peak memory**: 96MB
**Spans recorded**: 72
**Timeline events**: 12
**Tool calls**: 2
**Memory snapshots**: 3


---

## Runtime Timeline

```
     0ms  profiler.enabled
   894ms  ▶ snapshot
   895ms  ◀ snapshot (0.2ms)
   895ms  ▶ emit(run-started)
   895ms  ◀ emit(run-started) (0.0ms)
   895ms  ▶ snapshot
   895ms  ◀ snapshot (0.1ms)
   895ms  ▶ emit(message-added)
   895ms  ◀ emit(message-added) (0.0ms)
   895ms  ▶ agentLoop.iteration
   895ms  ▶ snapshot
   895ms  ◀ snapshot (0.0ms)
   895ms  ▶ emit(turn-started)
   895ms  ◀ emit(turn-started) (0.0ms)
   895ms  ▶ generateAssistantMessage
   895ms  ▶ composeSystemPrompt(call)
   896ms  ▶ composeSystemPrompt
   896ms  ◀ composeSystemPrompt (0.0ms)
   896ms  ◀ composeSystemPrompt(call) (0.1ms)
   896ms  ▶ cloneMessages(generateAssistant)
   896ms  ◀ cloneMessages(generateAssistant) (0.0ms)
   896ms  model.request.dispatch
   896ms  ▶ model.stream.open
   896ms  ◀ model.stream.open (0.1ms)
   896ms  model.stream.opened
   896ms  model.stream.first_event
   896ms  ▶ parseToolArguments
   896ms  ◀ parseToolArguments (0.0ms)
   896ms  ◀ generateAssistantMessage (0.8ms)
   896ms  ▶ snapshot
   896ms  ◀ snapshot (0.0ms)
   896ms  ▶ emit(message-added)
   896ms  ◀ emit(message-added) (0.0ms)
   896ms  ▶ snapshot
   896ms  ◀ snapshot (0.0ms)
   896ms  ▶ emit(assistant-message)
   896ms  ◀ emit(assistant-message) (0.0ms)
   896ms  ▶ executeToolCalls
   897ms  ▶ getTool
   897ms  ◀ getTool (0.0ms)
   897ms  ▶ tool.execute(echo)
   897ms  ▶ snapshot
   897ms  ◀ snapshot (0.0ms)
   897ms  ▶ emit(tool-started)
   897ms  ◀ emit(tool-started) (0.0ms)
   897ms  ▶ snapshot
   897ms  ◀ snapshot (0.0ms)
   897ms  ▶ snapshot
   897ms  ◀ snapshot (0.0ms)
   897ms  ▶ emit(tool-finished)
   897ms  ◀ emit(tool-finished) (0.0ms)
   897ms  ◀ tool.execute(echo) (0.2ms)
   897ms  ◀ executeToolCalls (0.8ms)
   897ms  ▶ snapshot
   897ms  ◀ snapshot (0.0ms)
   897ms  ▶ emit(message-added)
   897ms  ◀ emit(message-added) (0.0ms)
   897ms  ▶ snapshot
   897ms  ◀ snapshot (0.0ms)
   897ms  ▶ emit(turn-finished)
   897ms  ◀ emit(turn-finished) (0.0ms)
   897ms  ◀ agentLoop.iteration (2.3ms)
   897ms  ▶ getTool
   897ms  ◀ getTool (0.0ms)
   897ms  ▶ agentLoop.iteration
   897ms  ▶ snapshot
   897ms  ◀ snapshot (0.0ms)
   897ms  ▶ emit(turn-started)
   897ms  ◀ emit(turn-started) (0.0ms)
   897ms  ▶ generateAssistantMessage
   897ms  ▶ composeSystemPrompt(call)
   897ms  ◀ composeSystemPrompt(call) (0.0ms)
   897ms  ▶ cloneMessages(generateAssistant)
   897ms  ◀ cloneMessages(generateAssistant) (0.0ms)
   897ms  model.request.dispatch
   897ms  ▶ model.stream.open
   898ms  ◀ model.stream.open (0.0ms)
   898ms  model.stream.opened
   898ms  model.stream.first_event
   898ms  ▶ parseToolArguments
   898ms  ◀ parseToolArguments (0.0ms)
   898ms  ◀ generateAssistantMessage (0.2ms)
   898ms  ▶ snapshot
   898ms  ◀ snapshot (0.0ms)
   898ms  ▶ emit(message-added)
   898ms  ◀ emit(message-added) (0.0ms)
   898ms  ▶ snapshot
   898ms  ◀ snapshot (0.0ms)
   898ms  ▶ emit(assistant-message)
   898ms  ◀ emit(assistant-message) (0.0ms)
   898ms  ▶ executeToolCalls
   898ms  ▶ getTool
   898ms  ◀ getTool (0.0ms)
   898ms  ▶ tool.execute(echo)
   898ms  ▶ snapshot
   898ms  ◀ snapshot (0.0ms)
   898ms  ▶ emit(tool-started)
   898ms  ◀ emit(tool-started) (0.0ms)
   898ms  ▶ snapshot
   898ms  ◀ snapshot (0.0ms)
   898ms  ▶ snapshot
   898ms  ◀ snapshot (0.0ms)
   898ms  ▶ emit(tool-finished)
   898ms  ◀ emit(tool-finished) (0.0ms)
   898ms  ◀ tool.execute(echo) (0.1ms)
   898ms  ◀ executeToolCalls (0.1ms)
   898ms  ▶ snapshot
   898ms  ◀ snapshot (0.0ms)
   898ms  ▶ emit(message-added)
   898ms  ◀ emit(message-added) (0.0ms)
   898ms  ▶ snapshot
   898ms  ◀ snapshot (0.0ms)
   898ms  ▶ emit(turn-finished)
   898ms  ◀ emit(turn-finished) (0.0ms)
   898ms  ◀ agentLoop.iteration (0.5ms)
   898ms  ▶ getTool
   898ms  ◀ getTool (0.0ms)
   898ms  ▶ agentLoop.iteration
   898ms  ▶ snapshot
   898ms  ◀ snapshot (0.0ms)
   898ms  ▶ emit(turn-started)
   898ms  ◀ emit(turn-started) (0.0ms)
   898ms  ▶ generateAssistantMessage
   898ms  ▶ composeSystemPrompt(call)
   898ms  ◀ composeSystemPrompt(call) (0.0ms)
   898ms  ▶ cloneMessages(generateAssistant)
   898ms  ◀ cloneMessages(generateAssistant) (0.0ms)
   898ms  model.request.dispatch
   898ms  ▶ model.stream.open
   898ms  ◀ model.stream.open (0.0ms)
   898ms  model.stream.opened
   898ms  model.stream.first_event
   898ms  model.stream.first_text_token
   898ms  ▶ snapshot
   898ms  ◀ snapshot (0.0ms)
   898ms  ▶ emit(assistant-text-delta)
   898ms  ◀ emit(assistant-text-delta) (0.0ms)
   898ms  ◀ generateAssistantMessage (0.1ms)
   898ms  ▶ snapshot
   898ms  ◀ snapshot (0.0ms)
   898ms  ▶ emit(message-added)
   898ms  ◀ emit(message-added) (0.0ms)
   898ms  ▶ snapshot
   898ms  ◀ snapshot (0.0ms)
   898ms  ▶ emit(assistant-message)
   898ms  ◀ emit(assistant-message) (0.0ms)
   898ms  ▶ snapshot
   898ms  ◀ snapshot (0.0ms)
   898ms  ▶ emit(turn-finished)
   898ms  ◀ emit(turn-finished) (0.0ms)
   898ms  ◀ agentLoop.iteration (0.4ms)
   898ms  ▶ snapshot
   898ms  ◀ snapshot (0.0ms)
   898ms  ▶ emit(run-finished)
   898ms  ◀ emit(run-finished) (0.0ms)
   902ms  profiler.finishing
```


---

## Startup Analysis

No startup spans recorded.

---

## Top 20 Slowest Functions (by total time)

| Rank | Function | Category | Calls | Total (ms) | Avg (ms) | Max (ms) | Min (ms) |
|------|----------|----------|-------|------------|----------|----------|----------|
| 1 | agentLoop.iteration | agent | 3 | 3.1 | 1.04 | 2.3 | 0.4 |
| 2 | generateAssistantMessage | llm | 3 | 1.1 | 0.38 | 0.8 | 0.1 |
| 3 | executeToolCalls | tool | 2 | 0.9 | 0.44 | 0.8 | 0.1 |
| 4 | snapshot | message | 24 | 0.6 | 0.03 | 0.2 | 0.0 |
| 5 | tool.execute(echo) | tool | 2 | 0.3 | 0.14 | 0.2 | 0.1 |
| 6 | model.stream.open | llm | 3 | 0.2 | 0.05 | 0.1 | 0.0 |
| 7 | composeSystemPrompt(call) | message | 3 | 0.1 | 0.04 | 0.1 | 0.0 |
| 8 | emit(run-started) | event | 1 | 0.0 | 0.04 | 0.0 | 0.0 |
| 9 | composeSystemPrompt | message | 1 | 0.0 | 0.03 | 0.0 | 0.0 |
| 10 | emit(message-added) | event | 6 | 0.0 | 0.00 | 0.0 | 0.0 |
| 11 | parseToolArguments | tool | 2 | 0.0 | 0.01 | 0.0 | 0.0 |
| 12 | cloneMessages(generateAssistant) | message | 3 | 0.0 | 0.01 | 0.0 | 0.0 |
| 13 | emit(turn-started) | event | 3 | 0.0 | 0.01 | 0.0 | 0.0 |
| 14 | getTool | tool | 4 | 0.0 | 0.00 | 0.0 | 0.0 |
| 15 | emit(turn-finished) | event | 3 | 0.0 | 0.00 | 0.0 | 0.0 |
| 16 | emit(tool-started) | event | 2 | 0.0 | 0.01 | 0.0 | 0.0 |
| 17 | emit(tool-finished) | event | 2 | 0.0 | 0.00 | 0.0 | 0.0 |
| 18 | emit(assistant-message) | event | 3 | 0.0 | 0.00 | 0.0 | 0.0 |
| 19 | emit(run-finished) | event | 1 | 0.0 | 0.00 | 0.0 | 0.0 |
| 20 | emit(assistant-text-delta) | event | 1 | 0.0 | 0.00 | 0.0 | 0.0 |


---

## Top 20 Highest Call Count Functions

| Rank | Function | Category | Calls | Total (ms) | Avg (ms) |
|------|----------|----------|-------|------------|----------|
| 1 | snapshot | message | 24 | 0.6 | 0.03 |
| 2 | emit(message-added) | event | 6 | 0.0 | 0.00 |
| 3 | getTool | tool | 4 | 0.0 | 0.00 |
| 4 | emit(turn-started) | event | 3 | 0.0 | 0.01 |
| 5 | composeSystemPrompt(call) | message | 3 | 0.1 | 0.04 |
| 6 | cloneMessages(generateAssistant) | message | 3 | 0.0 | 0.01 |
| 7 | model.stream.open | llm | 3 | 0.2 | 0.05 |
| 8 | generateAssistantMessage | llm | 3 | 1.1 | 0.38 |
| 9 | emit(assistant-message) | event | 3 | 0.0 | 0.00 |
| 10 | emit(turn-finished) | event | 3 | 0.0 | 0.00 |
| 11 | agentLoop.iteration | agent | 3 | 3.1 | 1.04 |
| 12 | parseToolArguments | tool | 2 | 0.0 | 0.01 |
| 13 | emit(tool-started) | event | 2 | 0.0 | 0.01 |
| 14 | emit(tool-finished) | event | 2 | 0.0 | 0.00 |
| 15 | tool.execute(echo) | tool | 2 | 0.3 | 0.14 |
| 16 | executeToolCalls | tool | 2 | 0.9 | 0.44 |
| 17 | emit(run-started) | event | 1 | 0.0 | 0.04 |
| 18 | composeSystemPrompt | message | 1 | 0.0 | 0.03 |
| 19 | emit(assistant-text-delta) | event | 1 | 0.0 | 0.00 |
| 20 | emit(run-finished) | event | 1 | 0.0 | 0.00 |


---

## LLM Analysis

### LLM Spans

| Phase | Duration | Details |
|-------|----------|---------|
| generateAssistantMessage | 0.8ms | iteration=1, finishReason=tool-calls, contentParts=1 |
| model.stream.open | 0.1ms | iteration=1 |
| generateAssistantMessage | 0.2ms | iteration=2, finishReason=tool-calls, contentParts=1 |
| model.stream.open | 0.0ms | iteration=2 |
| generateAssistantMessage | 0.1ms | iteration=3, finishReason=stop, contentParts=1 |
| model.stream.open | 0.0ms | iteration=3 |

**Total LLM time**: 1ms
**LLM calls**: 6


---

## Tool Call Analysis

### Per-Tool Summary

| Tool | Calls | Total (ms) | Avg (ms) | Max (ms) | Avg Args Size | Avg Result Size | Retries |
|------|-------|------------|----------|----------|---------------|-----------------|---------|
| echo | 2 | 0 | 0.0 | 0 | 17 | 19 | 0 |

### Tool Call Timeline

| # | Tool | Start | Duration | Args Size | Result Size |
|---|------|-------|----------|-----------|-------------|
| 1 | echo | 1336ms | 0ms | 16 | 18 |
| 2 | echo | 1336ms | 0ms | 17 | 19 |


---

## Message Pipeline Analysis

| Function | Calls | Total (ms) | Avg (ms) | Max (ms) |
|----------|-------|------------|----------|----------|
| snapshot | 24 | 0.6 | 0.03 | 0.2 |
| composeSystemPrompt(call) | 3 | 0.1 | 0.04 | 0.1 |
| composeSystemPrompt | 1 | 0.0 | 0.03 | 0.0 |
| cloneMessages(generateAssistant) | 3 | 0.0 | 0.01 | 0.0 |

**Total message pipeline time**: 1ms


---

## Hook & Event Analysis

| Hook/Event | Calls | Total (ms) | Avg (ms) | Max (ms) |
|------------|-------|------------|----------|----------|
| emit(run-started) | 1 | 0.0 | 0.04 | 0.0 |
| emit(message-added) | 6 | 0.0 | 0.00 | 0.0 |
| emit(turn-started) | 3 | 0.0 | 0.01 | 0.0 |
| emit(assistant-message) | 3 | 0.0 | 0.00 | 0.0 |
| emit(tool-started) | 2 | 0.0 | 0.01 | 0.0 |
| emit(tool-finished) | 2 | 0.0 | 0.00 | 0.0 |
| emit(turn-finished) | 3 | 0.0 | 0.00 | 0.0 |
| emit(assistant-text-delta) | 1 | 0.0 | 0.00 | 0.0 |
| emit(run-finished) | 1 | 0.0 | 0.00 | 0.0 |


---

## Memory Analysis

| Time (ms) | RSS (MB) | Heap Used (MB) | Heap Total (MB) | External (MB) |
|-----------|----------|----------------|-----------------|---------------|
| 0 | 94 | 28 | 38 | 5 |
| 894 | 209 | 95 | 136 | 10 |
| 902 | 210 | 96 | 136 | 10 |

**Peak heap usage**: 96MB at 902ms
**Peak RSS**: 210MB


---

## Category Summary

| Category | Spans | Total Time (ms) | % of Total |
|----------|-------|-----------------|------------|
| agent | 3 | 3 | 0.3% |
| llm | 6 | 1 | 0.1% |
| tool | 10 | 1 | 0.1% |
| message | 31 | 1 | 0.1% |
| event | 22 | 0 | 0.0% |
