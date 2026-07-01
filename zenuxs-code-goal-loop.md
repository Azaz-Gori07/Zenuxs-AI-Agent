# ZENUXS-CODE CLI — AGENT IMPROVEMENT GOAL-LOOP

> **Audience:** Yeh document ek doosre coding agent ke liye hai jo `zenuxs-code` CLI agent (TypeScript/Node.js) par kaam karega.
> **Mode:** Yeh ek prompt nahi hai — yeh ek **goal-loop checklist** hai. Har target ek pass/fail condition ke saath diya gaya hai. Agent ko har target ko verify karna hai; jab tak saare targets `PASS` na ho jayein, agent ko kaam jaari rakhna hai. Koi bhi target skip ya assume nahi karna — proof chahiye (test output, command output, file diff).

---

## 0. GROUND RULE — NO CLONING, ONLY REBUILD-WHERE-BROKEN

- Har existing tool (especially **grep/search tools**, jo currently fail ho rahe hain) ko pehle **audit** karo.
- Audit ke baad decide karo: `FIX` (logic bug hai, structure thik hai) ya `REBUILD` (structure hi galat/fragile hai).
- **REBUILD ka matlab copy-paste clone nahi hai.** Naya implementation likho jo zenuxs-code ke existing architecture (file layout, type system, CLI command interface) ke saath properly integrate ho — kisi doosre tool (Claude Code/Cursor) ka code literally copy mat karo, sirf unka **behavior/pattern** reference lo.
- Agar koi tool repeatedly fail ho raha hai aur fix possible nahi (root cause unclear / architecture broken), to use **DELETE karke from scratch rebuild** karo, lekin pehle iska reason document karo.

---

## 1. AUDIT PHASE (mandatory, before any fix)

**Target A1 — Full Tool Inventory**
- [ ] Saare existing tools/commands ki list banao (search, edit, terminal, web, MCP, git, verification, etc.)
- [ ] Har tool ke liye: input schema, output schema, current implementation file path
- **PASS condition:** Ek table/JSON file ho jisme har tool ka naam, location, status (working/broken/partial) ho.

**Target A2 — Failure Reproduction**
- [ ] Har "broken" tool (grep tool sabse pehle) ko 3-5 real test cases pe chalao
- [ ] Exact error/wrong-output capture karo (stack trace, mismatched results, timeout, etc.)
- **PASS condition:** Har broken tool ke liye ek reproducible failure log file ho.

**Target A3 — Root Cause Classification**
- [ ] Har failure ko classify karo: `logic-bug` | `bad-architecture` | `missing-fallback` | `wrong-dependency` | `no-error-handling`
- **PASS condition:** Classification document ready, jisme FIX vs REBUILD vs DELETE-REBUILD decision likha ho with reasoning.

---

## 2. CORE TOOL LAYER TARGETS

Inspired by Claude Code / Cursor / Antigravity ke patterns — but TypeScript-native implementation, zenuxs-code ke style me.

### 2.1 Search & Retrieval
- [ ] **T1 — Semantic codebase search** kaam kare (embedding-based ya AST-based, jo bhi stack ho)
  - PASS: Query do, relevant files/functions accurately return ho (manually verify 5 queries)
