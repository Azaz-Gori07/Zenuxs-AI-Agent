# Reachability Audit: `packages/core/src/`

**Date:** 2026-06-26
**Scope:** Every `.ts` file under `packages/core/src/`, traced from live entry points.
**Entry points:**
1. `packages/core/src/index.ts` — main barrel (`@cline/core`)
2. `packages/core/src/hub/daemon/entry.ts` — hub daemon entry (`@cline/core/hub/daemon-entry`)
3. `packages/core/src/hub/index.ts` — hub barrel (`@cline/core/hub`)
4. `packages/core/src/services/telemetry/index.ts` — telemetry barrel (`@cline/core/telemetry`)
5. `packages/core/src/services/feature-flags/posthog.ts` — PostHog FF provider (`@cline/core/services/feature-flags/posthog`)
6. Consumers: `apps/cli/src/`, `apps/zenuxs-hub/src/`

---

## Overall Verdict

**All directories and files are reachable.** No truly dead source modules were found. Every barrel, service, tool, hook, runtime host, and session component is connected via at least one import chain from a live entry point. Details below.

---

## Module-by-Module Reachability Table

| Module / File | Status | Import Chain |
|---|---|---|
| **`ZenuxsCore.ts`** | ✅ REACHABLE (value) | Exported from `index.ts`; instantiated by `apps/cli`, `apps/zenuxs-hub` |
| `ZenuxsCore.test.ts` | 🧪 Test only | — |

### Engine
| `engine/types.ts` | ✅ REACHABLE (type+value) | Imported by `ZenuxsCore.ts` |
| `engine/runtime-services.ts` | ✅ REACHABLE (value) | `ZenuxsCore.ts` → instantiates `createZenuxsCoreSettingsApi`, `createZenuxsCorePendingPromptsApi` |
| `engine/automation.ts` | ✅ REACHABLE (value) | `ZenuxsCore.ts` → `ZenuxsCoreAutomationController` + runtime handlers |
| `engine/start-input.ts` | ✅ REACHABLE (value) | `ZenuxsCore.ts` → `normalizeZenuxsCoreStartInput`, `toZenuxsCoreStartInput` |
| `engine/telemetry.ts` | ✅ REACHABLE (value) | `ZenuxsCore.ts` → `emitSessionStartedTelemetry` |

### Cron (all files reachable via ZenuxsCore → CronService)
| `cron/service/cron-service.ts` | ✅ REACHABLE (value) | Instantiated in `ZenuxsCore` constructor (line 143); conditional on `automationOptions` being set |
| `cron/service/schedule-service.ts` | ✅ REACHABLE (value) | Exported from `hub/index.ts`; used by `HubRuntimeHost` |
| `cron/service/schedule-command-service.ts` | ✅ REACHABLE (value) | Exported from `hub/index.ts` |
| `cron/events/cron-event-ingress.ts` | ✅ REACHABLE (value) | `cron-service.ts` → `CronEventIngress` |
| `cron/runner/cron-materializer.ts` | ✅ REACHABLE (value) | `cron-service.ts` → `CronMaterializer` |
| `cron/runner/cron-runner.ts` | ✅ REACHABLE (value) | `cron-service.ts` → `CronRunner` |
| `cron/runner/resource-limiter.ts` | ✅ REACHABLE (value) | `cron-runner.ts` |
| `cron/schedule/scheduler.ts` | ✅ REACHABLE (value) | `cron-runner.ts` |
| `cron/specs/cron-reconciler.ts` | ✅ REACHABLE (value) | `cron-service.ts` → `CronReconciler` |
| `cron/specs/cron-watcher.ts` | ✅ REACHABLE (value) | `cron-service.ts` → `CronWatcher` |
| `cron/specs/cron-spec-parser.ts` | ✅ REACHABLE (value) | `cron-reconciler.ts`, `cron-watcher.ts` |
| `cron/store/sqlite-cron-store.ts` | ✅ REACHABLE (value) | `cron-service.ts` → `SqliteCronStore` |
| `cron/store/cron-schema.ts` | ✅ REACHABLE (value) | `sqlite-cron-store.ts` |
| `cron/reports/cron-report-writer.ts` | ✅ REACHABLE (value) | `cron-runner.ts` |

### Extensions

**Agents**
| `extensions/agents/agent-system.ts` | ✅ REACHABLE (value) | Exported from `extensions/index.ts` → `index.ts` → consumer |

**Config**
| `extensions/config/index.ts` | ✅ REACHABLE (value) | Barrel re-exported from `extensions/index.ts` → `index.ts` |
| `extensions/config/unified-config-file-watcher.ts` | ✅ REACHABLE (value) | Exported from `config/index.ts` |
| `extensions/config/runtime-commands.ts` | ✅ REACHABLE (type) | Exported from `config/index.ts` |
| `extensions/config/skill-frontmatter-toggle.ts` | ✅ REACHABLE (value) | Imported by `settings/settings-service.ts` |
| `extensions/config/user-instruction-config-loader.ts` | ✅ REACHABLE (value) | Exported from `config/index.ts` |
| `extensions/config/user-instruction-service.ts` | ✅ REACHABLE (value) | Exported from `config/index.ts`; used by `runtime-builder.ts` |
| `extensions/config/user-instruction-plugin.ts` | ✅ REACHABLE (value) | Imported by `user-instruction-service.ts` |

