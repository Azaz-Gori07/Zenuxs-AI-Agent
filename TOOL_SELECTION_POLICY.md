# INTELLIGENT TOOL SELECTION POLICY — ZENUXS CODE

> **Date:** 2026-07-23  
> **Module:** `packages/core/src/extensions/tools/tool-selection-policy.ts`  
> **Status:** Fully Integrated & Validated

---

## 1. Overview & Core Principles

The Intelligent Tool Selection Policy governs how `zenuxs-code` agents dynamically select between native tools, recommended MCP tools, and LLM reasoning.

### Principles:
1. **Never Forced**: Tool selection is context-aware and dynamic. The LLM is never forced to use an MCP server if a native tool or direct reasoning is better.
2. **Native Tool Priority**: Native tools (`read_files`, `write_file`, `editor`, `search_codebase`, `run_commands`) remain the default highest-priority choice for standard operations.
3. **Targeted MCP Boost (~60–70% Preference Bias)**: When user task intent explicitly calls for specialized capabilities (multi-language AST symbol references, visual browser automation, library API docs, structured git history), the router applies a ~60–70% preference boost to recommended MCP servers (`Serena`, `Playwright`, `Context7`, `Git`).

---

## 2. Selection Hierarchy & Weighting

```
Task Intent & Context
        │
        ▼
   Is User Intent Matching a Specialized MCP Domain?
     ├── YES ──► Recommended MCP Tool Boosted (Score: 1.25–1.40) ──► Selected MCP Tool
     └── NO  ──► Native Zenuxs Tool Default (Score: 1.00)       ──► Selected Native Tool
                 │
                 └── Fallback (Score: 0.40)                    ──► LLM Direct Reasoning
```

### Preference Weights:

| Tool Tier | Condition | Score Weight | Description |
| :--- | :--- | :---: | :--- |
| **Recommended MCP Tool** | Domain intent matches rule pattern | **1.25 – 1.40** | Override default native tools for specialized tasks (e.g. Serena for call graph, Playwright for visual click/screenshot). |
| **Native Zenuxs Tool** | Standard operation / General coding | **1.00** | Default high-priority selection for file operations, codebase search, and bash commands. |
| **Standard MCP Tool** | Non-boosted generic MCP tool | **0.40** | Used when no native equivalent exists. |
| **Direct Reasoning** | No tool appropriate | **0.00** | LLM responds using pre-trained knowledge. |

---

## 3. Domain Intent Routing Rules

The routing policy evaluates candidate tools against the following regex & domain rules:

```typescript
const MCP_PREFERENCE_RULES = [
  {
    mcpName: "serena",
    pattern: /\b(call graph|symbol reference|references to|rename symbol|hover doc|outline|go to def|type hierarchy)\b/i,
    nonTsPattern: /\.(py|rs|go|cpp|c|java|rb|php|swift|kt|cs)\b/i,
    boostScore: 1.25,
    domain: "Multi-Language AST & Code Intelligence",
  },
  {
    mcpName: "playwright",
    pattern: /\b(click|fill|screenshot|browser|dom|ui test|web page|render js|playwright|scrape spa)\b/i,
    boostScore: 1.25,
    domain: "Browser Automation & Visual Verification",
  },
  {
    mcpName: "context7",
    pattern: /\b(docs for|documentation|api reference|library docs|lookup api|framework docs)\b/i,
    boostScore: 1.25,
    domain: "External Library Documentation",
  },
  {
    mcpName: "git",
    pattern: /\b(git log|git blame|git branch|git history|git commit history|git checkout|git merge|git stash)\b/i,
    boostScore: 1.20,
    domain: "Structured Local Git Operations",
  },
];
```

---

## 4. Fallback Mechanism

If an MCP server fails to connect, times out, or encounters a runtime transport error:
1. `McpLayer` catches the failure and logs health degradation to `HealthMonitor`.
2. The router automatically falls back to **Native Zenuxs Tools** (`search_codebase`, `fetch_web_content`, `run_commands`).
3. Execution proceeds uninterrupted without halting agent execution.
