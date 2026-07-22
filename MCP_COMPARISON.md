# MCP Server Comparison — Zenuxs Code vs. Dedicated MCP Servers

> **Methodology:** Each MCP server capability is compared against Zenuxs Code's built-in tools (definitions.ts, executors/) and runtime services. Evidence is drawn directly from repository source code.

---

## 1. Filesystem MCP vs. Zenuxs Code

| Capability | Filesystem MCP | Zenuxs Code | Delta |
|------------|---------------|-------------|-------|
| `read_file` | ✅ Native tool | ✅ `read_files` (definitions.ts:215), `FileReadExecutor` (file-read.ts) | Equivalent |
| `write_file` | ✅ Native tool | ✅ `write_file` (definitions.ts:88), bundled in `EditorExecutor` | Equivalent |
| `edit_file` | ✅ Native tool | ✅ `str_replace`/`edit` in `EditorExecutor` (editor.ts:158-193) | Equivalent |
| `rename` | ✅ Native tool | ❌ No dedicated rename tool — uses `run_commands` (mv) | Zenuxs uses shell fallback |
| `move_file` | ✅ Native tool | ❌ No dedicated move tool — uses `run_commands` (mv) | Zenuxs uses shell fallback |
| `search` (glob) | ✅ Native tool | ✅ `search_codebase` + `GlobTool` via shell (definitions.ts:465) | Zenuxs uses AST+grep+regex |
| `get_file_info` | ✅ Native tool | ❌ No dedicated stat tool | Zenuxs uses `run_commands` (stat) |
| `list_directory` | ✅ Native tool | ✅ `list_directory` (definitions.ts:163, directory-list.ts) | Equivalent |
| `directory_tree` | ✅ Native tool | ❌ No recursive tree tool | Zenuxs uses `run_commands` (tree) |
| `create_directory` | ✅ Native tool | ❌ No dedicated mkdir tool | Zenuxs uses `run_commands` (mkdir) |
| Path safety | ✅ Sandboxed | ✅ `assertPathSafe` (safety.ts) | Both safe |
| Image read | ❌ | ✅ `read_files` auto-detects images (file-read.ts:22-28) | Zenuxs adds image support |
| Image to mermaid | ❌ | ✅ `image_to_mermaid` (definitions.ts:605) | Zenuxs adds vision-to-diagram |

**Verdict:** Zenuxs Code already provides **equivalent or superior** filesystem capabilities. The missing dedicated tools (rename, move, stat, tree, mkdir) are trivially covered by `run_commands` (shell). No advantage to adding Filesystem MCP.

---

## 2. Git MCP vs. Zenuxs Code

| Capability | Git MCP | Zenuxs Code | Delta |
|------------|---------|-------------|-------|
| `git_status` | ✅ Native tool | ✅ `git_status` (definitions.ts:380) via `GitHelper` | Equivalent |
| `git_diff` | ✅ Native tool | ✅ `git_diff` (definitions.ts:384) via `GitHelper` | Equivalent |
| `git_log` | ✅ Native tool | ❌ No dedicated log tool | Zenuxs uses `run_commands` (git log) |
| `git_show` | ✅ Native tool | ❌ No dedicated show tool | Zenuxs uses `run_commands` |
| `git_branch` | ✅ Native tool | ❌ No dedicated branch tool | Zenuxs uses `run_commands` |
| `git_checkout` | ✅ Native tool | ❌ No dedicated checkout tool | Zenuxs uses `run_commands` |
| `git_commit` | ✅ Native tool | ✅ `safeCommit` (git-helper.ts) | Zenuxs has safe wrapper |
| `git_add` | ✅ Native tool | ❌ No dedicated add tool | Zenuxs uses `run_commands` |
| `git_reset` | ✅ Native tool | ❌ No dedicated reset tool | Zenuxs uses `run_commands` |
| `git_blame` | ✅ Native tool | ❌ No dedicated blame tool | Zenuxs uses `run_commands` |
| `git_stash` | ✅ Native tool | ❌ No dedicated stash tool | Zenuxs uses `run_commands` |
| `git_remote` | ✅ Native tool | ❌ No dedicated remote tool | Zenuxs uses `run_commands` |
| `git_push` | ✅ Native tool | ❌ No dedicated push tool | Zenuxs uses `run_commands` |
| `git_pull` | ✅ Native tool | ❌ No dedicated pull tool | Zenuxs uses `run_commands` |
| `git_merge` | ✅ Native tool | ❌ No dedicated merge tool | Zenuxs uses `run_commands` |

