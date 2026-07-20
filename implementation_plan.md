# Zenuxs-Code Quality Assurance & Stability Program

## Mission

Transform Zenuxs-Code into a production-grade AI coding platform by performing a **complete engineering audit, bug hunt, architecture validation, and end-to-end testing**.

---

## Phase 1 — Developer Settings Audit

Audit the entire **Settings → Developer** page end-to-end.

### 1.1 UI Layout & Components
- [ ] Verify all 8 sidebar tabs render correctly (Provider, Skills, Auto Approves, Execution, MCP, Plugins, About, Developer)
- [ ] Verify Developer tab icon (CodeIcon) displays
- [ ] Verify DeveloperLogsView mounts/unmounts cleanly when switching tabs
- [ ] Verify VirtualList renders with correct overscan
- [ ] Verify JsonView inspector panel opens/closes
- [ ] Verify filter panel toggle (show/hide filters)
- [ ] Verify export menu toggle (show/hide export options)
- [ ] Verify responsive layout at various widths
- [ ] Verify dark mode / light mode theme variables apply correctly

### 1.2 State Management
- [ ] Verify `entries` state grows correctly with incoming logs
- [ ] Verify 100k entry cap works (ring buffer eviction)
- [ ] Verify `bufferRef` batched flush via requestAnimationFrame
- [ ] Verify `paused` flag stops live entry forwarding
- [ ] Verify `autoScroll` works and toggles
- [ ] Verify `selectedEntry` state for detail inspector
- [ ] Verify `filter` state (search, regex, categories, levels, providers, models, sessions, conversations, date range)
- [ ] Verify filter options dropdowns populate from live data
- [ ] Verify filter reset on `DEFAULT_FILTER`

### 1.3 IPC Communication
- [ ] Verify `subscribe` message flow: webview → postMessage → chat-view-provider → loggerService.subscribe()
- [ ] Verify `unsubscribe` message flow: cleanup on unmount
- [ ] Verify `developer_logs_batch` messages arrive at webview
- [ ] Verify backlog replay on subscribe (existing entries sent first)
- [ ] Verify `clear` action: loggerService.clear() + webview state reset
- [ ] Verify `pause` / `resume` actions toggle `this.developerPaused`
- [ ] Verify `webview_log` messages from webview forward to loggerService

### 1.4 LoggerService Core Audit
- [ ] Verify ring buffer max size enforcement (default 50k)
- [ ] Verify pub/sub: subscribe returns unsubscribe function
- [ ] Verify `replay()` sends backlog to new subscribers
- [ ] Verify `getEntries()` returns current buffer snapshot
- [ ] Verify `clear()` empties buffer and notifies subscribers
- [ ] Verify `maskSecret()` / `maskSecretString()` redacts API keys
- [ ] Verify persistence to disk with debounced writes
- [ ] Verify monotonic seq numbers (no duplicates, no gaps)
- [ ] Verify timestamps are accurate
- [ ] Verify no memory leaks on repeated subscribe/unsubscribe cycles
- [ ] Verify thread safety (async log calls from multiple sources)

### 1.5 Log Category Instrumentation Audit
Verify each of these 20 categories **actually emits logs** during real usage:

| # | Category | Emitter in developer-logs.ts | Wired in source modules? |
|---|----------|------------------------------|--------------------------|
| 1 | auth | ✅ devLogsAuth (sessionStart, login, oauth*, apiKeyAuth) | strategy.ts? |
| 2 | provider | ✅ devLogsProvider (registered, configured, switched, failed) | ? |
| 3 | model | ✅ devLogsModel (selected, loaded) | handler-factory.ts? |
| 4 | api_request | ✅ devLogsRequest (sent, retrying) | ? |
| 5 | api_response | ✅ devLogsResponse (received, error) | ? |
| 6 | streaming | ✅ devLogsStream (started, chunk, firstToken, complete, error) | handler-factory.ts? |
| 7 | tool | ✅ devLogsTool (selected, started, result, error) | ? |
| 8 | agent | ✅ devLogsAgent (planning, step, completed) | ? |
| 9 | conversation | ✅ devLogsConversation (created, loaded, saved) | ? |
| 10 | prompt | ✅ devLogsPrompt (built, injected, compacted) | ? |
| 11 | memory | ✅ devLogsMemory (loading, synced, error) | zenuxs-memory.ts? |
| 12 | api_key | ✅ devLogsApiKey (added, updated, deleted) | local-provider-service.ts? |
| 13 | storage | ✅ devLogsStorage (read, write, delete, error) | sqlite-session-store.ts? |
| 14 | network | ✅ devLogsNetwork (online, offline, request, response, error) | ? |
| 15 | performance | ✅ devLogsPerformance (metric, threshold) | ? |
| 16 | extension | ✅ devLogsExtension (activated, deactivated, command, reload) | extension.ts ✅ |
| 17 | ui | ✅ devLogsUi (mounted, unmounted, interaction) | ? |
| 18 | error | ✅ devLogsError (captured, handled, unhandled) | ? |
| 19 | console | ✅ devLogsConsole (log, info, warn, error, debug) | extension.ts ✅ |
| 20 | insights | ✅ devLogsInsights (connected, failed, retry, dropped) | ? |