- [ ] **T2 — Exact grep/text search FIX/REBUILD** (priority #1, kyunki yeh sabse zyada fail ho raha hai)
  - PASS: Special characters, regex patterns, large files, binary-file-skip, multi-directory search — sab edge cases pass ho. Ripgrep jaisa reliable ho.
- [ ] **T3 — File read + directory listing** robust ho (large files, symlinks, hidden files handle ho)
  - PASS: Edge cases (empty file, 100k+ line file, non-UTF8) crash na karein.

### 2.2 Edit & Write
- [ ] **T4 — Structured file edit** (line-range / diff-based) reliable ho
  - PASS: Concurrent edits, partial match failures, whitespace-sensitive edits sab handle ho.
- [ ] **T5 — Patch-apply fallback** ho agar structured edit fail ho
  - PASS: Jab T4 fail kare, system automatically patch-based apply try kare aur log kare ki fallback trigger hua.
- [ ] **T6 — Full file rewrite fallback** (last resort) ho
  - PASS: Jab T4 aur T5 dono fail hon, rewrite ho aur backup original file ka rakha jaye.

### 2.3 Execution & Verification
- [ ] **T7 — Terminal execution** sandboxed/safe ho, timeout aur output-capture ho
  - PASS: Long-running command, failing command, infinite loop — sab gracefully handle ho.
- [ ] **T8 — Test/lint/typecheck runners** auto-detect ho (package.json scripts se)
  - PASS: npm/yarn/pnpm projects me sahi script detect ho, output parse ho (pass/fail count nikal sake).
- [ ] **T9 — Git operations** (diff, commit, branch, rollback) safe ho
  - PASS: Dirty working tree, merge conflict, detached HEAD jaise states me bhi crash na ho.

### 2.4 Context & Rules
- [ ] **T10 — Project rules/constraints fetch** (e.g. `.zenuxs/rules`, config files) reliably load ho
  - PASS: Missing config, malformed config dono gracefully handle ho.
- [ ] **T11 — Web search/fetch** ho, rate-limit aur timeout handle ho
  - PASS: Failed fetch pe primary-docs-fallback trigger ho.

### 2.5 External Integrations
- [ ] **T12 — MCP / external connector support** ho
  - PASS: MCP server down hone par local-script-fallback automatically try ho.

---

## 3. FAILOVER / FALLBACK MAP (must be implemented, not just designed)

Har layer ka explicit fallback chain code me implemented hona chahiye, sirf documentation me nahi:

| Layer | Primary | Fallback 1 | Fallback 2 |
|---|---|---|---|
| Search | Semantic search | Grep (fixed) | Directory + manual file read |
| Edit | Structured edit | Patch apply | Full file rewrite (with backup) |
| Execute | Full test suite | Targeted test | Single smoke command |
| External | MCP server | Local script/API | Manual prompt to user |
| Verification | Unit tests | Integration test | Lint/typecheck only |

**Target F1 — PASS condition:** Har fallback chain ko deliberately primary-fail karke test karo (e.g. semantic search ko intentionally break karke check karo grep automatically chalta hai ya nahi). Log/trace produce ho jo fallback trigger ko dikhaye.

---

## 4. AGENT LOOP ARCHITECTURE

**Target L1 — Loop Controller**
- [ ] Ek central orchestrator loop ho: `plan → inspect → retrieve → edit → verify → fix → summarize`
- [ ] Har step ka state track ho (task intake → planning → context-gathering → execution → verification → repair → finalization)
- PASS: Ek multi-step real task (e.g. "add a new API endpoint with tests") end-to-end is loop se complete ho, har step ka log mile.

**Target L2 — Repair Loop**
- [ ] Verification fail hone par agent automatically smaller-scoped fix try kare (poora rewrite nahi, targeted patch)
- PASS: Intentionally ek failing test do, agent ek hi targeted fix se resolve kare, na ki unrelated files touch kare.

**Target L3 — Guardrails/Permissions**
- [ ] Risky actions (delete, force-push, system commands) ke liye approval/allowlist mechanism ho
- PASS: Destructive command bina approval ke block ho, log me reason likha ho.

**Target L4 — Observability**
- [ ] Logs, diff summaries, retry history persist hon (file ya structured log store me)
- PASS: Kisi bhi past task ka full trace (kaunsa tool kab fail hua, kaunsa fallback chala) retrieve ho sake.

---

## 5. FINAL ACCEPTANCE CRITERIA (loop exit condition)

Agent tabhi "done" maan sakta hai jab:

1. Saare Section 1 audit targets `PASS`.
2. Saare Section 2 tool targets `PASS` (especially T2 grep tool — yeh non-negotiable hai).
3. Section 3 fallback map fully implemented + tested.
4. Section 4 loop architecture working end-to-end on a real multi-file task.
5. Koi bhi tool "silently fails" nahi karta — har failure ka log/error visible hota hai.
6. Code review se confirm ho ki rebuild/fix hua code **zenuxs-code ke existing conventions** follow karta hai (naming, file structure, type definitions) — yeh kisi doosre tool ka literal clone nahi hai.

**Agar koi bhi target FAIL hai → agent loop par wapas jao us specific target par, fix karo, re-verify karo. Kaam tab tak continue karo jab tak yeh sab targets PASS na ho jayein.**

---

## 6. PRIORITY ORDER (suggested execution sequence)

1. Target A1 → A2 → A3 (audit)
2. Target T2 (grep fix/rebuild) — **highest priority, sabse zyada broken**
3. Target T1, T3 (baaki search/read tools)
4. Target T4, T5, T6 (edit chain)
5. Target T7, T8, T9 (execution/verification)
6. Target T10, T11, T12 (context/external)
7. Target F1 (fallback testing)
8. Target L1–L4 (loop + guardrails + observability)
9. Final acceptance criteria check (Section 5)