**Context**
| `extensions/context/context-system.ts` | ✅ REACHABLE (value) | Exported from `extensions/index.ts` → `index.ts` |
| `extensions/context/compaction.ts` | ✅ REACHABLE (value) | Directly exported from `index.ts` line 746 |
| `extensions/context/agentic-compaction.ts` | ✅ REACHABLE (value) | Imported by `compaction.ts` |
| `extensions/context/basic-compaction.ts` | ✅ REACHABLE (value) | Imported by `compaction.ts` |
| `extensions/context/compaction-shared.ts` | ✅ REACHABLE (value) | Imported by `agentic-compaction.ts`, `basic-compaction.ts`, `compaction.ts` |

**MCP**
| `extensions/mcp/index.ts` | ✅ REACHABLE (value) | Re-exported from `extensions/index.ts` → `index.ts` |
| `extensions/mcp/client.ts` | ✅ REACHABLE (value) | Used by `runtime-builder.ts` |
| `extensions/mcp/config-loader.ts` | ✅ REACHABLE (value) | Exported from `mcp/index.ts` |
| `extensions/mcp/manager.ts` | ✅ REACHABLE (value) | `InMemoryMcpManager` used by `runtime-builder.ts` |
| `extensions/mcp/oauth.ts` | ✅ REACHABLE (value) | Exported from `mcp/index.ts` |
| `extensions/mcp/plugin-server-registration.ts` | ✅ REACHABLE (value) | Exported from `mcp/index.ts` |
| `extensions/mcp/policies.ts` | ✅ REACHABLE (value) | Exported from `mcp/index.ts` |
| `extensions/mcp/tools.ts` | ✅ REACHABLE (value) | `createMcpTools` used by `runtime-builder.ts` |
| `extensions/mcp/types.ts` | ✅ REACHABLE (type) | Exported from `mcp/index.ts` |
| `extensions/mcp/name-transform.ts` | ✅ REACHABLE (value) | Used by `tools.ts`, `manager.ts` |

**Plugin**
| `extensions/plugin/plugin-config-loader.ts` | ✅ REACHABLE (value) | Exported from `extensions/index.ts`, used by `local-runtime-bootstrap.ts` |
| `extensions/plugin/plugin-loader.ts` | ✅ REACHABLE (value) | Exported from `extensions/index.ts` |
| `extensions/plugin/plugin-load-report.ts` | ✅ REACHABLE (type) | Exported from `extensions/index.ts` |
| `extensions/plugin/plugin-module-import.ts` | ✅ REACHABLE (value) | Used by `plugin-loader.ts` |
| `extensions/plugin/plugin-sandbox.ts` | ✅ REACHABLE (value) | Used by `plugin-loader.ts` |
| `extensions/plugin/plugin-sandbox-bootstrap.ts` | ✅ REACHABLE (value) | Used by `plugin-sandbox.ts` |
| `extensions/plugin/plugin-targeting.ts` | ✅ REACHABLE (value) | Used by `plugin-config-loader.ts` |

