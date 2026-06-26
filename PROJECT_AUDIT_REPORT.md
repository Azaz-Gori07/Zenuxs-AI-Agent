# Project Audit Report: Zenuxs AI Agent

**Date**: 2026-06-26
**Repository**: D:\V3\zenuxs-code
**Package Manager**: Bun
**Language**: TypeScript (ESM)
**Root Package**: `@zenuxs/workspace`

---

## Table of Contents

1. [Repository Topology](#1-repository-topology)
2. [Architecture Overview](#2-architecture-overview)
3. [Package-by-Package Findings](#3-package-by-package-findings)
   - 3.1 [packages/shared](#31-packagesshared-clineshared-v0051)
   - 3.2 [packages/agents](#32-packagesagents-clineagents-v0051)
   - 3.3 [packages/core](#33-packagescore-clinecore-v0051)
   - 3.4 [packages/llms](#34-packagesllms-clinellms-v0051)
   - 3.5 [apps/cli](#35-appscli-zenuxs-v3029)
   - 3.6 [apps/zenuxs-hub](#36-appszenuxs-hub-zenuxszenuxs-hub-v000)
   - 3.7 [docs/ and mcp/](#37-docs-and-mcp)
4. [Dependency Graph](#4-dependency-graph)
5. [Feature Map](#5-feature-map)
6. [Tool Registry](#6-tool-registry)
7. [Runtime Workflow](#7-runtime-workflow)
8. [Loop Prevention Architecture](#8-loop-prevention-architecture)
9. [Branding Migration Status](#9-branding-migration-status)
10. [Critical Issues](#10-critical-issues)
11. [Recommendations](#11-recommendations)

---

## 1. Repository Topology

```
zenuxs-code/
├── package.json              # @zenuxs/workspace (Bun workspace root)
├── apps/
│   ├── cli/                  # zenuxs v3.0.29 — CLI application (user-facing)
│   └── zenuxs-hub/           # @zenuxs/zenuxs-hub v0.0.0 — Dashboard server + webview
├── packages/
│   ├── shared/               # @cline/shared v0.0.51 — Leaf: types, utils, schemas
│   ├── agents/               # @cline/agents v0.0.51 — Agent runtime loop
│   ├── core/                 # @cline/core v0.0.51 — Core SDK, orchestrator, services
│   └── llms/                 # @cline/llms v0.0.51 — Provider registry, gateway, catalog
├── docs/                     # AI-generated audit/planning documents
├── mcp/                      # Empty scaffolding (12 empty subdirectories)
└── .planning/                # Task state and audit findings
```

### Workspace Configuration
| Property | Value |
|----------|-------|
| Workspaces | `packages/*`, `apps/*`, `apps/zenuxs-hub/src/webview` |
| Engine | `node >=22`, `bun >=1.0.0` |
| Module system | ESM (`"type": "module"`) |
| Build tool | Bun (`bun build`) + `tsc` for type checks |
| Test framework | Vitest v4 |
| Root deps | `nanoid`, `@types/node`, `typescript`, `vitest` |

### Package Size Comparison

| Package | Source files | Test files | Approx LOC | Key deps |
|---------|-------------|------------|------------|----------|
| shared | ~90 | 21 | ~8,000 | zod, jsonrepair, aws4fetch |
| agents | ~25 | 4 | ~5,800 | @cline/llms, @cline/shared, MCP SDK |
| core | 269 | 119 | ~40,000 | @cline/agents, @cline/shared, @cline/llms, OTel |
| llms | ~80 | 30 | ~35,000 | AI SDK packages, vendor SDKs |
| cli | ~150 | ~60 | ~30,000 | @zenuxs/zenuxs-hub, OpenTUI, Commander |
| hub | ~40 | 4 | ~5,000 | @cline/core, @cline/llms, @cline/shared |

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        apps/cli                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐  │
│  │ TUI      │  │ ACP      │  │Commands  │  │ Connectors   │  │
│  │(OpenTUI) │  │(IDE int) │  │(16 cmds) │  │(Discord,etc) │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬──────┘  │
│       └──────────────┴─────────────┴───────────────┘         │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                     apps/zenuxs-hub                           │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ HTTP/WS    │  │ Hub Context  │  │ Webview SPA (React)  │  │
│  │ Server     │  │(state/peers) │  │ (shadcn/ui + Vite)   │  │
│  └─────┬──────┘  └──────┬───────┘  └──────────────────────┘  │
│        └────────────────┘                                     │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                     packages/core                             │
│  ┌────────┐ ┌──────────┐ ┌────────┐ ┌──────┐ ┌───────────┐  │
│  │Zenuxs  │ │ Session  │ │Runtime │ │Safety│ │Services   │  │
│  │Core    │ │Orchestr. │ │Builder │ │Loop  │ │(Telemetry, │  │
│  │(entry) │ │          │ │        │ │Detect│ │ Storage)   │  │
│  └───┬────┘ └────┬─────┘ └───┬────┘ └──┬───┘ └─────┬─────┘  │
│      └───────────┴───────────┴─────────┴────────────┘        │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    packages/agents                            │
│  ┌─────────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ AgentRuntime    │  │ agent-graph  │  │ MCP modules  │   │
│  │ (LIVE)          │  │ (DEAD)       │  │ (DEAD)       │   │
│  └─────────────────┘  └──────────────┘  └──────────────┘   │
└──────────┬──────────────────────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────────┐
│                    packages/llms                              │
│  ┌─────────┐ ┌────────┐ ┌──────────┐ ┌────┐ ┌───────────┐  │
│  │Gateway  │ │Catalog │ │Providers │ │AI  │ │Routing    │  │
│  │(stream) │ │(models)│ │(12 fam.) │ │SDK │ │(18 rules) │  │
│  └─────────┘ └────────┘ └──────────┘ └────┘ └───────────┘  │
└──────────┬──────────────────────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────────┐
│                   packages/shared                             │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌───────┐   │
│  │Types │ │Tools │ │Prompts│ │Parse │ │Hooks │ │Remote │   │
│  │      │ │      │ │      │ │      │ │      │ │Config │   │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └───────┘   │
└────────────────────────────────────────────────────────────┘
```

### Package Dependency Flow
```
shared (leaf, no internal deps)
  ├── llms (depends on shared)
  ├── agents (depends on shared + llms)
  ├── core (depends on shared + llms + agents)
  │   ├── zenuxs-hub (depends on core + llms + shared)
  │   └── cli (depends on core + shared, devDep only on core + shared)
```

---

## 3. Package-by-Package Findings

### 3.1 packages/shared (`@cline/shared` v0.0.51)

**Role**: Leaf package — shared types, utilities, schemas, and configuration used by all other packages.

#### Stale Cline Naming (HIGH)
| File | Issue |
|------|-------|
| `src/remote-config/schema.ts:117` | Schema key `Cline: ZenuxsSettingsSchema` — wire format still `Cline` |
| `src/remote-config/schema.test.ts:4` | **Compile error**: imports `ClineSettingsSchema` which no longer exists (renamed to `ZenuxsSettingsSchema`) |
| `src/runtime/build-env.test.ts:77,109` | **Runtime error**: references undefined `CLINE_BUILD_ENV_ENV` (should be `ZENUXS_BUILD_ENV_ENV`) |
| `src/llms/requests.ts:1-6` | API headers: `X-Title: Cline`, `https://cline.bot`, `X-CLIENT-TYPE: cline-sdk` |
| `src/feature-flags.ts:3` | Flag name `CLINE_PASS` |
| `src/hub.ts:373` | Command `cline.account.get_current` |
| `src/providers/utils.ts:2` | `isZenuxsProvider()` matches `"cline"` and `"cline-pass"` |
| `src/storage/paths.ts` | Dual `CLINE_*` / `ZENUXS_*` env var fallbacks — Cline versions preferred |
| `src/vcr.ts` | `CLINE_VCR` env vars |
| `package.json` | Name `@cline/shared`, URL `github.com/cline/cline` |

#### maxIterations Inconsistency (HIGH)
- `src/agent.ts:479` — `AgentRuntimeConfig.maxIterations: number` **REQUIRED**
- `src/agents/types.ts:704` — `AgentConfig.maxIterations?: number` **OPTIONAL**
- Two agent config interfaces must be aligned

#### DEFAULT_MAX_ITERATIONS
- Declared at `src/agent.ts:9` with value `50`
- Not imported anywhere within shared — consumed externally by `@cline/core`

#### Export Gaps
- `automation/`, `db/`, `storage/` accessible only via subpath exports (`@cline/shared/automation`, etc.), not from main barrel

#### Test Status
- 21 test files, vitest config present
- **Critical**: 2 tests fail to compile/run (schema.test.ts, build-env.test.ts)

---

### 3.2 packages/agents (`@cline/agents` v0.0.51)

**Role**: Browser-safe agent runtime loop. **~65% of source code is dead/unreachable.**

#### Dead Code (HIGH — ~2,450 lines unreachable)

| Module | Lines | Status | Reason |
|--------|-------|--------|--------|
| `src/agent-graph.ts` | 984 | **DEAD** | Zero imports in monorepo; imports missing `@langchain/langgraph` dep |
| `src/reasoning/selfCritique.ts` | 153 | **DEAD** | Only imported by dead agent-graph.ts |
| `src/subagents/` (3 files) | 304 | **DEAD** | Only imported by dead agent-graph.ts |
| `src/mcp/` (~10 modules) | ~1,920 | **PARTIALLY DEAD** | Only `McpServerConfig` type imported by agent-runtime.ts; no runtime usage |

#### Live Code: `src/agent-runtime.ts` (~1,626 lines)
- Standalone agent loop (no LangGraph dependency)
- 14 event types, 8 lifecycle hooks
- Public API: `run()`, `continue()`, `abort()`, `subscribe()`, `restore()`, `snapshot()`
- Exported via `index.ts` as `AgentRuntime`, `Agent` (alias), `createAgentRuntime`, `createAgent`

#### Test Status
| File | Lines | Status |
|------|-------|--------|
| `agent-runtime.test.ts` | 1,535 | Live — comprehensive coverage |
| `agent-runtime.provider-form.test.ts` | 237 | Live |
| `integrations.test.ts` | 74 | Tests dead code |
| `mcp-layer.test.ts` | 451 | Tests dead code |

---

### 3.3 packages/core (`@cline/core` v0.0.51)

**Role**: Core SDK — session orchestration, runtime builder, safety systems, services, and integrations. The largest and most active package.

#### Loop Prevention Systems

**Two systems coexist** — a legacy port and a new implementation:

| Feature | `LoopDetectionTracker` | `DoomLoopDetector` |
|---------|----------------------|-------------------|
| Location | `runtime/safety/loop-detection.ts` | `extensions/tools/registry.ts` |
| Thresholds | Soft: 3, Hard: 5 (configurable) | Hard-coded: 3 |
| Output | `"ok"` / `"soft"` / `"hard"` | Boolean |
| Input normalization | JSON key-sorted signature | `JSON.stringify(input)` |
| Used by | SessionRuntime (beforeTool hook) | ToolRegistry.isDoomLoop() |

**MistakeTracker** (`runtime/safety/mistake-tracker.ts`):
- Default limit: 6 consecutive mistakes
- Reasons: `api_error`, `invalid_tool_call`, `tool_execution_failed`
- On limit: appends stop message + aborts runtime
- Interaction: Hard loop verdict → `forceAtLimit: true` → MistakeTracker stop

#### Runtime Builder Flow
```
ZenuxsCore.start(input)
  → toZenuxsCoreStartInput(input)
  → prepare() (optional bootstrap)
  → host.startSession()
    → LocalRuntimeHost.startSession()
      → DefaultRuntimeBuilder.build(input)
        → BuiltRuntime (tools, hooks, team, policies)
      → SessionRuntime.run(prompt)
        → compose system prompt
        → create agent model
        → merge extension tools
        → create AgentRuntime
        → subscribe events (loop/mistake tracking)
        → AgentRuntime.run()
        → drain tracker work
        → build AgentResult
```

#### Tool Definitions
- **9 default tools**: read_files, search_codebase, run_commands, fetch_web_content, apply_patch, editor, skills, ask_question, submit_and_exit
- **18 team tools**: spawn/shutdown/status, task CRUD, messaging, mailbox, outcomes
- **~10 enhanced tools** (OpenCode port): read, write, edit, glob, grep, bash, webfetch, websearch, todowrite, plan_exit
- **5 presets**: act (default), plan, search, minimal, yolo
- **Unlimited**: MCP tools + plugin tools

#### Telemetry
- **OpenTelemetry** (built-in): Console and OTLP HTTP exporters
- **PostHog** (optional peer dep): Feature flags only, pointed at `data.zenuxs.bot`
- **20+ event capture functions** in `core-events.ts`
- **4 adapters**: OpenTelemetryAdapter, TelemetryService (multi-fanout), TelemetryLoggerSink, OptedOutTelemetryService

#### Stale Cline Naming
- **Intentional**: `ClineNotSubscribedError`, `resolveLocalClineAuthToken`, `CLINE_DIR`, `CLINE_DATA_DIR`
- **Renamed**: `ZenuxsCore`, `ZenuxsCoreOptions`, `buildZenuxsSystemPrompt`, `zenuxs.bot`
- Comments reference "original Cline" for parity explanations

---

### 3.4 packages/llms (`@cline/llms` v0.0.51)

**Role**: Provider registry, model catalog, AI SDK gateway, and provider option routing.

#### Provider Landscape (12 families, ~47 built-in providers)

| Family | Provider IDs | AI SDK Package |
|--------|-------------|----------------|
| openai | openai-native, openai-codex | @ai-sdk/openai |
| openai-compatible | deepseek, xai, together, fireworks, groq, 29 total | @ai-sdk/openai-compatible |
| anthropic | anthropic, minimax | @ai-sdk/anthropic |
| google | gemini | @ai-sdk/google |
| vertex | vertex | @ai-sdk/google-vertex |
| bedrock | bedrock | @ai-sdk/amazon-bedrock |
| mistral | mistral | @ai-sdk/mistral |
| claude-code | claude-code | ai-sdk-provider-claude-code |
| openai-codex | openai-codex-cli | ai-sdk-provider-codex-cli |
| opencode | opencode | ai-sdk-provider-opencode-sdk |
| dify | dify | dify-ai-provider |
| sap-ai-core | sapaicore | @jerome-benoit/sap-ai-provider |
| **plus** | cline, cline-pass | (built-in specs) |

#### Gateway Architecture
```
DefaultGateway.stream(request)
  → GatewayRegistry.resolveModel(modelId)
  → GatewayRegistry.createProvider(providerId)
  → resolveGatewayRequestMaxTokens()
  → estimateRequestInputTokens()
  → provider.stream(request)
    → composeAiSdkProviderOptions()
      → matchProviderOptionRules() (18 rules, 6 phases)
      → suppress generic thinking/effort/fanout
      → merge patches in phase order
    → streamText() from `ai` package
    → emitAiSdkEvents() (text, reasoning, tool, usage, finish)
    → normalizeUsage() (cross-provider cost extraction)
```

#### 18 Routing Rules

| Phase | Rules |
|-------|-------|
| adapter | openai adapter (1) |
| provider | anthropic direct, google direct, openai-codex, google-gemini thinking, cline disable-thinking, ollama reasoning (6) |
| provider-fanout | generic fanout (1) |
| provider-reasoning | cline reasoning, openrouter reasoning, cline minimax, vercel minimax (4) |
| model-family | kimi-k2.6 thinking, deepseek thinking (2) |
| model-overlay | glm routed, minimax thinking, glm non-glm suppress (4) |

#### Error Types
- **Only one custom error**: `ClineNotSubscribedError` (with 4 helpers)
- No generic error hierarchy

#### Test Status
- 24 unit test files + 6 live/VCR test files
- `gateway.test.ts` (~4,000 lines) is comprehensive
- **Gaps**: mistral, SAP AI Core, routing modules lack dedicated unit tests

#### Browser Support
- `index.browser.ts` exports a strict subset: catalog queries, billing display, error types
- No handler creation, no gateway, no streaming

#### Stale Cline Naming
- `ClineNotSubscribedError`, `CLINE_DEFAULT_MODEL_ID`, `CLINE_PASS_PROVIDER_ID`, `BUILT_IN_PROVIDER.CLINE`
- `createClineLikeSpec()`, `buildClineModels()`, `CLINE_API_KEY`
- URL endpoint: `/api/v1/ai/cline/recommended-models`

---

### 3.5 apps/cli (zenuxs v3.0.29)

**Role**: User-facing CLI application with 16 commands, TUI, ACP protocol, and chat connectors.

#### Entry Point Flow
```
src/index.ts
  → initVcr(CLINE_VCR)
  → signal handlers (SIGINT, SIGTERM)
  → fatal error handlers (uncaughtException, unhandledRejection)
  → isHubDaemonProcess()? → import @cline/core/hub/daemon-entry
  → else → import ./main.ts → runCli()
    → createProgram() (Commander)
    → register 16 subcommands
    → parse args → dispatch:
      ├── Subcommand matched → handler (auth, config, plugin, etc.)
      └── No subcommand → default agent flow:
           ├── ACP mode? → runAcpMode()
           ├── Interactive? → runInteractive() (TUI)
           ├── Zen mode? → runZen() (fire-and-forget)
           └── Single prompt → runAgent()
```

#### CLI Command Map

| Command | Description |
|---------|-------------|
| `auth [provider]` | Authenticate provider and configure model |
| `config` | Show current configuration |
| `plugin` | Manage plugins (install/uninstall) |
| `skill` | Manage skills (wraps npx skills) |
| `connect [channel]` | Connect to external chat channel |
| `mcp` | Manage MCP servers |
| `doctor` | Diagnose/fix configuration |
| `history` / `h` | List/manage session history |
| `hook` | Handle hook payload from stdin |
| `schedule` | Manage scheduled tasks |
| `hub` | Manage local hub daemon |
| `dashboard` | Start hub dashboard + browser |
| `update` | Check for updates |
| `version` | Show version |
| `kanban` | Run kanban app |

#### Runtime Modes
1. **Non-interactive** (`runAgent`) — single prompt, stdout output, timeout/abort handling
2. **Interactive** (`runInteractive`) — OpenTUI React UI, 3 views (onboarding/home/chat), 16 slash commands
3. **Zen mode** (`runZen`) — fire-and-forget to hub, exits immediately, completion via notification
4. **ACP mode** (`runAcpMode`) — JSON-RPC over stdio, session management, OAuth, editor integration

#### Chat Connectors (6 platforms)
Discord, Google Chat, Linear, Slack, Telegram, WhatsApp — all via `@chat-adapter/*` SDK

#### Stale Naming (Pervasive)
- `CLINE_VCR`, `CLINE_API_KEY`, `CLINE_PROVIDER`, `CLINE_MODEL`, `CLINE_DIR`, `CLINE_DATA_DIR`, `CLINE_HOOKS_DIR`, `CLINE_BUILD_ENV`, `CLINE_FORCE_ONBOARDING` — dozens of `CLINE_` env vars
- Repository URL: `github.com/cline/cline.git`
- Author: `"Cline Bot Inc."`
- Package keywords: `"cline"`, `"claude"`, `"openrouter"`

#### Test Status
- Vitest with unit + E2E + interactive E2E configs
- Sequential execution with `maxWorkers: 1`
- Comprehensive E2E tests (935 lines in `cli.e2e.test.ts`)

---

### 3.6 apps/zenuxs-hub (`@zenuxs/zenuxs-hub` v0.0.0)

**Role**: Browser dashboard server — live clients, sessions, streaming chat, and hub restart.

#### Server Architecture
- **Runtime**: Bun-exclusive (Bun.serve for HTTP/WebSocket)
- **Port**: 8787 (default)
- **HTTP Endpoints**: `/version`, `/health`, `/browser` (WS upgrade), `/config.json`, `/api/marketplace/catalog`
- **SPA Routes**: 20+ routes served from `dist/webview/` or Vite dev server
- **Health Check**: Every 5 seconds, pings hub, broadcasts state to peers

#### Hub State (HubContext)
- Tracks: peers (browser tabs), clients (hub-connected apps), sessions, pending tool approvals, event log (max 30)
- Connection: hub attach/detach via Core SDK

#### WebSocket Protocol
- **17 inbound message types**: send, abort, reset, attach/delete/fork/restore sessions, approval, loadModels, saveProviderSettings, OAuth, desktop commands, restart_hub
- Outbound types: hub_state, session_hydrated, assistant_delta, reasoning_delta, tool_event, turn_done, approval_request

#### Webview Frontend (React SPA)
- **Framework**: Vite + React + shadcn/ui
- **Views**: Home (dashboard), Sessions, Chat (streaming/approvals/forks), Settings (general/providers/MCP/channels/schedules/account), Customizations
- **Communication**: `postToHost()` → WebSocket / VS Code bridge

#### Stale Naming
- 92 matches of `Cline`/`CLINE_` in server code
- Exported types: `ClineHubDashboardServer`, `startClineHubDashboardServer()`
- 11 `CLINE_*` environment variables (port, webview, provider, marketplace, etc.)

#### Test Coverage (Major Gaps)
| File | Tests |
|------|-------|
| `marketplace.test.ts` | 870 lines, 20+ tests |
| `http.test.ts` | 54 lines |
| `user-instructions.test.ts` | 70 lines |
| `desktop-client.test.ts` | 71 lines |
| **Missing**: state.ts, hub.ts, sessions.ts, approvals.ts, agent-events.ts, all webview components | None |

---

### 3.7 docs/ and mcp/

#### docs/ (6 files, ~133 KB total)

| File | Purpose | Verdict |
|------|---------|---------|
| `BRANDING-AUDIT.md` | Catalogue of Cline→Zenuxs rename status | **Accurate** |
| `COMPARISON-REPORT.md` | Zenuxs vs Cline comparison | **Mostly accurate** — claims "no CLI" (incorrect, CLI exists) |
| `KEYMAP-SPECIFICATION.md` | TUI keyboard shortcut proposal | **Aspirational** — doesn't match actual implementation |
| `PORTING-NOTES.md` | Raw AI chat transcript of entire Cline port | **Historical only** — 132 KB, hundreds of Cline refs |
| `STRATEGIC-IMPROVEMENTS.md` | Gap analysis + 30/90-day roadmap | **Accurate** — identifies real gaps (CI/CD, docs, SDK) |
| `VERIFIED-DOCUMENTATION.md` | Source-verified reference doc | **Best reference** — uses absolute paths that may drift |

#### mcp/
- 12 empty subdirectories (browser-use, chrome-devtools, ci-cd, context7, docker, exa-search, filesystem, github, memory, playwright, sentry, terminal)
- **All empty** — scaffolding only
- Actual MCP runtime: `packages/core/src/extensions/mcp/` + `packages/agents/src/mcp/`

#### Root Files
- **README.md**: 40-byte stub (`# Zenuxs-AI-Agent`)
- **.zenuxs-user-config.json**: Dev config with filesystem + GitHub MCP
- **.env.example**: Minimal (LLM_API_KEY, OPENAI_API_KEY)

---

## 4. Dependency Graph

### Internal Dependencies
```
@cline/shared (leaf)
  ↑
@cline/llms ──────┐
  ↑               │
@cline/agents ────┤
  ↑               │
@cline/core ──────┤
  ↑               │
@zenuxs/zenuxs-hub │
  ↑               │
zenuxs (cli) ─────┘
```

### External Key Dependencies
| Area | Packages |
|------|----------|
| AI SDK | `ai` v6, `@ai-sdk/openai/anthropic/google/vertex/bedrock/mistral/openai-compatible` |
| Community AI | `ai-sdk-provider-claude-code`, `-codex-cli`, `-opencode-sdk`, `dify-ai-provider`, `sap-ai-provider` |
| MCP | `@modelcontextprotocol/sdk`, `-server-filesystem`, `-server-github` |
| Telemetry | `@opentelemetry/*` (api, sdk, exporter), `posthog-node` (optional) |
| Chat | `@chat-adapter/discord/gchat/linear/slack/telegram/whatsapp` |
| TUI | `@opentui/core`, `@opentui/react`, `react` 19, `react-reconciler` |
| CLI | `commander`, `@clack/prompts`, `pino`, `fzf`, `marked` |
| Validation | `zod` v4, `zod-to-json-schema` |
| IDs | `nanoid` |
| Misc | `simple-git`, `ws`, `yaml`, `open`, `jiti`, `marked` |

---

## 5. Feature Map

| Feature | Status | Location |
|---------|--------|----------|
| Agent Loop (streaming LLM) | ✅ Live | packages/agents/agent-runtime.ts |
| Agent Graph (LangGraph orchestration) | ❌ Dead | packages/agents/agent-graph.ts |
| MCP Client + Tool Registry | ✅ Live (core) / ❌ Dead (agents) | core/extensions/mcp/ + agents/src/mcp/ |
| Self-Critique | ❌ Dead | agents/reasoning/selfCritique.ts |
| Sub-Agents | ❌ Dead | agents/subagents/ |
| Multi-Agent Teams | ✅ Live | core/extensions/tools/team/ |
| Configured Agents | ✅ Live | core/extensions/tools/configured-agent*.ts |
| Loop Detection | ✅ Live (2 systems) | core/runtime/safety/loop-detection.ts + extensions/tools/registry.ts |
| Mistake Tracker | ✅ Live | core/runtime/safety/mistake-tracker.ts |
| Tool Policies / Safety Rules | ✅ Live | core/runtime/safety/rules.ts + tool-policies |
| Session Persistence | ✅ Live | core/session/ + core/services/storage/ |
| Session Checkpoints | ✅ Live | core/session/checkpoint-restore.ts |
| Session Versioning | ✅ Live | core/session/session-versioning-service.ts |
| Provider Gateway (47 providers) | ✅ Live | packages/llms/ |
| Model Catalog (auto-generated) | ✅ Live | packages/llms/catalog/ |
| Provider Option Routing (18 rules) | ✅ Live | packages/llms/providers/routing/ |
| CLI (16 commands) | ✅ Live | apps/cli/ |
| TUI (React/OpenTUI) | ✅ Live | apps/cli/src/tui/ |
| ACP (Editor Protocol) | ✅ Live | apps/cli/src/acp/ |
| Chat Connectors (6 platforms) | ✅ Live | apps/cli/src/connectors/ |
| Hub Dashboard | ✅ Live | apps/zenuxs-hub/ |
| Schedule/Cron | ✅ Live | core/cron/ |
| Plugins + Skills | ✅ Live | core/extensions/plugin/ + core/extensions/config/ |
| Hooks System | ✅ Live | core/hooks/ |
| Telemetry (OTel + PostHog) | ✅ Live | core/services/telemetry/ |
| Remote Config | ✅ Live | shared/remote-config/ + core/remote-config/ |
| Auth (OAuth, Device, Codex, OCA) | ✅ Live | core/auth/ |

---

## 6. Tool Registry

### Default Tools (9)
| Tool | Enabled by Default? | Completes Run? |
|------|-------------------|----------------|
| `read_files` | Yes | No |
| `search_codebase` | Yes | No |
| `run_commands` | Yes | No |
| `fetch_web_content` | Yes | No |
| `apply_patch` | No | No |
| `editor` | Yes | No |
| `skills` | Yes | No |
| `ask_question` | Yes | No |
| `submit_and_exit` | No | **Yes** |

### Team Tools (18)
Spawn/shutdown teammates, task management (CRUD + run + cancel + list + await), messaging (send + broadcast + mailbox), mission log, team cleanup, outcome lifecycle (create + fragment + review + finalize + list)

### Enhanced Tools (10, OpenCode Port)
| Tool | Purpose |
|------|---------|
| `read` | Read file |
| `write` | Write file |
| `edit` | Edit file (diff-based) |
| `glob` | File pattern matching |
| `grep` | Content search |
| `bash` / `shell` | Shell execution |
| `webfetch` | URL fetch |
| `websearch` | Web search |
| `todowrite` | Task tracking |
| `plan_exit` | Plan completion |

### Tool Presets (5)
| Preset | Bash | Editor | Search | WebFetch | Skills | AskQ | SubmitExit | Spawn | Teams |
|--------|------|--------|--------|----------|--------|------|-----------|-------|-------|
| act | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| plan | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| search | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| minimal | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| yolo | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |

---

## 7. Runtime Workflow

### Session Lifecycle
```
User input
  │
  ▼
ZenuxsCore.start(input)
  │
  ▼
RuntimeHost.startSession()
  │
  ▼
DefaultRuntimeBuilder.build(input)
  ├── Normalize mode/tools
  ├── Load user instruction config (rules, skills, workflows)
  ├── Build built-in tools (respecting mode preset)
  ├── Load MCP tools (if enabled)
  ├── Load configured agents (for spawn)
  ├── Set up team runtime
  ├── Apply tool policies / disabled filters
  └── Return BuiltRuntime
  │
  ▼
SessionRuntime.run(prompt)
  ├── Reset MistakeTracker + LoopDetectionTracker
  ├── Append user message
  ├── Compose system prompt (rules)
  ├── Create agent model (from config)
  ├── Merge extension tools
  ├── Create AgentRuntime
  ├── Subscribe to events
  │   ├── tool-started → LoopDetectionTracker.inspect()
  │   └── turn-finished → MistakeTracker.record() (if all tools failed)
  ├── AgentRuntime.run()
  │   └── Loop (maxIterations):
  │       ├── prepareTurn callback
  │       ├── beforeModel hooks
  │       ├── model.stream(request)
  │       ├── afterModel hooks
  │       ├── No tool calls? → check completion → finish or loop
  │       ├── executeToolCalls() → policy → approval → exec
  │       └── Terminal tool? → finish
  ├── Drain tracker work
  │   ├── Soft loop? → append recovery notice
  │   ├── Hard loop? → force MistakeTracker at limit
  │   └── MistakeTracker stop? → append stop + abort
  ├── Replace conversation store
  └── Build AgentResult
  │
  ▼
Emit events → persist session → return result
```

### Loop Prevention Flow (Detailed)
```
tool-started event
  │
  ▼
LoopDetectionTracker.inspect(toolName, toolInput)
  ├── kind: "ok" → continue
  ├── kind: "soft" → append recovery notice message
  └── kind: "hard" → MistakeTracker.record({ forceAtLimit: true })
                          │
                          ▼
                  MistakeTracker.record(reason)
                    ├── api_error
                    ├── invalid_tool_call
                    └── tool_execution_failed
                          │
                          ▼
                  At limit (default 6)?
                    ├── No → append guidance message
                    └── Yes → append stop message + abort runtime
```

---

## 8. Loop Prevention Architecture

### Current State

Two systems exist independently:

| Component | Threshold | Location | Integration |
|-----------|-----------|----------|-------------|
| LoopDetectionTracker | Soft: 3, Hard: 5 (configurable) | `core/runtime/safety/loop-detection.ts` | BeforeTool hook in SessionRuntime |
| DoomLoopDetector | Hard-coded 3 | `core/extensions/tools/registry.ts` | ToolRegistry.isDoomLoop() |
| MistakeTracker | Default 6 (configurable) | `core/runtime/safety/mistake-tracker.ts` | Post-turn check + fed by hard loop verdict |

**DEFAULT_MAX_ITERATIONS = 50** is declared in `shared/src/agent.ts` but the `maxIterations` field is:
- **REQUIRED** in `AgentRuntimeConfig` (agent.ts)
- **OPTIONAL** in `AgentConfig` (agents/types.ts)

This inconsistency must be resolved before Step 1 of the loop prevention plan can be considered complete.

### Gaps
1. No cumulative mistake budget across sessions
2. No flip-flop detection (alternating between two patterns)
3. Self-critique not wired through orchestrator (dead code)
4. No retry limit in error handler

---

## 9. Branding Migration Status

### Already Renamed (Cline → Zenuxs)
| Area | Status |
|------|--------|
| CLI package name | ✅ `zenuxs` |
| Core class name | ✅ `ZenuxsCore` |
| Public APIs | ✅ `ZenuxsCoreOptions`, `ZenuxsCoreStartInput`, `ZenuxsAccountService` |
| System prompt | ✅ `buildZenuxsSystemPrompt` |
| PostHog endpoint | ✅ `data.zenuxs.bot` |
| Recommended models | ✅ `zenuxs-recommended-models.ts` (file names) |
| Hub package | ✅ `@zenuxs/zenuxs-hub` |

### Still Using Cline (Intentional or Not)
| Area | Status | Category |
|------|--------|----------|
| Package scopes | `@cline/shared`, `@cline/agents`, `@cline/core`, `@cline/llms` | **Package identity** |
| Error class | `ClineNotSubscribedError` | **Provider-facing** |
| Provider IDs | `cline`, `cline-pass` | **Provider-facing** |
| Env vars | `CLINE_DIR`, `CLINE_DATA_DIR`, `CLINE_VCR`, `CLINE_API_KEY` (~30 vars) | **Migration needed** |
| Storage paths | `resolveClineDir()`, `resolveClineDataDir()` | **Dual API** (Zenuxs aliases exist) |
| API headers | `X-Title: Cline`, `X-CLIENT-TYPE: cline-sdk` | **Migration needed** |
| Hub commands | `cline.account.get_current` | **Migration needed** |
| Feature flags | `CLINE_PASS` | **Dual alias** (`ZENUXS_PASS` exists) |
| URLs | `github.com/cline/cline`, `https://cline.bot` | **Migration needed** |
| Schema keys | `Cline: ZenuxsSettingsSchema` (wire format) | **Migration needed** |
| Enum values | `BUILT_IN_PROVIDER.CLINE`, `BUILT_IN_PROVIDER.CLINE_PASS` | **Provider-facing** |
| Author | `"Cline Bot Inc."` | **Migration needed** |
| Keywords | `"cline"`, `"claude"`, `"openrouter"` | **Low priority** |

### Breaking Tests (HIGH — must fix)
| File | Issue |
|------|-------|
| `packages/shared/src/remote-config/schema.test.ts:4` | Imports deleted `ClineSettingsSchema` |
| `packages/shared/src/runtime/build-env.test.ts:77,109` | References undefined `CLINE_BUILD_ENV_ENV` |

---

## 10. Critical Issues

### 🔴 HIGH — Dead Code in packages/agents
- **~65% of source code** is unreachable (~2,450 lines)
- `agent-graph.ts` (984 lines) imports missing `@langchain/langgraph` dependency — would not compile even if reached
- `selfCritique.ts`, `subagents/`, and most `mcp/` modules are only reachable through the dead graph
- 2 test files test dead code (~525 lines)

### 🔴 HIGH — Two Tests Broken in packages/shared
- `schema.test.ts:4` — imports renamed/deleted symbol
- `build-env.test.ts:77,109` — references undefined variable
- Blocking ability to run full test suite

### 🔴 HIGH — maxIterations Inconsistency
- `AgentRuntimeConfig.maxIterations` is **REQUIRED** (`number`)
- `AgentConfig.maxIterations` is **OPTIONAL** (`number?`)
- These interfaces must be aligned for the loop prevention plan

### 🟡 MEDIUM — Two Loop Detection Systems
- `LoopDetectionTracker` (new, configurable, `runtime/safety/`)
- `DoomLoopDetector` (legacy, hard-coded 3, `extensions/tools/`)
- Both active simultaneously — possible double-detection

### 🟡 MEDIUM — Hub Test Coverage Gap
- Core modules (`state.ts`, `hub.ts`, `sessions.ts`, `approvals.ts`) have zero tests
- Webview React components have zero tests

### 🟡 MEDIUM — Documentation Staleness
- `README.md` is a 40-byte stub
- `KEYMAP-SPECIFICATION.md` does not match actual implementation
- `COMPARISON-REPORT.md` incorrectly claims "no CLI"
- `PORTING-NOTES.md` is 132 KB of raw AI chat transcript

### 🟡 MEDIUM — Empty mcp/ Directories
- 12 directories under `mcp/` are empty — potential confusion
- Actual MCP runtime lives in `packages/` not here

---

## 11. Recommendations

### Immediate (Highest Priority)
1. **Delete dead code in packages/agents**: `agent-graph.ts`, `selfCritique.ts`, `subagents/`, unreachable `mcp/` modules
2. **Fix 2 broken tests** in `packages/shared`: `schema.test.ts` and `build-env.test.ts`
3. **Align `maxIterations`** between `AgentRuntimeConfig` and `AgentConfig` interfaces

### Short-term
4. **Consolidate loop detection**: Decide between `LoopDetectionTracker` and `DoomLoopDetector` — or document the relationship
5. **Add Hub test coverage** for `state.ts`, `hub.ts`, `sessions.ts`, `approvals.ts`
6. **Resolve dual `CLINE_` env vars**: Deprecate Cline-prefixed fallbacks, prefer Zenuxs-prefixed
7. **Update stale documentation**: `README.md`, `KEYMAP-SPECIFICATION.md`, `COMPARISON-REPORT.md`
8. **Remove empty `mcp/` scaffolding** or add README explaining purpose
9. **Add routing unit tests** for `generic-compatible.ts`, `glm-thinking.ts`, `reasoning-codecs.ts`, `utils.ts`

### Medium-term
10. **Continue scope rename** from `@cline/*` to `@zenuxs/*` (or keep as `@cline` if intentionally upstream-referencing)
11. **Archive or trim `PORTING-NOTES.md`** — 132 KB chat transcript should not live in docs/
12. **Add CI/CD** per STRATEGIC-IMPROVEMENTS.md recommendations
13. **Improve test coverage** for mistral, SAP AI Core providers

### Long-term
14. **Implement loop prevention plan** (cumulative budget, flip-flop detection, wired self-critique, error handler retry limit)
15. **Build proper SDK documentation site**
16. **Consider REST API** for external integration beyond ACP

---

## Appendix: File Inventory

| Location | Files | Tests |
|----------|-------|-------|
| `packages/shared/src/` | ~90 source | 21 test |
| `packages/agents/src/` | 25 source (10 dead) | 4 test (2 dead) |
| `packages/core/src/` | 269 source | 119 test |
| `packages/llms/src/` | ~80 source | 30 test |
| `apps/cli/src/` | ~150 source | ~60 test |
| `apps/zenuxs-hub/src/` | ~40 source | 4 test |
| **Total** | **~654 source files** | **~238 test files** |

## Appendix: Environment Variables Map

| Variable | Package | Status |
|----------|---------|--------|
| `CLINE_DIR` | shared/core/cli | Active, dual ZENUXS_DIR |
| `CLINE_DATA_DIR` | shared/core/cli | Active, dual ZENUXS_DATA_DIR |
| `CLINE_VCR` | shared/cli | Active (test harness) |
| `CLINE_VCR_CASSETTE` | shared | Active |
| `CLINE_VCR_MODE` | shared | Active |
| `CLINE_SOURCEMAPS` | shared | Active (build) |
| `CLINE_API_BASE_URL` | shared | Active, dual ZENUXS_API_BASE_URL |
| `CLINE_API_KEY` | llms/cli | Active |
| `CLINE_PROVIDER` | cli/hub | Active |
| `CLINE_MODEL` | cli/hub | Active |
| `CLINE_BUILD_ENV` | shared/cli | Active |
| `CLINE_HOOKS_DIR` | cli | Active |
| `CLINE_LOG_ENABLED` | cli | Active |
| `CLINE_LOG_LEVEL` | cli | Active |
| `CLINE_LOG_PATH` | cli | Active |
| `CLINE_LOG_NAME` | cli | Active |
| `CLINE_RPC_ADDRESS` | cli | Active |
| `CLINE_SESSION_BACKEND_MODE` | cli | Active |
| `CLINE_FORCE_ONBOARDING` | cli | Active |
| `CLINE_FORCE_MIGRATION_NOTICE` | cli | Active |
| `CLINE_SANDBOX` | cli | Active |
| `CLINE_HUB_DASHBOARD_PORT` | cli/hub | Active |
| `CLINE_HUB_WEBVIEW_DIST_DIR` | hub | Active |
| `CLINE_MCP_SETTINGS_PATH` | hub | Active |
| `CLINE_MARKETPLACE_URL` | hub | Active |
| `CLINE_WRAPPER_PATH` | hub | Active |
| `CLINE_BIN_PATH` | hub | Active |
| `CLINE_GLOBAL_SETTINGS_PATH` | hub | Active |
| `CLINE_HUB_ADDRESS` | cli | Active |
| `CLINE_CAPTURE_DIR` | llms | Active |
