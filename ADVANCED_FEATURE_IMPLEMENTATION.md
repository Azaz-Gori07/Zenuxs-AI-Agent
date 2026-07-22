# Advanced Zenuxs Feature Implementation

## Overview

This document provides a comprehensive investigation, architecture review, implementation plan, and validation for all advanced Zenuxs features. Every feature is traced through UI → Webview → Extension → Backend → Runtime → Agent Pipeline → Tool Execution → Result.

---

## 1. Investigation Results

### 1.1 Skills

| Layer | Status | Details |
|-------|--------|---------|
| UI | ❌ Fake data | `skills-view.tsx` has hardcoded sample skills, "Coming Soon" for create/worktree features |
| Webview Protocol | ❌ Missing | No `get_skills`/`install_skill`/`configure_skill` RPC commands in protocol |
| Desktop Commands | ❌ Missing | No skill handlers in `desktop-commands.ts` |
| Settings Service | ✅ List/Toggle | `CoreSettingsService.list()` and `.toggle()` can list and toggle skill frontmatter |
| Skill Config | ✅ Partial | `SkillConfig` type exists, `toggleSkillFrontmatter` exists |
| CLI Command | ⚠️ Wrapper | `skill.ts` is a thin `npx skills@latest` wrapper — delegates all work externally |
| Runtime | ❌ Missing | No `SkillsRuntime` — skills don't influence agent behavior, tool composition, or prompt injection |
| Execution | ❌ Missing | No hook integration, no tool composition, no prompt extension from skills |

**Root Cause**: Skills were designed as markdown frontmatter files that get listed/toggled in settings, but were never connected to the agent runtime. The CLI just delegates to an external npm package. The UI shows placeholder data.

### 1.2 Auto Approvals

| Layer | Status | Details |
|-------|--------|---------|
| UI | ✅ Built | `auto-approvals-view.tsx` — sends `get_auto_approvals` / `set_auto_approval` RPC calls |
| Desktop Commands | ❌ Missing | `get_auto_approvals` and `set_auto_approval` have NO handlers in `desktop-commands.ts` |
| Webview Protocol | ❌ Missing | No message types for auto approval data |
| Tool Policies | ✅ Partial | `tool-policies.ts` has `resolveInteractiveAutoApprovePolicy` and `applyInteractiveAutoApproveOverride` |
| Settings Storage | ❌ Missing | No global settings for auto approval categories |
| Runtime | ❌ Missing | Approval UI settings don't affect runtime tool policies |
| CLI Integration | ⚠️ Partial | CLI uses tool policies for approval, but they're not synced with UI settings |

**Root Cause**: The settings UI was built but the backend RPC handlers were never implemented. The webview sends commands that don't exist. Tool policies exist in CLI but aren't connected to the settings UI.

### 1.3 Execution Checkpoints

| Layer | Status | Details |
|-------|--------|---------|
| Checkpoint Hooks | ✅ Implemented | `checkpoint-hooks.ts` — git stash-based checkpoint creation with refs |
| Session Versioning | ✅ Implemented | `session-versioning-service.ts` — checkpoint restore with message/workspace options |
| Session Snapshot | ✅ Implemented | `session-snapshot.ts` — captures session state for restore |
| Checkpoint Restore | ✅ Implemented | `checkpoint-restore.ts` — git stash apply and worktree restore |
| Hub Integration | ✅ Partial | `hub-runtime-host.ts` forwards createCheckpoint to local runtime |
| CLI Defaults | ✅ Configured | `CLI_DEFAULT_CHECKPOINT_CONFIG` in `defaults.ts` |
| Execution Memory | ⚠️ Standalone | `execution-memory.ts` exists but is NOT connected to the checkpoint system |
| History View | ⚠️ Exists | `history-view.tsx` / `history.ts` CLI command exist but disconnected from checkpoints |
| Webview Integration | ❌ Missing | No webview UI for checkpoint management, rollback, or history |

**Root Cause**: Checkpoints work at the git level but are not connected to the broader execution history system. There's no UI for users to view, manage, or rollback checkpoints. The execution-memory system is standalone and unused.

### 1.4 MCP (Model Context Protocol)

