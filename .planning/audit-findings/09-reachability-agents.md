# Reachability Audit: `packages/agents`

## Entry Points Reaching `@cline/agents`
1. `apps/cli/src/index.ts` → dynamic `@cline/core/hub/daemon-entry` → `packages/core/src/hub/daemon/entry.ts` → `AgentRuntimeAbortError` from `@cline/agents` (static import)
2. `apps/zenuxs-hub/src/server.ts` → `@cline/core` → `packages/core/src/index.ts` line 745: `export { Agent, createAgentRuntime } from "@cline/agents"`
3. `packages/core/src/runtime/orchestration/session-runtime-orchestrator.ts` → `createAgentRuntime` (runtime) + `AgentRuntime` (type) from `@cline/agents`

## Files

### `agent-runtime.ts` — REACHABLE
- Exported via `packages/agents/src/index.ts` as `Agent`, `AgentRuntime`, `createAgent`, `createAgentRuntime`
- Consumed by `packages/core/src/hub/daemon/entry.ts:1` (`AgentRuntimeAbortError`)
- Consumed by `packages/core/src/runtime/orchestration/session-runtime-orchestrator.ts:23` (`createAgentRuntime`)
- Consumed by `packages/core/src/index.ts:745` (re-export)

### `agent-graph.ts` — UNREACHABLE
- 984 lines, imports `@langchain/langgraph` (heavy external dep)
- Only 1 grep match in entire monorepo: `agent-graph.ts:93` (`export function buildAgentGraph`)
- No entry point or reachable code imports `buildAgentGraph` or any symbol from this file
- **DEAD CODE**

### `reasoning/selfCritique.ts` — UNREACHABLE (transitively)
- Only imported by `agent-graph.ts:19` (`import { runSelfCritique } from "./reasoning/selfCritique"`)
- Since `agent-graph.ts` is dead, `selfCritique.ts` is dead
- **DEAD CODE**

### `subagents/` — UNREACHABLE (transitively)
- `subAgentNode.ts` — only imported by `agent-graph.ts:16`
- `roles.ts` — only imported by `agent-graph.ts:17`
- `types.ts` — type import only, used by subAgentNode.ts, roles.ts, selfCritique.ts
- All three are transitively dead via `agent-graph.ts`
- **DEAD CODE**

### `mcp/` — UNREACHABLE at runtime

| File | Reachability | Reason |
|------|-------------|--------|
| `mcp/types.ts` | TYPE-ONLY (dead at runtime) | Agent-runtime.ts:33 `import type { McpServerConfig } from "./mcp/types"` — type-level only, no runtime execution |
| `mcp/index.ts` | NO | Barrel re-export; only consumers are agent-graph.ts and test files |
| `mcp/mcpClient.ts` | NO | Only used by agent-graph.ts and mcp-layer.test.ts |
| `mcp/toolRegistry.ts` | NO | Only used by agent-graph.ts, subAgentNode.ts, and toolRegistry.ts itself |
| `mcp/capabilityRegistry.ts` | NO | Only used by agent-graph.ts |
| `mcp/connectionManager.ts` | NO | Only used by agent-graph.ts |
| `mcp/discoveryEngine.ts` | NO | Only used by agent-graph.ts |
| `mcp/healthMonitor.ts` | NO | Only used by agent-graph.ts |
| `mcp/permissionManager.ts` | NO | Only used by agent-graph.ts |
| `mcp/sessionManager.ts` | NO | Only used by agent-graph.ts |
| `mcp/dynamicLoader.ts` | NO | Only used by agent-graph.ts |
| `mcp/userMcpManager.ts` | NO | Only used by agent-graph.ts |

## Dead Code Summary

| Module | Lines | External Deps |
|--------|-------|---------------|
| `agent-graph.ts` | ~984 | `@langchain/langgraph`, `node:fs`, `node:path` |
| `reasoning/selfCritique.ts` | ~100 | (shared deps only) |
| `subagents/subAgentNode.ts` | ~180 | (shared deps only) |
| `subagents/roles.ts` | ~80 | (shared deps only) |
| `subagents/types.ts` | ~40 | (shared deps only) |
| `mcp/mcpClient.ts` | ~300 | (shared deps only) |
| `mcp/toolRegistry.ts` | ~150 | (shared deps only) |
| `mcp/capabilityRegistry.ts` | ~100 | (shared deps only) |
| `mcp/connectionManager.ts` | ~100 | `@modelcontextprotocol/sdk` |
| `mcp/discoveryEngine.ts` | ~150 | (shared deps only) |
| `mcp/healthMonitor.ts` | ~100 | (shared deps only) |
| `mcp/permissionManager.ts` | ~80 | (shared deps only) |
| `mcp/sessionManager.ts` | ~80 | (shared deps only) |
| `mcp/dynamicLoader.ts` | ~100 | (shared deps only) |
| `mcp/userMcpManager.ts` | ~200 | (shared deps only) |
| **Total dead** | **~2,644 lines** | |

## Reachable vs Dead

```
agent-runtime.ts ─── REACHABLE
    ↓ (type only)
mcp/types.ts ─────── TYPE-ONLY REACHABLE
─────────────────────────────────────
agent-graph.ts ───── DEAD
    ├── selfCritique.ts ── DEAD
    ├── subagents/ ─────── DEAD
    └── mcp/* (runtime) ── DEAD
```

## Conclusion
- Only `agent-runtime.ts` (and `mcp/types.ts` at type level) are reachable
- ~2,644 lines across 15 files are dead code
- The dead code carries `@langchain/langgraph` as a bundled dependency with no runtime benefit
- `@cline/agents` has a de facto reachable surface area of 1 file: `agent-runtime.ts`
