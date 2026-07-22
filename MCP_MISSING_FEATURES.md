# Missing Features — Gaps Between Zenuxs Code and MCP Servers

> **Purpose:** Catalog every feature that Zenuxs Code needs but doesn't have, organized by capability domain. Each gap includes the MCP server that could fill it, the evidence from our code audit, and the implementation effort required.

---

## 1. Code Intelligence (HIGH GAP)

### Gap: Multi-language code analysis

**MCP solution:** Serena MCP or Tree-sitter MCP

**Evidence:**
- `semantic-search.ts:46-53` — Zenuxs only parses 6 file extensions (`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`) using the TypeScript compiler API
- `semantic-search.ts:98-194` — `extractSymbols()` only extracts declarations (function, class, interface, type, enum, variable, method, property, import, export)
- `semantic-search.ts:296-354` — `searchWithSemantic()` returns only declaration-level matches

**Missing features (all requiring tree-sitter or Serena):**

| Feature | Zenuxs Code | Tree-sitter MCP | Serena MCP |
|---------|-------------|-----------------|------------|
| Multi-language AST (40+ langs) | ❌ TS/JS only | ✅ | ✅ |
| Symbol references (cross-file) | ❌ (grep fallback) | ❌ | ✅ |
| Call graph | ❌ | ❌ | ✅ |
| File outline | ❌ | ✅ | ✅ |
| Rename refactoring | ❌ | ❌ | ✅ |
| Hover documentation | ❌ | ❌ | ✅ |
| Code completions | ❌ | ❌ | ✅ |
| Diagnostics | ❌ | ❌ | ✅ |
| Go-to-definition | ❌ | ✅ | ✅ |
| AST pattern queries | ❌ | ✅ | ❌ |
| Syntax highlighting | ❌ | ✅ | ❌ |

**Impact:** High. Zenuxs Code cannot understand code structure in Python, Rust, Go, C++, Java, or any non-TypeScript language at the AST level. It falls back to regex grep for those languages.

**Effort to build natively:** Very high (full tree-sitter integration with grammar downloads, binding generation, multi-language AST management)

---

## 2. Browser Automation (HIGH GAP)

### Gap: No browser interaction

**MCP solution:** Playwright MCP

**Evidence:**
- `web-fetch.ts:98-258` — `WebFetchExecutor` performs **HTTP-level GET requests only**
- `web-fetch.ts:54-79` — `htmlToText()` is a simple regex-based HTML stripper, not a DOM parser
- No Playwright/Puppeteer/Selenium dependency in any `package.json`

**Missing features:**

| Feature | Zenuxs Code | Playwright MCP |
|---------|-------------|----------------|
| Page navigation | ❌ | ✅ |
| Element click | ❌ | ✅ |
| Form filling | ❌ | ✅ |
| Screenshot capture | ❌ | ✅ |
| JavaScript execution | ❌ | ✅ |
| DOM querying | ❌ | ✅ |
| Cookie management | ❌ | ✅ |
| Viewport control | ❌ | ✅ |
| Wait for elements | ❌ | ✅ |
| Browser history | ❌ | ✅ |

**Impact:** High. Any task requiring JavaScript-rendered page access, UI testing, or web scraping of SPA sites is impossible with `web_fetch` alone.

**Effort to build natively:** High (browser automation engine with multi-browser support, debugging, headless/headed modes)

---

## 3. Documentation Retrieval (MEDIUM GAP)

### Gap: No structured documentation lookup

**MCP solution:** Context7 MCP

**Evidence:**
- `web-fetch.ts` can fetch documentation URLs but has no understanding of doc structure
- `workspace-indexer.ts` indexes local files only — no external documentation awareness
- No documentation caching or versioned doc access

**Missing features:**

| Feature | Zenuxs Code | Context7 MCP |
|---------|-------------|-------------|
| Structured doc lookup | ❌ | ✅ |
| Cross-library doc search | ❌ | ✅ |
| API reference retrieval | ❌ | ✅ |
| Version-aware docs | ❌ | ✅ |
| Task-specific context | ✅ (workspace index) | ✅ (external docs) |

**Impact:** Medium. Users must manually find and fetch documentation URLs. The LLM has no automatic access to library APIs, breaking changes, or best practices.

**Effort to build natively:** Medium (documentation crawler, parser, and indexer)

---

## 4. Database Operations (MEDIUM GAP)

### Gap: No PostgreSQL support

**MCP solution:** PostgreSQL MCP

**Evidence:**
- `intent-router.ts:99` — PostgreSQL is recognized as a technology hint
- `sdlc-engine.ts:727,839-842` — PostgreSQL is recommended as an architecture choice ("PostgreSQL provides ACID compliance, JSON support, and excellent performance")
- **No `pg` or `postgres` npm dependency** exists in any `package.json`
- **No PostgreSQL client wrapper class** exists in the repository
- SQLite IS supported (via `shared/src/db/sqlite-db.ts`) but no other database drivers