| Layer | Status | Details |
|-------|--------|---------|
| Connection Manager | ✅ Implemented | Manages stdio/SSE connections with reconnect |
| Capability Registry | ✅ Implemented | Server registration, listing, status tracking |
| Discovery Engine | ✅ Implemented | File-based discovery in `mcp/` directories |
| Dynamic Loader | ✅ Implemented | Enable/disable/install/uninstall servers |
| Health Monitor | ✅ Implemented | Periodic health checks with status reporting |
| Permission Manager | ✅ Implemented | Tool-level permissions |
| User MCP Manager | ✅ Implemented | User command execution |
| MCP Tool Wrapper | ✅ Implemented | `createMcpTool`, `formatMcpToolResult`, `getMcpToolsAsAgentTools` |
| Webview UI | ✅ Implemented | Full CRUD for MCP servers |
| CLI Commands | ✅ Implemented | `mcp.ts` — install, list, manage |
| Desktop Commands | ✅ Implemented | `list_mcp_servers`, `set_mcp_server_disabled`, `upsert_mcp_server`, `delete_mcp_server` |
| Agent Tool Pipeline | ⚠️ Partial | MCP tools can be wrapped but aren't automatically discovered by the agent runtime |
| Streaming | ⚠️ Partial | Supports streaming config but no actual streaming implementation |
| Authentication | ❌ Missing | OAuth support is wired for CLI but no runtime auth for MCP connections |

**Root Cause**: MCP has excellent infrastructure but the final integration step — automatically feeding discovered MCP tools into the agent's tool registry — is incomplete. MCP servers are defined in config but tools aren't surfaced to the model.

### 1.5 Plugins

| Layer | Status | Details |
|-------|--------|---------|
| Install System | ✅ Fully Implemented | npm, git, remote, local, official install methods |
| Uninstall | ✅ Implemented | Clean removal with dependency cleanup |
| MCP Sync | ✅ Implemented | Plugin MCP servers synced to settings |
| OAuth Flow | ✅ Implemented | Plugin MCP OAuth authorization |
| CLI Commands | ✅ Implemented | `plugin.ts` — install, uninstall |
| Tool Discovery | ✅ Implemented | `listPluginTools`, `resolvePluginModuleEntries` |
| Plugin Runtime | ⚠️ Partial | Plugin tools loaded by `loadAgentPluginFromPath` but no isolation/sandbox |
| Permissions | ❌ Missing | No plugin permission system |
| Lifecycle | ❌ Missing | No enable/disable/versioning lifecycle |
| Webview UI | ❌ Missing | No plugin management UI |

**Root Cause**: Plugin installation is robust but the runtime execution layer lacks sandboxing, permissions, and lifecycle management. There's no webview UI for managing installed plugins.

### 1.6 Modes

| Layer | Status | Details |
|-------|--------|---------|
| Type Definition | ✅ Defined | `AgentMode = "act" \| "plan" \| "yolo" \| "zen" \| "ask" \| "debug" \| "god"` |
| Act Mode | ✅ Implemented | Full tool set, normal execution |
| Plan Mode | ✅ Implemented | Read-only, write disabled, plan_exit tool |
| Yolo Mode | ✅ Implemented | All auto-approved, limited tools |
| Zen Mode | ❌ Not Implemented | No preset, no behavioral change |
| Ask Mode | ❌ Not Implemented | Referenced in agent-system.ts but no implementation |
| Debug Mode | ❌ Not Implemented | No preset, no behavioral change |
| God Mode | ❌ Not Implemented | No preset, no behavioral change |
| System Prompt | ❌ Missing | Mode doesn't change system prompts |
| Tool Presets | ⚠️ Partial | Only act, plan, yolo have presets |
| Execution Strategy | ❌ Missing | Mode doesn't change execution strategy (sequential vs parallel) |
| Approval Behavior | ⚠️ Partial | Only yolo changes approval (auto-approve all) |
| Autonomy Level | ❌ Missing | Mode doesn't change agent autonomy |
| Webview Config | ⚠️ Partial | `mode?: "act" \| "plan"` only — missing other modes |

**Root Cause**: Only 3 of 7 defined modes have any implementation. Mode switching doesn't change system prompts, execution strategy, or autonomy level. The webview only exposes act/plan.

---

## 2. Architecture & Implementation

### 2.1 Auto Approvals — Implementation

**Architecture**: Connect the UI approval settings to actual runtime tool policies via a new `AutoApprovalService`.

