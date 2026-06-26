# Audit: packages/core (@cline/core v0.0.51)

**Date:** 2026-06-26
**Working Tree:** D:\\V3\\zenuxs-code
**Scope:** packages/core (269 TypeScript source files, 119 test files)
**Test Framework:** vitest (via vitest.config.ts + vitest.e2e.config.ts)

---

## 1. Loop Prevention

### 1.1 untime/safety/loop-detection.ts (162 lines)

**What exists:**
- Pure helpers (createLoopDetectionState, esetLoopDetectionState, 	oolCallSignature, checkRepeatedToolCall) ported from @cline/shared
- LoopDetectionTracker class — a per-session repeated-tool-call detector with configurable thresholds:
  - softThreshold: default **3** identical consecutive calls → "soft" warning
  - hardThreshold: default **5** identical consecutive calls → "hard" escalation
- LoopDetectionConfig type imported from @cline/shared
- LoopDetectionVerdict output: { kind: "ok" | "soft" | "hard", message?: string }
- inspect(call) method: takes { name, input }, computes a JSON-key-sorted signature
- eset() method to clear state

**Iteration limit:** Yes — the hardThreshold (default 5) acts as a hard iteration limit. When hit, it returns kind: "hard" with a message like *"Detected N consecutive identical calls to \	oolName\; stopping to avoid a loop."*

### 1.2 untime/safety/mistake-tracker.ts (221 lines)

**What exists:**
- MistakeTracker class — per-session consecutive-mistake counter
- Configurable maxConsecutiveMistakes (default 6, set in session-runtime-orchestrator.ts line 406)
- Mistake reasons: "api_error" | "invalid_tool_call" | "tool_execution_failed"
- MistakeOutcome: { action: "continue", guidance? } or { action: "stop", message, reason? }
- On limit reached: calls optional onLimitReached callback; if absent, defaults to stop
- Recovery notice mechanism: appends guidance as a user message to the conversation
- orceAtLimit option: jumps straight to max on a single record

**How they interact (in session-runtime-orchestrator.ts):**
- On 	urn-finished: if all tools failed → MistakeTracker.record({ reason: "tool_execution_failed" })
- On 	ool-started: LoopDetectionTracker.inspect() — soft verdict appends a recovery notice; hard verdict feeds MistakeTracker.record({ forceAtLimit: true })
- When MistakeTracker returns "stop" → appends stop message to conversation + calls ctiveRuntime.abort()

---

## 2. DoomLoopDetector

A **separate, simpler** loop detector exists in extensions/tools/registry.ts (lines 54-67):

`	ypescript
export class DoomLoopDetector {
  private history = new Map<string, number>();
  check(toolName: string, input: unknown): boolean {
    // Returns true when the same tool+input appears 3+ times
  }
  reset(): void { this.history.clear(); }
}
`

- Threshold: hard-coded **3** (DOOM_LOOP_THRESHOLD)
- Used by ToolRegistry (same file, line 75) which exposes isDoomLoop(toolName, input)
- Exported via extensions/index.ts → index.ts for consumers

**Where used:**
1. extensions/tools/registry.ts — ToolRegistry uses it internally
2. extensions/tools/enhanced-index.ts — createAllEnhancedTools() returns a doomDetector instance
3. Exported at package level via index.ts

**Relationship to LoopDetectionTracker:**
- **DoomLoopDetector** = simpler, hard-coded threshold of 3, returns boolean. Ported from OpenCode.
- **LoopDetectionTracker** = more sophisticated, configurable thresholds, soft/hard verdicts, JSON-signature-key-sorted input normalization. Designed for runtime integration as a eforeTool hook.
- Both exist in the codebase simultaneously. The LoopDetectionTracker is the "new" per-session detector; DoomLoopDetector is legacy port from OpenCode.

---

## 3. Runtime Builder Flow

### Flow: untime-builder.ts → session-runtime-orchestrator.ts → session-runtime.ts

#### 3.1 session-runtime.ts (85 lines — interface-only)
Defines SessionRuntime interface with lifecycle: start(), send(), bort(), stop(), poll()
Defines RuntimeBuilder interface: uild(input: RuntimeBuilderInput) → Promise<BuiltRuntime>
Defines BuiltRuntime shape: tools, hooks, logger, telemetry, teamRuntime, extensions, completionPolicy, shutdown

