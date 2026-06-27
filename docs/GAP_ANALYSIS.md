# Gap Analysis - Zenuxs-Code vs Modern AI Agents

## Critical Gaps (Must Fix)

### 1. Enhanced Tools Not Integrated
**Files:** `packages/core/src/extensions/tools/enhanced-*`  
**Impact:** Missing safety features, binary detection, fuzzy suggestions  
**Current State:** Enhanced tools exist but `createDefaultExecutors` is used instead of `createAllEnhancedTools`

### 2. MCP Tools Not Executable
**Files:** `packages/agents/src/mcp/toolRegistry.ts`  
**Impact:** MCP servers discovered but tools not executable as native tools  
**Current State:** `getToolDescriptions()` returns descriptions but tools not registered

### 3. Shell Safety Features Disabled
**Files:** `packages/core/src/extensions/tools/shell-enhanced.ts`  
**Impact:** Dangerous command patterns not blocked  
**Current State:** References in enhanced-index.ts but CLI uses executors/bash.ts

---

## High Priority Gaps

### 4. No Streaming Tool Interface
**Files:** `packages/shared/src/tools/definition.ts`  
**Impact:** Long operations block without incremental output  
**OpenCode Reference:** `toModelOutput` for progressive rendering

### 5. Missing PTY Support
**Files:** All shell implementations  
**Impact:** Interactive tools don't work properly  
**OpenCode Reference:** PTY-based shell for interactive commands

### 6. No Semantic Code Search
**Files:** `packages/core/src/extensions/tools/executors/search.ts`  
**Impact:** No intelligent code understanding  
**Cursor Reference:** Embedding-based codebase indexing

### 7. Workflow Graph Engine Missing
**Files:** `packages/core/src/cron/`  
**Impact:** Only cron-based scheduling, no DAG workflows  
**Need:** Workflow definition and execution engine

---

## Medium Priority Gaps

### 8. File Watch Integration
**Files:** No file watching module  
**Impact:** No trigger on file changes

### 9. Rollback/Transaction Support
**Files:** No transaction wrapper  
**Impact:** No atomic file operations

### 10. Advanced Context Compression
**Files:** `packages/core/src/extensions/context/`  
**Impact:** Only truncation, no intelligent summarization

### 11. Tool Retry Not Exposed
**Files:** Tool definition lacks retry configuration  
**Impact:** No per-tool retry policies

---

## Low Priority Gaps

### 12. Doom Loop Not Enforced
**Files:** `packages/core/src/extensions/tools/registry.ts`  
**Impact:** Potential infinite loops not prevented

### 13. Tool Name Duplication
**Files:** Multiple shell tool names (`bash`, `run_commands`)  
**Impact:** User confusion

### 14. Missing Tool Categories
**Files:** Tool registry  
**Impact:** No tool categorization for UI

---

## Comparison Matrix: Tool Capabilities

| Capability | Zenuxs-Code | OpenCode | Claude Code | Cursor | Priority |
|------------|------------|---------|-------------|--------|----------|
| Danger detection | ✗ (enhanced exists) | ✓ | ✓ | ✓ | HIGH |
| Binary detection | ✗ (enhanced exists) | ✓ | ✓ | ✓ | MEDIUM |
| Fuzzy suggestions | ✗ (enhanced exists) | ✓ | ✗ | ✓ | MEDIUM |
| Tool streaming | ✗ | ✓ | ✓ | ✓ | HIGH |
| MCP auto-registration | ✗ | ✓ | ✓ | ✓ | CRITICAL |
| Model-aware routing | Partial | ✓ | ✓ | ✓ | MEDIUM |
| PTY shell | ✗ | ✓ | ✓ | ✓ | HIGH |
| Semantic search | ✗ | Partial | ✓ | ✓ | HIGH |
| Workflow engine | ✗ (cron only) | ✓ | ✓ | ✓ | HIGH |

---

## Integration Gap Map

```
┌─────────────────────────────────────────────────────────────────┐
│                    Current Integration State                        │
├─────────────────────────────────────────────────────────────────┤
│ Native Tools         │ Executors//*.ts           │ ✓ Connected        │
│ Enhanced Tools       │ extensions/tools/*-enhanced.ts │ ✗ Disconnected │
│ MCP Tools            │ agents/mcp/*             │ ⚠ Partial (prompt only) │
│ Team Tools           │ extensions/tools/team/*    │ ✓ Connected        │
│ Cron Tools           │ cron/                      │ ✓ Connected        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Recommended Integration Order

### Phase 1 (Critical)
1. Integrate enhanced shell tool
2. Auto-register MCP tools with runtime
3. Add workspaceRoot to AgentRuntimeConfig

### Phase 2 (High Priority)
4. Add streaming tool interface
5. Integrate enhanced file read
6. Implement PTY shell support

### Phase 3 (Medium Priority)
7. Build workflow graph engine
8. Add semantic search capabilities
9. Implement file watch triggers

---

## Test Coverage Gaps

### Missing Tests
- Enhanced tool integration tests
- MCP tool registration flow tests
- Shell safety feature tests (danger detection)
- Binary file handling tests
- Workflow execution tests
- Multi-agent handoff tests

---

## Performance Gaps

| Area | Gap | Recommendation |
|------|-----|--------------|
| Large file reads | Only truncation | Add streaming reads |
| MCP connections | Per-call overhead | Add connection pooling |
| Search results | Full scan | Add indexed search |
| Tool batching | Sequential by default | Enable more parallel |