# MCP Duplicate Analysis — Internal Code vs. MCP Server Overlap

> **Goal:** Identify where Zenuxs Code's built-in tooling already duplicates an MCP server's capabilities, and where the MCP would add genuine new value.

---

## Filesystem MCP — HIGH DUPLICATE

### What Zenuxs Code already has

| File | Component | What it does |
|------|-----------|-------------|
| `definitions.ts:215` | `read_files` | Read files with line ranges, image detection |
| `definitions.ts:88` | `write_file` | Write file contents |
| `definitions.ts:681` | `editor` | str_replace, insert, edit, write full file |
| `definitions.ts:163` | `list_directory` | List directory contents |
| `definitions.ts:632` | `apply_patch` | Apply unified diff patches |
| `file-read.ts` | `FileReadExecutor` | Full file reading with line numbers, streams, images |
| `editor.ts` | `EditorExecutor` | create, edit, replace, insert, backup |
| `directory-list.ts` | — | Directory listing |
| `safety.ts` | `assertPathSafe` | Path traversal protection |
| `path-analyzer.ts` | `PathAnalyzerService` | Path resolution and analysis |

### What the MCP adds

- `rename` — ded. to shell (`mv`)
- `move_file` — ded. to shell (`mv`)
- `get_file_info` — ded. to shell (`stat`)
- `directory_tree` — ded. to shell (`tree` or `ls -R`)
- `create_directory` — ded. to shell (`mkdir`)

### Verdict

**100% overlap.** Every Filesystem MCP capability is either built as a native tool or trivially available through `run_commands`. Adding Filesystem MCP would add process overhead with zero new capabilities.

---

## Git MCP — LOW DUPLICATE

### What Zenuxs Code already has

| File | Component | What it does |
|------|-----------|-------------|
| `definitions.ts:380` | `git_status` | Run `git status` |
| `definitions.ts:384` | `git_diff` | Run `git diff` |
| `git-helper.ts` | `GitHelper` | `getStatus()`, `getDiff()`, `safeCommit()`, `safeBranch()`, `safeRollback()` |
| `definitions.ts:468` | `run_commands` | Generic shell execution for all git ops |

### What the MCP adds

12 structured git operations (log, show, branch, checkout, add, reset, blame, stash, remote, push, pull, merge) that Zenuxs currently handles via raw shell.

### Verdict

**Low overlap.** Zenuxs Code has only 3 dedicated git operations. A Git MCP would provide structured, validated git operations with proper error handling instead of raw shell commands.

---

## Serena MCP — LOW DUPLICATE

### What Zenuxs Code already has

| File | Component | What it does |
|------|-----------|-------------|
| `semantic-search.ts` | `searchWithSemantic()` | AST-based symbol extraction for TS/JS only |
| `semantic-search.ts:98-194` | `extractSymbols()` | Extract functions, classes, interfaces, types, enums, variables, imports, exports |
| `search.ts` | `createSearchExecutor()` | 3-tier fallback chain: semantic → ripgrep → regex |

### What the MCP adds

- Cross-file reference finding
- Call graph generation
- File outline
- Rename refactoring
- Hover documentation
- Code completions
- Diagnostics
- Go-to-definition navigation
- Multi-language support (all tree-sitter grammars)

### Verdict

**Low overlap.** Zenuxs Code's `searchWithSemantic` provides only declaration-level symbol lookup for TS/JS. Serena provides full code intelligence across all languages. Significant gap.

---

## Context7 MCP — NO DUPLICATE

### What Zenuxs Code already has

| File | Component | What it does |
|------|-----------|-------------|
| `web-fetch.ts` | `WebFetchExecutor` | HTTP page fetching |
| `workspace-indexer.ts` | `WorkspaceIndexer` | Local workspace file indexing |

### What the MCP adds

Documentation lookup from external sources, cross-doc search, task-specific context, API reference lookup.

### Verdict

**Zero overlap.** `web_fetch` can fetch arbitrary URLs but has no understanding of documentation structure. `WorkspaceIndexer` indexes local files only. Context7 is entirely additive.

---

## Playwright MCP — NO DUPLICATE

### What Zenuxs Code already has

