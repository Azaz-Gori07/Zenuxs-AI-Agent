# Top-Level Repository Topology

## Monorepo Structure
- **Root**: `@zenuxs/workspace` — Bun workspace monorepo
- **Workspaces**: `packages/*`, `apps/*`, `apps/zenuxs-hub/src/webview`
- **Package Manager**: Bun
- **Runtime**: Node >=22, Bun >=1.0.0
- **Language**: TypeScript, ESM only (`"type": "module"`)

## Package Dependency Graph
```
apps/cli (zenuxs v3.0.29) ─────────────────────────────────┐
  ├── deps: @zenuxs/zenuxs-hub (workspace)                  │
  ├── devDeps: @cline/core, @cline/shared                    │
  └── no direct dep on @cline/agents or @cline/llms          │
                                                              │
apps/zenuxs-hub (@zenuxs/zenuxs-hub v0.0.0) ────────────────┘
  ├── deps: @cline/core, @cline/llms, @cline/shared          │
                                                              │
packages/core (@cline/core v0.0.51) ─────────────────────────┤
  ├── deps: @cline/agents, @cline/shared, @cline/llms        │
  ├── Optional: posthog-node                                  │
  └── Telemetry: OpenTelemetry, PostHog                       │
                                                              │
packages/agents (@cline/agents v0.0.51) ─────────────────────┤
  ├── deps: @cline/llms, @cline/shared, MCP SDK              │
  └── Browser-safe agent runtime                              │
                                                              │
packages/llms (@cline/llms v0.0.51) ─────────────────────────┤
  ├── deps: @cline/shared, AI SDK providers, various vendor SDKs
  └── Provider implementations (Anthropic, OpenAI, Google, etc.)
                                                              │
packages/shared (@cline/shared v0.0.51) ────────────────────┘
  ├── deps: zod, jsonrepair, aws4fetch
  └── No internal deps (leaf package)
```

## Key Observations
1. Package names still use `@cline/` prefix despite project being named "zenuxs"
2. `@cline/core` re-exports most of `@cline/shared` and `@cline/llms` — serves as public API facade
3. `apps/cli` depends on `@zenuxs/zenuxs-hub` (note: `@zenuxs/`, not `@cline/`)
4. `apps/cli` only lists `@cline/core` and `@cline/shared` as devDependencies, not runtime dependencies
5. Root `package.json` has dependency on `nanoid` but it's also declared in individual packages