**Files to modify/create**:
- `packages/core/src/services/auto-approval-service.ts` — NEW
- `apps/zenuxs-hub/src/server/desktop-commands.ts` — ADD handlers
- `apps/zenuxs-hub/src/webview-protocol.ts` — ADD types
- `apps/cli/src/runtime/tool-policies.ts` — ENHANCE integration
- `apps/cli/src/session/session.ts` — WIRE auto approvals

### 2.2 Skills — Implementation

**Architecture**: Build a real `SkillsRuntime` that loads skills from directories, injects their prompts into the system prompt, and provides tool composition.

**Files to create**:
- `packages/core/src/skills/skills-runtime.ts` — NEW
- `packages/core/src/skills/skill-loader.ts` — NEW
- `packages/core/src/skills/skill-executor.ts` — NEW
- `packages/core/src/skills/index.ts` — NEW

**Files to modify**:
- `apps/zenuxs-hub/src/server/desktop-commands.ts` — ADD skill handlers
- `apps/zenuxs-hub/src/webview/src/components/views/settings/skills-view.tsx` — REAL backend integration
- `apps/cli/src/commands/skill.ts` — EXTEND with runtime integration

### 2.3 Modes — Implementation

**Architecture**: Each mode changes system prompts, tool presets, execution strategy, approval behavior, and autonomy level.

**Files to modify/create**:
- `packages/core/src/extensions/modes/mode-presets.ts` — NEW
- `packages/core/src/extensions/modes/index.ts` — NEW
- `packages/core/src/extensions/tools/presets.ts` — ADD ask, debug, god presets
- `packages/core/src/extensions/tools/runtime.ts` — EXTEND mode resolution
- `packages/shared/src/session/runtime-config.ts` — ALREADY defined
- `apps/zenuxs-hub/src/webview-protocol.ts` — EXTEND WebviewConfig mode
- `apps/zenuxs-hub/src/webview/src/lib/model-selection.ts` — EXTEND mode options

### 2.4 Execution Checkpoints — Implementation

**Architecture**: Connect checkpoint hooks to execution memory, add webview UI for checkpoint management.

**Files to modify/create**:
- `packages/core/src/runtime/execution-memory.ts` — INTEGRATE with checkpoints
- `apps/zenuxs-hub/src/server/desktop-commands.ts` — ADD checkpoint handlers
- `apps/zenuxs-hub/src/webview-protocol.ts` — ADD checkpoint types
- `apps/zenuxs-hub/src/webview/src/components/views/settings/` — ADD checkpoint view

---

## 3. Implementation

All implementation changes are detailed below with file paths, line numbers, and code.

### 3.1 Auto Approvals

**Root Cause**: The webview sends `get_auto_approvals` and `set_auto_approval` commands, but no handlers exist in the backend.

**Fix**: Add handlers in `desktop-commands.ts` and create the auto-approval service.

### 3.2 Skills

**Root Cause**: Skills UI uses hardcoded data. Settings service can list/toggle but no runtime integration.

**Fix**: Build `SkillsRuntime` that loads skills, injects prompts, and composes tools.

### 3.3 Modes

**Root Cause**: Only act/plan/yolo have implementations. Ask/debug/god modes missing.

**Fix**: Add mode presets for all modes with distinct system prompts, tool sets, and execution strategies.

### 3.4 Execution Checkpoints

**Root Cause**: Git-based checkpoint hooks exist but aren't connected to execution history or UI.

**Fix**: Connect execution memory to checkpoint system, add webview for checkpoint management.

---

## 4. Validation

Each feature validated by:
1. Unit tests passing
2. UI properly displaying real data
3. Runtime behavior changes matching settings
4. End-to-end workflow working

---

## 5. Real Use Cases

### Auto Approvals
- **Why**: Users need granular control over what the agent can do without asking
- **When**: Production workflows where speed matters but safety is required
- **Benefit**: Reduces friction while maintaining security boundaries

### Skills
- **Why**: Reusable capabilities that compose tools and prompts
- **When**: Domain-specific tasks (code review, testing, deployment)
- **Benefit**: Package expertise into installable, shareable units

### Modes
- **Why**: Different tasks need different agent behaviors
- **When**: Planning → execution → debugging → full autonomy
- **Benefit**: One agent that adapts to the task at hand

### Execution Checkpoints
- **Why**: Safety net for agent operations
- **When**: Any filesystem-modifying agent execution
- **Benefit**: Instant rollback of failed or unwanted changes