| File | Component | What it does |
|------|-----------|-------------|
| `web-fetch.ts` | `WebFetchExecutor` | HTTP-level page fetching, HTML-to-text |

### What the MCP adds

Full browser automation: navigation, clicks, form filling, screenshots, JavaScript execution, DOM querying, cookie management, viewport control.

### Verdict

**Zero overlap.** `web_fetch` is HTTP-level GET requests with HTML-to-text conversion. It cannot execute JavaScript, render pages, or interact with DOM. Playwright is entirely additive.

---

## Docker MCP — LOW DUPLICATE

### What Zenuxs Code already has

| File | Component | What it does |
|------|-----------|-------------|
| `definitions.ts:468` | `run_commands` | Shell execution for `docker` CLI commands |
| `intent-router.ts:107` | Docker intent regex | Recognizes Docker-related requests |
| `sdlc-engine.ts:728` | Docker tech mention | Recommends Docker for deployment |

### What the MCP adds

Structured Docker API: list/start/stop containers, pull/build images, exec in containers, view logs, manage networks/volumes.

### Verdict

**Low overlap.** Zenuxs requires raw shell commands for all Docker operations. Docker MCP would provide structured API access.

---

## Fetch MCP — FULL DUPLICATE

### What Zenuxs Code already has

| File | Component | What it does |
|------|-----------|-------------|
| `definitions.ts:247` | `web_fetch` | Web content fetching |
| `web-fetch.ts` | `WebFetchExecutor` | Full HTTP client with HTML-to-text, JSON, redirects, timeouts |

### What the MCP adds

- `fetch_urls` (batch) — not in Zenuxs

### Verdict

**95% overlap.** Only batch URL fetching is missing. Adding a `multi_read` variant to `web_fetch` would be simpler than integrating an entire MCP server.

---

## MCP Inspector — PARTIALLY DUPLICATE

### What Zenuxs Code already has

| File | Component | What it does |
|------|-----------|-------------|
| `manager.ts` | `InMemoryMcpManager` | Server registration, lifecycle |
| `client.ts` | `SdkMcpClient` | MCP client implementation |
| `mcpClient.ts` | `McpLayer` | Tool execution, connection management |
| `toolRegistry.ts` | `ToolRegistry` | Tool discovery and listing |
| `healthMonitor.ts` | `HealthMonitor` | Server health monitoring |
| `capabilityRegistry.ts` | `CapabilityRegistry` | Capability discovery |

### What the MCP adds

- Web-based debug UI
- Interactive tool testing
- Log inspection

### Verdict

**MCP Inspector is a different tool class** — it's a development/debugging UI, not a runtime component. Zenuxs Code has all the programmatic MCP infrastructure needed. No duplication concern.

---

## PostgreSQL MCP — NO DUPLICATE

### What Zenuxs Code already has

| File | Component | What it does |
|------|-----------|-------------|
| `intent-router.ts:99` | PostgreSQL intent regex | Recognizes PostgreSQL in user requests |
| `sdlc-engine.ts:839-842` | PostgreSQL recommendation | Recommends PostgreSQL as architecture choice |
| — | — | **No PostgreSQL client code exists** |

### What the MCP adds

Full PostgreSQL database operations: SQL queries, schema inspection, table management, transactions.

### Verdict

**Zero overlap.** PostgreSQL is mentioned as an architecture recommendation but there is zero database driver code in the repository. Entirely additive.

---

## SQLite MCP — HIGH DUPLICATE

### What Zenuxs Code already has

| File | Component | What it does |
|------|-----------|-------------|
| `sqlite-db.ts` | `loadSqliteDb()` | Creates SQLite connection using `bun:sqlite` or `node:sqlite` |
| `sqlite-session-store.ts` | `SqliteSessionStore` | Session persistence |
| `sqlite-team-store.ts` | `SqliteTeamStore` | Team data persistence |
| `sqlite-cron-store.ts` | `SqliteCronStore` | Cron job scheduling |

### What the MCP adds

- MCP protocol wrapper around SQLite operations
- Structured `query`, `list_tables`, `describe_table` tool interfaces

### Verdict

