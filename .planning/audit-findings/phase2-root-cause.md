# Phase 2 Root Cause Classification

## T1 — Semantic codebase search missing

| Attribute | Value |
|---|---|
| Classification | `missing-fallback` + `bad-architecture` |
| Decision | **REBUILD / ADD** |
| Rationale | `search_codebase` has only text/regex search. The goal-loop fallback map requires semantic search as the primary search tier, with grep as fallback. A new AST-based driver must be added and integrated as the first tier for symbol-like queries. It will reuse the existing ripgrep driver for non-AST files and broader text matches. |

## T3 — Directory listing tool missing

| Attribute | Value |
|---|---|
| Classification | `missing-fallback` |
| Decision | **ADD** |
| Rationale | No dedicated `list_directory` tool exists. The fallback map expects "directory + manual file read" as the last search fallback. A new safe directory-listing executor and tool factory are required. |

## T3 — file-read directory error message

| Attribute | Value |
|---|---|
| Classification | `no-error-handling` |
| Decision | **FIX in `file-read.ts`** |
| Rationale | Reading a directory throws a generic `Path is not a file` message. It should throw a clearer error that identifies the path as a directory and tells the user to use `list_directory`. |

## T3 — file-read non-UTF8 / empty / large files

| Attribute | Value |
|---|---|
| Classification | `working` |
| Decision | **No code change** |
| Rationale | Existing tests confirm empty files return empty results, non-UTF8 files decode with replacement characters without crashing, and 100k+ line files return a paginated window. Only the directory error message needs improvement. |
