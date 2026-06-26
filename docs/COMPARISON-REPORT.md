# OpenCode vs Zenuxs-Code — Comparison Report

_Generated 2026-06-24_

## 1. Executive Summary

| Metric | OpenCode | Zenuxs-Code | Difference |
|---|---|---|---|
| **Monorepo packages** | 25 | 4 | OpenCode 6.25× larger |
| **Test files** | 532 | 165 | OpenCode 3.2× more tests |
| **Test lines of code** | ~470k | ~161k | OpenCode 2.9× more |
| **Test suite status** | Cannot run (missing deps) | ✅ 1133 pass / 13 skip / 0 fail | Zenuxs-Code wins (Windows) |
| **Architecture style** | Effect-TS Schema-first | Traditional OOP / async | Different paradigms |
| **CLI + TUI + Desktop** | ✅ Full stack | ❌ Core only | OpenCode has complete product |
| **Plugin system** | ✅ `@opencode-ai/plugin` | ✅ Inherited from OpenCode | Parity |
| **Server / API** | ✅ Effect HttpApi | ❌ Not present | OpenCode has full server |
| **SDK** | ✅ JS SDK (client + server) | ❌ Not present | OpenCode has external SDK |
| **Enterprise / Console** | ✅ SST deployment, admin console | ❌ Not present | OpenCode has infra |
| **Web app** | ✅ Vite + SolidJS | ❌ Not present | OpenCode has web UI |
| **Package scope** | `@opencode-ai/*` | `@cline/*` | Branding rename only |

---

## 2. Architecture Comparison

### 2.1 OpenCode Architecture

```
@opencode-ai/core       — Core engine (DB, sessions, tools, plugins, FS, PTY)
@opencode-ai/llm        — Effect Schema-first LLM routing, protocols, providers
@opencode-ai/cli        — Standalone CLI tool (lildax)
opencode                — Main CLI entry (yargs), session orchestration, TUI
@opencode-ai/server     — HTTP API server (Effect HttpApi)
@opencode-ai/tui        — Terminal UI (SolidJS + OpenTUI)
@opencode-ai/ui         — Shared web/TUI components (SolidJS + Tailwind)
@opencode-ai/app        — Web application (Vite + SolidJS + Tailwind)
@opencode-ai/desktop    — Electron desktop app
@opencode-ai/plugin     — Plugin SDK for external developers
@opencode-ai/sdk        — JavaScript/TypeScript client + server SDK
@opencode-ai/script     — Build/CI utilities
@opencode-ai/web        — Marketing site (Astro + Starlight)
@opencode-ai/slack      — Slack integration (Bolt SDK)
@opencode-ai/http-recorder — HTTP cassette recorder for testing
@opencode-ai/effect-drizzle-sqlite — Drizzle + Effect SQLite adapter
@opencode-ai/effect-sqlite-node   — Effect SQLite Node bindings
@opencode-ai/enterprise — Enterprise self-hosted build
@opencode-ai/function   — Cloudflare Workers / serverless
@opencode-ai/console-*  — Admin console (5 sub-packages: app, core, mail, resource, function)
@opencode-ai/stats-*    — Analytics/telemetry (3 sub-packages: server, app, core)
@opencode-ai/storybook  — Component library storybook
```

**Key architectural choices:**
- **Effect-TS** v4.0.0-beta.83 throughout the core, LLM, and server layers
- **Drizzle ORM** + SQLite for persistence
- **SolidJS** for both TUI and web UI
- **SST (Serverless Stack)** v4 for cloud deployment
- **Dual-platform**: Bun `imports` conditions for browser vs Node backends (SQLite, PTY, filesystem)
- **Turborepo** for task orchestration
- **Bun test** as test runner (not Vitest)
- **Vercel AI SDK** interop alongside native LLM client
- **V2 event system** with SQL persistence

### 2.2 Zenuxs-Code Architecture

```
@cline/shared   — Shared utilities (paths, environment config, storage)
@cline/llms     — LLM providers, built-in models, model registry
@cline/core     — Core engine (account, auth, cron, hub, runtime, services, extensions)
@cline/settings — Settings UI (web-based)
```

