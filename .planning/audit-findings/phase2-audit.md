# Phase 2 Audit: T1 Semantic Search + T3 File Read / Directory Listing

## Current capabilities

### Search layer (T1)
- `packages/core/src/extensions/tools/executors/search.ts` provides `search_codebase` via ripgrep → regex fallback.
- The ripgrep/regex drivers can find text patterns but have no understanding of symbols, definitions, or references.
- There is no semantic/AST search tool or fallback today.

### File read layer (T3)
- `packages/core/src/extensions/tools/executors/file-read.ts` handles absolute/relative paths, line ranges, image files, abort signals, and path-safety checks.
- It already caps reads at 2000 lines / ~50k chars and reports pagination.
- Path Analyzer (`packages/core/src/runtime/path-analyzer.ts`) normalizes paths, resolves symlinks, and blocks paths that escape the workspace.

### Directory listing
- No dedicated `list_directory` tool exists.
- `glob-grep-enhanced.ts` has a `glob` tool that can list files matching a pattern, but it is not a general directory browser.
- `workspace-analyzer.ts` has a private `readDirectory` helper, but it is not exposed as a tool.

## What is missing

| Target | Gap |
|---|---|
| T1 | No AST-based symbol extraction; no "find definition / find references" capability. |
| T3 | `read_files` does not explicitly handle empty files, non-UTF8 text, or directory inputs. |
| T3 | No `list_directory` tool for the search fallback chain. |

## Files that will change

- `packages/core/package.json` — add `typescript` runtime dependency for AST parsing.
- `packages/core/src/extensions/tools/executors/semantic-search.ts` — new semantic search driver.
- `packages/core/src/extensions/tools/executors/directory-list.ts` — new directory listing executor.
- `packages/core/src/extensions/tools/executors/file-read.ts` — harden edge-case handling.
- `packages/core/src/extensions/tools/executors/search.ts` — integrate semantic driver as primary tier.
- `packages/core/src/extensions/tools/schemas.ts` — add `ListDirectoryInputSchema`.
- `packages/core/src/extensions/tools/definitions.ts` — add `createListDirectoryTool`.
- `packages/core/src/extensions/tools/types.ts` — add `DirectoryListExecutor` / entry types.
- `packages/core/src/extensions/tools/executors/index.ts` — export new executors.
