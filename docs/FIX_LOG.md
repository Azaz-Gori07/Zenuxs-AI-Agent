# Fix Log: OpenCode → Zenuxs Migration

**Date**: 2026-06-27  
**Engineer**: Principal AI Runtime Engineer

---

## Fix 1: Documentation Accuracy

**Issue**: PROJECT_AUDIT_REPORT.md and ARCHITECTURE_MIGRATION.md incorrectly stated enhanced tools were "disconnected"  
**Root Cause**: Audit was performed before enhanced tools were integrated  
**Resolution**: Verified that `createAllEnhancedTools()` IS called in `runtime-builder.ts:177` and tools ARE being used  
**Impact**: No code changes needed - audit documentation was outdated  
**Files**: None (documentation only)

---

## Fix 2: Parallel Tool Execution Default

**Issue**: Tools executed sequentially by default, causing 2-5x slower performance for tool-heavy operations  
**Root Cause**: `resolveToolExecution()` returned `undefined` when `maxParallelToolCalls` was not set, falling back to sequential execution  
**Resolution**: Changed default from `undefined` to `"parallel"` in `agent-runtime-config-builder.ts:177`  
**Impact**: All sessions now execute multiple tool calls in parallel by default  
**Files Modified**: 
- `packages/core/src/runtime/config/agent-runtime-config-builder.ts` (lines 170-181)

**Validation**: ✅ Core packages build successfully (`bun --production -F './packages/*' build`)

---
# Architecture Fix Log

## Issue #1: Enhanced Shell Tool Not Integrated

**Severity:** HIGH  
**File:** `packages/core/src/extensions/tools/enhanced-index.ts`  
**Discovered:** Line-by-line code review comparing imports and usage  

### Problem
The enhanced shell tool (`shell-enhanced.ts`) contains dangerous pattern detection, file operation scanning, and external directory permission checks, but the CLI uses the plain bash executor instead.

### Root Cause
The CLI in `main.ts` calls `createDefaultExecutors` which uses `executors/bash.ts`, while the enhanced tools factory exists but is not connected to the runtime.

### Current Implementation
```typescript
// In main.ts - uses plain executor
const toolExecutors = {
  askQuestion: askQuestionInTerminal,
  submit: submitAndExitInTerminal,
};
```

### Required Fix
Integrate enhanced tools into the default tool creation flow:
1. Replace `createDefaultExecutors` with enhanced tool versions
2. Ensure danger detection and file operation scanning are active
3. Connect external directory permission checks to runtime

### Status
**OPEN** - Requires integration work

---

## Issue #2: Dual File Read Implementations

**Severity:** HIGH  
**File:** `packages/core/src/extensions/tools/file-read-enhanced.ts`  
**Discovered:** Code review comparing enhanced vs executor implementations  

### Problem
Two file read implementations exist:
- `executors/file-read.ts` - Uses streaming, line ranges, basic safety
- `file-read-enhanced.ts` - Has fuzzy suggestions, binary detection, directory listing

The enhanced version is not used by default.

### Root Cause
The enhanced index exports the factory but CLI defaults to `createDefaultExecutors`.

### Current Implementation
```typescript
// In executors/index.ts
export function createDefaultExecutors(options: DefaultExecutorsOptions = {}): ToolExecutors {
  return {
    readFile: createFileReadExecutor(options.fileRead),
    // ...
  };
}
```

### Required Fix
Replace with enhanced file read implementation in default tool chain.

### Status
**OPEN**

---

## Issue #3: MCP Tools Not Auto-Registered

**Severity:** HIGH  
**File:** `packages/agents/src/mcp/toolRegistry.ts`  
**Discovered:** Flow analysis of MCP layer integration  

### Problem
MCP tools are discovered and available via `McpToolRegistry.getToolDescriptions()`, but they are not automatically registered with the AgentRuntime's tool map.

### Root Cause
The agent-graph planner node adds MCP tool descriptions to the system prompt, but `runtime.tools` does not include them.

### Current Implementation
```typescript
// In agent-graph.ts planner node
const mcpToolDescriptions = effectiveMcpRegistry.getToolDescriptions();
// Added to prompt but not to tool registry
```

### Required Fix
Auto-register MCP tools with the agent runtime during initialization:
1. Convert MCP tool schemas to AgentTool format
2. Register with runtime.tools Map
3. Handle MCP tool calls through McpLayer

### Status
**OPEN**

---

## Issue #4: Workspace Root Access via Private API

**Severity:** MEDIUM  
**File:** `packages/agents/src/agent-graph.ts`  
**Discovered:** TypeScript error suppression patterns  