**Missing features:**

| Feature | Zenuxs Code | PostgreSQL MCP |
|---------|-------------|---------------|
| SQL query execution | ❌ | ✅ |
| Table listing | ❌ | ✅ |
| Schema inspection | ❌ | ✅ |
| Database listing | ❌ | ✅ |
| Transaction support | ❌ | ✅ |
| Connection management | ❌ | ✅ |

**Impact:** Medium. Zenuxs Code cannot connect to PostgreSQL databases — despite recommending PostgreSQL as the default database in `sdlc-engine.ts:841-842`. This is a notable inconsistency.

**Effort to build natively:** Low-Medium (add `pg` npm dependency, create `PostgresDb` wrapper similar to `SqliteDb`)

---

## 5. Container Management (MEDIUM GAP)

### Gap: No programmatic Docker/Kubernetes API

**MCP solutions:** Docker MCP and Kubernetes MCP

**Evidence:**
- `intent-router.ts:107-108` — Docker and Kubernetes are recognized in user intent
- `sdlc-engine.ts:728,896` — Both are recommended as deployment technologies
- **No Docker SDK** (`dockerode`) or **Kubernetes SDK** (`@kubernetes/client-node`) exists
- All Docker/K8s operations go through `run_commands` (shell) — no structured API

**Missing features:**

| Feature | Zenuxs Code | Docker MCP | K8s MCP |
|---------|-------------|-----------|---------|
| Container lifecycle | ❌ (shell) | ✅ | — |
| Image management | ❌ (shell) | ✅ | — |
| Pod management | ❌ (shell) | — | ✅ |
| Deployment management | ❌ (shell) | — | ✅ |
| Log streaming | ❌ (shell) | ✅ | ✅ |
| Resource inspection | ❌ (shell) | ✅ | ✅ |

**Impact:** Medium. Shell-based Docker/K8s operations work but lack structured error handling, output parsing, and type safety.

**Effort to build natively:** Medium (add `dockerode` and/or `@kubernetes/client-node`, create wrapper classes)

---

## 6. Static Analysis (MEDIUM GAP)

### Gap: No integrated code quality engine

**MCP solution:** Static Analysis MCP

**Evidence:**
- Zenuxs Code has no static analysis engine of its own
- `run_commands` can execute `eslint`, `prettier`, `npm audit` etc. but results are unstructured text
- `sdlc-engine.ts` validation phase (phase 7) mentions "lint, test, typecheck" but doesn't have built-in analysis

**Missing features:**

| Feature | Zenuxs Code | Static Analysis MCP |
|---------|-------------|-------------------|
| File-level analysis | ❌ (shell) | ✅ |
| Project-level analysis | ❌ (shell) | ✅ |
| Security scanning | ❌ (shell) | ✅ |
| Style checking | ❌ (shell) | ✅ |
| Complexity metrics | ❌ | ✅ |
| Duplicate detection | ❌ | ✅ |

**Impact:** Medium. Code quality analysis requires shell-outs to external tools. No integrated results.

**Effort to build natively:** High (integrate multiple linters with structured output parsing)

---

## 7. Obsidian Integration (LOW GAP)

### Gap: No knowledge base access

**MCP solution:** Obsidian MCP

**Evidence:**
- **Zero lines of Obsidian-related code** found anywhere in the repository
- `grep` for "obsidian" across the entire repo returned zero results

**Missing features:** All of them (read/write notes, search vault, tags, backlinks, note management).

**Impact:** Low — a niche use case.

**Effort to build natively:** Low-Medium (filesystem access to markdown vault + parser)

---

## Gap Priority Matrix

| Gap | Domain | Impact | Effort to Build | Best MCP Fit |
|-----|--------|--------|-----------------|-------------|
| Multi-language code intelligence | Code Analysis | **HIGH** | Very high | **Serena / Tree-sitter** |
| Browser automation | Testing/Scraping | **HIGH** | High | **Playwright** |
| Documentation retrieval | Research | MEDIUM | Medium | Context7 |
| PostgreSQL support | Database | MEDIUM | Low-Medium | PostgreSQL |
| Docker API | DevOps | MEDIUM | Medium | Docker |
| Kubernetes API | DevOps | MEDIUM | Medium | Kubernetes |
| Static analysis | Code Quality | MEDIUM | High | Static Analysis |
| Obsidian vault | Knowledge | LOW | Low-Medium | Obsidian |
| Git operations | Version Control | LOW | Low-Medium | Git (community) |

**Summary:** 8 genuine capability gaps exist. The top 3 by impact are: multi-language code intelligence, browser automation, and PostgreSQL/database support.
