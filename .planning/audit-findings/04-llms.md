# Audit: packages/llms (@cline/llms v0.0.51)

**Date**: 2026-06-26
**Scope**: Full source audit of D:\V3\zenuxs-code\packages\llms
**Package**: @cline/llms v0.0.51 — "Config-driven SDK for selecting, extending, and instantiating LLM providers and models"

---

## 1. Provider Landscape

### Provider Families (12 total)

| Family | Provider ID(s) | AI SDK Target | Test Coverage | Notes |
|--------|---------------|---------------|---------------|-------|
| openai | openai-native, openai-codex | "openai" | gateway.test.ts, nthropic.test.ts | Uses @ai-sdk/openai via provider.responses() |
| openai-compatible | 29 OpenAI-compatible providers (see below) | "openai-compatible" | gateway.test.ts | Generic fanout via @ai-sdk/openai-compatible |
| nthropic | nthropic, minimax | "anthropic" | nthropic.test.ts, gateway.test.ts | Uses @ai-sdk/anthropic; MiniMax wraps with thinking middleware |
| google | gemini | "google" | ertex.test.ts | Uses @ai-sdk/google |
| ertex | ertex | "vertex" | ertex.test.ts | Uses @ai-sdk/google-vertex |
| edrock | edrock | "bedrock" | edrock.test.ts | Uses @ai-sdk/amazon-bedrock |
| mistral | mistral | "mistral" | None | Uses @ai-sdk/mistral |
| claude-code | claude-code | "claude-code" | community.test.ts | Via i-sdk-provider-claude-code |
| openai-codex | openai-codex-cli (distinct from openai-codex family) | "openai-codex" | community.test.ts | Via i-sdk-provider-codex-cli |
| opencode | opencode | "opencode" | community.test.ts | Via i-sdk-provider-opencode-sdk; has signal handler workaround |
| dify | dify | "dify" | community.test.ts | Via dify-ai-provider |
| sap-ai-core | sapaicore | "sapaicore" | None | Via @jerome-benoit/sap-ai-provider |

### 29 OpenAI-Compatible Providers (in OPENAI_COMPATIBLE_SPECS)

deepseek, xai, 	ogether, ireworks, groq, poolside, cerebras, sambanova, 
ebius, aseten, equesty, litellm, huggingface, ercel-ai-gateway, 0, ihubmix, hicap, 
ousResearch, huawei-cloud-maas, qwen, qwen-code, doubao, zai, zai-coding-plan, moonshot, wandb, xiaomi, kilo, openrouter, ollama, lmstudio, oca, sksage, 
vidia

**Plus**: cline (Zenuxs), cline-pass (ClinePass)

**Total built-in providers**: ~47

### Provider Status

