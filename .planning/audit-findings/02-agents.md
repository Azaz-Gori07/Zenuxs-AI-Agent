# Audit: `packages/agents` (`@cline/agents` v0.0.51)

> **Package path**: `D:\V3\zenuxs-code\packages\agents`
> **Description**: "Browser-safe agent runtime for the next-generation Cline SDK"
> **Dependencies**: `@cline/llms` (workspace:*), `@cline/shared` (workspace:*), `@modelcontextprotocol/sdk`, `@modelcontextprotocol/server-filesystem`, `@modelcontextprotocol/server-github`, `nanoid`

---

## 1. Dead Code Detection

### 1.1 `src/agent-graph.ts` -- **DEAD CODE. 984 lines, unlinked.**

**File**: `D:\V3\zenuxs-code\packages\agents\src\agent-graph.ts`

This file contains a full LangGraph-based agent graph (`buildAgentGraph`, `AgentStateAnnotation`) with 11 graph node functions, complex conditional edge routing, MCP integration, and imports from reasoning/ and subagents/.

**Evidence of death:**
- **Zero imports** of `buildAgentGraph`, `AgentStateAnnotation`, or anything from `./agent-graph` exist **anywhere** in the entire monorepo (confirmed by grep across all *.ts files).
- The file is not re-exported from `src/index.ts` (which only exports from `./agent-runtime`).
- It imports `@langchain/langgraph` which is **not declared** in `package.json` dependencies.
- `agent-graph.ts` is the **sole consumer** of `reasoning/selfCritique.ts`, `subagents/`, and the MCP runtime module imports.

**Recommendation**: Either delete `agent-graph.ts` entirely, or move its graph-building logic into a separate package with proper LangGraph dependency.

---

### 1.2 `src/reasoning/selfCritique.ts` -- **DEAD CODE. 153 lines.**

**File**: `D:\V3\zenuxs-code\packages\agents\src\reasoning\selfCritique.ts`

Contains `runSelfCritique()` -- a self-critique loop with critic/refiner turns.

**Evidence of death:**
- Only import is inside dead `agent-graph.ts` (line 19, 425).
- Not re-exported from `index.ts`.
- The `selfCritique` feature flag on `IntegrationsConfig` is **never read or acted upon**.

---

### 1.3 `src/subagents/` -- **DEAD CODE. 3 files, 304 lines.**

**Files**: `types.ts` (15 lines), `roles.ts` (129 lines), `subAgentNode.ts` (160 lines)

**Evidence of death:**
- Only consumer is dead `agent-graph.ts`.
- Not re-exported from `index.ts`.
- `IntegrationsConfig.subagents` flag is dead config.

---

### 1.4 `src/mcp/` -- **Partially dead. 10 modules, ~1,920 lines.**

**Evidence:**
- `agent-runtime.ts` imports **only** `McpServerConfig` type from `./mcp/types` -- no runtime usage.
- No MCP initialization or tool execution flows occur in the main agent loop.
- The only full consumers were `agent-graph.ts` (dead) and `subAgentNode.ts` (dead).
- `mcpServers` config field exists but is **never consumed** by `agent-runtime.ts`.

**Recommendation**: Either (A) delete unreachable MCP modules keeping only `types.ts`, or (B) wire MCP into `agent-runtime.ts`.

---

## 2. `src/agent-runtime.ts` -- The Live Code (1626 lines)

### 2.1 Core Loop (execute method)

1. `ensureInitialized()` -- plugin setup, tool/hook registration
2. `beforeRun` hooks
3. Loop (maxIterations guard):
   - `prepareTurn` callback
   - `beforeModel` hooks
   - `model.stream(request)` -- streaming response
   - `afterModel` hooks
   - If no tool calls: check completion guard, finish or loop
   - `executeToolCalls()` -- policy checks, approval, execution
   - Check for terminal tool
4. `afterRun` hooks, emit events, return result

### 2.2 Hooks/Events