**100% overlap.** Zenuxs Code has full SQLite support used in production across four stores. SQLite MCP would wrap Zenuxs's own SQLite infrastructure in an MCP protocol — adding complexity without new capabilities.

---

## Tree-sitter MCP — LOW DUPLICATE

### What Zenuxs Code already has

| File | Component | What it does |
|------|-----------|-------------|
| `semantic-search.ts:46-53` | `AST_EXTENSIONS` | TS/JS only (`ts`, `tsx`, `js`, `jsx`, `mjs`, `cjs`) |
| `semantic-search.ts:98-194` | `extractSymbols()` | Declaration extraction using TypeScript compiler API |
| `semantic-search.ts:296-354` | `searchWithSemantic()` | Symbol search fallback chain |

### What the MCP adds

- Multi-language AST parsing (40+ languages via tree-sitter grammars)
- AST pattern matching queries
- Full syntax tree retrieval
- Syntax highlighting
- Precise code structure analysis beyond symbols

### Verdict

**Low overlap.** Zenuxs Code's AST parsing is entirely TypeScript compiler API — limited to 6 file extensions. Tree-sitter would add 40+ language grammars. The extraction logic `extractSymbols` (semantic-search.ts:98-194) only finds top-level declarations and wouldn't need to be replaced if tree-sitter is added — they could coexist.

---

## Static Analysis MCP — NO DUPLICATE

### What Zenuxs Code already has

| File | Component | What it does |
|------|-----------|-------------|
| `definitions.ts:468` | `run_commands` | Shell execution for `eslint`, `prettier`, `npm audit` |
| `sdlc-engine.ts` | SDLC phases | Validation phase mentions lint/typecheck/test |
| — | — | **No static analysis engine** |

### What the MCP adds

Integrated static analysis: security scanning, style checking, complexity analysis, duplication detection.

### Verdict

**Zero overlap.** Zenuxs Code has no static analysis engine. It shells out to external tools. Static Analysis MCP is entirely additive.

---

## Obsidian MCP — NO DUPLICATE

### What Zenuxs Code already has

- **Nothing.** Zero lines of Obsidian-related code exist in the repository.

### Verdict

**Zero overlap.** Entirely additive.

---

## Kubernetes MCP — LOW DUPLICATE

### What Zenuxs Code already has

| File | Component | What it does |
|------|-----------|-------------|
| `definitions.ts:468` | `run_commands` | Shell execution for `kubectl` CLI commands |
| `intent-router.ts:108` | Kubernetes intent regex | Recognizes K8s in user requests |
| `sdlc-engine.ts:728,896` | Kubernetes tech mention | Recommends K8s for deployment |

### What the MCP adds

Structured Kubernetes operations: pod/deployment/service management, logging, exec, cluster info.

### Verdict

**Low overlap.** Zenuxs requires raw shell for all K8s operations. K8s MCP would provide structured API access.

---

## Duplicate Summary

| MCP Server | Duplicate Level | Native Coverage |
|------------|----------------|-----------------|
| Filesystem MCP | **HIGH** (100%) | Full native tools + shell fallback |
| Fetch MCP | **HIGH** (95%) | Full HTTP client, HTML-to-text, JSON |
| SQLite MCP | **HIGH** (100%) | Full internal SQLite infrastructure |
| MCP Inspector | PARTIAL | Internal MCP infra but no debug UI |
| Git MCP | LOW (3/15 ops) | Status, diff, safeCommit only |
| Serena MCP | LOW (TS/JS only) | Basic AST symbol extraction |
| Docker MCP | LOW (shell only) | No Docker SDK |
| Kubernetes MCP | LOW (shell only) | No K8s SDK |
| Context7 MCP | **NONE** | No doc retrieval |
| Playwright MCP | **NONE** | No browser automation |
| PostgreSQL MCP | **NONE** | No PG client code |
| Static Analysis MCP | **NONE** | No analysis engine |
| Obsidian MCP | **NONE** | No Obsidian code |
| Tree-sitter MCP | LOW (TS/JS only) | TypeScript compiler API only |

**Key Insight:** 3 MCP servers (Filesystem, Fetch, SQLite) are already fully duplicated by Zenuxs Code's internal tooling. 11 MCP servers would add genuinely new capabilities.