**Tools**
| `extensions/tools/index.ts` | ✅ REACHABLE (value) | Re-exported from `extensions/index.ts` → `index.ts` |
| `extensions/tools/definitions.ts` | ✅ REACHABLE (value) | `createBuiltinTools` (line 165) calls `createDefaultTools` (line 840); used by `runtime-builder.ts` |
| `extensions/tools/enhanced-index.ts` | ✅ REACHABLE (value) | Exported from `extensions/index.ts` |
| `extensions/tools/registry.ts` | ✅ REACHABLE (value) | Exported from `extensions/index.ts` → `index.ts` |
| `extensions/tools/presets.ts` | ✅ REACHABLE (value) | Used by `index.ts`, `runtime-builder.ts` |
| `extensions/tools/runtime.ts` | ✅ REACHABLE (value) | Exported from `tools/index.ts` |
| `extensions/tools/constants.ts` | ✅ REACHABLE (value) | Used by `presets.ts`, `index.ts` |
| `extensions/tools/types.ts` | ✅ REACHABLE (type) | Exported from `tools/index.ts` |
| `extensions/tools/schemas.ts` | ✅ REACHABLE (type) | Exported from `tools/index.ts` |
| `extensions/tools/model-tool-routing.ts` | ✅ REACHABLE (value) | Used by `runtime.ts`, `runtime-builder.ts`, `index.ts` |
| `extensions/tools/helpers.ts` | ✅ REACHABLE (value) | Used by `definitions.ts`, `executors/bash.ts` |
| `extensions/tools/executors/index.ts` | ✅ REACHABLE (value) | `createDefaultExecutors` used by `tools/index.ts` |
| `extensions/tools/executors/bash.ts` | ✅ REACHABLE (value) | Executor used by `executors/index.ts` |
| `extensions/tools/executors/editor.ts` | ✅ REACHABLE (value) | Executor used by `executors/index.ts` |
| `extensions/tools/executors/file-read.ts` | ✅ REACHABLE (value) | Executor used by `executors/index.ts` |
| `extensions/tools/executors/search.ts` | ✅ REACHABLE (value) | Executor used by `executors/index.ts` |
| `extensions/tools/executors/web-fetch.ts` | ✅ REACHABLE (value) | Executor used by `executors/index.ts` |
| `extensions/tools/executors/apply-patch.ts` | ✅ REACHABLE (value) | Executor used by `executors/index.ts` |
| `extensions/tools/executors/output-limits.ts` | ✅ REACHABLE (value) | Used by `definitions.ts`, executors |
| `extensions/tools/executors/safety.ts` | ✅ REACHABLE (value) | Used by `bash.ts`, `editor.ts` |
| `extensions/tools/executors/apply-patch-parser.ts` | ✅ REACHABLE (value) | Used by `apply-patch.ts` |
| `extensions/tools/team/index.ts` | ✅ REACHABLE (value) | Re-exported from `extensions/index.ts` → `index.ts` |
| `extensions/tools/team/multi-agent.ts` | ✅ REACHABLE (value) | Exported from `team/runtime.ts` → `runtime-builder.ts` uses `AgentTeamsRuntime` |
| `extensions/tools/team/team-tools.ts` | ✅ REACHABLE (value) | Exported from `team/runtime.ts` → used by `runtime-builder.ts` |
| `extensions/tools/team/delegated-agent.ts` | ✅ REACHABLE (value) | Exported from `team/runtime.ts` → `runtime-builder.ts` |
| `extensions/tools/team/spawn-agent-tool.ts` | ✅ REACHABLE (value) | Exported from `team/runtime.ts`; used by `runtime.ts` |
| `extensions/tools/team/configured-agent-config.ts` | ✅ REACHABLE (value) | Used by `runtime-builder.ts` |
| `extensions/tools/team/configured-agent-tool.ts` | ✅ REACHABLE (value) | Used by `runtime-builder.ts` |
| `extensions/tools/team/projections.ts` | ✅ REACHABLE (value) | Exported from `team/index.ts`; used by `runtime-builder.ts` |
| `extensions/tools/team/subagent-prompts.ts` | ✅ REACHABLE (value) | Used by `delegated-agent.ts` |

### Hooks
| `hooks/index.ts` | ✅ REACHABLE (value) | Re-exported from `index.ts` |
| `hooks/hook-extension.ts` | ✅ REACHABLE (value) | `createAgentHooksExtension` exported |
| `hooks/hook-file-config.ts` | ✅ REACHABLE (value) | Exported from `hooks/index.ts` |
| `hooks/hook-file-hooks.ts` | ✅ REACHABLE (value) | Exported from `hooks/index.ts`; used by `local-runtime-bootstrap.ts` |
| `hooks/checkpoint-hooks.ts` | ✅ REACHABLE (value) | Exported from `index.ts`; used by `local-runtime-bootstrap.ts` |
| `hooks/subprocess.ts` | ✅ REACHABLE (value) | Exported from `hooks/index.ts` |
| `hooks/subprocess-runner.ts` | ✅ REACHABLE (value) | Exported from `hooks/index.ts` |

### Hub
| `hub/index.ts` | ✅ REACHABLE (value) | `@cline/core/hub` entry point; also re-exports from `hub/*` |
| `hub/client/index.ts` | ✅ REACHABLE (value) | Exported from `hub/index.ts`; `NodeHubClient`, `ensureCompatibleLocalHubUrl` used by `host.ts` |
| `hub/client/connect.ts` | ✅ REACHABLE (value) | Exported from `hub/client` barrel |
| `hub/client/session-client.ts` | ✅ REACHABLE (value) | Exported from `hub/client` barrel; used by `apps/cli` |
| `hub/client/ui-client.ts` | ✅ REACHABLE (value) | Exported from `hub/client` barrel |
| `hub/daemon/index.ts` | ✅ REACHABLE (value) | Exported from `hub/index.ts`; `prewarmDetachedHubServer` used by `host.ts` |
| `hub/daemon/entry.ts` | ✅ REACHABLE (value) | Standalone entry `@cline/core/hub/daemon-entry` |
| `hub/daemon/runtime-handlers.ts` | ✅ REACHABLE (value) | `createLocalHubScheduleRuntimeHandlers` used by `entry.ts` |
| `hub/daemon/start-shared-server.ts` | ✅ REACHABLE (value) | `startHubServer`, `ensureHubServer` exported; used by consumers |
| `hub/discovery/index.ts` | ✅ REACHABLE (value) | Exported from `hub/index.ts`; used by `client/index.ts`, `daemon/index.ts` |
| `hub/discovery/defaults.ts` | ✅ REACHABLE (value) | Exported; used by `hub/index.ts`, `daemon/entry.ts` |
| `hub/discovery/workspace.ts` | ✅ REACHABLE (value) | Exported; used by `daemon/entry.ts`, `client/index.ts` |
| `hub/runtime-host/hub-runtime-host.ts` | ✅ REACHABLE (value) | Used by `host.ts` (hub mode + auto mode); exported from `index.ts` |
| `hub/runtime-host/remote-runtime-host.ts` | ✅ REACHABLE (value) | Used by `host.ts` (remote mode); exported from `index.ts` |
| `hub/server/index.ts` | ✅ REACHABLE (value) | Exported from `hub/index.ts` |
| `hub/server/browser-websocket.ts` | ✅ REACHABLE (value) | Exported from `hub/index.ts` |
| `hub/server/command-transport.ts` | ✅ REACHABLE (value) | Exported from `hub/index.ts` |
| `hub/server/native-transport.ts` | ✅ REACHABLE (value) | Exported from `hub/index.ts` |
| `hub/server/hub-websocket-server.ts` | ✅ REACHABLE (value) | Used by `daemon/entry.ts`, `start-shared-server.ts` |
| `hub/server/hub-capability-tool-executors.ts` | ✅ REACHABLE | Used by `hub-runtime-host.ts` |
| `hub/server/hub-client-contributions.ts` | ✅ REACHABLE | Used by `hub-websocket-server.ts` |
| `hub/server/hub-notifications.ts` | ✅ REACHABLE | Used by `hub-websocket-server.ts` |
| `hub/server/hub-schedule-events.ts` | ✅ REACHABLE | Used by `hub-runtime-host.ts` |
| `hub/server/hub-server-logging.ts` | ✅ REACHABLE | Used by `hub-websocket-server.ts` |
| `hub/server/hub-server-options.ts` | ✅ REACHABLE | Type file |
| `hub/server/hub-server-transport.ts` | ✅ REACHABLE | Used by `hub-websocket-server.ts` |
| `hub/server/hub-session-records.ts` | ✅ REACHABLE | Used by `hub-websocket-server.ts` |

