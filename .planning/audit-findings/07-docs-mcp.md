# Audit: docs/ and mcp/ Directories
**Date**: 2026-06-26
**Scope**: `docs/`, `mcp/`, `README.md`, `.zenuxs-user-config.json`, `.env.example`

---

## docs/ Directory — File-by-File Audit

There are 6 files in `docs/` (total ~133 KB across all files). One file (PORTING-NOTES.md) is 133 KB alone — a full AI chat transcript.

---

### 1. BRANDING-AUDIT.md (34 lines)

**Purpose**: Catalogues the branding rename from "Cline" to "Zenuxs" across the codebase. Divides items into three categories:
- **Category A (Safe Branding)**: User-facing strings and documentation that have been renamed (documents, CLI help, UI messages, provider display names, robot animation).
- **Category B (Internal Identifiers — Retained)**: Items that must NOT be renamed because they would break functionality: `@cline/*` package scopes, file/directory names containing "cline", provider IDs (`"cline"`, `"cline-pass"`), `CLINE_*` env vars, HTTP headers, OAuth client_name, error class names, CLI binary name.
- **Category C (Internal Legacy References)**: ~31 lines of comments/TODOs/test-only strings referencing "Cline" — harmless, may be cleaned up opportunistically.

**Current and accurate?**: YES. It accurately reflects the current state of branding in the codebase. The `@cline/*` scope is still in use, env vars still use `CLINE_` prefix, and files like `cline-account.ts`, `ClineCore.ts`, etc. still exist.

**Stale "Cline" references?**: N/A — the document's purpose IS to document the remaining Cline references. It contains the word "Cline" ~40 times because it is describing what does and does not still use that name.

**Key content**: The branding is a **superficial rename** (user-facing strings) with **deep internal inertia** (package scopes, env vars, class names, file paths all still say "Cline"). This means the product looks like "Zenuxs" to users but internally is still firmly "Cline" in many places.

---

### 2. COMPARISON-REPORT.md (226 lines)

**Purpose**: Detailed technical comparison between OpenCode (the upstream project) and Zenuxs-Code (this fork). Generated 2026-06-24. Covers architecture, features, migration status, ratings, risks, and recommendations.

**Current and accurate?**: MOSTLY. The architecture descriptions match the current codebase. However:
- It states "Zenuxs-Code is library-only" (no CLI) — this is **stale/incorrect**. The codebase now has a full `apps/cli/` with 16+ commands.
- It claims Zenuxs-Code has "no CI/CD" — still accurate as of the audit.
- The `@cline/*` scope references are still accurate.
- The comparison tables correctly capture the feature gaps.

**Stale "Cline" references?**: YES — it mentions `@cline/*` ~15 times (factually accurate), `ClineEnvironment`, `CLINE_API_BASE_URL`, etc. These are describing the current state, not stale content per se.

**Key content**: Zenuxs-Code is a fork of OpenCode (v1.17.9) that diverged by:
- Switching from Effect-TS to traditional OOP/async
- Switching from `bun test` to Vitest
- Removing the full product stack (no CLI, TUI, Web, Desktop, SDK initially)
- Keeping core engine + MCP + plugin system + tool system
- Adding a unique cron scheduler
- Currently rated 5.5/10 vs OpenCode's 7.3/10 in the comparison

---

### 3. KEYMAP-SPECIFICATION.md (283 lines)

**Purpose**: Design proposal/specification for a terminal keyboard mapping system for Zenuxs. Version 1.0.0, status "Proposal". Defines a modal paradigm (Command Mode / Insert Mode inspired by vim/LazyGit) with 18 sections covering global shortcuts, chat navigation, scrolling, text selection, command palette, session management, agent management, model/provider management, MCP management, tool approval, workspace explorer, multi-pane layout, history/checkpoints, AI runtime controls, kanban/dashboard, emergency controls, accessibility layer, and a final keymap table.

