# Phase 3 Audit — T4-T12, F1, L1-L4

## T4 — Structured File Edit (editor.ts)
**Status:** WORKING — needs edge case hardening
**File:** `packages/core/src/extensions/tools/executors/editor.ts`
**Tests:** `editor.test.ts` (4 tests: create, insert, invalid insert, path safety)
**Gaps:**
- No concurrent edit protection (race condition on simultaneous edits)
- No whitespace-normalization option for partial match failures
- No backup before overwrite for T6 fallback
**Classification:** FIX — add edge case tests + backup support

## T5 — Patch-Apply Fallback (apply-patch.ts)
**Status:** WORKING — solid implementation
**File:** `packages/core/src/extensions/tools/executors/apply-patch.ts`
**Tests:** `apply-patch.test.ts` (6 tests: documented format, legacy wrapper, sentinels, context mismatch)
**Gaps:** None critical. Already serves as fallback.
**Classification:** PASS — no changes needed

## T6 — Full File Rewrite Fallback
**Status:** PARTIAL — editor creates files but no backup
**File:** `editor.ts` (createFile function)
**Gaps:**
- No automatic backup of original before rewrite
- T6 requires "backup original file" per goal-loop spec
**Classification:** FIX — add backup-before-rewrite to editor

## T7 — Terminal Execution (bash.ts)
**Status:** WORKING — robust implementation
**File:** `packages/core/src/extensions/tools/executors/bash.ts`
**Tests:** `bash.test.ts` (276 lines)
**Gaps:** None critical. Has timeout, output capture, process tree killing, abort signal.
**Classification:** PASS — no changes needed

## T8 — Test/Lint/Typecheck Auto-Detect
**Status:** MISSING — no dedicated executor
**Gaps:**
- No script auto-detection from package.json
- No output parsing for pass/fail counts
- Currently everything goes through bash
**Classification:** FIX — add test-runner utility (not a new tool, a helper)

## T9 — Git Operations
**Status:** MISSING — no safe git wrapper
**Gaps:**
- Git goes through bash without safety checks
- No dirty-tree detection, no conflict handling
**Classification:** FIX — add safe git helper utilities

## T10 — Project Rules/Constraints
**Status:** WORKING — loaded in runtime-builder.ts
**File:** `packages/core/src/runtime/orchestration/runtime-builder.ts` (line 417-454)
**Gaps:** Rules loaded from workspace path; need to verify graceful handling of missing/malformed
**Classification:** VERIFY — test edge cases

## T11 — Web Fetch
**Status:** WORKING — robust implementation
**File:** `packages/core/src/extensions/tools/executors/web-fetch.ts`
**Gaps:** None critical. Has timeout, size limits, protocol validation, HTML-to-text.
**Classification:** PASS — no changes needed

## T12 — MCP/External Connector
**Status:** WORKING — MCP infrastructure exists
**Files:** `packages/core/src/extensions/mcp/` (config-loader, manager, oauth, plugin-server-registration)
**Gaps:** Need to verify fallback behavior when MCP server is down
**Classification:** VERIFY — test fallback path

## F1 — Fallback Chain Tests
**Status:** MISSING — no deliberate failure tests
**Classification:** NEW — create fallback-chain audit tests

## L1-L4 — Loop Architecture
**Status:** EXISTS — session-runtime-orchestrator.ts implements the loop
**Files:** `packages/core/src/runtime/orchestration/session-runtime-orchestrator.ts`
**Classification:** VERIFY — confirm loop steps are logged and traceable