#### 3.2 untime-builder.ts (736 lines — DefaultRuntimeBuilder)
The main implementation of RuntimeBuilder:
1. Normalizes config (mode, enableTools, enableSpawnAgent, etc.)
2. Loads user instruction config (rules/skills/workflows)
3. Creates user instruction plugin extension
4. Builds built-in tools list (respects mode preset: act/plan/search/minimal/yolo)
5. Loads MCP tools from settings file (unless disabled)
6. Loads configured agents for spawn-agent capability
7. Sets up team runtime (AgentTeamsRuntime) with persistence store
8. Bootstraps team tools (spawn, management, task, messaging)
9. Applies tool policies, disabled tool filters
10. Returns BuiltRuntime with completion policy, team completion guard

#### 3.3 session-runtime-orchestrator.ts (1375 lines — SessionRuntime class)
The per-session orchestrator, not to be confused with the interface:
- Constructor: creates ConversationStore, MessageBuilder, ContributionRegistry, MistakeTracker (max 6), LoopDetectionTracker
- un(userMessage) → resets trackers, calls executeRun({ isContinue: false })
- continue(userMessage) → calls executeRun({ isContinue: true })
- executeRunInternal:
  1. Guards: shutdownCalled, already running
  2. Appends user message to conversation store
  3. Composes system prompt from rules
  4. Creates agent model from config
  5. Merges extension tools + config tools
  6. Creates AgentRuntime via createAgentRuntimeConfig + createAgentRuntime
  7. Subscribes to runtime events (tracking tool calls, mistakes, loops)
  8. Calls untime.run("") or untime.continue(undefined) — empty string so no duplicate user message
  9. Drains tracker work (mistake/loop side-effects)
  10. Replaces conversation store with runtime's message trail
  11. Builds legacy AgentResult

#### How a Session Starts (end-to-end):
1. User calls ZenuxsCore.start(input)
2. start() calls 	oZenuxsCoreStartInput(), then prepare() if configured, then host.startSession()
3. RuntimeHost.startSession() (e.g., LocalRuntimeHost) creates a SessionRuntime(orchestrator), constructs config via DefaultRuntimeBuilder.build(), registers lead agent, and starts the first turn
4. SessionRuntime.run(prompt) → executes the cycle: compose system prompt → build runtime config → create AgentRuntime → subscribe events → run → drain → build result
5. Returns StartSessionResult with sessionId, manifest, event subscription

---

## 4. Safety Rules (untime/safety/rules.ts)

**File:** 49 lines.

Pure utility functions for user-defined rule handling:

| Function | Purpose |
|---|---|
| isRuleEnabled(rule) | Returns true unless ule.disabled === true |
| ormatRulesForSystemPrompt(rules) | Renders rules as ## RuleName\\ninstructions blocks |
| mergeRulesForSystemPrompt(primary, additional) | Combines two rule strings with a blank line |
| listEnabledRulesFromWatcher(watcher) | Lists enabled rules from the UserInstructionConfigWatcher sorted by name |
| loadRulesForSystemPromptFromWatcher(watcher) | One-call convenience: list + format |

No complex rule engine — just markdown formatting helpers. The actual rule loading/parsing happens in extensions/config/user-instruction-config-loader.ts.

---

## 5. Tool Definitions

### Built-in (Default) Tools — extensions/tools/definitions.ts

9 tool types defined via factory functions:

| Tool Name | Factory | Default Enabled | Description |
|---|---|---|---|
| ead_files | createReadFilesTool | Yes | Read file content with optional line ranges |
| search_codebase | createSearchTool | Yes | Regex pattern search across codebase |
| un_commands | createBashTool / createWindowsShellTool | Yes | Shell command execution (platform-specific) |
| etch_web_content | createWebFetchTool | Yes | URL content fetching |
| pply_patch | createApplyPatchTool | No (false) | Freeform patch grammar application |
| editor | createEditorTool | Yes | Controlled file edits (insert/replace/create) |
| skills | createSkillsTool | Yes | Invoke configured skills by name |
| sk_question | createAskQuestionTool | Yes | Ask user a question with 2-5 options |
| submit_and_exit | createSubmitAndExitTool | No (false) | Final answer submission (completesRun: true) |