**Current and accurate?**: PARTIALLY. The document is a **design proposal**, not an implementation document. Many of the specified shortcuts do NOT match the actual implemented keyboard handlers in `apps/cli/src/tui/hooks/use-root-keyboard.ts` or `apps/cli/src/tui/hooks/use-model-selector.tsx`. For example:
- The spec lists `Ctrl+G` for help overlay, but the actual code uses `Ctrl+P` for command palette and `Meta/Option` combinations for other actions.
- The spec describes a full Kanban/dashboard/tool approval system, but the actual TUI is more limited.
- The document is aspirational, not a record of what is built.

**Stale "Cline" references?**: NO — zero mentions of "Cline" in this document (it is pure Zenuxs design).

**Key content**: Proposes 4 distinct UI contexts (Command Mode, Insert Mode, Visual Selection Mode, Approval Screen) with roughly 45+ keybindings. The design is comprehensive but only partially overlaps with what is actually coded. This document appears to have been generated as a design exercise rather than derived from source code inspection.

---

### 4. PORTING-NOTES.md (~132,862 bytes, ~3,459+ lines)

**Purpose**: Raw AI chat transcript from the conversation that performed the original Cline → Zenuxs port. Documents the step-by-step process of analyzing the Cline codebase (from `d:\V3\cline`), planning the migration, copying files, fixing builds, and creating documentation. This is a **historical record** of the porting effort.

**Current and accurate?**: NO — this is an archival/historical document, not current documentation. It describes the process of making the codebase work, not documented features. It references a sibling `d:\V3\cline` directory extensively. It was clearly generated automatically during the porting process by an AI agent.

**Stale "Cline" references?**: YES — EXTENSIVE. The entire document revolves around analyzing and porting from the original "Cline" codebase. "Cline" appears hundreds of times as it describes the original code being analyzed, directories being inspected (`d:\V3\cline\...`), decisions made, etc.

**Key content**: The transcript shows:
- Full analysis of the original Cline VS Code extension / CLI monorepo structure
- Decision to copy `sdk/packages/{shared,agents,llms,core}` and `apps/{cli,zenuxs-hub}` from Cline
- Renaming of `.cline` → `.zenuxs` in path resolution
- Fixing `bun link` / global binary registration
- Fixing vitest path resolution
- Resolving Commander.js argument parsing issues
- Creating end-user documentation
- Creating KEYMAP-SPECIFICATION.md as a design exercise
- Redesigning provider/model UX (separating `/connect` and `/models`)
- Multiple rounds of codebase auditing and documentation generation

The later portions (from ~line 2500+) show additional work on the provider/model redesign, but the document was truncated at 132 KB.

---

### 5. STRATEGIC-IMPROVEMENTS.md (609 lines)

**Purpose**: Strategic analysis of Zenuxs-Code's strengths, weaknesses, and improvement roadmap. Generated 2026-06-24. Evaluates what to preserve (passing tests, OOP/async, Vitest, cron scheduler, Windows support, Commander CLI, OpenTUI TUI) vs what to replace/ignore (Effect-TS, yargs CLI, SolidJS TUI, etc.). Provides 30-day and 90-day roadmaps.

**Current and accurate?**: YES. The analysis aligns with the current codebase state. The identified gaps (no CI/CD, branding remnants, no REST API, no SDK, no documentation site) are all accurate. The recommended actions are well-reasoned.

**Stale "Cline" references?**: YES — mentions `ClineCore`, `ClineEnvironment`, `ClineAccountService`, `@cline/*`, `CLINE_*` env vars, etc. These are used factually to describe current internal naming that needs renaming. The document itself is about Zenuxs strategy.