**Verdict:** Zenuxs Code has **minimal dedicated git tooling** (only status, diff, and safeCommit). All other git operations go through `run_commands` (shell). A **Git MCP integration would provide structured, validated git operations** without raw shell access.

---

## 3. Serena MCP vs. Zenuxs Code

| Capability | Serena MCP | Zenuxs Code | Delta |
|------------|-----------|-------------|-------|
| `find_symbols` | ✅ tree-sitter based, multi-language | ✅ `search_codebase` → `searchWithSemantic` (semantic-search.ts:296) — **TS/JS only** | Serena supports all tree-sitter langs |
| `find_references` | ✅ tree-sitter symbol references | ❌ No reference finding | Zenuxs uses grep fallback |
| `get_call_graph` | ✅ tree-sitter call hierarchy | ❌ No call graph | Missing |
| `get_outline` | ✅ File outline | ❌ No outline tool | Missing |
| `rename_symbol` | ✅ Cross-file rename | ❌ No rename refactoring | Missing — uses editor search/replace |
| `get_hover_info` | ✅ Hover doc | ❌ No hover tool | Missing |
| `get_completions` | ✅ Code completions | ❌ No completion tool | Missing |
| `get_diagnostics` | ✅ File diagnostics | ❌ No diagnostic tool | Missing |
| `navigate_to` | ✅ Go-to-definition | ❌ No navigation tool | Missing |

**Verdict:** Zenuxs Code's `searchWithSemantic` (semantic-search.ts) provides **basic AST-based symbol search** but only for TypeScript/JavaScript and only for **declarations** (functions, classes, interfaces, types, enums, variables, imports, exports). Serena is a full code intelligence engine using tree-sitter with cross-file references, call graphs, and multi-language support. **Serena (or tree-sitter MCP) would fill a significant gap.**

---

## 4. Context7 MCP vs. Zenuxs Code

| Capability | Context7 MCP | Zenuxs Code | Delta |
|------------|-------------|-------------|-------|
| `get_documentation` | ✅ Multi-source docs | ❌ No doc lookup tool | Missing — uses `web_fetch` only |
| `search_documentation` | ✅ Cross-doc search | ❌ No doc search | Missing |
| `get_context_for_task` | ✅ Task-specific context | ✅ `WorkspaceIndexer` (workspace-indexer.ts) | Zenuxs indexes workspace, not docs |
| `lookup_api` | ✅ API reference lookup | ❌ No API ref tool | Missing |

**Verdict:** Zenuxs Code has **no dedicated documentation retrieval** capability. The `web_fetch` tool (web-fetch.ts) can fetch docs from URLs, but there's no structured documentation index or API reference lookup. **Context7 MCP would add value for documentation-aware coding.**

---

## 5. Playwright MCP vs. Zenuxs Code

| Capability | Playwright MCP | Zenuxs Code | Delta |
|------------|---------------|-------------|-------|
| `navigate` | ✅ Browser navigation | ❌ | Missing |
| `click` | ✅ Element click | ❌ | Missing |
| `fill` | ✅ Form fill | ❌ | Missing |
| `select` | ✅ Option selection | ❌ | Missing |
| `screenshot` | ✅ Screenshot | ❌ | Missing |
| `get_text` | ✅ Page text | ✅ `web_fetch` fetches raw HTML text | No browser rendering |
| `get_html` | ✅ Page HTML | ✅ `web_fetch` fetches raw HTML | No browser rendering |
| `evaluate_script` | ✅ In-page JS execution | ❌ | Missing |
| `wait_for_selector` | ✅ Element wait | ❌ | Missing |
| `set_viewport` | ✅ Viewport config | ❌ | Missing |
| Cookie management | ✅ | ❌ | Missing |

