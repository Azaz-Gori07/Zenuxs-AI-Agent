# Runtime Reachability Audit: `packages/llms/src`

**Date**: 2026-06-26
**Scope**: All `.ts` files under `packages/llms/src/` (excluding `tests/`)
**Entry points**: `index.ts`, `index.browser.ts`, `models.ts`, `providers.ts`, `providers.browser.ts`

---

## Summary Table

| Module | Reachable | Code Path |
|--------|-----------|-----------|
| **Barrel** | | |
| `index.ts` | ✅ Live | Package entry point |
| `index.browser.ts` | ✅ Live | Browser barrel |
| `models.ts` | ✅ Live | Re-exported from `index.ts` |
| `providers.ts` | ✅ Live | Re-exported from `index.ts` |
| `providers.browser.ts` | ✅ Live | Re-exported from `index.browser.ts` |
| **Catalog** | | |
| `catalog/types.ts` | ✅ Live | Re-exports from `@cline/shared`; consumed by `models.ts`, `catalog-live.ts`, `catalog.generated-access.ts`, `builtins.ts`, `config.ts`, `compat.ts`, `openai-codex-models.ts` |
| `catalog/catalog.generated.ts` | ✅ Live | Imported by `catalog.generated-access.ts` → `models.ts` → `index.ts` |
| `catalog/catalog.generated-access.ts` | ✅ Live | Imported by `models.ts` |
| `catalog/catalog-live.ts` | ✅ Live | Imported by `models.ts` and `catalog.generated-access.ts` |
| `catalog/catalog-zenuxs-recommended.ts` | **🔴 DEAD** | Only imported in `catalog-live.test.ts`; zero production imports |
| `catalog/model-id-aliases.ts` | ✅ Live | Imported by `models.ts` and `builtins.ts` |
| **Providers — Types / Config** | | |
| `providers/types.ts` | ✅ Live | Re-exports from `config.ts`, `handler.ts`, `messages.ts`, `stream.ts`; imported by `providers.ts`, `config.ts`, `compat.ts`, `factory-registry.ts` |
| `providers/config.ts` | ✅ Live | Imported by `types.ts` |
| `providers/handler.ts` | ✅ Live | Type exports via `types.ts` |
| `providers/messages.ts` | ✅ Live | Type exports via `types.ts` |
| `providers/stream.ts` | ✅ Live | Type exports via `types.ts` |
| `providers/ids.ts` | ✅ Live | Imported by `config.ts` → `types.ts` → `providers.ts`, also by `billing.ts` |
| **Providers — Core** | | |
| `providers/compat.ts` | ✅ Live | Imported by `providers.ts`; `createGatewayApiHandler`/`createGatewayApiHandlerAsync` called by `createHandler()`/`createHandlerAsync()` |
| `providers/factory-registry.ts` | ✅ Live | Imported by `providers.ts`; used by `createHandler()`/`createHandlerAsync()` |
| `providers/errors.ts` | ✅ Live | Exported from both barrels; `ClineNotSubscribedError` thrown in `builtins.ts:535`; `isClineNotSubscribedMessage` used in `builtins.ts` |
| `providers/gateway.ts` | ✅ Live | Imported by `compat.ts` and exported from `index.ts` |
| `providers/registry.ts` | ✅ Live | Imported by `gateway.ts` |
| `providers/builtins.ts` | ✅ Live | Imported by `model-registry.ts` and `builtins-runtime.ts` |
| `providers/builtins-runtime.ts` | ✅ Live | Imported by `compat.ts` and `gateway.ts` |
| `providers/ai-sdk.ts` | ✅ Live | Imported by `compat.ts` (static) and `builtins-runtime.ts` (dynamic) |
| `providers/model-registry.ts` | ✅ Live | Imported by `models.ts` and `billing.ts` / `compat.ts` |
| **Providers — Utilities** | | |
| `providers/format.ts` | ✅ Live | Imported by `ai-sdk.ts` |
| `providers/http.ts` | ✅ Live | Imported by `ai-sdk.ts` |
| `providers/model-facts.ts` | ✅ Live | Imported by `ai-sdk.ts` and all routing modules |
| `providers/async.ts` | ✅ Live | Imported by `gateway.ts` |
| `providers/billing.ts` | ✅ Live | Exported directly from both barrels |
| `providers/provider-keys.ts` | ✅ Live | Imported by `catalog-live.ts`; `resolveProviderModelCatalogKeys` exported from `index.ts` |
| `providers/provider-request-capture.ts` | ✅ Live | Imported by `ai-sdk.ts` |
| `providers/openai-codex-models.ts` | ✅ Live | Imported by `models.ts` and `builtins.ts` |
| **Providers — Routing** | | |
| `providers/routing/provider-options.ts` | ✅ Live | Imported by `ai-sdk.ts` |
| `providers/routing/provider-options-types.ts` | ✅ Live | Imported by `provider-options.ts` and `provider-option-rules.ts` |
| `providers/routing/provider-option-rules.ts` | ✅ Live | Imported by `provider-options.ts` |
| `providers/routing/anthropic-compatible.ts` | ✅ Live | Imported by `builtins.ts`, `ai-sdk.ts`, `provider-options.ts`, `generic-compatible.ts`, `provider-option-rules.ts` |
| `providers/routing/generic-compatible.ts` | ✅ Live | Imported by `provider-options.ts` and `provider-option-rules.ts` |
| `providers/routing/glm-thinking.ts` | ✅ Live | Imported by `builtins.ts` and `provider-option-rules.ts` |
| `providers/routing/minimax-thinking.ts` | ✅ Live | Imported by `builtins.ts` and `provider-option-rules.ts` |
| `providers/routing/reasoning-codecs.ts` | ✅ Live | Imported by `provider-option-rules.ts` |
| `providers/routing/utils.ts` | ✅ Live | Imported by all routing modules |
| **Providers — Middleware** | | |
| `providers/middleware/split-tool-images.ts` | ✅ Live | Imported by `vendors/openai-compatible.ts` and `vendors/mistral.ts` |
| **Providers — Vendors** | | |
| `providers/vendors/types.ts` | ✅ Live | Imported by `ai-sdk.ts` |
| `providers/vendors/anthropic.ts` | ✅ Live | Dynamic `import()` in `ai-sdk.ts:createProviderModule` |
| `providers/vendors/bedrock.ts` | ✅ Live | Dynamic `import()` in `ai-sdk.ts` |
| `providers/vendors/codex-cli.ts` | ✅ Live | Exported from `index.ts` (static) |
| `providers/vendors/community.ts` | ✅ Live | Dynamic `import()` in `ai-sdk.ts` (reused for claude-code, openai-codex, opencode, dify, sapaicore) |
| `providers/vendors/google.ts` | ✅ Live | Dynamic `import()` in `ai-sdk.ts` |
| `providers/vendors/minimax-thinking.ts` | **🔴 DEAD** | Not imported by any production file |
| `providers/vendors/mistral.ts` | ✅ Live | Dynamic `import()` in `ai-sdk.ts` |
| `providers/vendors/openai.ts` | ✅ Live | Dynamic `import()` in `ai-sdk.ts` |
| `providers/vendors/openai-compatible.ts` | ✅ Live | Dynamic `import()` in `ai-sdk.ts` |
| `providers/vendors/vertex.ts` | ✅ Live | Dynamic `import()` in `ai-sdk.ts` |
| **Services** | | |
| `services/` | N/A | Directory does not exist |