For each "?" — find the source module that should be calling it, verify wiring exists, and if missing, add it.

### 1.6 Actions
- [ ] Verify **Copy** copies selected/filtered logs to clipboard
- [ ] Verify **Clear** clears the log view
- [ ] Verify **Pause** stops live log updates
- [ ] Verify **Resume** restarts live log updates
- [ ] Verify **Export JSON** produces valid JSON file
- [ ] Verify **Export CSV** produces valid CSV
- [ ] Verify **Export TXT** produces plain text
- [ ] Verify **Export Markdown** produces markdown table
- [ ] Verify export respects current filters (only exports filtered view)
- [ ] Verify export with empty selection shows appropriate message

### 1.7 Search & Filters
- [ ] Verify plain text search filters logs
- [ ] Verify regex search works
- [ ] Verify invalid regex doesn't crash (graceful fallback)
- [ ] Verify category multi-select filter
- [ ] Verify level multi-select filter
- [ ] Verify provider filter dropdown populates
- [ ] Verify model filter dropdown populates
- [ ] Verify session filter dropdown populates
- [ ] Verify conversation filter dropdown populates
- [ ] Verify date range filter (from/to)
- [ ] Verify multiple filters stack correctly
- [ ] Verify filter reset clears all filters

### 1.8 Performance
- [ ] Verify VirtualList renders smoothly with 10k+ entries
- [ ] Verify batched rAF flush doesn't drop frames
- [ ] Verify 100k entry cap prevents OOM
- [ ] Verify filter computation is performant (useMemo)
- [ ] Verify JsonView lazy-renders (only for selected entry)
- [ ] Verify subscribe/unsubscribe cycle doesn't leak memory

### 1.9 Error Handling
- [ ] Verify component renders with empty log state
- [ ] Verify loading state on initial subscription (before first batch)
- [ ] Verify error state if IPC message fails
- [ ] Verify recovery after IPC disconnect
- [ ] Verify invalid filter regex doesn't crash
- [ ] Verify malformed log entries don't crash render

---

## Phase 2 — Complete Repository Validation

### 2.1 Package-by-Package Audit
Audit every file in every package:

```
apps/
  vscode-extension/  → 1892 lines (chat-view-provider), extension.ts, webview/*
  zenuxs-hub/        → webview, server, API routes
  cli/               → commands, auth, config
packages/
  core/              → 269 source files, 119 test files
  llms/              → 47 built-in providers, gateway, registry
  agents/            → agent definitions, tools
  shared/            → types, schemas, utilities
```

For each file:
- [ ] Find dead code (unused exports, unreachable branches)
- [ ] Find unused imports
- [ ] Find circular dependencies
- [ ] Find duplicate logic/types/components
- [ ] Find orphan files (not imported by anything)
- [ ] Verify every exported API is used

### 2.2 Known Issues from Existing Audit
Items from `.planning/audit-findings/` that need fixes:

**@cline/shared:**
- [ ] Fix stale `Cline` naming → `Zenuxs` in schema keys, env vars, headers, comments
- [ ] Fix broken test import (ClineSettingsSchema → ZenuxsSettingsSchema)
- [ ] Remove dead code paths (unused exports)
- [ ] Deduplicate `AutomationEventEnvelope` types

**@cline/core:**
- [ ] Fix stale `Cline` references in error messages, comments
- [ ] Fix unused exports
- [ ] Fix broken test imports
- [ ] Audit session-runtime-orchestrator safety logic (loop detection, mistake tracker)