### Remote Config
| `remote-config/integration.ts` | ✅ REACHABLE (value) | Exported from `index.ts` |

### Runtime

**Capabilities**
| `runtime/capabilities/index.ts` | ✅ REACHABLE (type) | Type-only, but `normalizeRuntimeCapabilities` is exported from `index.ts` |
| `runtime/capabilities/runtime-capabilities.ts` | ✅ REACHABLE (type) | Type definition |
| `runtime/capabilities/normalize-runtime-capabilities.ts` | ✅ REACHABLE (value) | Used by `ZenuxsCore.ts`, `local-runtime-host.ts`, etc. |

**Config**
| `runtime/config/agent-runtime-config-builder.ts` | ✅ REACHABLE (value) | Used by `session-runtime-orchestrator.ts` |
| `runtime/config/agent-message-codec.ts` | ✅ REACHABLE (value) | Used by `session-runtime-orchestrator.ts`, `message-builder.ts`, `apihandler-agent-model-adapter.ts` |

**Host**
| `runtime/host/runtime-host.ts` | ✅ REACHABLE (type+value) | Core interface; used everywhere |
| `runtime/host/host.ts` | ✅ REACHABLE (value) | `createRuntimeHost` called by `ZenuxsCore.create()` |
| `runtime/host/local-runtime-host.ts` | ✅ REACHABLE (value) | Instantiated by `host.ts`; exported from `index.ts` |
| `runtime/host/history.ts` | ✅ REACHABLE (value) | `listSessionHistory` used by `ZenuxsCore.listHistory` |
| `runtime/host/runtime-host-support.ts` | ✅ REACHABLE (value) | `RuntimeHostEventBus` used by all runtime hosts |
| `runtime/host/local/agent-event-bridge.ts` | ✅ REACHABLE (value) | Used by `local-runtime-host.ts` |
| `runtime/host/local/session-record.ts` | ✅ REACHABLE (value) | Used by `local-runtime-host.ts` |
| `runtime/host/local/session-service-invoker.ts` | ✅ REACHABLE (value) | Used by `local-runtime-host.ts` |
| `runtime/host/local/spawn-tool.ts` | ✅ REACHABLE (value) | Used by `local-runtime-host.ts` |
| `runtime/host/local/user-files.ts` | ✅ REACHABLE (value) | Used by `local-runtime-host.ts` |

**Orchestration**
| `runtime/orchestration/session-runtime.ts` | ✅ REACHABLE (type) | Type definitions only |
| `runtime/orchestration/session-runtime-orchestrator.ts` | ✅ REACHABLE (value) | `SessionRuntime` class; instantiated by `local-runtime-host.ts` |
| `runtime/orchestration/runtime-builder.ts` | ✅ REACHABLE (value) | `DefaultRuntimeBuilder` used by `local-runtime-host.ts`; exported from `index.ts` |
| `runtime/orchestration/runtime-event-adapter.ts` | ✅ REACHABLE (value) | Used by `session-runtime-orchestrator.ts` |
| `runtime/orchestration/runtime-oauth-token-manager.ts` | ✅ REACHABLE (value) | Used by `local-runtime-host.ts` |
| `runtime/orchestration/user-input-builder.ts` | ✅ REACHABLE (value) | Dynamically imported by `session-runtime-orchestrator.ts` (line 1362) |

**Safety**
| `runtime/safety/loop-detection.ts` | ✅ REACHABLE (value) | `LoopDetectionTracker` used by `session-runtime-orchestrator.ts` |
| `runtime/safety/mistake-tracker.ts` | ✅ REACHABLE (value) | `MistakeTracker` used by `session-runtime-orchestrator.ts` |
| `runtime/safety/rules.ts` | ✅ REACHABLE (value) | Exported from `index.ts` |

