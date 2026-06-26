# Deep Audit: pps/zenuxs-hub (@zenuxs/zenuxs-hub v0.0.0)

Audit date: 2026-06-26
Package: pps/zenuxs-hub (workspace root: D:\V3\zenuxs-code)
Description: "Browser dashboard for the Cline hub: live clients, sessions, streaming chat, and hub restart."

---

## 1. Server Architecture

### Entry Point: src/server.ts

The server starts via startClineHubDashboardServer() which:

1. **Creates a single HubContext** instance — the shared mutable runtime state (see §2).
2. **Attaches to the hub** via ttachHub(ctx):
   - Calls ensureDetachedHubServer(workspaceRoot) to spawn/find a local detached hub.
   - Creates a ClineCore instance (client name: "zenuxs-hub", client type: "zenuxs-hub-chat").
   - Creates a HubUIClient instance (client type: "zenuxs-hub-server", display name: "Zenuxs Hub Server").
   - Subscribes to hub UI events (subscribeUI) for real-time client/session/event updates.
   - Subscribes to the ClineCore event stream (ctx.cline.subscribe) for chunk/agent/status/end events.
3. **Starts a health-check interval** (every 5s) that pings the hub health endpoint and broadcasts state to all peers.
4. **Starts a Bun HTTP+WebSocket server** on the configured host/port.

### HTTP Endpoints