- **ALL providers** use the AI SDK (streamText() from the i package) — there is NO legacy streaming code for any vendor. All are wrapped via createAiSdkProvider(kind) in i-sdk.ts.
- The old ApiHandler / BaseHandler legacy handler system still exists in handler.ts for backward compatibility (the actory-registry.ts and compat.ts bridge), but all built-in providers go through the Gateway.
- **Vendors** (endors/*.ts) each produce an @ai-sdk/provider-compatible model using AI SDK provider SDKs (e.g., createAnthropic(), createOpenAI(), etc.).

---

## 2. Gateway System (gateway.ts + egistry.ts)

### Architecture

`
DefaultGateway (gateway.ts)
  ├── GatewayRegistry (registry.ts) — stores provider registrations + configs
  │     ├── registerProvider(registration) — stores manifest + factory
  │     ├── configureProvider(config) — overrides API keys, base URLs, model lists
  │     ├── resolveModel(selection) — resolves provider + model by ID
  │     └── createProvider(providerId) — lazy-loads factory, merges config
  ├── BUILTIN_PROVIDER_REGISTRATIONS — from builtins-runtime.ts
  └── stream(request) — main entry point
        ├── resolveModel → find provider + model
        ├── createProvider → instantiate the provider factory
        ├── resolveGatewayRequestMaxTokens → caps output tokens
        ├── estimateRequestInputTokens → estimates prompt size
        └── provider.stream(request, context) → actual LLM call
`

### Provider Option Routing Flow

1. DefaultGateway.stream() is called with GatewayStreamRequest
2. Registry resolves provider/model metadata
3. Factory creates provider (async, cached)
4. Provider's stream() method (in i-sdk.ts) calls composeAiSdkProviderOptions():
   - **Match rules**: matchProviderOptionRules() runs PROVIDER_OPTION_RULES table (18 rules)
   - **Suppress**: some rules suppress generic thinking/effort/fanout
   - **Build**: each rule returns a ProviderOptionsPatch
   - **Merge**: patches are merged in order (later overrides earlier)
5. Resulting providerOptions is passed to streamText() from the i package

---

## 3. Model Catalog

### Files

| File | Purpose |
|------|---------|
| catalog.generated.ts | Auto-generated model data (23,130 lines) — **NOT for manual editing** |
| catalog.generated-access.ts | Accessor with sorting/caching |
| catalog-live.ts | Fetches + normalizes live data from models.dev |
| catalog-zenuxs-recommended.ts | Fetches Zenuxs/ClinePass recommended models from piBaseUrl/api/v1/ai/cline/recommended-models |
| model-id-aliases.ts | Alias rules (e.g., z-ai/ → zai/) |
| 	ypes.ts | Zod schemas re-exporting from @cline/shared |

### Catalog Contents (catalog.generated.ts)

Generated model data for providers including: ihubmix, nthropic, edrock, cerebras, cline-pass, deepseek, doubao, ireworks, gemini, groq, huggingface, kilo, lmstudio, minimax, moonshot, 
ebius, 
ousResearch, 
vidia, oca, openai-native, openrouter, poolside, qwen, qwen-code, equesty, sambanova, sapaicore, 	ogether, 0, ercel-ai-gateway, wandb, xai, xiaomi, zai, zai-coding-plan

### Stale References in Catalog

- catalog-zenuxs-recommended.ts line 98: URL endpoint /api/v1/ai/cline/recommended-models contains "cline" in path
- Error messages reference "Cline recommended models"
- catalog.generated.ts header: Generated by: @cline/llms/scripts/generate-models.ts

---

## 4. Error Types (errors.ts)

| Error/Function | Type | Cline-specific? | Notes |
|---------------|------|-----------------|-------|
| ClineNotSubscribedError | Class extends Error | **YES** — name, message, providerId | 
ame = "ClineNotSubscribedError" |
| getClinePassSubscriptionUrl() | Function | **YES** | Returns {appBaseUrl}/dashboard/subscription/ |
| getClineNotSubscribedMessage() | Function | **YES** | Message about "ClinePass subscription" |
| isClineNotSubscribedError() | Type guard | **YES** | Checks instanceof |
| isClineNotSubscribedMessage() | Function | **YES** | Checks for CLINE_NOT_SUBSCRIBED_RESPONSE_MESSAGE |

**There are NO generic error types.** All exported errors are Cline-specific. The only custom error class is ClineNotSubscribedError. Other errors are standard Error instances thrown inline.

---

## 5. Routing System (outing/)

### Files

| File | Purpose | Test? |
|------|---------|-------|
| provider-option-rules.ts | **18 named rules** — the behavior matrix | No dedicated test |
| provider-options-types.ts | Types: AiSdkProviderOptionsTarget, ProviderOptionRule, ProviderOptionSuppression, MatchedProviderOptionRule | No |
| provider-options.ts | composeAiSdkProviderOptions() — orchestrates rule matching, builds final provider options | No |
| nthropic-compatible.ts | Anthropic thinking/cache routing logic: esolveAnthropicReasoningRequestPolicy(), uildAnthropicProviderOptions(), uildGatewayReasoningOptions(), prompt cache | nthropic-compatible.test.ts (503 lines) |
| generic-compatible.ts | OpenAI-compatible thinking/effort options: uildCompatibleProviderOptions(), uildOpenAINativeProviderOptions() | No |
| glm-thinking.ts | GLM thinking wire format (referenced in rules) | No |
| minimax-thinking.ts | MiniMax thinking wire format | minimax-thinking.test.ts |
| easoning-codecs.ts | OpenRouter reasoning encoding (uildOpenRouterReasoningOptions()) | No |
| utils.ts | Helpers: 	oProviderOptionsKey(), createEphemeralCacheControl(), uildProviderAndAliasPatch(), uildThinkingPatch() | No |
| split-tool-images.ts | **(MISSING)** — middleware lives in middleware/split-tool-images.ts instead | middleware/split-tool-images.test.ts |

### 18 Routing Rules (in order)

| # | Rule ID | Phase | Applies To | Suppresses |
|---|---------|-------|-----------|------------|
| 1 | provider.anthropic.direct | provider | nthropic provider | genericFanout |
| 2 | provider.google.direct | provider | google provider | genericFanout |
| 3 | dapter.openai | adapter | openai target | — |
| 4 | provider.openai-codex | provider | openai-codex provider | genericFanout |
| 5 | provider.generic-fanout | provider-fanout | non-openai targets (unless suppressed) | — |
| 6 | provider.cline.reasoning | provider-reasoning | Zenuxs providers | — |
| 7 | provider.openrouter.reasoning | provider-reasoning | openrouter | genericThinking, genericEffort |
| 8 | provider.cline.minimax-m3.gateway-reasoning | provider-reasoning | Zenuxs + MiniMax M3 | genericThinking, genericEffort |
| 9 | provider.vercel-ai-gateway.minimax-m3.gateway-reasoning | provider-reasoning | ercel-ai-gateway + MiniMax M3 | genericThinking, genericEffort |
| 10 | provider.google-gemini.thinking-config | provider | Google/Gemini/Vertex with reasoning | genericThinking, genericEffort |
| 11 | provider.cline.disable-thinking | provider | Zenuxs + Moonshot Kimi (non-K2.6) | — |
| 12 | amily.kimi-k2.6.thinking | model-family | Kimi K2.6 (not OpenRouter) | genericThinking |
| 13 | amily.deepseek.thinking | model-family | DeepSeek models | genericThinking |
| 14 | provider.ollama.reasoning-default-on.disable-none | provider-reasoning | Ollama with reasoning default-on & disabled | — |
| 15 | provider.routing.glm-thinking.non-glm.suppress-generic-thinking | provider | GLM-thinking providers + non-GLM model | genericThinking |
| 16 | provider.routing.glm-thinking | model-overlay | GLM thinking routing | genericThinking |
| 17 | provider.routing.minimax-thinking | model-overlay | MiniMax M3 thinking routing | genericThinking, genericEffort |
| 18 | amily.glm.routed-reasoning | model-overlay | GLM models (non-thinking route) | genericThinking |

### Three suppression flags
- genericThinking — suppress 	hinking: { type: "adaptive" } in compatible bucket
- genericEffort — suppress effort in compatible bucket
- genericFanout — suppress the catch-all provider-id bucket

### Rule Evaluation Order
1. Phase dapter → provider → provider-fanout → provider-reasoning → model-family → model-overlay

---

## 6. Stale Naming: Cline References

### Package Identity (still @cline/*)
- package.json: "name": "@cline/llms", "@cline/shared": "workspace:*"
- README.md: All references to @cline/llms, @cline/shared, @cline/agents, @cline/core
- AGENTS.md: # @cline/llms Development Guidance

### Class/Type/Function Names

| Symbol | Location | Cline-specific? |
|--------|----------|-----------------|
| ClineNotSubscribedError | errors.ts, exported from multiple entry points | YES |
| getClineNotSubscribedMessage() | errors.ts | YES |
| getClinePassSubscriptionUrl() | errors.ts | YES |
| isClineNotSubscribedError() | errors.ts | YES |
| isClineNotSubscribedMessage() | errors.ts | YES |
| CLINE_NOT_SUBSCRIBED_RESPONSE_MESSAGE | errors.ts constant | YES |
| CLINE_DEFAULT_MODEL_ID | uiltins.ts | YES |
| CLINE_PASS_PROVIDER_ID | uiltins.ts | YES |
| cline (variable) | uiltins.ts — the Cline builtin spec | YES |
| clinePass (variable) | uiltins.ts — the ClinePass builtin spec | YES |
| createClineLikeSpec() | uiltins.ts — helper for Cline-like providers | YES |
| uildClineModels() | uiltins.ts | YES |
| CLINE_API_KEY | uiltins.ts env var name | YES |
| BUILT_IN_PROVIDER.CLINE | ids.ts enum value | YES |
| BUILT_IN_PROVIDER.CLINE_PASS | ids.ts enum value | YES |

### URLs & Endpoints
- catalog-zenuxs-recommended.ts: Endpoint /api/v1/ai/cline/recommended-models
- Error messages mention "Cline" and "ClinePass"

### Comment References
- catalog-zenuxs-recommended.ts: Comments mention "cline-Pass models"
- catalog/README.md: Multiple "Cline" references in documentation
- providers/README.md: "Cline's conversation state", "Cline's final provider formatting"
- middleware/split-tool-images.ts: "classic Cline's"
- provider-keys.ts: "Maps provider identifiers across Cline legacy provider ids"
- handler.ts: "Convert Cline messages into provider-specific message format"

### Tests
- uiltins.test.ts: Tests reference "cline", "cline-pass", "ClinePass"
- catalog-live.test.ts: Tests reference "Cline recommended", "ClinePass"
- provider-vcr.test.ts: VCR test uses providerId: "cline"
- provider-live-minimax-routing.test.ts: Uses providerId: "cline"

### GitHub Repository
- package.json: "url": "https://github.com/cline/cline"

---

## 7. Test Coverage

### Test Framework: Vitest (itest.config.ts)

### Unit Tests (24 test files)

| Test File | Lines | Tests What |
|-----------|-------|------------|
| gateway.test.ts | ~4018 | Gateway registry, streaming, model resolution, max tokens logic |
| nthropic-compatible.test.ts | 503 | Model facts, prompt cache routing, reasoning policy |
| compat.test.ts | — | Legacy compatibility layer (ApiHandler bridge) |
| uiltins.test.ts | — | Builtin specs, model collections |
| i-sdk.test.ts | 371 | Usage normalization across provider formats |
| illing.test.ts | — | Cost display resolution |
| ormat.test.ts | — | Format utilities |
| http.test.ts | — | HTTP provider utilities (fetch, retry) |
| ids.test.ts | — | Provider ID normalization |
| model-id-aliases.test.ts | — | Alias rules |
| catalog-live.test.ts | — | Catalog normalization, ClinePass models |
| provider-options.test.ts | — | Provider option composition |
| split-tool-images.test.ts | — | Tool image split middleware |
| nthropic.test.ts | — | Anthropic vendor integration |
| edrock.test.ts | — | Bedrock vendor |
| community.test.ts | — | Community providers (Claude Code, OpenCode, Dify) |
| ertex.test.ts | — | Vertex AI vendor |
| minimax-thinking.test.ts | — | MiniMax thinking vendor |
| provider-live-config.test.ts | — | Live test config resolution |

### Live/VCR Tests (6 test files)

| File | Purpose |
|------|---------|
| provider-vcr.test.ts | VCR (cassette-based) replay tests |
| provider-live.test.ts | Live provider streaming tests |
| provider-live-tools.test.ts | Live tool-calling tests |
| provider-live-reasoning.test.ts | Live reasoning tests |
| provider-live-minimax-routing.test.ts | MiniMax routing live tests |
| provider-live-config.test.ts | Config validation for live tests |

### Coverage Gaps
- mistral.ts — no unit tests
- sap-ai-core — no unit tests
- outing/provider-option-rules.ts — no dedicated test (tested indirectly through provider-options tests)
- outing/generic-compatible.ts — no dedicated test
- outing/glm-thinking.ts — no dedicated test
- outing/reasoning-codecs.ts — no dedicated test
- outing/utils.ts — no dedicated test

---

## 8. Browser Support

### index.browser.ts vs index.ts

| Aspect | index.ts | index.browser.ts |
|--------|-----------|-------------------|
| Handler creation | createHandler(), createHandlerAsync(), getRegisteredHandler(), egisterHandler(), etc. | **NOT EXPORTED** |
| Gateway | createGateway(), DefaultGateway | **NOT EXPORTED** |
| Built-in provider types | ApiHandler, BuiltInProviderId, HandlerFactory, LazyHandlerFactory, ProviderConfig | **NOT EXPORTED** |
| Model stream types | ApiStreamChunk, ContentBlock, Message, ToolDefinition, etc. | **NOT EXPORTED** |
| Billing | esolveProviderUsageCostDisplay(), shouldShowProviderUsageCost() | **EXPORTED** |
| Cline errors | ClineNotSubscribedError, getClineNotSubscribedMessage(), isClineNotSubscribedError() | **EXPORTED** |
| Model catalog | getAllProviders(), getModelsForProvider(), getProvider(), egisterModel(), etc. | **EXPORTED** |
| Provider IDs | 
ormalizeProviderId(), ProviderCapability, ProviderId | **EXPORTED** (from providers.browser.ts) |
| Codex CLI | checkCodexCliInstalled(), isOpenAICodexCliProvider(), OPENAI_CODEX_CLI_PROVIDER_ID | **NOT EXPORTED** |
| Provider keys | esolveProviderModelCatalogKeys() | **NOT EXPORTED** |

**Browser entry point is a strict subset** — it exports only:
- Model catalog helpers (read-only)
- Billing display
- Cline error types and normalization
- No handler creation, no gateway, no streaming, no provider factory/registry

---

## 9. AI SDK Integration

### How i-sdk.ts Works

The createAiSdkProvider(kind) function (line 893) is a **higher-order factory** that returns a GatewayProviderFactory. For each incoming request:

1. **Resolve the AI SDK provider module** via createProviderModule(kind) — dynamic import to the appropriate vendor (endors/openai.ts, endors/anthropic.ts, etc.)
2. **Build AI SDK messages**: 	oAiSdkMessages() converts AgentMessage[] to AI SDK message format, handling:
   - Text, reasoning, file, image, tool-call, tool-result parts
   - system-update parts wrapped in XML
   - Anthropic reasoning signatures
   - Google thought signatures on tool calls
3. **Build AI SDK tools**: 	oAiSdkTools() converts tool definitions with JSON Schema validation
4. **Compose provider options**: composeAiSdkProviderOptions() runs the routing rules → produces providerOptions bucket
5. **Call streamText()** from the i package with:
   - Model from vendor factory
   - Messages, system prompt, tools, temperature, max tokens
   - bortSignal for cancellation
   - providerOptions for provider-specific wire encoding
   - onError callback for error capture + telemetry
6. **Emit events**: emitAiSdkEvents() iterates stream.fullStream, yielding 	ext-delta, easoning-delta, 	ool-call-delta, usage, inish events
7. **Normalize usage**: 
ormalizeUsage() handles tokens and cost across all provider formats

### What Providers Does It Wrap?

All 12 provider targets: openai, openai-compatible, nthropic, google, ertex, edrock, mistral, claude-code, openai-codex, opencode, dify, sapaicore

### AI SDK Provider Package Dependencies

| AI SDK Package | Used For |
|---------------|----------|
| @ai-sdk/openai | openai-native, openai-codex |
| @ai-sdk/openai-compatible | All OpenAI-compatible providers |
| @ai-sdk/anthropic | nthropic, minimax |
| @ai-sdk/google | gemini |
| @ai-sdk/google-vertex | ertex |
| @ai-sdk/amazon-bedrock | edrock |
| @ai-sdk/mistral | mistral |
| i-sdk-provider-claude-code | claude-code |
| i-sdk-provider-codex-cli | openai-codex-cli |
| i-sdk-provider-opencode-sdk | opencode |
| dify-ai-provider | dify |
| @jerome-benoit/sap-ai-provider | sapaicore |

---

## 10. Dead Code / Unreachable Modules

### services/ Directory
- **Empty** — src/services/ exists but has zero files. This is an intentional placeholder for telemetry services.

### Modules Not Exported From index.ts

The following modules exist but are **not publicly exported** (only accessible via internal imports):

| Module | Reachability |
|--------|-------------|
| providers/async.ts | Imported internally by gateway.ts for 	oAsyncIterable() |
| providers/config.ts | Re-exported via providers/types.ts barrel |
| providers/format.ts | Internal utility (error message extraction) |
| providers/handler.ts | Types re-exported via providers/types.ts |
| providers/messages.ts | Types re-exported via providers/types.ts |
| providers/model-facts.ts | Internal — model detection helpers |
| providers/model-registry.ts | Re-exported via models.ts |
| providers/provider-request-capture.ts | Internal — request capture debugging |
| providers/stream.ts | Types re-exported via providers/types.ts |
| providers/openai-codex-models.ts | Re-exported via models.ts |
| providers/vendors/*.ts | Internal — vendor provider modules, loaded dynamically by i-sdk.ts |
| providers/routing/*.ts | Internal — provider option routing |
| providers/middleware/*.ts | Internal — middleware loaded by vendors |
| catalog/catalog-live.ts | Re-exported via models.ts |
| catalog/catalog-zenuxs-recommended.ts | Internal — used by model generation script |

### Potential Dead/Duplicate Code

1. **providers/builtins-runtime.ts vs providers/builtins.ts**: Runtime registration (BUILTIN_PROVIDER_REGISTRATIONS) is separate from the spec definitions (BUILTIN_SPECS). uiltins-runtime.ts is the runtime bridge that maps families to factory functions. This is intentional separation.

2. **providers/compat.ts**: The entire legacy compatibility layer (GatewayApiHandler, createGatewayApiHandler(), createGatewayApiHandlerAsync()) exists solely to bridge the old ApiHandler interface to the new Gateway. This is backward-compat code — not dead, but transitional.

3. **providers/factory-registry.ts**: Custom handler registration (egisterHandler(), egisterAsyncHandler()) — allows third-party handlers to override built-in providers. This is extension API code.

4. **providers/ids.ts**: The BUILT_IN_PROVIDER enum defines aliases and includes all built-in providers. The enum is used for type safety and normalization.

### Not Dead But Worth Noting

- outing/split-tool-images.ts does not exist at the expected path — the actual middleware lives at middleware/split-tool-images.ts. The routing directory only contains files related to provider option routing.
- The services/ directory is an empty placeholder (potentially for future OpenTelemetry integration).

---

## Summary of Key Findings

1. **Renaming needed**: The package still has pervasive @cline/ naming (package name, error classes, provider IDs, environment variables, comments, URLs). Full rename to @zenuxs/llms (or whatever the new brand is) would touch: package.json, README.md, AGENTS.md, errors.ts, builtins.ts, ids.ts, provider-keys.ts (comment), handler.ts (comment), catalog files, test files, env var names (CLINE_API_KEY, CLINE_CAPTURE_*).

2. **Error types are all Cline-specific**: No generic error hierarchy exists. ClineNotSubscribedError is the only custom error class.

3. **ALL providers use AI SDK**: No legacy streaming code. The old ApiHandler interface is bridged through compat.ts but all built-in providers go through the Gateway.

4. **Routing system is mature**: 18 named rules across 6 phases, with a clean suppression mechanism. The rule table approach in provider-option-rules.ts is well-designed per the AGENTS.md guidance.

5. **Test coverage is good but has gaps**: Mistral, SAP AI Core, and several routing modules lack dedicated unit tests. The gateway test is very comprehensive (~4000 lines).

6. **Browser support is read-only**: The browser bundle exports only model catalog queries and error checking — no streaming, no handler creation, no gateway.

7. **services/ is an empty directory**: A placeholder that could be removed or documented as intentionally empty.

8. **Catalog is generated**: catalog.generated.ts (23K lines) is auto-generated from models.dev and should not be manually edited.