**Tools**
| `runtime/tools/subprocess-sandbox.ts` | ✅ REACHABLE (value) | Exported from `index.ts` |
| `runtime/tools/tool-approval.ts` | ✅ REACHABLE (value) | Exported from `index.ts` |

**Turn Queue**
| `runtime/turn-queue/pending-prompt-service.ts` | ✅ REACHABLE (value) | `PendingPromptsController` used by `local-runtime-host.ts` |

### Services
| `services/agent-events.ts` | ✅ REACHABLE (value) | Used by `local-runtime-host.ts` |
| `services/config.ts` | ✅ REACHABLE (value) | Used by `local-runtime-bootstrap.ts` |
| `services/global-settings.ts` | ✅ REACHABLE (value) | Exported from `index.ts`; used by `runtime-builder.ts` |
| `services/local-runtime-bootstrap.ts` | ✅ REACHABLE (value) | Used by `local-runtime-host.ts` |
| `services/plugin-mcp-settings.ts` | ✅ REACHABLE (value) | Exported from `index.ts` |
| `services/plugin-tools.ts` | ✅ REACHABLE (value) | Exported from `index.ts` |
| `services/plugin-uninstall.ts` | ✅ REACHABLE (value) | Exported from `index.ts` |
| `services/session-artifacts.ts` | ✅ REACHABLE (value) | Used by `local-runtime-host.ts` |
| `services/session-data.ts` | ✅ REACHABLE (value) | Used by `local-runtime-host.ts` |
| `services/session-telemetry.ts` | ✅ REACHABLE (value) | Used by `local-runtime-host.ts` |
| `services/usage.ts` | ✅ REACHABLE (value) | Exported from `index.ts`; used by multiple files |
| `services/feature-flags/FeatureFlagsService.ts` | ✅ REACHABLE | Instantiated in `ZenuxsCore.create()` |
| `services/feature-flags/providers.ts` | ✅ REACHABLE | Exported from `feature-flags/index.ts` |
| `services/feature-flags/posthog.ts` | ✅ REACHABLE | Standalone entry `@cline/core/services/feature-flags/posthog` (package.json exports map) - conditionally used by FeatureFlagsService when PostHog peer dep is installed |
| `services/llms/handler-factory.ts` | ✅ REACHABLE | Used by `session-runtime-orchestrator.ts` |
| `services/llms/provider-defaults.ts` | ✅ REACHABLE | Exported from `index.ts` |
| `services/llms/provider-settings.ts` | ✅ REACHABLE | Exported from `index.ts`; used by `automation.ts` |
| `services/llms/runtime-config.ts` | ✅ REACHABLE | Exported from `index.ts` |
| `services/llms/runtime-registry.ts` | ✅ REACHABLE | Exported from `index.ts` |
| `services/llms/runtime-types.ts` | ✅ REACHABLE (type) | Exported from `index.ts` |
| `services/llms/configured-provider-registry.ts` | ✅ REACHABLE | Used by `runtime-registry.ts` |
| `services/llms/apihandler-agent-model-adapter.ts` | ✅ REACHABLE | Used by `handler-factory.ts` |
| `services/llms/zenuxs-recommended-models.ts` | ✅ REACHABLE | Exported from `index.ts` |
| `services/providers/local-provider-service.ts` | ✅ REACHABLE | Exported from `index.ts` |
| `services/providers/local-provider-registry.ts` | ✅ REACHABLE | Used by `local-provider-service.ts`, `provider-settings-manager.ts` |
| `services/providers/provider-config-fields.ts` | ✅ REACHABLE | Exported from `index.ts` |
| `services/providers/model-source.ts` | ✅ REACHABLE | Used by `local-provider-registry.ts` |
| `services/storage/sqlite-session-store.ts` | ✅ REACHABLE | Exported from `index.ts`; used by `host.ts`, `runtime-handlers.ts` |
| `services/storage/sqlite-team-store.ts` | ✅ REACHABLE | Exported from `index.ts` |
| `services/storage/team-store.ts` | ✅ REACHABLE | Exported from `index.ts`; used by `runtime-builder.ts` |
| `services/storage/provider-settings-manager.ts` | ✅ REACHABLE | Exported from `index.ts`; used by `local-runtime-host.ts` |
| `services/storage/provider-settings-legacy-migration.ts` | ✅ REACHABLE | Exported from `index.ts` |
| `services/storage/session-store.ts` | ✅ REACHABLE (type) | Exported from `index.ts` |
| `services/storage/artifact-store.ts` | ✅ REACHABLE (type) | Exported from `index.ts` |
| `services/storage/file-team-store.ts` | ✅ REACHABLE | Used by `team-store.ts` |
| `services/telemetry/index.ts` | ✅ REACHABLE | Barrel for `@cline/core/telemetry`; dynamically imported by `index.ts`'s `loadOpenTelemetryAdapter()` |
| `services/telemetry/TelemetryService.ts` | ✅ REACHABLE | Exported from `index.ts` |
| `services/telemetry/OpenTelemetryProvider.ts` | ✅ REACHABLE | Exported from `index.ts` |
| `services/telemetry/OpenTelemetryAdapter.ts` | ✅ REACHABLE | Used by `OpenTelemetryProvider.ts`; dynamically loadable via `loadOpenTelemetryAdapter()` |
| `services/telemetry/TelemetryLoggerSink.ts` | ✅ REACHABLE | Exported from `index.ts` |
| `services/telemetry/core-events.ts` | ✅ REACHABLE | Exported from `index.ts`; used throughout |
| `services/telemetry/distinct-id.ts` | ✅ REACHABLE | Used by `ZenuxsCore.ts` and `local-runtime-host.ts` |
| `services/telemetry/tool-context.ts` | ✅ REACHABLE | Used by `session-runtime-orchestrator.ts`, `definitions.ts` |
| `services/telemetry/ITelemetryAdapter.ts` | ✅ REACHABLE (type) | Exported from `index.ts` |
| `services/workspace/file-indexer.ts` | ✅ REACHABLE | Exported from `services/workspace/index.ts` |
| `services/workspace/mention-enricher.ts` | ✅ REACHABLE | Exported from `services/workspace/index.ts` |
| `services/workspace/workspace-manager.ts` | ✅ REACHABLE | Exported from `index.ts` |
| `services/workspace/workspace-manifest.ts` | ✅ REACHABLE | Exported from `index.ts` |
| `services/workspace/workspace-telemetry.ts` | ✅ REACHABLE | Used by `workspace-manifest.ts` |