**@cline/llms:**
- [ ] Fix stale `cline.bot` headers in requests.ts
- [ ] Fix unused provider specs
- [ ] Verify all 47 providers have valid configurations

---

## Phase 3 — Pipeline Validation

### 3.1 Pipeline Dependency Verification
For each pipeline, verify the step order is correct:

| Pipeline | Expected Steps | Validated? |
|----------|---------------|------------|
| Extension Startup | activate → registerCommands → initLogger → initProvider → mountWebview | [ ] |
| Session Creation | createSession → initMemory → initContext → startStream | [ ] |
| Chat Send | buildPrompt → injectMemory → agentPlan → toolSelect → toolExecute → stream → render | [ ] |
| Settings Save | webview → postMessage → chat-view-provider → core → persist | [ ] |
| Streaming | provider.stream → chunk → parse → accumulate → emit → render | [ ] |
| Tool Execution | select → validate → execute → result → accumulate → next | [ ] |
| Checkpoint/Restore | serialize → store → list → select → deserialize → restore | [ ] |
| Shutdown | disposeWebview → closeSession → flushStorage → unregisterCommands | [ ] |

### 3.2 Pipeline Gap Analysis
- [ ] Find broken transitions between steps
- [ ] Verify error propagation between steps
- [ ] Verify timeout/retry between steps
- [ ] Verify cleanup on step failure

---

## Phase 4 — Feature Testing

### 4.1 Feature Status Matrix

| Feature | Status | Working | Tested |
|---------|--------|---------|--------|
| Chat | ? | ? | ? |
| Streaming | ? | ? | ? |
| Sessions | ? | ? | ? |
| Conversation History | ? | ? | ? |
| Providers | ? | ? | ? |
| Models | ? | ? | ? |
| API Keys | ? | ? | ? |
| OAuth | ? | ? | ? |
| Memory | ? | ? | ? |
| File Editing | ? | ? | ? |
| File Creation | ? | ? | ? |
| Tool Calling | ? | ? | ? |
| Search | ? | ? | ? |
| Workspace Integration | ? | ? | ? |
| Checkpoints | ? | ? | ? |
| MCP | ? | ? | ? |
| Settings | ? | ? | ? |
| Developer Page | ? | ? | ? |
| Logs | ? | ? | ? |
| Extension Commands | ? | ? | ? |
| CLI | ? | ? | ? |
| Hub | ? | ? | ? |
| Auto Approvals | ? | ? | ? |
| Thinking/Reasoning | ? | ? | ? |
| Context Compaction | ? | ? | ? |

For each feature, test and report: Working / Broken / Partial / Missing

---

## Phase 5 — Stress & Error Injection Testing

### 5.1 Stress Tests
- [ ] 1000+ chat messages in single session
- [ ] 100+ concurrent sessions
- [ ] Rapid provider switching (50x in 10s)
- [ ] Large workspace (10k+ files)
- [ ] Long conversation (500+ turns)
- [ ] Large context window (100k+ tokens)
- [ ] Continuous streaming for 30+ minutes
- [ ] High-frequency logging (10k events/sec)
- [ ] Extension reload cycles (20x)

### 5.2 Error Injection Tests
- [ ] Invalid API Key → graceful error + log entry
- [ ] Expired OAuth → re-auth prompt
- [ ] Network offline → retry + queue
- [ ] Provider timeout → retry + fallback
- [ ] HTTP 500 → retry + log
- [ ] HTTP 429 → backoff + retry
- [ ] Streaming failure → reconnect
- [ ] Corrupted settings → backup restore
- [ ] Missing database → auto-create
- [ ] SQLite lock → retry
- [ ] Invalid tool arguments → validation error

---

## Phase 6 — Final QA Report

### Deliverables
- [ ] Bugs Fixed — complete list with severity
- [ ] Bugs Remaining — known issues with workarounds
- [ ] Dead Code Removed — quantified
- [ ] Pipeline Issues — resolved
- [ ] Feature Coverage — complete matrix
- [ ] Test Coverage — gaps identified
- [ ] Performance Metrics — before/after
- [ ] Security Findings — addressed
- [ ] Regression Risks — documented
- [ ] Technical Debt — prioritized
- [ ] Production Readiness Score (1-10)

---

## Execution Order

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6
```

Begin with Phase 1 (Developer Settings Audit) and proceed sequentially.