---

## Key Findings

### 1. Dead Code — `catalog/catalog-zenuxs-recommended.ts`
**Status**: 🔴 DEAD
**Evidence**: Only import is in `catalog/catalog-live.test.ts`. No production file imports `fetchZenuxsRecommendedProviderModels` or `normalizeZenuxsRecommendedProviderModels`. The `@cline/shared` endpoint at `/api/v1/ai/cline/recommended-models` is never called from this package at runtime.
**Risk**: Low. This appears to be an experimental or upcoming feature for ClinePass recommendations that is not wired into any production path.

### 2. Dead Code — `providers/vendors/minimax-thinking.ts`
**Status**: 🔴 DEAD
**Evidence**: Zero imports from any production `.ts` file. Contains a middleware (`miniMaxThinkingDisabledMiddleware`) and a fetch wrapper (`createMiniMaxThinkingFetch`) that are never referenced. The routing layer handles MiniMax thinking through `providers/routing/minimax-thinking.ts` (which is live), but the vendor-level middleware implementation sits unused.
**Risk**: Low. The routing module handles MiniMax thinking at the `providerOptions` level; this vendor-level fetch/middleware approach appears to be a superseded implementation.

### 3. Live — `providers/compat.ts` (Legacy ApiHandler Bridge)
**Status**: ✅ LIVE
**Callers**: `providers.ts` imports `createGatewayApiHandler` and `createGatewayApiHandlerAsync`. These are called by `createHandler()` and `createHandlerAsync()` respectively, which are exported from `index.ts`. Any consumer that calls `createHandler({ providerId: "..." })` routes through compat.
**Note**: Not dead — this is the default fallback handler for any non-registered provider.

### 4. Live — `providers/factory-registry.ts`
**Status**: ✅ LIVE
**Callers**: `providers.ts` imports `getRegisteredHandler`, `getRegisteredHandlerAsync`, `hasRegisteredHandler`, `isRegisteredHandlerAsync`, `registerHandler`, `registerAsyncHandler`. These are re-exported from `index.ts`.
**Note**: This is the extension point for custom handlers (e.g., VSCode LM). Built-in providers do NOT register through this; they use the builtins pipeline. But the registry is reachable and functional.

### 5. All Vendor Modules Are Dynamically Loaded
**Status**: Confirmed
**Mechanism**: `ai-sdk.ts:createProviderModule()` (lines 824-891) uses `await import()` for all vendor modules:
| Kind | Vendor Module |
|------|--------------|
| `openai` | `./vendors/openai` |
| `openai-compatible` | `./vendors/openai-compatible` |
| `anthropic` | `./vendors/anthropic` |
| `google` | `./vendors/google` |
| `vertex` | `./vendors/vertex` |
| `bedrock` | `./vendors/bedrock` |
| `mistral` | `./vendors/mistral` |
| `claude-code` | `./vendors/community` |
| `openai-codex` | `./vendors/community` |
| `opencode` | `./vendors/community` |
| `dify` | `./vendors/community` |
| `sapaicore` | `./vendors/community` |
**Exception**: `vendors/codex-cli.ts` has a static import from `index.ts` (line 83-89) — it exports `checkCodexCliInstalled`, `isOpenAICodexCliProvider`, and constants.

