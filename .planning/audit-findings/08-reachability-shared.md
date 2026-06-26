# Reachability Audit: `packages/shared`

## Entry Points
- `apps/cli/src/index.ts` → `@cline/shared` (static: `initVcr`, `isHubDaemonProcess`, `disposeAll`)
- `apps/zenuxs-hub/src/server.ts` → `@cline/core` → re-exports `@cline/shared` (types only) + `@cline/shared/storage`
- `packages/core/src/index.ts` → re-exports everything from `@cline/shared` (qualifies all of shared as reachable via `@cline/core`)
- `packages/core/src/hub/daemon/entry.ts` → `@cline/shared` (static: `initVcr`, `resolveZenuxsBuildEnv`)
- `packages/agents/src/index.ts` → just re-exports agent types from `@cline/shared` (types only)
- `packages/llms/src/index.ts` → no runtime imports from `@cline/shared`
- `packages/llms/src/index.browser.ts` → no runtime imports from `@cline/shared`
- `packages/shared/src/index.ts` → barrel re-export of all modules (self-referential)
- `packages/shared/src/index.browser.ts` → subset barrel

## Reachability Summary

Every module in `packages/shared/src/` is REACHABLE because `packages/core/src/index.ts` re-exports `*` from `@cline/shared` and `@cline/core` is itself consumed by both entry points (`apps/cli` and `apps/zenuxs-hub`).

### Module-by-Module
| Module | Reachable | Notes |
|--------|-----------|-------|
| `agent.ts` | YES | Types only; exported via index.ts → core → consumers |
| `agents/index.ts` → `agents/types.ts` | YES | Types + Zod; exported via index.ts |
| `automation/` | YES | Types + Zod; exported via index.ts |
| `connectors/events.ts` | YES | Types + Zod; exported via index.ts |
| `connectors/options.ts` | YES | Types only; exported via index.ts |
| `cron/` | YES | Types only; exported via index.ts |
| `db/index.ts` → `db/sqlite-db.ts` | YES | Runtime: `loadSqliteDb`, `ensureSessionSchema` |
| `dispose.ts` | YES | Runtime: `registerDisposable`, `disposeAll` |
| `extensions/context.ts` | YES | Types only |
| `extensions/contribution-registry.ts` | YES | Types + runtime `ContributionRegistry` |
| `extensions/plugin.ts` | YES | Const only |
| `feature-flags.ts` | YES | Types + const |
| `hooks/contracts.ts` | YES | Types only |
| `hooks/events.ts` | YES | Types + Zod |
| `hub.ts` | YES | Runtime: `isHubProtocolCompatible` |
| `llms/ai-sdk-format.ts` | YES | Runtime: `formatMessagesForAiSdk` |
| `llms/gateway.ts` | YES | Types only |
| `llms/media.ts` | YES | Runtime: image validation |
| `llms/messages.ts` | YES | Types only |
| `llms/model-info.ts` | YES | Types + Zod |
| `llms/model-options.ts` | YES | Runtime |
| `llms/reasoning-effort.ts` | YES | Runtime |
| `llms/requests.ts` | YES | Runtime const |
| `llms/tokens.ts` | YES | Runtime: `estimateTokens` |
| `llms/tools.ts` | YES | Types + Zod |
| `logging/logger.ts` | YES | Types + const |
| `parse/error.ts` | YES | Runtime helpers |
| `parse/headers/utils.ts` | YES | Runtime: `parseKeyPairsIntoRecord` |
| `parse/json.ts` | YES | Runtime: `parseJsonStream` |
| `parse/shell.ts` | YES | Runtime |
| `parse/string.ts` | YES | Runtime |
| `parse/time.ts` | YES | Runtime |
| `parse/zod.ts` | YES | Runtime |
| `prompt/zenuxs.ts` | YES | Runtime |
| `prompt/system.ts` | YES | Runtime |
| `prompt/system-part.ts` | YES | Runtime |
| `prompt/format.ts` | YES | Runtime |
| `providers/utils.ts` | YES | Runtime |
| `remote-config/` | YES | Full tree (index → bundle, schema, constants, paths, artifact-store, blob-storage, materializer, runtime, telemetry) |
| `rpc/index.ts` | YES | Consts only |
| `rpc/runtime.ts` | YES | Types + small runtime |
| `rpc/team-progress.ts` | YES | Types + consts |
| `runtime/build-env.ts` | YES | Runtime |
| `runtime/zenuxs-environment.ts` | YES | Runtime |
| `runtime/hub-daemon-env.ts` | YES | Runtime |
| `services/telemetry.ts` | YES | Types only |
| `services/telemetry-config.ts` | YES | Runtime |
| `session/*` | YES | Runtime (all submodules) |
| `storage/index.ts` → `storage/paths.ts`, `storage/path-resolution.ts` | YES | Runtime |
| `team/` | YES | Types + Zod |
| `tools/definition.ts` | YES | Runtime |
| `tools/dispatch.ts` | YES | Runtime |
| `tools/create.ts` | YES | Runtime |
| `types/` | YES | Runtime + types |
| `vcr.ts` | YES | Runtime |

## Dead Code
None. Every source module in `packages/shared/src/` is transitively reachable from at least one entry point.

## Cross-Package Edges
- `remote-config/runtime.ts` imports `AgentExtension` (type-only) from `../agents/types` → creates a soft type dependency from shared → agents types
- `remote-config/bundle.ts` imports `AgentExtension` from `../agents/types` → same pattern
- These are type-level only; no runtime coupling

## Conclusion
`packages/shared` has no dead code. All 49+ source modules are reachable via `@cline/core` → entry points.