### Tool Presets — extensions/tools/presets.ts

5 presets based on CoreAgentMode:

| Preset | Bash | Editor | Search | WebFetch | Skills | AskQuestion | Submit&Exit | SpawnAgent | AgentTeams |
|---|---|---|---|---|---|---|---|---|---|
| **act** (default) | Yes | Yes | Yes | Yes | Yes | Yes | No | Yes | Yes |
| **plan** | Yes | No | Yes | Yes | Yes | Yes | No | Yes | Yes |
| **search** | No | No | Yes | No | No | No | No | Yes | Yes |
| **minimal** | Yes | No | No | No | No | No | No | Yes | No |
| **yolo** | Yes | Yes | No | No | No | No | Yes | No | No |

### Team Tools — extensions/tools/team/team-tools.ts

**18 team tools** defined in TEAM_TOOL_NAMES:

| Tool | Purpose |
|---|---|
| 	eam_spawn_teammate | Spawn a teammate agent |
| 	eam_shutdown_teammate | Shutdown a teammate |
| 	eam_status | Team snapshot (members, tasks, mailbox) |
| 	eam_task | Task CRUD (create/list/claim/complete/block) |
| 	eam_run_task | Route task to teammate (sync or async) |
| 	eam_cancel_run | Cancel an async run |
| 	eam_list_runs | List teammate runs |
| 	eam_await_runs | Wait for async runs to complete |
| 	eam_send_message | Direct mailbox message |
| 	eam_broadcast | Broadcast to all teammates |
| 	eam_read_mailbox | Read mailbox (unread only, marks read) |
| 	eam_mission_log | Append mission log entry |
| 	eam_cleanup | Clean up team runtime |
| 	eam_create_outcome | Create converged outcome |
| 	eam_attach_outcome_fragment | Attach fragment to outcome section |
| 	eam_review_outcome_fragment | Review/reject outcome fragment |
| 	eam_finalize_outcome | Finalize outcome |
| 	eam_list_outcomes | List outcomes |

### Enhanced/OpenCode Tools — extensions/tools/enhanced-index.ts

Additional tools ported from OpenCode:

| Tool Name | Source File |
|---|---|
| ead | ile-read-enhanced.ts |
| write | editor-enhanced.ts |
| edit | editor-enhanced.ts |
| glob | glob-grep-enhanced.ts |
| grep | glob-grep-enhanced.ts |
| ash (shell) | shell-enhanced.ts |
| webfetch | web-enhanced.ts |
| websearch | web-enhanced.ts |
| 	odowrite | 	odo-enhanced.ts |
| plan_exit | 	odo-enhanced.ts |

### Total Unique Tool Types: 
- 9 default tools
- 18 team tools
- ~10 enhanced tools (OpenCode port)
- Unlimited MCP tools (loaded from settings)
- Unlimited plugin tools

---

## 6. "Cline" Naming Analysis

