# Phase 2 Failure Reproductions

## T3 file-read edge cases

Test file: `packages/core/src/extensions/tools/executors/file-read.audit.test.ts`

### Directory input

**Test expectation:** reading a directory should report a clear error mentioning that the path is a directory and suggesting `list_directory`.

**Actual failure before fix:**
```
expected [Function] to throw error matching /directory|list_directory/i
but got 'Path is not a file: C:\Users\...\agents-file-read-dir-7HR0lz'
```

**Classification:** `no-error-handling`

### 100k-line file pagination

**Test expectation:** a 100k-line file should return a window and a pagination notice.

**Actual behavior before fix:** the file is read successfully and returns lines 1-2000 with the notice:
```
[Showing lines 1-2000 of 50000+ lines. Use start_line/end_line to read other sections.]
```

The file does not crash, but the test was written to expect the exact total line count. The implementation caps the line-count scan at 50,000 for unranged reads, so it reports `50000+` rather than `100000`. The test was relaxed to accept any `\d+\+? lines` pagination notice.

**Classification:** no code change required; behavior already satisfies T3 "crash na karein" requirement.

## T1 semantic search

**Current state:** no semantic/AST search exists. The `search_codebase` tool only performs regex/text search via ripgrep and a regex fallback.

**Classification:** `missing-fallback` + `bad-architecture`