| Path | Method | Response |
|------|--------|----------|
| /version | GET | { coreVersion: "..." } |
| /health | GET | Hub health payload (status, uptime, clients, sessions) |
| /browser | GET/WS | WebSocket upgrade — the **main real-time channel** (authorized via oomSecret) |
| /config.json | GET | { inviteRequired, publicUrl } |
| /api/marketplace/catalog | GET | Marketplace catalog JSON (proxied from https://cline.github.io/marketplace/catalog.json) |
| /* (SPA routes) | GET | Webview static assets (built dist/webview/ or Vite dev server) |

### SPA Webview Routes (handled by WebviewAssets.serve())

/, /index.html, /chat, /sessions, /models, /customizations, /rules, /hooks, /mcp, /plugins, /skills, /agents, /tools, /marketplace, /marketplace/mcp, /marketplace/skills, /marketplace/plugins, /channels, /schedules, /settings, /settings/*

In dev mode (VITE_DEV_SERVER_URL set), all SPA routes serve a dynamic HTML shell that loads from the Vite dev server for hot reload.

### Module Architecture

`
server.ts (entry)
  ├── server/state.ts          HubContext (central state)
  ├── server/deps.ts           Resolved options, paths, provider settings manager
  ├── server/http.ts           WebviewAssets, JSON/text responses, route matching
  ├── server/hub.ts            attach/detach/restart hub, sync clients & sessions
  ├── server/sessions.ts       Session CRUD, messaging, forks, restores
  ├── server/session-mapping.ts Format hub session records to webview types
  ├── server/state-payloads.ts HubState payload construction, broadcast
  ├── server/approvals.ts      Tool approval request/response lifecycle
  ├── server/agent-events.ts   Streaming agent event forwarding (chunks, tools, reasoning)
  ├── server/providers.ts      Provider listing, model loading, OAuth, settings save
  ├── server/marketplace.ts    Marketplace catalog fetch, install/uninstall MCP/skills/plugins
  ├── server/desktop-commands.ts  RPC bridge for ~30+ desktop commands
  ├── server/connectors.ts     Connector channel start/stop (imports from CLI)
  ├── server/schedules.ts      Routine schedule CRUD via HubScheduleService
  ├── server/mcp.ts            MCP settings file read/write/upsert/delete
  ├── server/user-instructions.ts  List rules, workflows, skills, agents, plugins, tools, hooks
  └── server/utils.ts          Type coercions, format helpers, external URL opener
`

---

## 2. Hub State (src/server/state.ts)

The HubContext class is the **single shared mutable runtime state**:

`	ypescript
class HubContext {
  readonly peers = new Set<BrowserPeer>();          // Connected browser tabs
  readonly clients = new Map<string, TrackedClient>();  // Hub-connected clients
  readonly sessions = new Map<string, TrackedSession>(); // Active sessions
  readonly pendingToolApprovals = new Map<string, PendingToolApproval>();
  readonly events: WebviewHubEvent[] = [];           // Event log (max 30)

  hubUrl = "";               // E.g. http://127.0.0.1:63241
  hubAuthToken = "";          // Auth token for hub API
  hubHealthy = false;         // Last health check result
  cline: ClineCore | undefined;  // Core API client
  uiClient: HubUIClient | undefined;  // UI event subscription client
  hubStartedAt: string | undefined;
  coreVersion: string | undefined = CORE_BUILD_VERSION;
  lastSessionContext: SessionContext | undefined;  // Most recent session's provider/model/workspace
  initialHubEventEmitted = false;
}
`

Key methods:
- send(peer, payload) — JSON-serialize and send to one peer
- roadcast(payload) — send to all peers
- pushEvent(title, body, severity) — add to event log
- sendToSelectedPeers(sessionId, payload) — send only to peers watching a given session
- hasSelectedPeer(sessionId) — check if any peer is watching a session

Types:
- **BrowserPeer**: { socket, displayName, selectedSessionId?, unsubscribeEvents?, sending }
- **TrackedClient**: { clientId, displayName?, clientType, connectedAt }
- **TrackedSession**: { sessionId, status, title, workspaceRoot?, cwd?, provider?, model?, source?, createdAt, updatedAt, createdByClientId?, prompt?, inputTokens?, outputTokens?, totalCost?, agentCount, participantCount }
- **PendingToolApproval**: { sessionId, resolve, timeout }
- **SessionContext**: { workspaceRoot, cwd, providerId, modelId }

---

## 3. WebSocket Communication

### Connection Flow

1. Browser connects to ws://host:port/browser?roomSecret=... (WebSocket upgrade).
2. If ROOM_SECRET is configured, the server validates it against the query parameter.
3. On upgrade, a BrowserPeer is created with a random display name and added to ctx.peers.
4. On open, the socket is stored in the peer data.
5. On message, the raw payload is parsed as BrowserFrame (a discriminated union of WebviewInboundMessage types).
6. On close, the peer's event subscriptions are cleaned up, and orphaned approvals are rejected.

### Inbound Message Types (Browser → Server)

| Type | Handler | Purpose |
|------|---------|---------|
| eady | initializePeer() | First message: sync state, send defaults/providers/sessions/hubState |
| send | sendMessage() | Send a user prompt (creates new session if none selected) |
| bort | bortPeerTurn() | Abort the current assistant turn |
| eset | esetPeer() | Detach from current session |
| ttachSession | selectSession() | Load a specific session's history |
| deleteSession | deleteSession() | Delete a session from the hub |
| updateSessionMetadata | inline | Update session title/metadata |
| orkSession | orkPeerSession() | Fork current session into a new one |
| estore | estorePeerSession() | Restore from a checkpoint |
| estart_hub | estartHub() | Detach, stop, respawn hub, reconnect |
| desktopCommand | handleDesktopCommand() | RPC bridge for ~30+ commands |
| loadModels | loadModels() | Load models for a provider |
| loadProviderCatalog | sendProviderCatalog() | Load full provider catalog |
| saveProviderSettings | saveProviderSettings() | Update provider config |
| unProviderOAuthLogin | unProviderOAuthLogin() | Trigger OAuth login |
| pproval_response | handleToolApprovalResponse() | Approve/reject tool |

### Outbound Message Types (Server → Browser)

See WebviewOutboundMessage in src/webview-protocol.ts (lines 273-344). Key types:
- hub_state — Full state snapshot (clients, sessions, connectors, events)
- session_started, session_hydrated — Session lifecycle
- ssistant_delta, easoning_delta, 	ool_event — Streaming output
- 	urn_done — Turn completion with finish reason and usage
- pproval_request, pproval_resolved — Approval lifecycle
- providers, provider_catalog, models, sessions — Data payloads
- defaults — Default provider/model/workspace
- desktopCommandResult — RPC response
- status, error — Status messages

### Browser-Side Communication (src/webview/src/vscode.ts)

The webview uses a dual transport:
1. If window.acquireVsCodeApi exists (i.e., running inside VS Code), it uses VS Code's postMessage/getState/setState.
2. Otherwise (browser standalone), it creates a WebSocket connection to ws://<host>/browser and persists state via localStorage.

Messages are dispatched to window as MessageEvents so React components listen uniformly via window.addEventListener("message", ...).

---

## 4. Session Management

### Session Model (TrackedSession)
Sessions track: id, status ("running", "idle", "completed", etc.), title, workspace, provider, model, source, timestamps, cost, agent count.

### Key Operations (src/server/sessions.ts)

| Operation | Function | Details |
|-----------|----------|---------|
| **Select** | selectSession() | Sets peer.selectedSessionId, loads message history, sends session_started + session_hydrated |
| **Create** | createSession() | Calls ctx.cline.start(), tracks in ctx.sessions, sends the initial prompt |
| **Send** | sendMessage() | If no session selected, auto-creates one; otherwise sends to existing session |
| **Delete** | deleteSession() | Calls ctx.cline.delete(), cleans up peer selection |
| **Reset** | esetPeer() | Detaches from session, rejects pending approvals |
| **Abort** | bortPeerTurn() | Calls ctx.cline.abort() |
| **Fork** | orkPeerSession() | Reads full message history, creates a new session with that history |
| **Restore** | estorePeerSession() | Calls ctx.cline.restore() with a checkpoint run count |
| **Initialize** | initializePeer() | Sends full state snapshot to a newly connected peer |

### Session Context Resolution (esolveLaunchContext)
Priority for provider/model selection:
1. Explicit override from WebviewConfig
2. ctx.lastSessionContext (most recent hub session)
3. providerSettingsManager.getLastUsedProviderSettings()
4. Environment variables CLINE_PROVIDER / CLINE_MODEL

### Agent Event Forwarding (src/server/agent-events.ts)
- chunk → ssistant_delta (streaming text to peers watching the session)
- gent_event → forward to next: easoning_delta, 	ool_event (input, update, output), 	urn_done, error
- status → update TrackedSession.status + broadcast
- ended → set status to "completed" + broadcast

---

## 5. Provider Marketplace

### Catalog Fetching (src/server/marketplace.ts)
- Fetches from CLINE_MARKETPLACE_CATALOG_URL (default https://cline.github.io/marketplace/catalog.json)
- Returns raw JSON with catalog entries (MCP, skills, plugins)
- Also exposed via /api/marketplace/catalog HTTP endpoint

### Installation Types
| Type | Mechanism |
|------|-----------|
| **MCP** | Writes to cline_mcp_settings.json via upsertMcpServer() |
| **Skill** | Runs 
px -y skills@latest add ... -g -a cline -y |
| **Plugin** | Runs cline plugin install ... --json via the local CLI |

### Desktop Command Integration
- install_marketplace_entry / uninstall_marketplace_entry — resolve from catalog, then install/uninstall
- list_marketplace_installed_entries — check current install status for a list of entries
- uninstall_local_primitive — uninstall MCP by name, plugin by name/path, skill/workflow by file path

### Security
- Secrets redaction in command output (pi_key, 	oken, secret, password, Bearer)
- Desktop commands resolve from server catalog to prevent tampering with install args from browser

---

## 6. Webview (React Frontend)

### Structure
`
src/webview/src/
  main.tsx          — React entry, theme observer, renders <App>
  App.tsx           — Shell layout (sidebar), routing, hub state display, sessions list
  Chat.tsx          — Full chat interface (streaming, approvals, forks, checkpoints)
  vscode.ts         — Transport bridge (WebSocket ↔ window messages)
  index.css         — Tailwind CSS
  lib/
    desktop-client.ts       — RPC client for desktop commands (request/response pattern)
    marketplace.ts          — Marketplace catalog fetch + types (client-side)
    theme.ts                — Light/dark theme management
    utils.ts                — cn() for class merging
    provider-schema.ts      — Provider config field types (possibly shared/dead)
    provider-model-catalog.ts — Provider/model loading via desktop client (possibly dead)
    provider-id.ts          — Provider ID normalization aliases (possibly dead)
    model-selection.ts      — Model selection persistence (possibly dead)
  components/
    Composer.tsx            — Chat input bar (model selector, send/abort)
    TeamTasks.tsx           — Team task visualization
    ui/*                    — shadcn/ui components (40+ files)
    ai-elements/*           — AI chat UI components (50+ files)
    views/
      page-layout.tsx       — PageFrame/PageHeader shell
      marketplace-view.tsx  — Marketplace browser (may be dead/unused)
      settings/*            — Settings sections (account, channels, extensions, MCP, providers, routines)
`

### App.tsx Views
- **home** — Hub dashboard: connected clients, active sessions, recent events, restart hub button
- **sessions** — Filterable/sortable session list with rename and delete
- **chat** — Full chat interface (streaming text, reasoning, tools, approvals, fork, checkpoint restore)
- **settings** — General, Providers, MCP, Channels, Schedules, Account
- **models** → Providers settings
- **channels** → Channels settings
- **schedules** → Schedules settings
- **mcp/plugins/skills/rules/hooks/agents/tools** — Customization section views with marketplace integration

### Communication Pattern
- Messages are sent via postToHost() which resolves to either cquireVsCodeApi().postMessage() or WebSocket send
- Incoming messages are dispatched as window MessageEvent and handled in useEffect listeners
- Session history/reconnection: merges live streaming state with hydrated history on session attach

---

## 7. Dependencies

### package.json Dependencies (only 3, all workspace:*)
- @cline/core — ClineCore, HubUIClient, ProviderSettingsManager, core types
- @cline/llms — Message type, LLM provider interfaces
- @cline/shared — Shared types (HubUINotifyPayload, ToolApprovalResult, ToolApprovalRequest, storage paths)

### Runtime
- Uses **Bun** exclusively (Bun.serve, Bun.file, Bun.spawn) — no Node.js HTTP server
- Webview uses **Vite** for build/dev
- webview package.json declares its own deps (React, Tailwind, lucide-react, radix-ui, etc.)

### Config files reference
- 	sconfig.json — extends base, maps @cline/core and @cline/shared to sdk/packages
- itest.config.ts — test runner configuration

---

## 8. Stale Naming: Cline/CLINE_ References

### Exported types/interfaces (server-side)
- ClineHubDashboardServer — exported interface
- startClineHubDashboardServer() — exported function
- printClineHubDashboardServerInfo() — exported function
- printClineHubDashboardServerInfo() — console logs say "Cline Hub dashboard" and "Cline Hub invite URL"

### Environment variables (all CLINE_* prefixed)
| Variable | Used In |
|----------|---------|
| CLINE_HUB_DASHBOARD_PORT | options.ts (default port) |
| CLINE_HUB_WEBVIEW_DEV_HOST | dev.ts |
| CLINE_HUB_WEBVIEW_DEV_PORT | dev.ts |
| CLINE_HUB_WEBVIEW_DIST_DIR | deps.ts |
| CLINE_PROVIDER | sessions.ts, providers.ts (fallback provider) |
| CLINE_MODEL | sessions.ts, providers.ts (fallback model) |
| CLINE_WRAPPER_PATH | marketplace.ts (CLI invocation) |
| CLINE_DIR | marketplace.ts (global install dir) |
| CLINE_MCP_SETTINGS_PATH | marketplace test + user-instructions test |
| CLINE_MARKETPLACE_CATALOG_URL | marketplace.ts (default URL) |
| CLINE_BUILD_ENV | connectors.ts |
| CLINE_GLOBAL_SETTINGS_PATH | user-instructions.test.ts |

### Comments and strings
- README.md extensively references "Cline hub", "ClineCore", "CLINE_PROVIDER", "CLINE_MODEL"
- state.ts: "Shared mutable runtime state for the Cline Hub server"
- server.ts: "Cline Hub dashboard listening", "Cline Hub public URL", "Cline Hub invite URL"
- marketplace.ts: esolveClineInvocation(), OFFICIAL_PLUGINS_REPO = "https://github.com/cline/plugins.git"
- Error messages: "No provider/model available. Start a session in another Zenuxs client first, or set CLINE_PROVIDER and CLINE_MODEL."
- Test strings: "Cline SDK", "Installed Cline SDK globally for Zenuxs.", "runs skills globally for Cline"

### Observations
- The codebase is in **active migration** from "Cline" → "Zenuxs" naming.
- Server types/functions (startClineHubDashboardServer) still use "Cline" prefix.
- Environment variables (the CLINE_* namespace) are inherited from the upstream Cline project and would require coordinated changes across all Cline-dependent packages to rename.
- The webview uses "Zenuxs Hub" in all UI labels.
- The /cline-logo-filled.svg asset and GitHub issue link (github.com/cline/cline) suggest partial migration.

---

## 9. Dead Code Assessment

### Likely Unused Modules (Server-side)
- **server/connectors.ts** — exported functions connectorChannelsPayload(), startConnectorChannel(), stopConnectorChannel() are called only from desktop-commands.ts (via handleDesktopCommand RPC). Not dead, but tightly coupled to CLI module imports.
- **server/user-instructions.ts** — listUserInstructionConfigs() called from desktop-commands.ts and marketplace.ts. In use.
- **server/schedules.ts** — called only from desktop-commands.ts. In use.
- **server/mcp.ts** — called from marketplace.ts and desktop-commands.ts. In use.

### Webview lib files (potentially dead/redundant)
| File | Notes |
|------|-------|
| lib/provider-schema.ts | Defines Provider/ProviderModel/ProviderConfigField types — may be superseded by webview-protocol.ts types |
| lib/provider-model-catalog.ts | ProviderModelCatalog loading via desktop client — check if model-selection.ts replaces this |
| lib/provider-id.ts | 
ormalizeProviderId() — aliases "openai"→"openai-native", "google"→"gemini" |
| lib/model-selection.ts | Model selection persistence — check if logic in Chat.tsx (which uses vscode API state) duplicates this |

### Webview components
- **iews/marketplace-view.tsx** — appears to be a dedicated marketplace browser; verify it is imported by any route (App.tsx maps marketplace routes to CustomizationSectionView, not this).
- **i-elements/** — 50+ components, most are imported by views (Chat.tsx imports checkpoint, conversation, message, reasoning, tool, TeamTasks).
- **settings-patch.ts** — referenced in the file tree, likely applies patch overrides to settings components.

### No barrel/index files
- No index.ts exists anywhere in src/. All imports are direct file paths.

---

## 10. Test Coverage

### Existing Tests

| File | Lines | Scope | Notes |
|------|-------|-------|-------|
| server/marketplace.test.ts | 870 | Marketplace installer | MCP parsing, skill install/uninstall, plugin install/uninstall, catalog fetch, secret redaction, edge cases (empty args, non-writable dir, missing install result). **Most comprehensive test file.** |
| server/http.test.ts | 54 | Webview route matching, HTML normalization | Route matching for SPA routes, asset URL rewriting, theme bootstrap injection. |
| server/user-instructions.test.ts | 70 | Plugin display name resolution | Verifies listUserInstructionConfigs resolves package.json name for plugins. |
| webview/lib/desktop-client.test.ts | 71 | Desktop client RPC | Transport failure detection, pending request rejection. |

### Missing Test Coverage

| Module | Risk |
|--------|------|
| server/state.ts (HubContext) | No tests for state management, broadcast, event push |
| server/hub.ts | No tests for attach/detach/restart, sync, health check |
| server/sessions.ts | No tests for session CRUD, message send, fork, restore |
| server/session-mapping.ts | No tests for 	rackSession, mapHistoryToWebviewMessages, parseSessionContext |
| server/approvals.ts | No tests for approval lifecycle |
| server/agent-events.ts | No tests for event forwarding |
| server/connectors.ts | No unit tests (depends on CLI modules) |
| server/schedules.ts | No tests |
| server/mcp.ts | No unit tests (partially covered by marketplace tests) |
| server/providers.ts | No tests |
| server/desktop-commands.ts | No tests (large surface area, 30+ commands) |
| server/utils.ts | No tests for type coercions, format helpers |
| webview/ (React) | No component tests for App, Chat, Composer, settings views |

### Test Configuration
- itest.config.ts — likely minimal config (extends from workspace root)
- Test runner: unx vitest run --config vitest.config.ts
- Webview tests excluded from server tsconfig ("exclude": ["src/webview/**"])

---

## Summary

@zenuxs/zenuxs-hub is a **feature-rich browser dashboard** for the Cline/Zenuxs hub with:

- **Comprehensive hub state management** — live clients, sessions, events, approvals
- **Full WebSocket-based real-time communication** — streaming text, reasoning, tool events
- **Session management** — create, select, delete, fork, restore from checkpoints
- **Provider marketplace integration** — install/uninstall MCP, skills, plugins
- **Desktop command RPC bridge** — 30+ backend operations exposed to webview
- **React SPA frontend** — 40+ shadcn UI components, 50+ AI chat elements, settings views

### Key Concerns
1. **Rebranding incomplete**: All exported server APIs and environment variables use Cline/CLINE_ — a coordinated rename to Zenuxs/ZENUXS_ across the monorepo is pending.
2. **Test coverage gaps**: Core server logic (state, hub, sessions, approvals) has no tests; desktop commands (30+ RPC handlers) are untested.
3. **CLI module coupling**: connectors.ts and state-payloads.ts import from ../../../cli/src/ — creates a tight cross-package dependency.
4. **Potential dead frontend code**: Several lib/ modules and marketplace-view.tsx may be superseded or unused.
5. **No barrel exports**: All imports are direct relative paths; no index.ts files.
6. **Error messages mixed**: Some reference "Cline", others "Zenuxs".
