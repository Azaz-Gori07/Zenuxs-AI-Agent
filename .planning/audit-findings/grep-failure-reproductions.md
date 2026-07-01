# Grep Tool Failure Reproductions (Target A2)

All four documented failure modes were reproduced with dedicated audit tests.

---

## Issue 1 — `search.ts` flag injection via raw rg query

**Test file:** `packages/core/src/extensions/tools/executors/search.audit.test.ts`

**Failure mode:** Patterns beginning with `-` are passed to ripgrep without a `--` separator, so rg interprets them as CLI flags instead of literal search patterns.

**Minimal reproduction code:**

```typescript
const search = createSearchExecutor({ contextLines: 0 });
const result = await search("-version", dir, ctx);
```

**Actual output (current buggy implementation):**

```
Issue 1 result: No results found for pattern: -version
Searched 1 files.
```

**Expected correct output:** Should locate the literal substring `-version` in the file (or clearly report that the pattern is not present in the file).

**Stack trace / error:** No exception is thrown; the tool silently returns zero results because the ripgrep path exits with an error and the regex fallback searches for `-version` (which does not exist in the fixture).

---

## Issue 2 — `search.ts` hardcoded `--max-count=1`

**Test file:** `packages/core/src/extensions/tools/executors/search.audit.test.ts`

**Failure mode:** `searchWithRipgrep` always passes `--max-count=1`, limiting results to a single match per file even when a pattern appears multiple times.

**Minimal reproduction code:**

```typescript
// Fixture contains two matches on consecutive lines:
// const a = needle;
// const b = needle;
const search = createSearchExecutor({ contextLines: 0 });
const result = await search("needle", dir, ctx);
```

**Actual output (current buggy implementation):**

```
Issue 2 result: Found 1 result for pattern: needle

multi.ts:1:11
```

**Expected correct output:**

```
Found 2 results for pattern: needle
Searched 1 files.

multi.ts:1:11
> 1: const a = needle;

multi.ts:2:11
> 2: const b = needle;
```

**Classification evidence:** The ripgrep invocation at `search.ts:170` is `rg --json --context=... --max-count=1 -i <query>`. Removing `--max-count=1` (or making it configurable) resolves the behavior.

---

## Issue 3 — `search.ts` regex fallback has no binary skip

**Test file:** `packages/core/src/extensions/tools/executors/search.audit.test.ts`

**Failure mode:** When ripgrep is unavailable, the internal regex fallback reads every file whose extension is in the include list and does not detect or skip binary content.

**Minimal reproduction code:**

```typescript
// text.ts contains plain text "needle"
// binary.ts contains bytes [0x00, 0x01, "needle", 0x00]
process.env.PATH = ""; // force fallback
const search = createSearchExecutor({ contextLines: 0 });
const result = await search("needle", dir, ctx);
```

**Actual output (current buggy implementation):**

```
Issue 3 result: Found 2 results for pattern: needle
Searched 2 files.

binary.ts:1:3
> 1:  needle

text.ts:1:1
> 1: needle in text
```

**Expected correct output:** `binary.ts` should be skipped because it contains binary (non-text) data. Only `text.ts` should be reported.

**Related defects:** The fallback also lacks configurable include/exclude globs beyond the hardcoded extension list, and it uses `path.posix` helpers on paths that may arrive in Windows format (the current indexer normalizes to forward slashes, which masks but does not fix the platform-correctness issue).

---

## Issue 4 — `glob-grep-enhanced.ts` invalid regex crashes the tool

**Test file:** `packages/core/src/extensions/tools/glob-grep-enhanced.audit.test.ts`

**Failure mode:** `new RegExp(input.pattern, "g")` is constructed without validation, so malformed regex input throws an unhandled exception instead of returning a structured `isError` result.

**Minimal reproduction code:**

```typescript
const grepTool = createEnhancedGrepTool({ cwd: dir });
const result = await grepTool.execute(
  { pattern: "(?<!unclosed" },
  toolContext,
);
```

**Actual output (current buggy implementation):**

```
Issue 4 threw: SyntaxError: Invalid regular expression: /(?<!unclosed/g: Unterminated group
    at new RegExp (<anonymous>)
    at Object.execute (D:/V3/zenuxs-code/packages/core/src/extensions/tools/glob-grep-enhanced.ts:180:21)
```

**Expected correct output:** The tool should catch the invalid pattern and return:

```json
{
  "title": "Grep: (?<!unclosed",
  "output": "Invalid regex pattern: ...",
  "isError": true,
  "metadata": { "pattern": "(?<!unclosed", "files": 0, "matches": 0, "truncated": false }
}
```

---

## Reproduction commands

```bash
cd d:\V3\zenuxs-code
npx vitest run packages/core/src/extensions/tools/executors/search.audit.test.ts
npx vitest run packages/core/src/extensions/tools/glob-grep-enhanced.audit.test.ts
```

All four tests currently pass as "failure reproductions" (they assert the observable broken behavior). After the fix, these tests will be updated to assert the correct behavior.