**Key content**: 
- Core thesis: Zenuxs-Code is NOT "OpenCode minus features" but a DIFFERENT product with real advantages (simpler code, passing tests, Windows support, cron scheduling, hub/daemon architecture).
- Highest-impact improvements: CI/CD pipeline (2-4 hrs), branding sweep (4-8 hrs), `--json` output enhancement, npm publishing under `@zenuxs/*`.
- Medium-term: REST API, Client SDK, Plugin SDK, documentation site.
- Strategic differentiation should focus on: simplicity, reliability, background operation (daemon + cron), Windows first-class, extensibility.
- Explicitly recommends AGAINST: Effect-TS migration, SolidJS TUI rebuild, SST cloud deployment, admin console, PTY abstraction, V2 event system, i18n, Electron desktop app.

---

### 6. VERIFIED-DOCUMENTATION.md (386 lines)

**Purpose**: Self-described "absolute single source of truth" for Zenuxs system documentation. Claims every command, shortcut, tool, provider, and setting has been verified against source code. Divided into 9 phases: source audit, command verification, shortcut verification, tool verification, provider verification, agent verification, MCP verification, feature matrix, and execution test audit.

**Current and accurate?**: MOSTLY YES. The document:
- Correctly identifies 16 CLI commands registered in `apps/cli/src/main.ts`
- Correctly identifies keyboard shortcuts from `use-root-keyboard.ts` and `command-palette-items.ts`
- Correctly identifies 9 base tools from `runtime.ts`
- Correctly identifies provider IDs from `ids.ts` and `builtins.ts`
- Documented actual execution tests (`zenuxs -V`, `--help`, `config --help`, etc.)

However, it references files at absolute paths (`d:\V3\zenuxs-code\...`) and references line numbers that may drift as the codebase evolves.

**Stale "Cline" references?**: MINIMAL — only mentions `"cline"` and `"cline-pass"` as provider IDs (which is factually correct — those provider IDs still exist in the source).

**Key content**: Comprehensive audit that maps:
- 16 CLI commands with line numbers
- ~20 keyboard shortcuts with source references
- 9 tool registrations
- 40+ provider IDs across 6 categories
- Agent runtime engine structure
- MCP configuration and loading process
- 19-item feature matrix with verification status

---

## mcp/ Directory

**Exists**: YES at `D:\V3\zenuxs-code\mcp\`

**Contents**: 12 **empty subdirectories** (no files in any of them):
| Directory | Purpose (inferred from name) |
|-----------|-------------------------------|
| `browser-use/` | Browser automation MCP server |
| `chrome-devtools/` | Chrome DevTools Protocol MCP server |
| `ci-cd/` | CI/CD pipeline MCP server |
| `context7/` | Context7 context provider MCP server |
| `docker/` | Docker MCP server |
| `exa-search/` | Exa search API MCP server |
| `filesystem/` | Filesystem operations MCP server |
| `github/` | GitHub API MCP server |
| `memory/` | Memory/knowledge graph MCP server |
| `playwright/` | Playwright browser automation MCP server |
| `sentry/` | Sentry error tracking MCP server |
| `terminal/` | Terminal execution MCP server |

**Relationship to main codebase**: These directories appear to be **placeholder/stub directories** intended for future MCP server configurations. They were all created at the same timestamp (2026-06-26 00:52:06), indicating a single batch creation. They have no `package.json`, no code, no configuration files.

The actual MCP implementation lives in the codebase:
- `packages/core/src/extensions/mcp/` — MCP client, transport, and tool registration
- `packages/agents/src/mcp/` — MCP client and tool registry for the agent runtime
- `packages/shared/src/storage/paths.ts` — resolves MCP settings path to `~/.zenuxs/data/settings/zenuxs_mcp_settings.json`
- `apps/cli/src/commands/mcp.ts` — CLI commands for MCP management (install/add)

**Assessment**: The `mcp/` directory at root level appears to be a **future container** for per-server MCP configuration packages or docker-compose files. Currently it is empty scaffolding. It has no relationship to the actual MCP client/tool runtime, which is fully implemented in the packages.

---

## Root-Level Files

### README.md
- **Path**: `D:\V3\zenuxs-code\README.md`
- **Size**: 40 bytes
- **Content**: Single line: `# Zenuxs-AI-Agent`
- **Assessment**: **Stub/placeholder only**. Not real documentation. The comprehensive documentation lives in `docs/VERIFIED-DOCUMENTATION.md` and the individual `docs/` files.