**Verdict:** Zenuxs Code's `web_fetch` (web-fetch.ts) provides **HTTP-level page fetching with HTML-to-text conversion**, but it has **no browser rendering, JavaScript execution, or DOM interaction**. **Playwright MCP would add significant value for any task requiring browser interaction.**

---

## 6. Docker MCP vs. Zenuxs Code

| Capability | Docker MCP | Zenuxs Code | Delta |
|------------|-----------|-------------|-------|
| `list_containers` | ✅ | ❌ | Missing — uses `run_commands` (docker ps) |
| `start_container` | ✅ | ❌ | Missing — uses `run_commands` |
| `stop_container` | ✅ | ❌ | Missing — uses `run_commands` |
| `create_container` | ✅ | ❌ | Missing — uses `run_commands` |
| `remove_container` | ✅ | ❌ | Missing — uses `run_commands` |
| `list_images` | ✅ | ❌ | Missing — uses `run_commands` |
| `pull_image` | ✅ | ❌ | Missing — uses `run_commands` |
| `build_image` | ✅ | ❌ | Missing — uses `run_commands` |
| `remove_image` | ✅ | ❌ | Missing — uses `run_commands` |
| `exec_in_container` | ✅ | ❌ | Missing — uses `run_commands` |
| `view_logs` | ✅ | ❌ | Missing — uses `run_commands` |
| Network/volume mgmt | ✅ | ❌ | Missing |

**Verdict:** Docker is recognized as an **intent** in `intent-router.ts:107` (`docker: /\bdocker\b/i`) and is mentioned in `sdlc-engine.ts:728` as a deployment technology. Both recognize Docker but **neither provides a programmatic Docker API** — all operations go through `run_commands` shell. **Docker MCP would provide structured Docker operations without raw shell.**

---

## 7. Fetch MCP vs. Zenuxs Code

| Capability | Fetch MCP | Zenuxs Code | Delta |
|------------|----------|-------------|-------|
| `fetch_url` | ✅ Single URL fetch | ✅ `web_fetch` (web-fetch.ts:98-258) | Equivalent |
| `fetch_urls` | ✅ Multiple URLs | ❌ No batch fetch | Zenuxs single-URL only |
| HTML-to-text | ✅ | ✅ `htmlToText` (web-fetch.ts:54-79) | Equivalent |
| JSON formatting | ✅ | ✅ JSON.stringify (web-fetch.ts:213-219) | Equivalent |
| Size limit | ✅ | ✅ `maxResponseBytes` (web-fetch.ts:24) | Equivalent |
| Timeout | ✅ | ✅ `timeoutMs` (web-fetch.ts:18) | Equivalent |
| Redirect handling | ✅ | ✅ `followRedirects` (web-fetch.ts:40) | Equivalent |

**Verdict:** Zenuxs Code's `web_fetch` executor (web-fetch.ts:98-258) is **already fully featured** with HTML-to-text conversion (54-79), JSON formatting (213-219), response size limiting (24), timeout (18), redirect handling (40), content-type detection (207-222), and abort signal support (131-139). **Fetch MCP adds zero value** beyond batch URL fetching.

---

## 8. MCP Inspector vs. Zenuxs Code

| Capability | MCP Inspector | Zenuxs Code | Delta |
|------------|--------------|-------------|-------|
| Connect to MCP servers | ✅ | ✅ `SdkMcpClient` (client.ts), `InMemoryMcpManager` (manager.ts) | Zenuxs has full MCP client |
| List tools/resources | ✅ | ✅ `ToolRegistry` (toolRegistry.ts), `McpLayer` (mcpClient.ts) | Equivalent |
| Test tool calls | ✅ | ✅ `McpLayer.executeTool()` (mcpClient.ts) | Equivalent |
| View responses | ✅ | ✅ Response handling in mcpClient.ts | Equivalent |
| Inspect logs | ✅ Web UI | ❌ No MCP debug UI | Zenuxs lacks visual inspector |