### 6. Live — `catalog/catalog-live.ts`
**Status**: ✅ LIVE
**Callers**: `models.ts` re-exports `fetchModelsDevProviderModels` and `sortModelsByReleaseDate`. `catalog.generated-access.ts` calls `sortModelsByReleaseDate` at startup to sort generated models. `fetchModelsDevProviderModels` is exported and available for consumers to fetch the live models.dev catalog.

### 7. Live — `providers/errors.ts` (ClineNotSubscribedError)
**Status**: ✅ LIVE
**Usage**: Exported from both barrels. `builtins.ts:535` throws `ClineNotSubscribedError` inside the ClinePass `onResponseError` handler when a 403 response body matches the subscription message. `isClineNotSubscribedMessage` is used to detect the condition.

### 8. `catalog/catalog.generated.ts` (23K lines)
**Status**: ✅ LIVE
**Code Path**: `catalog.generated.ts` → `catalog.generated-access.ts` (line 1) → `models.ts` (lines 1-4) → `index.ts` (lines 11-32)
**Note**: Despite its size, it is fully reachable and consumed by the model registry through the access layer.

---

## Reachability Graph (Simplified)

```
index.ts / index.browser.ts
├── models.ts
│   ├── catalog/catalog.generated-access.ts
│   │   ├── catalog/catalog.generated.ts (23K lines)
│   │   └── catalog/catalog-live.ts
│   │       └── providers/provider-keys.ts
│   ├── catalog/model-id-aliases.ts
│   ├── catalog/types.ts (re-exports from @cline/shared)
│   ├── providers/model-registry.ts
│   │   └── providers/builtins.ts
│   │       ├── catalog/catalog.generated-access.ts
│   │       ├── catalog/model-id-aliases.ts
│   │       ├── catalog/types.ts
│   │       ├── providers/errors.ts
│   │       ├── providers/openai-codex-models.ts
│   │       ├── routing/anthropic-compatible.ts
│   │       │   └── providers/model-facts.ts
│   │       ├── routing/glm-thinking.ts
│   │       └── routing/minimax-thinking.ts
│   └── providers/openai-codex-models.ts
├── providers.ts
│   ├── providers/types.ts
│   │   ├── providers/config.ts (← providers/ids.ts)
│   │   ├── providers/handler.ts (types)
│   │   ├── providers/messages.ts (types)
│   │   └── providers/stream.ts (types)
│   ├── providers/compat.ts  *** LIVE LEGACY BRIDGE ***
│   │   ├── providers/ai-sdk.ts
│   │   │   ├── providers/http.ts
│   │   │   ├── providers/format.ts
│   │   │   ├── providers/model-facts.ts
│   │   │   ├── providers/provider-request-capture.ts
│   │   │   ├── routing/anthropic-compatible.ts
│   │   │   ├── routing/provider-options.ts
│   │   │   │   ├── routing/generic-compatible.ts
│   │   │   │   ├── routing/provider-option-rules.ts
│   │   │   │   │   ├── routing/glm-thinking.ts
│   │   │   │   │   ├── routing/minimax-thinking.ts
│   │   │   │   │   ├── routing/reasoning-codecs.ts
│   │   │   │   │   └── routing/utils.ts
│   │   │   │   ├── routing/provider-options-types.ts
│   │   │   │   └── routing/utils.ts
│   │   │   ├── vendors/types.ts
│   │   │   └── → dynamic import() of all vendors
│   │   ├── providers/builtins-runtime.ts
│   │   ├── providers/gateway.ts
│   │   │   ├── providers/async.ts
│   │   │   ├── providers/builtins-runtime.ts
│   │   │   └── providers/registry.ts
│   │   └── providers/model-registry.ts
│   ├── providers/factory-registry.ts
│   └── providers/errors.ts
├── providers/billing.ts
│   ├── providers/ids.ts
│   └── providers/model-registry.ts
├── providers/gateway.ts (type + value exports)
├── providers/provider-keys.ts
└── providers/vendors/codex-cli.ts (static export)
```

---

## Recommendations

1. **Remove `catalog/catalog-zenuxs-recommended.ts`** — unless integration with the `/recommended-models` endpoint is planned. The test file `catalog-live.test.ts` that depends on it should be updated or removed too.

2. **Remove `providers/vendors/minimax-thinking.ts`** — the routing-layer equivalent (`providers/routing/minimax-thinking.ts`) handles MiniMax thinking. The vendor-level middleware + fetch wrapper are unused and superseded.

3. **Low priority**: Consider whether `providers/vendors/codex-cli.ts` static import from the barrel (`index.ts`) is intentional. All other vendor modules are dynamically loaded. This is not a bug, just a consistency note.