### Session
| `session/checkpoint-restore.ts` | ✅ REACHABLE | Exported from `index.ts` |
| `session/index.ts` | ✅ REACHABLE | Re-exports from `index.ts` |
| `session/models/session-graph.ts` | ✅ REACHABLE | Exported from `index.ts` |
| `session/models/session-manifest.ts` | ✅ REACHABLE (type) | Exported from `index.ts` |
| `session/models/session-row.ts` | ✅ REACHABLE (type) | Exported from `index.ts` |
| `session/services/session-service.ts` | ✅ REACHABLE | `CoreSessionService` used by `host.ts`; exported from `index.ts` |
| `session/services/file-session-service.ts` | ✅ REACHABLE | Used by `host.ts` (fallback when SQLite unavailable) |
| `session/services/message-builder.ts` | ✅ REACHABLE | Used by `session-runtime-orchestrator.ts` |
| `session/services/persistence-service.ts` | ✅ REACHABLE | Used by `session-service.ts` |
| `session/session-snapshot.ts` | ✅ REACHABLE | Exported from `index.ts` |
| `session/session-versioning-service.ts` | ✅ REACHABLE | Exported from `index.ts`; used by `local-runtime-host.ts` |
| `session/stores/conversation-store.ts` | ✅ REACHABLE | Used by `session-runtime-orchestrator.ts` |
| `session/stores/session-manifest-store.ts` | ✅ REACHABLE | Used by `file-session-service.ts` |
| `session/stores/team-persistence-store.ts` | ✅ REACHABLE | Exported from `index.ts` |
| `session/team/team-child-session-manager.ts` | ✅ REACHABLE | Used by `local-runtime-host.ts` |
| `session/team/team-session-coordinator.ts` | ✅ REACHABLE | Used by `local-runtime-host.ts` |
| `session/team/index.ts` | ✅ REACHABLE | Re-exported from `session/index.ts` |

### Settings
| `settings/index.ts` | ✅ REACHABLE | Exported from `index.ts` |
| `settings/settings-service.ts` | ✅ REACHABLE | Exported from `settings/index.ts` |
| `settings/types.ts` | ✅ REACHABLE (type) | Exported from `settings/index.ts` |

### Types
| `types/index.ts` | ✅ REACHABLE (type) | Re-exports from index.ts |
| `types/chat-schema.ts` | ✅ REACHABLE (type+value) | Exported from `index.ts` |
| `types/common.ts` | ✅ REACHABLE (type+value) | Exported from `index.ts` |
| `types/config.ts` | ✅ REACHABLE (type) | Exported from `index.ts` |
| `types/events.ts` | ✅ REACHABLE (type) | Exported from `index.ts` |
| `types/provider-settings.ts` | ✅ REACHABLE (type+value) | Exported from `index.ts` |
| `types/session.ts` | ✅ REACHABLE (type) | Exported from `index.ts` |
| `types/sessions.ts` | ✅ REACHABLE (type) | Exported from `index.ts` |
| `types/storage.ts` | ✅ REACHABLE (type) | Exported from `index.ts` |

