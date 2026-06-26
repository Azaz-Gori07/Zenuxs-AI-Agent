# Audit Report: packages/shared (@cline/shared v0.0.51)

> Date: 2026-06-26
> Scope: Full source audit of D:\V3\zenuxs-code\packages\shared\src/

---

## 1. Stale Cline Naming (should be Zenuxs)

### 1.1 Schema key in remote config
- src/remote-config/schema.ts:117 — Cline: ZenuxsSettingsSchema.optional() — the object key is still Cline instead of Zenuxs. Affects wire format.

### 1.2 Broken test import (compile error)
- src/remote-config/schema.test.ts:4 — imports ClineSettingsSchema which no longer exists (was renamed to ZenuxsSettingsSchema). This test file will fail to compile/run.

### 1.3 CLI env var constants use CLINE_ prefix
- src/storage/paths.ts: CLINE_DIR, CLINE_CONFIG_DIR = ".cline", CLINE_MCP_SETTINGS_FILE_NAME, setClineDir, resolveClineDir, resolveClineDataDir (with Zenuxs-prefixed aliases at lines 593-598)
- src/vcr.ts: CLINE_VCR env vars throughout
- src/bun.mts:10: CLINE_SOURCEMAPS env var

### 1.4 Env var fallbacks with CLINE_ prefix
- src/runtime/zenuxs-environment.ts:90: CLINE_API_BASE_URL
- src/storage/paths.ts:99,124,132,140,148,263,271,279 — dual CLINE_ / ZENUXS_ fallbacks

### 1.5 API request headers (src/llms/requests.ts:1-6)
- HTTP-Referer: https://cline.bot, X-Title: Cline, X-CLIENT-TYPE: cline-sdk

### 1.6 Feature flag: CLINE_PASS (src/feature-flags.ts:3) with ZENUXS_PASS alias

### 1.7 Hub command: cline.account.get_current (src/hub.ts:373)

### 1.8 Provider ID check: isZenuxsProvider matches "cline" and "cline-pass" (src/providers/utils.ts:2)

### 1.9 BUG: undefined variable in test
- src/runtime/build-env.test.ts:77,109 — CLINE_BUILD_ENV_ENV is not defined or imported (should be ZENUXS_BUILD_ENV_ENV)

### 1.10 Source comments referencing Cline (9 files)
- agent.ts, extensions/context.ts, extensions/contribution-registry.ts, automation/schemas.ts, cron/cron-spec-types.ts, llms/model-info.ts, agents/types.ts, team/types.ts

---

## 2. Unused Exports / Dead Code Paths

### 2.1 Subpath-only modules (not in main index.ts barrel)
- automation/, db/, storage/, remote-config/ — built separately, have subpath exports in package.json but not in index.ts

### 2.2 ClineSettingsSchema dead import (schema.test.ts:4) — no longer exported

### 2.3 AutomationEventEnvelope type duplication
- cron/cron-spec-types.ts (lines 94-104) vs automation/types.ts (lines 118-128) — slightly different shapes

### 2.4 vcr.ts is Node-only: initVcr exported from main index.ts but cannot run in browser

---

## 3. maxIterations References

### 3.1 DEFAULT_MAX_ITERATIONS = 50 (src/agent.ts:9)
- Declared but NOT imported anywhere within shared package. Consumed externally by @cline/core.

### 3.2 All locations (12 files):
- agent.ts:479 (AgentRuntimeConfig, REQUIRED)
- agents/types.ts:704 (AgentConfig, optional) + 880 (zod schema, optional)
- session/runtime-config.ts:54
- hub.ts:292,339,359,659
- cron/cron-spec-types.ts:34
- connectors/options.ts:15,45,76,110,138,174 (all 6 connector types)
- automation/types.ts:70 + schemas.ts:42
- team/types.ts:75 + schema.ts:52

### 3.3 Inconsistency: AgentRuntimeConfig.maxIterations is REQUIRED while AgentConfig.maxIterations is OPTIONAL

---

## 4. AgentRuntimeConfig.maxIterations

Interface: src/agent.ts:440-508, Field at line 479: maxIterations: number — REQUIRED (no ?).

---

## 5. Index Export Completeness

### 5.1 Exported from index.ts:
agent, agents, connectors/events+options, cron (types), dispose, extensions/*, feature-flags, hooks/*, hub, llms/* (8 submodules), logging, parse/*, prompt/*, providers, remote-config/*, rpc/*, runtime/*, services/*, session/*, team, tools/*, types, vcr

### 5.2 NOT exported from index.ts (only subpath):
db/, storage/, automation/

### 5.3 Missing from index.browser.ts:
runtime/build-env.ts, vcr.ts, db/, storage/, automation/

---

## 6. Test Coverage

### 6.1 Config: vitest.config.ts — node environment, include src/**/*.test.ts, exclude *.e2e.test.ts

### 6.2 21 test files across: hub, vcr, extensions, tools, remote-config, db, llms, prompt, runtime, parse, services, storage

### 6.3 Missing coverage:
agent.ts, agents/types.ts, cron/, connectors/, dispose.ts, hooks/, logging/, rpc/, session/, team/, several llms/ submodules

---

## 7. @cline/ References

9 files contain @cline/ in comments. Update to @zenuxs/ if renaming scope.

---

## 8. catalog-zenuxs-recommended.ts / catalog-cline-recommended.ts

Not found in packages/shared. N/A.

---

## 9. Additional Findings

- package.json still uses @cline/shared name and github.com/cline/cline repo URL
- AGENTS.md references @cline/shared in code examples
- dispose.ts has module-level mutable registry (test pollution risk)
- vcr.ts uses global process.env for configuration
- hub.ts has stale "cline.account.get_current" hub command

---

## Summary of Action Items

| Priority | Issue | Location | Action |
|----------|-------|----------|--------|
| HIGH | Test compilation failure | schema.test.ts:4 — ClineSettingsSchema | Rename to ZenuxsSettingsSchema |
| HIGH | Undefined variable in test | build-env.test.ts:77,109 — CLINE_BUILD_ENV_ENV | Replace with ZENUXS_BUILD_ENV_ENV |
| HIGH | AgentRuntimeConfig.maxIterations required vs optional | agent.ts:479 vs agents/types.ts:704 | Align |
| MEDIUM | Schema key Cline | remote-config/schema.ts:117 | Rename to Zenuxs |
| MEDIUM | API headers | llms/requests.ts:1-6 | Update branding |
| MEDIUM | Hub command cline.account.get_current | hub.ts:373 | Rename |
| MEDIUM | CLINE_VCR_* env vars | vcr.ts | Add Zenuxs aliases |
| MEDIUM | CLINE_SOURCEMAPS | bun.mts:10 | Rename |
| MEDIUM | isZenuxsProvider matches "cline" | providers/utils.ts:2 | Add "zenuxs" or migrate |
| LOW | Cline path funcs preferred | storage/paths.ts | Deprecate Cline versions |
| LOW | CLINE_API_BASE_URL fallback | zenuxs-environment.ts:90 | Prefer ZENUXS_API_BASE_URL |
| LOW | @cline/* in comments | 9 files | Update to @zenuxs/* |
| LOW | AutomationEventEnvelope duplication | cron/ + automation/ | Deduplicate |
| INFO | DEFAULT_MAX_ITERATIONS = 50 not imported in shared | agent.ts:9 | Verify external consumption |
| INFO | Subpath modules not in barrel | index.ts | Consider adding if needed |
