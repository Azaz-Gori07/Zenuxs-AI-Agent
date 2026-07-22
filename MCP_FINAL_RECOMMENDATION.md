# Final Recommendation — MCP Servers for Zenuxs Code

> **Date:** 2026-07-23
> **Audience:** Engineering leads, architecture team
> **Based on:** Deep-dive audit of 14 MCP servers against Zenuxs Code repository (87 source files analyzed across 6 packages)

---

## Executive Summary

After analyzing 14 MCP servers against Zenuxs Code's built-in capabilities, **we recommend integrating 2 MCP servers immediately, evaluating 2 more, and skipping the remaining 10.**

### Quick Decision Table

| MCP Server | Recommendation | Rationale |
|------------|---------------|-----------|
| Filesystem | ❌ **Skip** | Fully duplicated |
| Git | ⚠️ **Evaluate** | 3 vs 15 operations — shell fallback works |
| Serena | ✅ **Integrate** | Major code intelligence gap |
| Context7 | ⚠️ **Evaluate** | Nice-to-have doc retrieval |
| Playwright | ✅ **Integrate** | Major browser automation gap |
| Docker | ❌ **Skip** | Shell fallback is sufficient |
| Fetch | ❌ **Skip** | Fully duplicated |
| MCP Inspector | ❌ **Skip** | Different tool class |
| PostgreSQL | ❌ **Skip** | Build native instead |
| SQLite | ❌ **Skip** | Fully duplicated |
| Tree-sitter | ❌ **Skip** | Build native or use Serena |
| Static Analysis | ❌ **Skip** | Shell fallback is sufficient |
| Obsidian | ❌ **Skip** | Niche use case |
| Kubernetes | ❌ **Skip** | Shell fallback is sufficient |

---

## Tier 1: Integrate Now

### 1. Playwright MCP — HIGHEST PRIORITY

**Why now:**
- Zenuxs Code has zero browser automation capability (`web_fetch` is HTTP-only)
- Enables UI testing, visual verification, SPA scraping, form automation
- Playwright MCP is mature, well-documented, and widely used
- Screenshot capability enables visual AI (model can "see" the page)

**Integration effort:**
- Add `@playwright/mcp` or `@modelcontextprotocol/server-playwright` to `opencode.json` built-in servers (`packages/core/src/extensions/mcp/types.ts`)
- Browser download is automatic via Playwright's install mechanism

**Files to modify:**
- `packages/core/src/extensions/mcp/types.ts` — Add Playwright to `BuiltInMcpServers`
- `packages/agents/src/mcp/capabilityRegistry.ts` — Register browser capabilities

### 2. Serena/Tree-sitter MCP — HIGH PRIORITY

**Why now:**
- Zenuxs Code's `searchWithSemantic` (semantic-search.ts:296) only supports 6 TypeScript/JavaScript file extensions
- For a multi-language code generation tool, this is a critical blind spot
- Serena provides call graphs, symbol references, and rename refactoring — all missing from Zenuxs
- Tree-sitter provides 40+ language grammars

**Recommendation:** Prefer Serena MCP over raw Tree-sitter MCP, as Serena includes tree-sitter parsing plus higher-level code intelligence (call graphs, references, rename).

**Integration effort:**
- Add Serena MCP server to built-in server definitions
- May need to configure Serena's workspace root to match Zenuxs's workspace

**Files to modify:**
- `packages/core/src/extensions/mcp/types.ts` — Add Serena to `BuiltInMcpServers`
- `packages/agents/src/mcp/toolRegistry.ts` — Register Serena's tools
- `packages/core/src/extensions/tools/executors/search.ts` — Optionally chain Serena before semantic search

---

## Tier 2: Evaluate

### 3. Context7 MCP

**Evaluate if:** Your team frequently needs up-to-date library documentation, API references, or framework-specific guidance during coding sessions.

**Why wait:**
- `web_fetch` can fetch documentation URLs manually
- The LLM's training data already includes most published documentation
- Value diminishes if the LLM model is large and recent

### 4. Git MCP

**Evaluate if:** You need structured git operations beyond status/diff/commit (e.g., merge, rebase, cherry-pick, stash management).

**Why wait:**
- Zenuxs's `git-helper.ts` provides `safeCommit` with pre-commit validation
- `run_commands` handles all other git operations
- Git MCP community implementations vary in quality

---

## Tier 3: Skip / Build Native

### 5. PostgreSQL MCP — Build Native Instead

**Do not integrate the MCP.** Instead, add PostgreSQL support natively:

```
packages/shared/src/db/
├── sqlite-db.ts        ← exists
├── postgres-db.ts      ← create this
└── index.ts            ← export both
```