**Lifecycle hooks**: `beforeRun`, `afterRun`, `beforeModel`, `afterModel`, `beforeTool`, `afterTool`, `onEvent`, `prepareTurn`

**Events emitted**: `run-started`, `turn-started`, `assistant-text-delta`, `assistant-reasoning-delta`, `message-added`, `assistant-message`, `usage-updated`, `tool-started`, `tool-updated`, `tool-finished`, `turn-finished`, `run-finished`, `run-failed`, `status-notice`

### 2.3 Public API

- `run(input)` / `continue(input?)` -- start/continue run
- `abort(reason?)` -- cancel via AbortController
- `subscribe(listener)` -- event listener, returns unsubscribe
- `restore(messages)` -- replace conversation, preserve subscribers
- `snapshot()` -- immutable state

### 2.4 Export Chain

```
index.ts -> agent-runtime.ts (only exports)
  +-- AgentRuntime (class)
  +-- Agent (alias = AgentRuntime)
  +-- createAgentRuntime / createAgent (factories)
  +-- AgentRuntimeAbortError
  +-- Types: AgentRuntimeConfig, AgentEventListener, AgentRunInput, IntegrationsConfig
```

---

## 3. Relationship: agent-runtime.ts vs agent-graph.ts

`agent-graph.ts` **wraps** `agent-runtime.ts` -- it imports `AgentRuntime` and accesses private methods via `@ts-expect-error` and `any` casts.

**The relationship is broken**: agent-graph.ts accesses private API internals (`generateAssistantMessage`, `executeToolCalls`, `finishRun`, `snapshot`, `emit`) that are not part of the public surface. If revived, agent-runtime.ts would need to expose these.

---

## 4. Test Coverage

| File | Lines | Coverage | Status |
| --- | --- | --- | --- |
| `agent-runtime.test.ts` | 1535 | Main loop, tools, hooks, plugins, parallel, approval, errors | Live |
| `agent-runtime.provider-form.test.ts` | 237 | Provider config, Agent alias, abort, restore | Live |
| `integrations.test.ts` | 74 | Sub-agent roles, browser detection | Tests dead code |
| `mcp-layer.test.ts` | 451 | MCP components | Tests dead code |

---

## 5. Stale "Cline" Naming

- Package name: `@cline/agents` (intentional, matches scope)
- `package.json` repository URL: `https://github.com/cline/cline` (stale)
- Source comments reference "clinee", "Cline SDK", "next-generation Cline SDK"
- README heavily references "Cline SDK" and @cline scope

---

## 6. Summary Statistics

| Metric | Value |
| --- | --- |
| Total source lines (agents/src/) | ~3,800+ |
| Dead source lines (unreachable) | ~2,450 (~65%) |
| Live source lines (agent-runtime.ts) | ~1,626 (includes dead config fields) |
| Total test lines | ~2,297 |
| Dead test lines | ~525 |
| Files to potentially delete | ~13 |

---

## 7. Key Recommendations

| # | Severity | Issue | Recommendation |
| --- | --- | --- | --- |
| 1 | HIGH | `agent-graph.ts` (984 lines) dead code, no consumers, missing dep | Delete the file |
| 2 | HIGH | `reasoning/selfCritique.ts` (153 lines) only consumed by dead graph | Delete the file |
| 3 | HIGH | `subagents/` (3 files, 304 lines) only consumed by dead graph | Delete the directory |
| 4 | HIGH | `mcp/` modules (~1,920 lines) runtime logic unreachable | Delete unreachable modules or integrate |
| 5 | MEDIUM | `IntegrationsConfig.subagents` and `selfCritique` dead fields | Remove from interface |
| 6 | MEDIUM | `mcpServers` config field declared but never consumed | Remove or implement |
| 7 | LOW | `integrations.test.ts` + `mcp-layer.test.ts` test dead code | Delete |
| 8 | LOW | Stale GitHub URL `github.com/cline/cline` in package.json | Update to Zenuxs repo |
| 9 | LOW | Unused MCP server packages in deps | Consider removing if MCP deleted |
