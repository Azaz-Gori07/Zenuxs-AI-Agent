# Grep Tool Root Cause Classification (Target A3)

## Classification rules

- `logic-bug` — The overall structure is sound, but a specific implementation detail is wrong.
- `bad-architecture` — The component has a fragile or duplicated design that will keep producing similar bugs.
- `missing-fallback` — A primary path fails and there is no safe secondary path.
- `wrong-dependency` — The wrong library, binary, or module is being used.
- `no-error-handling` — Errors are swallowed or thrown as unhandled exceptions instead of being surfaced.

---

## Issue-by-issue classification and FIX vs REBUILD decision

| # | File | Symptom | Root cause | Classification | Decision | Rationale |
|---|---|---|---|---|---|---|
| 1 | `packages/core/src/extensions/tools/executors/search.ts` | Patterns starting with `-` are misread as ripgrep flags. | User query is concatenated into the rg argv before `--`; exit code and stderr are ignored. | `logic-bug` + `no-error-handling` | **FIX** | Add `--` separator before the query, surface rg stderr on non-zero exits, and keep the existing search/fallback structure. |
| 2 | `packages/core/src/extensions/tools/executors/search.ts` | Only one match per file is returned. | Hardcoded `--max-count=1` in `searchWithRipgrep`. | `logic-bug` | **FIX** | Remove the flag (or make it configurable with default no per-file cap). No structural change needed. |
| 3 | `packages/core/src/extensions/tools/executors/search.ts` | Regex fallback searches binary files, has no include/exclude globs, and uses `path.posix` on platform-relative paths. | The fallback re-implements a tiny subset of ripgrep; it lacks binary detection, glob filtering, and platform-correct path handling. | `bad-architecture` | **REBUILD fallback path** | Replace the inline fallback with a small, focused `regex-search.ts` driver that skips binary files, supports include/exclude globs, and uses `path` correctly. Do not keep duplicating ripgrep features. |
| 4 | `packages/core/src/extensions/tools/glob-grep-enhanced.ts` | Invalid regex input crashes the tool with an unhandled `SyntaxError`. | `new RegExp(input.pattern, "g")` is not wrapped in validation. | `logic-bug` + `no-error-handling` | **FIX** | Wrap regex construction in `try/catch` and return a structured `isError` result. |
| 5 | `packages/core/src/extensions/tools/glob-grep-enhanced.ts` | Enhanced `grep` tool does not use ripgrep and maintains a second, weaker regex implementation. | The tool was built as a parallel implementation instead of reusing the existing ripgrep-backed search logic. | `bad-architecture` | **REBUILD grep path** | Route the enhanced `grep` tool through the same ripgrep driver as `search_codebase`, falling back to the shared regex driver when ripgrep is unavailable. Delete the duplicated regex traversal inside `glob-grep-enhanced.ts`. |

---

## Architectural decision summary

### What will be rebuilt

1. **Shared ripgrep driver** — new file `packages/core/src/extensions/tools/executors/ripgrep-search.ts`
   - Never passes user input before `--`.
   - No hardcoded `--max-count=1`.
   - Supports include/exclude globs, target path (file or directory), max results, context lines, timeout, and abort signal.
   - Parses ripgrep JSON output into a common `SearchMatch[]` shape.
   - Returns `null` when ripgrep is unavailable so callers can fall back.

2. **Shared regex fallback driver** — new file `packages/core/src/extensions/tools/executors/regex-search.ts`
   - Safe directory traversal with `fs.readdir({ withFileTypes: true })`.
   - Skips binary files by detecting null bytes in the first chunk.
   - Supports include/exclude globs and max depth.
   - Uses platform-correct `path` helpers.
   - Returns the same `SearchMatch[]` shape as the ripgrep driver.

3. **Enhanced grep tool** — `packages/core/src/extensions/tools/glob-grep-enhanced.ts`
   - Remove the inline regex traversal.
   - Use the shared ripgrep/regex drivers.
   - Preserve Path Analyzer integration for file-vs-directory routing.
   - Add input validation so invalid regex returns `isError` instead of throwing.

### What will be fixed in place

- **`packages/core/src/extensions/tools/executors/search.ts`** — Replace the inline ripgrep and fallback implementations with calls to the shared drivers, while keeping `createSearchExecutor`'s public signature and output formatting unchanged.

### What will not be changed

- `read_files`, `editor`, `apply_patch`, `run_commands`, `fetch_web_content`, MCP, git, and loop orchestrator tools are out of Phase 1 scope.

---

## Why this is not a clone

The rebuild does not copy code from Claude Code, Cursor, or any other agent. It extracts two small, focused drivers from zenuxs-code's existing `search.ts` logic, keeps the existing `SearchExecutor` and tool-result types, and wires them into the already-present Path Analyzer architecture. The file layout, naming conventions, and error shapes remain consistent with the rest of `packages/core/src/extensions/tools/`.