**Verdict:** Zenuxs Code has **full MCP client infrastructure** (`SdkMcpClient`, `InMemoryMcpManager`, `McpLayer`, `ToolRegistry`, `ConnectionManager`, etc.) — 14+ files dedicated to MCP integration (packages/agents/src/mcp/, packages/core/src/extensions/mcp/). It can connect to, list, and call MCP servers programmatically. **MCP Inspector is a developer UI tool** for debugging MCP servers — it serves a different purpose.

---

## 9. PostgreSQL MCP vs. Zenuxs Code

| Capability | PostgreSQL MCP | Zenuxs Code | Delta |
|------------|---------------|-------------|-------|
| `query` | ✅ SQL execution | ❌ | Missing |
| `list_tables` | ✅ Table listing | ❌ | Missing |
| `describe_table` | ✅ Schema inspection | ❌ | Missing |
| `list_databases` | ✅ DB listing | ❌ | Missing |
| `execute_transaction` | ✅ Transaction | ❌ | Missing |
| `get_schema` | ✅ Full schema | ❌ | Missing |

**Verdict:** PostgreSQL is recognized as a technology in `intent-router.ts:99` and `sdlc-engine.ts:727,839,841-842` — but the SDLC engine **recommends PostgreSQL** as an architecture choice, it doesn't connect to or query one. There is **zero PostgreSQL client code** in the repository. **PostgreSQL MCP would be essential for any database-querying workflows.**

---

## 10. SQLite MCP vs. Zenuxs Code

| Capability | SQLite MCP | Zenuxs Code | Delta |
|------------|-----------|-------------|-------|
| `query` | ✅ SQL execution | ✅ `loadSqliteDb` → `db.exec()` (sqlite-db.ts) | Zenuxs uses bun:sqlite |
| `list_tables` | ✅ Table listing | ✅ Via `db.exec("SELECT name FROM sqlite_master")` | Indirect but supported |
| `describe_table` | ✅ Schema | ✅ Via `PRAGMA table_info()` | Indirect |
| `get_schema` | ✅ Full schema | ✅ Via `sqlite_master` queries | Indirect |
| `execute_script` | ✅ Multi-statement | ✅ `db.exec()` supports multi-statement | Equivalent |

**Verdict:** Zenuxs Code has **full SQLite support** via `loadSqliteDb` (shared/src/db/sqlite-db.ts) using `bun:sqlite` or Node.js built-in `node:sqlite`. It's used in production for `SqliteSessionStore`, `SqliteCronStore`, and `SqliteTeamStore`. **SQLite MCP would add structured MCP tool access to an already-capable SQLite infrastructure.**

---

## 11. Tree-sitter MCP vs. Zenuxs Code

| Capability | Tree-sitter MCP | Zenuxs Code | Delta |
|------------|----------------|-------------|-------|
| `parse_file` | ✅ AST parsing | ❌ | Missing |
| `get_symbols` | ✅ Symbol extraction | ✅ `searchWithSemantic` (semantic-search.ts:296) — TS/JS only | Tree-sitter supports 40+ languages |
| `query_ast` | ✅ AST pattern matching | ❌ | Missing |
| `get_syntax_tree` | ✅ Full syntax tree | ❌ | Missing |
| `highlight` | ✅ Syntax highlighting | ❌ | Missing |
| `get_document_symbols` | ✅ Document symbols | ✅ Partial via `extractSymbols` (semantic-search.ts:98-194) | No hierarchy/completion |

**Verdict:** Zenuxs Code's `searchWithSemantic` (semantic-search.ts) uses the **TypeScript compiler API** (`typescript` package) for AST parsing — this is limited to `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs` files only. Tree-sitter MCP would provide **multi-language AST analysis** (40+ languages) with precise code understanding. **Tree-sitter MCP would provide the most value of any MCP on this list.**

---

## 12. Static Analysis MCP vs. Zenuxs Code

| Capability | Static Analysis MCP | Zenuxs Code | Delta |
|------------|-------------------|-------------|-------|
| `analyze_file` | ✅ Static analysis | ❌ | Missing |
| `analyze_project` | ✅ Project analysis | ❌ | Missing |
| `check_security` | ✅ Security scanning | ❌ | Missing — uses shell (npm audit, etc.) |
| `check_style` | ✅ Style checking | ❌ | Missing — uses shell (eslint, prettier) |
| `check_complexity` | ✅ Cyclomatic complexity | ❌ | Missing |
| `find_duplications` | ✅ Duplicate detection | ❌ | Missing |