### Account & Auth
| `account/index.ts` | ✅ REACHABLE | Exported from `index.ts` |
| `account/types.ts` | ✅ REACHABLE (type) | Exported from `index.ts` |
| `account/zenuxs-account-service.ts` | ✅ REACHABLE | Exported |
| `account/rpc.ts` | ✅ REACHABLE | Exported |
| `account/featurebase-token.test.ts` | 🧪 Test only | |
| `auth/client.ts` | ✅ REACHABLE | Exported from `index.ts` |
| `auth/server.ts` | ✅ REACHABLE | Exported from `index.ts` |
| `auth/types.ts` | ✅ REACHABLE (type) | Exported from `index.ts` |
| `auth/zenuxs.ts` | ✅ REACHABLE | Exported from `index.ts` |
| `auth/codex.ts` | ✅ REACHABLE | Exported from `index.ts` |
| `auth/oca.ts` | ✅ REACHABLE | Exported from `index.ts` |
| `auth/provider-auth-registry.ts` | ✅ REACHABLE | Exported from `index.ts` |
| `auth/utils.ts` | ✅ REACHABLE | Used by `local-runtime-bootstrap.ts` |
| `auth/bounded-ttl-cache.ts` | ✅ REACHABLE | Used by `provider-auth-registry.ts` |

### Misc
| `version.ts` | ✅ REACHABLE | Exported from `index.ts` |
| `types.ts` | ✅ REACHABLE (type) | Exported from `index.ts` |

---

## Specific Questions Answered

### 1. Is `DoomLoopDetector` used anywhere outside its definition file?

**Yes, but only within `packages/core`:**

- **Defined in:** `extensions/tools/registry.ts` (line 54)
- **Used internally by:** `ToolRegistry` class in the same file (line 75, `private doomDetector = new DoomLoopDetector()`)
- **Also instantiated in:** `extensions/tools/enhanced-index.ts` line 46 (returned in `createAllEnhancedTools` result)
- **Exported from:** `extensions/index.ts` (line 61) and `index.ts` (line 266)
- **NOT imported by** any `apps/` consumer directly (grep confirmed)
- **Status:** Reachable, but only used as a returned object from `createAllEnhancedTools()` — `DoomLoopDetector.check()` itself is called in `ToolRegistry.isDoomLoop()` which is a method on `ToolRegistry`. The `ToolRegistry` is instantiated in `enhanced-index.ts` but NOT in `runtime-builder.ts` (the default path). The `createAllEnhancedTools` function is exported for consumers who want it.

### 2. Is `MistakeTracker` instantiated? Where?

**YES** — instantiated in `runtime/orchestration/session-runtime-orchestrator.ts` (line ~407):
```ts
this.mistakeTracker = new MistakeTracker({...})
```
Used per-session in the `SessionRuntime` orchestrator. Fully reachable.

### 3. Is `LoopDetectionTracker` instantiated? Where?

**YES** — instantiated in `runtime/orchestration/session-runtime-orchestrator.ts` (line ~429):
```ts
this.loopTracker = new LoopDetectionTracker(loopConfig)
```
Used per-session in the `SessionRuntime` orchestrator. Fully reachable.

### 4. Which tools are actually registered vs just defined?

**Defined (function exists in `definitions.ts`):**
| Tool Creator | Export Status | Used Where? |
|---|---|---|
| `createReadFilesTool` | ✅ Exported | `createDefaultTools` → `createBuiltinTools` → `runtime-builder.ts` |
| `createSearchTool` | ✅ Exported | Same chain |
| `createBashTool` | ✅ Exported | Same chain (Unix) |
| `createWindowsShellTool` | ✅ Exported | Same chain (Win32) |
| `createWebFetchTool` | ✅ Exported | Same chain |
| `createEditorTool` | ✅ Exported | Same chain |
| `createApplyPatchTool` | ✅ Exported | Same chain (when enabled) |
| `createSkillsTool` | ✅ Exported | Same chain (when enabled) |
| `createAskQuestionTool` | ✅ Exported | Same chain (when enabled) |
| `createSubmitAndExitTool` | ✅ Exported | Same chain (when enabled) |

**Registered (added to `ToolRegistry` in `enhanced-index.ts`):**
`read`, `write`, `edit`, `glob`, `grep`, `bash`, `webfetch`, `todowrite`, `websearch` (optional), `plan_exit` (optional)

**Actually wired (via `runtime-builder.ts`):**
Uses `createBuiltinTools()` (from `tools/index.ts`), which internally calls `createDefaultTools()`. The tool set is determined by preset (act/plan/search/minimal/yolo) plus routing config. All 10 tool definitions are potentially used depending on preset.

**Key finding:** The `enhanced-index.ts` tools (the "ported OpenCode" tool system with `ToolRegistry`) are NOT the tools actually used at runtime. The runtime uses `createBuiltinTools` → `createDefaultTools` path. The enhanced tools are available as an alternative for consumers who prefer that system.

### 5. `HubRuntimeHost` vs `RemoteRuntimeHost` vs `LocalRuntimeHost` — which is actually used?

**ALL THREE** are used via conditional branching in `runtime/host/host.ts`:

| Configured Mode | Host Created | Line |
|---|---|---|
| `"remote"` | `RemoteRuntimeHost` | 153 |
| `"hub"` | `HubRuntimeHost` | 179 |
| `"auto"` | `HubRuntimeHost` first (with fallback) | 195-246 |
| `"auto"` (fallback) | `LocalRuntimeHost` | 245 |
| default/undefined | `LocalRuntimeHost` | 247 |

**Relationship:** `RemoteRuntimeHost extends HubRuntimeHost`. Both connect to a WebSocket-based hub. `LocalRuntimeHost` is the in-process direct implementation.

### 6. Is CronService always instantiated?