**Key architectural choices:**
- **Vitest** as test runner (diverged from OpenCode's `bun test`)
- **Traditional OOP** with classes and dependency injection
- **Async/await** patterns (no Effect-TS)
- **Static glob-based plugin loading** (sync startup sequence)
- **Provider registry** pattern in `@cline/llms` (not Effect schema)
- **Hub/daemon** architecture for runtime orchestration
- **Environment-based config** (CLINE_ENVIRONMENT, CLINE_API_BASE_URL)
- **Gateway model definitions** with `GatewayModelDefinition`
- **Vite** for settings app

---

## 3. Feature Comparison

### 3.1 Core Engine

| Feature | OpenCode | Zenuxs-Code | Notes |
|---|---|---|---|
| Session management | ✅ V2 with Effect | ✅ Session runtime + orchestrator | Different designs |
| Tool system | ✅ 19 built-in tools | ✅ Inherited + subagents | Parity |
| Provider registry | ✅ Effect Schema | ✅ BuiltinSpec registry | Different implementations |
| Plugin system | ✅ External + internal | ✅ Plugin config loader | Parity |
| Cron/background jobs | ❌ Not present | ✅ Cron runner + scheduler | **Zenuxs-Code unique** |
| MCP (Model Context Protocol) | ✅ | ✅ | Parity |
| Skill system | ✅ | ✅ | Parity |
| File indexing | ✅ | ✅ | Parity |
| Permission system | ✅ V2 | ❌ Not present | OpenCode unique |
| PTY abstraction | ✅ Bun vs Node | ❌ Not present | OpenCode unique |
| V2 event system | ✅ SQL-backed | ❌ Not present | OpenCode unique |

### 3.2 UI & User-Facing

| Feature | OpenCode | Zenuxs-Code | Notes |
|---|---|---|---|
| CLI (yargs) | ✅ 20+ commands | ❌ Not present | Zenuxs-Code is library-only |
| TUI (terminal UI) | ✅ SolidJS + OpenTUI | ❌ Not present | OpenCode unique |
| Web app | ✅ Vite + SolidJS | ❌ Settings app only | OpenCode full web |
| Desktop (Electron) | ✅ | ❌ Not present | OpenCode unique |
| Admin console | ✅ 5 packages | ❌ Not present | OpenCode enterprise |
| Marketing site | ✅ Astro + Starlight | ❌ Not present | OpenCode unique |
| i18n | ✅ | ❌ Not present | OpenCode unique |

### 3.3 Developer Experience

| Feature | OpenCode | Zenuxs-Code | Notes |
|---|---|---|---|
| JS/TS SDK | ✅ | ❌ Not present | OpenCode unique |
| Plugin SDK | ✅ @opencode-ai/plugin | ❌ Not present | OpenCode unique |
| HTTP API | ✅ Effect HttpApi + OpenAPI | ❌ Hub WebSocket only | OpenCode has REST |
| Storybook | ✅ | ❌ Not present | OpenCode unique |

### 3.4 Infrastructure

| Feature | OpenCode | Zenuxs-Code | Notes |
|---|---|---|---|
| Cloud deployment | ✅ SST v4 | ❌ Not present | OpenCode unique |
| Docker images | ✅ | ❌ Not present | OpenCode unique |
| Cloudflare Workers | ✅ | ❌ Not present | OpenCode unique |
| Enterprise self-hosted | ✅ | ❌ Not present | OpenCode unique |
| Analytics/telemetry | ✅ 3 stats packages | ✅ OpenTelemetry provider | Both have telemetry |
| Slack integration | ✅ | ❌ Not present | OpenCode unique |

### 3.5 Testing

| Feature | OpenCode | Zenuxs-Code | Notes |
|---|---|---|---|
| Test runner | `bun test` | **Vitest** | Zenuxs-Code diverged here |
| Test count | ~470k lines / 532 files | ~161k lines / 165 files | OpenCode 3× more |
| Suite status | ❌ Cannot run (missing deps) | ✅ 1133 pass on Windows | Zenuxs-Code less strict deps |
| Cassette recording | ✅ @opencode-ai/http-recorder | ❌ Not present | OpenCode unique |
| E2E (Playwright) | ✅ | ❌ Not present | OpenCode unique |

---

## 4. Migration Audit

### 4.1 Branding Surface (Updated)

| Location | OpenCode | Zenuxs-Code | Status |
|---|---|---|---|
| Package scope | `@opencode-ai/*` | `@cline/*` | ✅ Renamed |
| Error messages | `OpenCode` | `Cline` | ✅ (mostly) |
| File paths | `Documents/OpenCode/` | `Documents/Zenuxs/` | ✅ Fixed in Phase 2 |
| Agent paths | `.opencode/agents/` | `.zenuxs/agents/` | ✅ Fixed in Phase 2 |
| API URLs | `api.opencode.ai` | `api.cline.bot` (prod) / `127.0.0.1:8787` (dev) | ✅ Changed |
| CI/CD pipelines | OpenCode's GitHub Actions | ❌ Not ported | ⚠️ Missing |
| Package.json metadata | `opencode` | `zenuxs` | ✅ Changed |

### 4.2 Remaining Migration Debt

| Issue | Severity | File(s) | Notes |
|---|---|---|---|
| `CLINE_API_BASE_URL` env var still in test | Low | `local-provider-service.test.ts` | Test skipped on Windows; env var name tied to upstream |
| `process.env.CLINE_ENVIRONMENT` | Low | `cline-environment.ts` | Environment naming still Cline-based |
| `ClineEnvironment` type | Low | `cline-environment.ts` | Type name still references "Cline" |
| `CLINE_MCP_SETTINGS_PATH` | Low | `runtime-builder.test.ts` | Env var name is Cline-branded |
| `@cline/*` npm scope | Medium | All packages | Not published to npm; only local workspace |
| No CI setup | Medium | — | No GitHub Actions/CI for running tests |
| Upstream sync gap | Medium | All packages | OpenCode v1.17.9; unclear which commit Zenuxs-Code forked from |

---

## 5. Ratings

| Dimension | OpenCode | Zenuxs-Code | Rationale |
|---|---|---|---|
| **Test coverage** | 7/10 | 6/10 | OpenCode has 3× more tests, but cannot run them; Zenuxs-Code passes fully on Windows |
| **Code quality** | 8/10 | 7/10 | OpenCode's Effect-TS architecture is more type-safe; Zenuxs-Code's traditional OOP is simpler but less robust |
| **Feature completeness** | 9/10 | 5/10 | OpenCode has CLI, TUI, Web, Desktop, SDK, Plugin SDK, Slack, enterprise infra, REST API, admin console, cron — Zenuxs-Code has core engine only + cron |
| **Portability** | 6/10 | 7/10 | OpenCode uses Bun-specific features; Zenuxs-Code has more Node-compatible patterns |
| **Maintainability** | 7/10 | 7/10 | OpenCode more complex but well-structured; Zenuxs-Code simpler but has less CI/documentation |
| **Windows support** | 4/10 | 7/10 | OpenCode has PTY/spawn issues on Windows; Zenuxs-Code skips bash tests but runs core tests |
| **Developer experience** | 8/10 | 5/10 | OpenCode has SDK, plugin SDK, API server, Storybook, CI — Zenuxs-Code has no developer tooling |
| **Documentation** | 7/10 | 4/10 | OpenCode has AGENTS.md, inline docs, Starlight site — Zenuxs-Code has sparse docs |
| **Deployment readiness** | 9/10 | 3/10 | OpenCode has SST, Docker, enterprise — Zenuxs-Code has no deployment infra |
| **Innovation** | 8/10 | 4/10 | OpenCode has V2 event system, Effect-based providers, platform conditions — Zenuxs-Code has cron scheduler as main differentiator |

### Overall Ratings

| | OpenCode | Zenuxs-Code |
|---|---|---|
| **Weighted average** | **7.3 / 10** | **5.5 / 10** |
| **Strengths** | Full product stack, modern architecture, deployment-ready | Clean core, passes tests on Windows, simpler to understand |
| **Weaknesses** | Complex dependency tree, Windows issues, cannot run tests | Missing UI/CLI/SDK/API, no CI/CD, low test count |

---

## 6. Key Risks

### 6.1 For OpenCode
- Cannot run test suite due to missing dependencies (`effect` package not installed)
- Effect-TS learning curve for new contributors
- VTEX/concurrency model may cause subtle bugs in non-Node runtimes

### 6.2 For Zenuxs-Code
- **Upstream drift risk**: OpenCode continues to evolve; Zenuxs-Code will fall further behind
- **No CI/CD**: Cannot automatically verify PRs or releases
- **Limited feature set**: Core-only means no CLI, no UI, no SDK — consumers must build everything themselves
- **Support burden**: All OpenCode features will need to be reimplemented or backported
- **Branding is shallow**: Many env vars, config paths, and class names still reference "Cline" — will confuse users

---

## 7. Recommendations

1. **If continuing as fork**: Set up CI immediately. Sync to a known-good OpenCode commit. Add missing `@opencode-ai/plugin` and CLI packages.
2. **If diverging strategically**: Decide which features to keep unique (cron scheduler, Windows support) and strip the rest. Rename ALL `Cline` references. Add documentation and API surface.
3. **Minimum viable**: Add CLI entry point (reuse yargs from OpenCode), fix remaining branding debt, and publish to npm under `@zenuxs/*` scope.
4. **Long-term**: Either resource fully (port UI, SDK, server) or converge back to OpenCode upstream with Zenuxs features contributed.

---

_Generated by OpenCode analysis agent._