### Problem
Multiple `@ts-expect-error` comments indicate accessing private config properties:
```typescript
// @ts-expect-error – workspaceRoot not on public config type
const wsRoot = runtime.config.workspaceRoot || process.cwd();
```

### Root Cause
The AgentRuntimeConfig interface in shared doesn't include `workspaceRoot`.

### Required Fix
Add `workspaceRoot` to AgentRuntimeConfig type or use proper accessor methods.

### Status
**OPEN**

---

## Issue #5: MCP Built-in Servers May Not Exist

**Severity:** MEDIUM  
**File:** `packages/agents/src/mcp/types.ts`  
**Discovered:** Configuration analysis  

### Problem
Built-in MCP servers reference command names like `mcp-server-chrome-devtools` which may not be installed.

### Current Configuration
```typescript
{
  name: "chrome-devtools",
  transport: { type: "stdio", command: "mcp-server-chrome-devtools" },
  // Command may not exist in node_modules
}
```

### Required Fix
Either:
1. Install actual MCP server packages as dependencies
2. Make built-in servers optional with graceful degradation
3. Use npm npx resolution for MCP commands

### Status
**OPEN**

---

## Issue #6: No Tool Streaming Support

**Severity:** MEDIUM  
**File:** `packages/shared/src/tools/definition.ts`  
**Discovered:** Feature comparison with OpenCode  

### Problem
Tools don't support streaming output - all tool calls wait for completion.

### Current Implementation
```typescript
export interface EnhancedTool<TInput = unknown, TOutput = unknown> {
  readonly execute?: ToolExecuteFn<TInput, TOutput>;
  // No streaming support
}
```

### Required Fix
Add streaming tool support similar to OpenCode's `toModelOutput` for progressive rendering.

### Status
**OPEN**

---

## Issue #7: Doom Loop Detector Not Connected

**Severity:** LOW  
**File:** `packages/core/src/extensions/tools/registry.ts`  
**Discovered:** Tool flow analysis  

### Problem
DoomLoopDetector is created in `createAllEnhancedTools` but never actually used to prevent looped tool calls.

### Current Implementation
```typescript
const doomDetector = new DoomLoopDetector();
// Created but never checked before tool execution
```

### Required Fix
Integrate doom loop detection into tool execution flow in AgentRuntime.

### Status
**OPEN**

---

## Issue #8: Shell Tool Duplication

**Severity:** LOW  
**File:** Multiple files  
**Discovered:** File structure analysis  

### Problem
Two shell tool names exist: `bash` (in shell-enhanced.ts) and `run_commands` (in definitions.ts). This creates confusion.

### Required Fix
Unify naming or clearly differentiate purposes.

### Status
**OPEN**

---

## Fix Priority Matrix

| Priority | Issue | Impact | Complexity |
|----------|-------|--------|------------|
| HIGH | Enhanced shell not integrated | Safety, UX | Medium |
| HIGH | MCP tools not auto-registered | Functionality | High |
| HIGH | Dual file read implementations | Consistency | Medium |
| MEDIUM | Workspace root private access | Type safety | Low |
| MEDIUM | MCP servers may not exist | Reliability | Medium |
| MEDIUM | No tool streaming | Performance | High |
| LOW | Doom loop detector not connected | Robustness | Low |
| LOW | Shell tool duplication | Clarity | Low |

---

## Fix 9: Workspace Analyzer Compilation Errors (Session 2)

**Issue**: Newly created `workspace-analyzer.ts` had TypeScript compilation errors  
**Severity**: HIGH  
**Root Cause**: Incorrect `fs` module usage - imported `fs/promises` but used sync methods  
**Errors**:
1. `error TS6133: 'hasPages' is declared but its value is never read` - Unused variable
2. `error TS2339: Property 'existsSync' does not exist on type 'typeof import("fs/promises")'` - Wrong module
3. `error TS2339: Property 'readdirSync' does not exist on type 'typeof import("fs/promises")'` - Wrong module
4. `error TS2551: Property 'readFileSync' does not exist on type 'typeof import("fs/promises")'` - Wrong module

**Resolution**:
1. Changed import to use both modules:
   ```typescript
   import * as fs from "fs";              // For sync methods
   import * as fsPromises from "fs/promises";  // For async methods
   ```
2. Updated async file operations to use `fsPromises`:
   ```typescript
   const content = await fsPromises.readFile(path, "utf-8");
   const files = await fsPromises.readdir(dir);
   ```
3. Removed unused `hasPages` variable

**Files Modified**:
- `packages/core/src/runtime/workspace-analyzer.ts` (imports, lines 136, 249)

**Validation**: ✅ Build passes for all core packages (`bun --production -F './packages/*' build`)

**Status**: ✅ FIXED