**Rationale:**
- Zenuxs Code already has a database abstraction pattern (`SqliteDb` in `sqlite-db.ts`)
- Adding a `PostgresDb` class following the same pattern is simpler than integrating an MCP server
- SDLC engine already defaults to PostgreSQL (`sdlc-engine.ts:841-842`) — this inconsistency should be fixed by adding actual support
- `pg` (node-postgres) is a mature, well-known npm package

**Effort:** Low (2-3 days for implementation, similar to `SqliteDb`)

### 6. Filesystem, Fetch, SQLite MCPs — Skip (Fully Duplicated)

These three MCP servers provide zero new capabilities beyond what Zenuxs Code already has. Adding them would:
- Add ~20-40MB of process memory per MCP
- Increase startup latency
- Risk compatibility issues
- Add no new functionality

### 7. Docker, Kubernetes, Static Analysis MCPs — Skip for Now

Shell fallback (`run_commands`) is sufficient for these use cases. Re-evaluate if:
- Structured API output becomes necessary
- The shell-based approach causes reliability issues
- A specific user demand emerges

### 8. Obsidian MCP — Skip

Niche use case. Re-evaluate if Obsidian vault integration becomes a product requirement.

### 9. MCP Inspector — Skip

Developer tool, not a runtime component. Zenuxs Code already has full programmatic MCP infrastructure.

---

## Architecture Impact Assessment

### How MCP servers integrate with Zenuxs Code

```
User Request
    ↓
Intent Router (intent-router.ts)
    ↓
SDLC Engine (sdlc-engine.ts)
    ↓
Tool Layer
    ├── Built-in Tools (definitions.ts)
    │   ├── read_files, write_file, editor, ...
    │   ├── search_codebase (semantic → ripgrep → regex)
    │   ├── web_fetch
    │   ├── run_commands (bash)
    │   └── git_status, git_diff
    └── MCP Tools (via InMemoryMcpManager)
        ├── Playwright tools (navigate, click, screenshot...)
        ├── Serena tools (find_symbols, get_call_graph...)
        ├── [Context7 tools (get_documentation...)]
        └── [Git tools (git_log, git_push...)]
```

### Integration mechanism

Zenuxs Code already has the full MCP client infrastructure:

1. **`InMemoryMcpManager`** (manager.ts) — Manages MCP server lifecycle
2. **`SdkMcpClient`** (client.ts) — Protocol client using `@modelcontextprotocol/sdk`
3. **`McpLayer`** (mcpClient.ts) — Integration layer between MCP and agent
4. **`ToolRegistry`** (toolRegistry.ts) — Discovers and registers MCP tools
5. **`CapabilityRegistry`** (capabilityRegistry.ts) — Maps capabilities to MCP servers
6. **`ConnectionManager`** (connectionManager.ts) — Stdio/SSE transport management

Adding a new MCP server requires:
1. Adding the server definition to `types.ts` (`BuiltInMcpServers`)
2. Registering its capabilities in `capabilityRegistry.ts`
3. Merging its tools in `toolRegistry.ts`

### Configuration

MCP servers are configured via `opencode.json`:

```jsonc
// opencode.json (existing pattern from types.ts)
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp"],
      "env": {}
    },
    "serena": {
      "command": "npx",
      "args": ["@anthropic/serena-mcp"],
      "env": {}
    }
  }
}
```

---

## Summary

| Priority | MCP Server | Action | Effort | Impact |
|----------|-----------|--------|--------|--------|
| **P0** | Playwright | Integrate | Low (config) | **High** — browser automation |
| **P0** | Serena | Integrate | Low (config) | **High** — multi-language code intelligence |
| P1 | Context7 | Evaluate | Low (config) | Medium — doc retrieval |
| P1 | Git | Evaluate | Low (config) | Low — more structured git ops |
| P2 | PostgreSQL | **Build native** | Medium | Medium — database support |
| — | Filesystem | Skip | — | — |
| — | Fetch | Skip | — | — |
| — | SQLite | Skip | — | — |
| — | Docker | Skip | — | — |
| — | K8s | Skip | — | — |
| — | Static Analysis | Skip | — | — |
| — | Obsidian | Skip | — | — |
| — | MCP Inspector | Skip | — | — |
| — | Tree-sitter | Skip (use Serena) | — | — |

**Total MCP servers to integrate:** 2 (Playwright + Serena)
**Total MCP servers to evaluate:** 2 (Context7 + Git)
**Total to skip:** 10

### Key Insight

> Zenuxs Code already covers **3 of 14** MCP servers natively (Filesystem, Fetch, SQLite). Adding MCP wrappers around already-working native tooling would add complexity without value. The real gains come from the **2 high-impact MCPs** that fill genuine capability gaps: **Playwright** (browser automation) and **Serena** (code intelligence).