### .zenuxs-user-config.json
- **Path**: `D:\V3\zenuxs-code\.zenuxs-user-config.json`
- **Content**:
  - User ID: `user_zw_yJ0pkDG`
  - Two MCP server configurations:
    - `filesystem`: points to `D:\V3\zenuxs-code` via `mcp-server-filesystem`
    - `github`: points to GitHub API via `mcp-server-github` (GITHUB_TOKEN is empty)
- **Assessment**: A local user config for the developer's workstation. The filesystem MCP server is configured for this exact project directory. The GitHub MCP server has no token set, so it will fail to authenticate.

### .env.example
- **Path**: `D:\V3\zenuxs-code\.env.example`
- **Content**:
  ```env
  # ── LLM Provider ──
  LLM_API_KEY=sk-your-key-here
  OPENAI_API_KEY=sk-your-key-here
  ```
- **Assessment**: Minimal template. Only shows two placeholder API keys.

---

## Summary Matrix

| File | Purpose | Current/Accurate? | Stale "Cline" Refs? | Notes |
|------|---------|-------------------|---------------------|-------|
| `BRANDING-AUDIT.md` | Catalogues Cline→Zenuxs renames | YES | N/A (catalogues them) | Accurate record of branding state |
| `COMPARISON-REPORT.md` | OpenCode vs Zenuxs comparison | MOSTLY | YES (factual mentions) | Claims "no CLI" — stale since CLI exists now |
| `KEYMAP-SPECIFICATION.md` | Design proposal for keyboard mapping | PARTIAL | NO | Design doc, not implementation; many shortcuts differ from actual code |
| `PORTING-NOTES.md` | AI chat transcript of the porting process | NO (historical) | YES (extensive) | 132 KB archive; useful as historical record but not current docs |
| `STRATEGIC-IMPROVEMENTS.md` | Strategic analysis & roadmap | YES | YES (factual mentions) | Well-reasoned; roadmaps are aspirational but achievable |
| `VERIFIED-DOCUMENTATION.md` | Source-verified system documentation | MOSTLY | MINIMAL | Good reference; absolute paths may stale over time |
| `mcp/` (12 dirs) | MCP server configuration placeholders | N/A (empty) | NO | Empty stubs; actual MCP code is in packages/ |
| `README.md` | Root readme | NO | NO | 40-byte stub; needs full content |
| `.zenuxs-user-config.json` | Local dev config | N/A | NO | Local workstation config |
| `.env.example` | Env var template | N/A | NO | Minimal; only 2 vars |

---

## Key Findings

1. **The docs are AI-generated artifacts** — All docs files were created by an AI coding agent during the porting process, not written by a human maintainer. This means they are thorough but may include assumptions or errors.

2. **PORTING-NOTES.md is too large** — At 133 KB, it is the raw chat transcript. Consider splitting into multiple focused documents or truncating the historical portion.

3. **README.md is a placeholder** — The root README is just a title. New users/contributors learn nothing from it.

4. **mcp/ directories are empty scaffolding** — Twelve named directories but zero files. The actual MCP system is well-implemented in the packages.

5. **KEYMAP-SPECIFICATION.md is aspirational** — Many described shortcuts are not implemented in the actual TUI code. This could mislead contributors.

6. **VERIFIED-DOCUMENTATION.md is the best reference** — Most accurate and comprehensive single source for understanding the system.

7. **Stale Cline references are pervasive but documented** — The branding audit intentionally tracks them. The STRATEGIC-IMPROVEMENTS.md recommends a branding sweep as a high-priority improvement.