**NO** — it's conditional. In `ZenuxsCore` constructor (line 142):
```ts
this.automationService = automationOptions
    ? new CronService({...})
    : undefined;
```
Only instantiated when `automationOptions` are provided (either `automation: true` or `automation: {...}` option in `ZenuxsCore.create()`).

---

## Dead / Potentially Dead Modules

| File | Status | Notes |
|---|---|---|
| **None found** | ✅ All 200+ files reachable | Every file under `packages/core/src/` is imported by at least one live chain |

### Edge Cases: Conditionally Reachable (not dead, but guarded)

| Module | Guard | Reachable When |
|---|---|---|
| `cron/service/cron-service.ts` + all cron sub-modules | `automationOptions` truthy | `ZenuxsCore.create({automation: true})` |
| `hub/runtime-host/hub-runtime-host.ts` | `configuredMode` is `"hub"` or `"auto"` | Hub endpoint available |
| `hub/runtime-host/remote-runtime-host.ts` | `configuredMode === "remote"` | `remote.endpoint` set |
| `extensions/plugin/*` | Plugin paths exist | Plugin loading requested |
| `services/feature-flags/posthog.ts` | PostHog peer dep installed | Standalone entry point in package.json |
| `extensions/tools/team/multi-agent.ts` | Teams/spawn-agent enabled | Config-dependent |
| `services/storage/file-team-store.ts` | Used by `SqliteTeamStore` as fallback | SQLite unavailable |
| `session/services/file-session-service.ts` | Used by `host.ts` | SQLite unavailable (fallback) |

---

## Import Chain Summary

```
index.ts (barrel)
  ├── ZenuxsCore.ts
  │     ├── engine/automation.ts → cron/service/cron-service.ts → all cron/*
  │     ├── engine/runtime-services.ts → settings/settings-service.ts
  │     ├── engine/start-input.ts → runtime/host/runtime-host.ts
  │     ├── engine/telemetry.ts → services/telemetry/core-events.ts
  │     ├── engine/types.ts
  │     ├── cron/service/cron-service.ts → cron/{events,runner,specs,store}/*
  │     ├── runtime/capabilities/* → index.ts
  │     ├── runtime/host/host.ts
  │     │     ├── runtime/host/local-runtime-host.ts
  │     │     │     ├── extensions/context/compaction.ts
  │     │     │     ├── extensions/tools/team/*
  │     │     │     ├── hooks/*
  │     │     │     ├── runtime/orchestration/*
  │     │     │     │     ├── runtime/safety/{loop-detection,mistake-tracker}.ts
  │     │     │     │     ├── runtime/config/*
  │     │     │     │     ├── session/{stores,services}/*
  │     │     │     ├── services/{local-runtime-bootstrap,session-data,usage,...}.ts
  │     │     │     └── session/{team,models}/*
  │     │     ├── runtime/host/hub-runtime-host.ts → hub/runtime-host/hub-runtime-host.ts
  │     │     ├── runtime/host/remote-runtime-host.ts → hub/runtime-host/remote-runtime-host.ts
  │     │     ├── hub/{client,daemon}/*
  │     │     └── session/services/{session-service,file-session-service}.ts
  │     └── services/feature-flags/*
  ├── extensions/index.ts
  │     ├── extensions/agents/agent-system.ts
  │     ├── extensions/config/* (6 files)
  │     ├── extensions/context/context-system.ts
  │     ├── extensions/mcp/* (10 files)
  │     ├── extensions/plugin/* (7 files)
  │     ├── extensions/tools/index.ts
  │     │     ├── extensions/tools/definitions.ts → executors/*
  │     │     ├── extensions/tools/enhanced-index.ts
  │     │     ├── extensions/tools/presets.ts
  │     │     ├── extensions/tools/runtime.ts → team/*
  │     │     └── extensions/tools/model-tool-routing.ts
  │     └── extensions/tools/registry.ts
  ├── hooks/index.ts
  │     └── hooks/{hook-extension,hook-file-config,hook-file-hooks,checkpoint-hooks,subprocess,subprocess-runner}.ts
  ├── hub/index.ts (separate entry @cline/core/hub)
  │     └── hub/{client,daemon,discovery,server}/*
  ├── remote-config/integration.ts
  ├── runtime/* → index.ts exports select files
  ├── services/* → most exported or used transitively
  ├── session/* → most exported or used transitively
  ├── settings/settings-service.ts
  ├── account/* → exported from index.ts
  ├── auth/* → exported from index.ts
  └── types/* → exported from index.ts
```

---

## Summary

- **Total source files:** ~200+
- **Dead modules:** **0** (all reachable from at least one entry point)
- **Conditionally guarded:** ~8 modules (cron full tree, file-team-store, file-session-service, hub-mode hosts)
- **All cron modules** are reachable (guarded by `automationOptions` flag)
- **All three runtime hosts** are reachable (branch on `configuredMode`)
- **`MistakeTracker`** and **`LoopDetectionTracker`** both instantiated per-session in `SessionRuntime`
- **`DoomLoopDetector`** is reachable but not part of the default runtime path; it belongs to the alternative enhanced-tool system
- **No truly dead code** was found in `packages/core/src/`