### Intentional References to Upstream Project:
| Category | Examples |
|---|---|
| **Package name (correct)** | @cline/core, @cline/agents, @cline/shared, @cline/llms |
| **Env vars** | CLINE_DIR, CLINE_DATA_DIR — used for data directory resolution |
| **Auth tokens** | esolveLocalClineAuthToken, ClinePass, ClineNotSubscribedError |
| **OAuth** | loginClineOAuth, getValidClineCredentials — WorkOS-based Cline auth |
| **Storage paths** | esolveClineDataDir(), esolveClineDir() from @cline/shared/storage |
| **User-Agent** | \Cline/\\` in API headers |
| **Comment references** | "parity with original Cline's", "the SDK analog of original Cline's" |

### Stale/Renamed to Zenuxs:
| Pattern | Status |
|---|---|
| ZenuxsCore (class) | Renamed from Cline |
| ZenuxsCoreStartInput, ZenuxsCoreOptions, etc. | Renamed |
| ZenuxsAccountService | Renamed |
| zenuxs.bot (PostHog host) | Renamed |
| uildZenuxsSystemPrompt | Renamed |
| createZenuxsCore... functions | Renamed |
| ZenuxsCoreAutomationApi | Renamed |

### Summary:
The package uses "Cline" intentionally for upstream project references (package names, environment variables, auth services, storage paths). All public API surfaces use "Zenuxs" branding. Comments occasionally reference "original Cline" for legacy parity explanations.

---

## 7. ZenuxsCore.start()

### Signature:
`	ypescript
start(input: StartSessionInput | ZenuxsCoreStartInput): Promise<StartSessionResult>
`

### Flow:
1. 	oZenuxsCoreStartInput(input) — normalizes input, extracts core config from localRuntime
2. 	his.prepare?.(input) — optional bootstrap hook from options
3. ootstrap.applyToStartSessionInput(input) — mutate input if bootstrap exists
4. 	his.host.startSession(normalizeZenuxsCoreStartInput(...)) — delegates to runtime host
5. Stores bootstrap in ctiveSessionBootstraps map if session is active
6. Emits session.started telemetry event
7. Returns StartSessionResult

### Returns Promise<StartSessionResult>:
`	ypescript
interface StartSessionResult {
  sessionId: string;
  manifest: SessionManifest;
  manifestPath: string;
  messagesPath: string;
  subscription?: { unsubscribe(): void };
}
`

### Attached methods on ZenuxsCore:
| Method | Delegates to |
|---|---|
| send(sessionId, prompt) | host.runTurn() |
| bort(sessionId) | host.abort() |
| stop(sessionId) | host.stopSession() + disposeSessionBootstrap() |
| get(sessionId) | host.getSession() |
| list(limit, options) | listSessionHistory(host, ...) |
| delete(sessionId) | host.deleteSession() + cleanup |
| update(sessionId, data) | host.updateSession() |
| eadMessages(sessionId) | host.readSessionMessages() |
| estore(input) | host.restoreSession() |
| subscribe(listener, options) | host.subscribe() |
| updateSessionModel(...) | host as RuntimeHostServiceExtensions |
| getAccumulatedUsage(...) | host as RuntimeHostServiceExtensions |
| dispose() | host.dispose() + automation cleanup |
| ingestHookEvent(...) | host.dispatchHookEvent() |

---

## 8. Hub Integration (hub/index.ts)

**Exports from @cline/core/hub:**

| Export | Source |
|---|---|
| ITelemetryService | Re-export from @cline/shared |
| HubScheduleCommandService | cron/service/schedule-command-service.ts |
| HubScheduleService | cron/service/schedule-service.ts |
| ConfiguredTelemetryHandle | services/telemetry/OpenTelemetryProvider.ts |
| createConfiguredTelemetryHandle | services/telemetry/OpenTelemetryProvider.ts |
| createConfiguredTelemetryService | services/telemetry/OpenTelemetryProvider.ts |
| All client/* exports | Hub client connection, session client, UI client |
| All daemon/* exports | Daemon entry, runtime handlers, shared server startup |
| All discovery/* exports | Hub discovery, defaults, workspace lock |
| All server/* exports | WebSocket server, browser WebSocket, transports |

Additional hub entry exports from the main index.ts:
- HubRuntimeHost — for hub mode session execution
- RemoteRuntimeHost — for remote runtime sessions

---

## 9. Telemetry

### Core Components:

| Component | File | Purpose |
|---|---|---|
| ITelemetryAdapter | ITelemetryAdapter.ts | Interface: emit, emitRequired, recordCounter, recordHistogram, recordGauge, flush, dispose |
| OpenTelemetryAdapter | OpenTelemetryAdapter.ts | Adapter wrapping OTel metrics (counter, histogram, gauge) + logs |
| OpenTelemetryProvider | OpenTelemetryProvider.ts | Creates MeterProvider, LoggerProvider, NodeTracerProvider with console/OTLP exporters |
| TelemetryService | TelemetryService.ts | Multi-adapter fanout service implementing ITelemetryService |
| TelemetryLoggerSink | TelemetryLoggerSink.ts | Debug adapter logging to BasicLogger |
| OptedOutTelemetryService | OpenTelemetryProvider.ts | No-op adapter when telemetry is opted out |

### OpenTelemetry Exporters:
- **Console** (ConsoleLogRecordExporter, ConsoleMetricExporter, ConsoleSpanExporter)
- **OTLP HTTP** (OTLPLogExporterHttp, OTLPMetricExporterHttp, OTLPTraceExporter)

### PostHog Integration:
- **PostHog for Feature Flags** only — services/feature-flags/posthog.ts
- PostHogFeatureFlagsProvider implements IFeatureFlagsProvider
- uildClinePostHogClient() creates a PostHog client pointed at https://data.zenuxs.bot
- PostHog for telemetry events is **not** in core — it's consumed as an optional peer dependency posthog-node

### Telemetry Event Coverage:
services/telemetry/core-events.ts defines numerous event capture functions:
- Session lifecycle: captureAgentCreated, captureAgentTeamCreated
- Auth: captureAuthStarted, captureAuthSucceeded, captureAuthFailed, captureAuthLoggedOut
- Tools: captureToolUsage, captureDiffEditFailure, captureSubagentExecution
- Compaction: captureCompactionExecuted, captureCompactionSkipped
- Workspace: captureWorkspaceInitialized, captureWorkspacePathResolved, captureWorkspaceInitError
- Other: captureModeSwitch, captureMentionUsed, captureProviderConfigured, captureTaskCompleted

---

## 10. Test Patterns

### Test Framework: **Vitest**
- itest.config.ts — node environment, includes src/**/*.test.ts, excludes *.e2e.test.ts
- itest.e2e.config.ts — separate config for end-to-end tests

### Test Statistics:
- **119 test files** (.test.ts) across the source tree
- Also .e2e.test.ts files (3 found: local-runtime-host.e2e.test.ts, untime-parity.test.ts, compaction.live.test.ts)

### Testing Patterns:
1. **Mocked runtime host** — Tests mock createRuntimeHost from ./runtime/host/host using i.mock() + i.hoisted()
2. **Isolated temp directories** — mkdtempSync, mSync for filesystem tests
3. **describe/it/expect** — Standard vitest BDD style
4. **i.fn() mocks** — Heavy use of manual mock objects for host, telemetry, etc.
5. **i.hoisted()** — For hoisted mock factories
6. **process.platform guards** — (isWindows ? it.skip : it) for platform-specific tests

### Key Test Files:
- ZenuxsCore.test.ts (635 lines) — Core lifecycle, start, restore, telemetry, bootstraps
- untime-builder.test.ts — RuntimeBuilder assembly
- session-runtime-orchestrator.test.ts — SessionRuntime orchestration
- local-runtime-host.test.ts + .e2e.test.ts — Full local runtime
- untime/safety/rules.test.ts — Safety rule formatting
- Various *.test.ts files co-located with implementation

---

## Summary Statistics

| Metric | Count |
|---|---|
| TypeScript source files | 269 |
| Test files (.test.ts) | 119 |
| E2E test files (.e2e.test.ts) | 3 |
| Built-in tool types | 9 |
| Team tool types | 18 |
| Enhanced tool types (OpenCode port) | ~10 |
| Tool presets | 5 (act, plan, search, minimal, yolo) |
| Telemetry adapters | 2 real (OpenTelemetry + TelemetryService), 1 no-op (OptedOut) |
| Mistake tracker limit | Default 6 (configurable) |
| Loop detection thresholds | Soft: 3, Hard: 5 (configurable) |
| DoomLoopDetector threshold | Hard-coded 3 |
| OpenCode ported systems | Agent system, Context system, Enhanced tools, Permission checker |

**Key architectural notes:**
- Package is in active migration from legacy Cline patterns to Zenuxs naming
- Two loop detection systems coexist (legacy DoomLoopDetector, new LoopDetectionTracker)
- Session runtime orchestrator fully rewritten from legacy Agent class
- Hub provides WebSocket-based daemon for shared runtime hosting
- Telemetry supports optional PostHog via peer dependency; OpenTelemetry is built-in