**Verdict:** Zenuxs Code has **no dedicated static analysis engine**. It relies on `run_commands` (shell) to call linters (eslint), formatters (prettier), and security scanners (npm audit). **Static Analysis MCP would provide integrated, structured analysis results without shell dependence.**

---

## 13. Obsidian MCP vs. Zenuxs Code

| Capability | Obsidian MCP | Zenuxs Code | Delta |
|------------|-------------|-------------|-------|
| `read_note` | ✅ Vault note reading | ❌ | Missing |
| `write_note` | ✅ Vault note writing | ❌ | Missing |
| `search_notes` | ✅ Vault search | ❌ | Missing |
| `list_notes` | ✅ Note listing | ❌ | Missing |
| `get_tags` | ✅ Tag extraction | ❌ | Missing |
| `get_backlinks` | ✅ Backlink retrieval | ❌ | Missing |
| `create_note` | ✅ Note creation | ❌ | Missing |
| `delete_note` | ✅ Note deletion | ❌ | Missing |

**Verdict:** Zenuxs Code has **zero Obsidian-specific code**. The global search tool returned [no results for "obsidian"](file://search:obsidian:packages/agents). **Obsidian MCP would be necessary for any Obsidian vault interaction.**

---

## 14. Kubernetes MCP vs. Zenuxs Code

| Capability | Kubernetes MCP | Zenuxs Code | Delta |
|------------|---------------|-------------|-------|
| `get_pods` | ✅ Pod listing | ❌ | Missing — uses `run_commands` (kubectl) |
| `get_deployments` | ✅ Deployment listing | ❌ | Missing — uses `run_commands` |
| `get_services` | ✅ Service listing | ❌ | Missing — uses `run_commands` |
| `get_namespaces` | ✅ Namespace listing | ❌ | Missing — uses `run_commands` |
| `apply_manifest` | ✅ Manifest apply | ❌ | Missing — uses `run_commands` |
| `delete_resource` | ✅ Resource deletion | ❌ | Missing — uses `run_commands` |
| `get_logs` | ✅ Pod logs | ❌ | Missing — uses `run_commands` |
| `describe_resource` | ✅ Resource details | ❌ | Missing — uses `run_commands` |
| `exec_in_pod` | ✅ Pod execution | ❌ | Missing — uses `run_commands` |
| `get_cluster_info` | ✅ Cluster info | ❌ | Missing — uses `run_commands` |

**Verdict:** Kubernetes is mentioned in `intent-router.ts:108` and `sdlc-engine.ts:728,896` as a deployment technology. Both recognize Kubernetes but **neither provides a programmatic K8s API**. **Kubernetes MCP would provide structured cluster operations without raw kubectl.**

---

## Summary Table

| MCP Server | Zenuxs Equivalent | Gap | Recommendation |
|------------|-------------------|-----|---------------|
| Filesystem | Full (superior) | None | ❌ Skip |
| Git | Partial (status, diff, commit) | 12 missing operations | ⚠️ Optional |
| Serena | Basic AST search only | Full code intelligence | ✅ High value |
| Context7 | None | Documentation retrieval | ⚠️ Nice-to-have |
| Playwright | None (web_fetch only) | Full browser automation | ✅ High value |
| Docker | None (shell only) | Structured container mgmt | ⚠️ Optional |
| Fetch | Full (equivalent) | None | ❌ Skip |
| MCP Inspector | Full (internal) | N/A (different purpose) | ❌ Skip |
| PostgreSQL | None | Database operations | ✅ Project-dependent |
| SQLite | Full (sqlite-db.ts) | None (internal) | ❌ Skip |
| Tree-sitter | Partial (TS/JS only) | Multi-language AST | ✅ High value |
| Static Analysis | None (shell only) | Integrated analysis | ⚠️ Optional |
| Obsidian | None | Vault access | ⚠️ Use-case specific |
| Kubernetes | None (shell only) | Cluster management | ⚠️ Optional |
