# CLI Call Graph: Entry to Tool Execution

> Generated from source audit. Every edge annotated with caller→callee, file:line, condition, and edge type.

---

## 1. CLI Entry (`apps/cli/src/index.ts`)

```
┌─ index.ts:59-79  (top-level IIFE)
│
├─ [FORK] index.ts:60-63  — isHubDaemonProcess()?
│   Static → isHubDaemonProcess()       @ cline/shared
│   Conditional if: isHubDaemonProcess()
│   Dynamic  → await import("@cline/core/hub/daemon-entry")   @ line 61
│   Return: after daemon-entry, function exits
│
└─ else: index.ts:67-68
    Dynamic → await import("./main")              @ line 67
    Static  → await runCli()                      @ line 68
    │
    └─ catch: index.ts:70-74
        Static → logCliProcessError("runCli", err)   @ line 70
        Static → writeErr(...)                       @ line 71
        Static → cleanupActiveRuntime()               @ line 72
        Static → abortActiveRuntime()                 @ line 73
    └─ finally: index.ts:76
        Static → await disposeAll()                   @ line 76
    └─ line 78: process.exit(...)
```

**Signal handling (same file):**
```
process.on("SIGINT")  → forwardSignalToRuntime  @ line 29
process.on("SIGTERM") → forwardSignalToRuntime  @ line 30
  Static → abortActiveRuntime()   @ line 27
  Conditional if: shuttingDown → process.exit(1) @ line 24

process.on("uncaughtException") → handleFatalProcessError  @ line 46-48
process.on("unhandledRejection") → handleFatalProcessError  @ line 49-57
  Conditional if: isAbortInProgress() → ignore (line 50-55)
  Static → logCliProcessError()    @ line 36
  Static → writeErr()              @ line 37-39
  Static → cleanupActiveRuntime()  @ line 40
  Static → abortActiveRuntime()    @ line 41
  Dynamic → disposeAll().finally(process.exit(1))  @ line 42-44
```

---

## 2. `runCli()` (`apps/cli/src/main.ts`)

```
┌─ runCli()  @ main.ts:115 (export async function)
│
├─ Static → installStreamErrorGuards()                    @ line 116
├─ Static → autoUpdateOnStartup()                         @ line 117
├─ Static → resolveConfigDirArg(cliArgs)                  @ line 120
├─ Dynamic → import("@cline/shared/storage")              @ line 121
│   Conditional if (configDir): setClineDir(configDir)    @ line 122-124
├─ Static → setHomeDir(homedir())                         @ line 125
├─ Static → captureCliExtensionActivated()                @ line 131
├─ Static → normalizeAutoApproveArgs(cliArgs)             @ line 134
│
├─ Static → createProgram()          @ line 139   — Commander program setup
│
├─ SUBCOMMAND REGISTRATION (commander .command()):
│   │  Each subcommand uses Static → program.command(name).action(...)
│   │
│   ├─ "auth"       → Dynamic → runAuthCommand(...)      @ line 199
│   ├─ "config"     → Dynamic → createConfigCommand(...)  @ line 212
│   │                   → Dynamic → realCmd.parseAsync()  @ line 244
│   ├─ "plugin install" → Dynamic → runPluginInstallCommand(...) @ line 286
│   ├─ "plugin uninstall" → Dynamic → runPluginUninstallCommand(...) @ line 312
│   ├─ "skill"      → Dynamic → runSkillCommand(...)      @ line 338
│   ├─ "connect"    → [FORK] see below                    @ line 352
│   ├─ "mcp"        → [FORK] see below                    @ line 385
│   ├─ "mcp install" → Dynamic → runMcpInstallCommand(...) @ line 412
│   ├─ "doctor"     → Dynamic → createDoctorCommand(...)  @ line 422
│   │                   → realCmd.parseAsync()             @ line 439
│   ├─ "history"    → Dynamic → runHistoryList(...)        @ line 458
│   ├─ "history delete" → Dynamic → runHistoryDelete(...)  @ line 493
│   ├─ "history update" → Dynamic → runHistoryUpdate(...)  @ line 515
│   ├─ "history export" → Dynamic → runHistoryExport(...)  @ line 537
│   ├─ "hook"       → Dynamic → runHookCommand(...)        @ line 551
│   ├─ "schedule"   → [FORK] runScheduleWizard/createScheduleCommand @ line 573-583
│   ├─ "hub"        → Dynamic → createHubCommand(...)      @ line 592-593
│   ├─ "dashboard"  → Dynamic → runDashboardCommand(...)   @ line 622
│   ├─ "update"     → Dynamic → checkForUpdates(...)       @ line 644
│   ├─ "version"    → Dynamic → showVersion()              @ line 654
│   └─ "kanban"     → Dynamic → launchKanban(...)          @ line 662
│
│   └─ "connect" subcommand @ line 352-379:
│       Conditional if (opts.stop):
│         Conditional if (adapter) → runStopConnector(adapter, io)    @ line 362
│         else → runStopAllConnectors(io)                              @ line 364
│       else if (adapter) → runConnectAdapter(adapter, args, io)      @ line 369
│       else if (TTY) → runConnectWizard()                             @ line 375
│       else → formatAdapterList() / cmd.help()                         @ line 377
│
│   └─ "schedule" subcommand @ line 573-584:
│       Conditional if (no args && TTY) → runScheduleWizard()          @ line 579
│       else → createScheduleRuntimeCommand() → parseAsync()            @ line 582-583
│
├─ program.parseAsync(normalizedArgs)   @ line 669   — Commander dispatch
│   └─ catch: CommanderError handling (lines 671-679)
│
├─ [FORK] ctx.exitCode !== undefined → process.exitCode = ctx.exitCode; return @ line 682-685
│
├─ [FORK] rootOpts.update → checkForUpdates(...); return  @ lines 693-704
├─ [FORK] rootOpts.kanban → launchKanban(...); return      @ lines 705-721
│
├─ DEFAULT FLOW (no subcommand matched) @ lines 724-1209
│   │
│   ├─ Static → commanderToParsedArgs(program)     @ line 724
│   │
│   ├─ [FORK] args.length > 1 → error; return      @ line 725-731
│   │
│   ├─ [FORK] resumeSessionId → spawnHistoryResume  @ line 739-755
│   │     or fall through with interactive:true
│   │
│   ├─ [FORK] args.id !== undefined → set resumeSessionId    @ line 757-773
│   │
│   ├─ [FORK] launchConfigView → args.interactive = true     @ line 774-780
│   │
│   ├─ Various invalid-arg guards → error; return            @ line 782-814
│   │
│   ├─ [FORK] args.outputMode === "json" && (interactive || !prompt) → error @ line 828-834
│   │
│   ├─ [FORK] args.acpMode → runAcpMode(); return   @ line 838-841
│   │
│   ├─ [FORK] args.worktree → createTaskWorktree()  @ line 844-877
│   │
│   ├─ Static → resolveWorkspaceRoot(cwd)            @ line 880
│   ├─ Static → configureSandboxEnvironment(...)     @ line 886-890
│   │
│   ├─ PROVIDER SETUP:
│   │   Static → createProviderSettingsManager()     @ line 895
│   │   Static → loadCliRuntimeModules()             @ line 896-901
│   │     ├─ Dynamic → import("@cline/core")
│   │     ├─ Dynamic → import("./runtime/prompt")
│   │     └─ Dynamic → import("./runtime/run-agent")
│   │   Static → createUserInstructionConfigService(...)  @ line 903-911
│   │   Static → userInstructionService.start()            @ line 912
│   │   Static → refreshCliFeatureFlagsInBackground()      @ line 929
│   │   Various provider resolution calls                  @ lines 920-1001
│   │
│   ├─ [FORK] !apiKey && isOAuthProvider && !headless && !interactive
│   │   → ensureOAuthProviderApiKey(...)                   @ line 961
│   │
│   ├─ [FORK] isYoloMode / isZenMode decisions:
│   │   isYoloMode = args.mode === "yolo"                   @ line 947
│   │   isZenMode = args.mode === "zen"                     @ line 948
│   │   isHeadless = any of yolo/zen/json/!stdin.isTTY      @ line 953-957
│   │   isInteractive = (interactive || !prompt) && !headless @ line 958
│   │
│   ├─ Static → resolveSystemPrompt(...)                    @ line 1034-1039
│   ├─ Static → buildCliCompactionConfig(...)               @ line 1044
│   │
│   └─ MAIN FORK POINT @ lines 1106-1207:
│       │
│       ├─ [FORK] piped input (!isTTY && stdinHasPipedInput() && !interactive) @ 1106
│       │   ├─ read piped stdin chunks                         @ 1108-1111
│       │   ├─ rewriteTeamPrompt(piped)                        @ 1117
│       │   ├─ Conditional: Usage kind → writeln; return        @ 1118-1121
│       │   ├─ [SUB-FORK] isZenMode → runZen(); return          @ 1126-1129
│       │   └─ else → runAgent(); return                        @ 1131
│       │
│       ├─ [FORK] interactive (args.interactive || !args.prompt) @ 1138
│       │   ├─ [SUB-FORK] isZenMode → error; return             @ 1139-1147
│       │   └─ else:
│       │       Dynamic → loadInteractiveRuntimeModule()         @ 1148
│       │       Static  → runInteractive(config, ...)            @ 1175
│       │       return
│       │
│       └─ Single prompt mode (else) @ 1186-1209
│           ├─ rewriteTeamPrompt(args.prompt)                   @ 1187
│           ├─ [SUB-FORK] isZenMode → runZen(); return          @ 1201-1204
│           └─ else → runAgent(effectivePrompt, ...)             @ 1207
│               return
```

---

## 3. ACP Mode (`apps/cli/src/acp/index.ts`)

```
┌─ runAcpMode()  @ acp/index.ts:4
│   Dynamic → import("@agentclientprotocol/sdk")     @ line 5-6
│   Dynamic → import("./acpAgent")                   @ line 8
│   Static  → ndJsonStream(writable, readable)       @ line 12-15
│   Static  → new AgentSideConnection(factory, stream) @ line 17-19
│     Dynamic → new AcpAgent(conn)                    @ line 18 (callback)
│   Static  → await connection.closed                 @ line 22
```

---

## 4. `runAgent()` (`apps/cli/src/runtime/run-agent.ts`)

```
┌─ runAgent(prompt, config, userInstructionService?, options?)  @ run-agent.ts:134
│
├─ [FORK] config.verbose
│   Static → resolveClineWelcomeLine(...)            @ line 148-149
│   Conditional if: config.outputMode !== "json" → writeln  @ line 153-154
│
├─ Static → prewarmFileIndex(config.cwd)             @ line 159 (fire-and-forget)
│
├─ isYoloMode = config.mode === "yolo"               @ line 163
│
├─ Static → createCliCore({
│     capabilities: { toolExecutors, requestToolApproval },
│     forceLocalBackend: isYoloMode || config.sandbox,   @ line 174
│     ...
│   })                                              @ line 168-178
│   └─ (→ see §5 createCliCore chain)
│
├─ Static → createRuntimeHooks({...})                @ line 179-187
│
├─ Static → subscribeToAgentEvents(sessionManager, onAgentEvent)  @ line 212
│
├─ Static → setActiveRuntimeAbort(abortAll)          @ line 231
│
├─ Signal handlers:
│   process.on("SIGINT") → handleSigint  @ line 264
│     Conditional if abortAll() → emitAbortRequested  @ line 250-252
│     else → cleanupRuntime() → process.exit(0)       @ line 254-257
│   process.on("SIGTERM") → handleSigterm @ line 265
│     → abortAll(); emitAbortRequested                @ line 260-261
│
├─ [FORK] config.verbose → printModelProviderInfo      @ line 269-271
│
├─ Static → buildUserInputMessage(prompt, ...)        @ line 276
│
├─ sessionManager.start({...})                        @ line 277-301
│   └─ (→ see §5 ZenuxsCore.start chain)
│
├─ [FORK] started.result (non-interactive, first turn already run)
│   → use started.result directly                     @ line 329-331
│   else → sessionManager.send({...})                 @ line 333-341
│
├─ sessionManager.getAccumulatedUsage()               @ line 346-348
├─ Static → zeroCliUsageCost(...)                     @ line 349-356
│
├─ [FORK] config.outputMode === "json" → emitJsonLine  @ line 358-369
├─ [FORK] abortRequested/timeouted → error/emit        @ line 371-388
├─ [FORK] result.finishReason !== "completed" → error   @ line 390-400
├─ else → printRunStats(...); process.exitCode = 0     @ line 402-409
│
└─ catch → logCliError; writeErr; process.exitCode = 1  @ line 411-415
└─ finally → await cleanupRuntime()                     @ line 417
    → unsubscribe(); runtimeHooks.shutdown(); sessionManager.stop()/dispose()
```

---

## 5. `createCliCore()` (`apps/cli/src/session/session.ts`)

```
┌─ createCliCore(options?)  @ session.ts:29
│
├─ forceLocalBackend → backendMode = "local"           @ line 38-39
│
├─ Static → getCliTelemetryService(logger)            @ line 44
├─ Static → getCliFeatureFlagsService(...)            @ line 45-48
│
├─ ZenuxsCore.create({...})                            @ line 49-68
│   └─ Conditional: !forceLocalBackend → hub config    @ line 51-59
│   └─ Conditional: forceLocalBackend → no hub config
│   └─ (→ see §6 ZenuxsCore.create)
│
├─ await core.featureFlags.poll()                      @ line 70-73
│
└─ return core                                         @ line 79
```

---

## 6. `ZenuxsCore.create()` → `createRuntimeHost()` (`packages/core/src/ZenuxsCore.ts` + `host.ts`)

```
┌─ ZenuxsCore.create(options)   @ ZenuxsCore.ts:197
│
├─ Static → resolveCoreDistinctId(options.distinctId)  @ line 198
├─ Static → normalizeRuntimeCapabilities(options.capabilities) @ line 199
│
├─ createRuntimeHost(normalizedOptions)                @ line 201
│   └─ (→ see §7 createRuntimeHost)
│
├─ Static → normalizeAutomationOptions(options.automation) @ line 202
│
├─ [FORK] options.featureFlags or new FeatureFlagsService(...) @ line 203-213
│
├─ new ZenuxsCore(host, ...)                           @ line 214-227
│   (private constructor stores host, creates settings/prompts/automation APIs)
│
├─ [FORK] automationOptions.autoStart !== false
│   → await core.automation.start()                    @ line 228-229
│
└─ return core                                         @ line 231
```

### `ZenuxsCore.start()` (`packages/core/src/ZenuxsCore.ts:274`)

```
┌─ ZenuxsCore.start(input)  @ line 274
│
├─ Static → toZenuxsCoreStartInput(input)              @ line 277
│
├─ [FORK] this.prepare?.(input)                         @ line 278
│   (optional prepare hook, set by prepareCliEnterpriseIntegration)
│   Conditional if (bootstrap):
│     → bootstrap.applyToStartSessionInput(input)      @ line 281
│
├─ host.startSession(normalizeZenuxsCoreStartInput(...))  @ line 283-297
│   └─ (→ see §8 LocalRuntimeHost.startSession)
│
├─ [FORK] bootstrap → track in activeSessionBootstraps   @ line 298-305
├─ Static → emitSessionStartedTelemetry(...)            @ line 306-312
└─ return result                                        @ line 313
```

---

## 7. `createRuntimeHost()` (`packages/core/src/runtime/host/host.ts`)

```
┌─ createRuntimeHost(options)  @ host.ts:136
│
├─ Static → resolveCoreDistinctId(options.distinctId)  @ line 139
├─ Static → resolveConfiguredBackendMode(options)      @ line 141
│     Checks: options.backendMode → env var CLINE_SESSION_BACKEND_MODE → "auto"
│
├─ Static → prewarmLocalHubIfNeeded(configuredMode, options)  @ line 142
│     Conditional: mode === "auto" || mode === "hub" → prewarmDetachedHubServer
│
├─ [FORK] configuredMode === "remote"  @ host.ts:143
│   │  Conditional if !remoteEndpoint → throw Error
│   │  → new RemoteRuntimeHost({...})                   @ line 153-161
│   └─ return
│
├─ [FORK] configuredMode === "hub"  @ host.ts:163
│   │  Conditional: explicitEndpoint or ensureCompatibleLocalHubUrl(...)
│   │  Conditional if !hubUrl → throw Error
│   │  → new HubRuntimeHost({...}, {...})               @ line 179-192
│   └─ return
│
├─ [FORK] configuredMode === "auto"  @ host.ts:194
│   │  → resolveCompatibleLocalHubUrl(...)              @ line 195-200
│   │  [FORK] if hubUrl found:
│   │      → new HubRuntimeHost({...}, {...})           @ line 205-218
│   │      → await host.connect()                       @ line 220
│   │      Conditional if connect succeeds → return host  @ line 221
│   │      else → fall back to createLocalRuntimeHost(options, distinctId) @ line 245
│   │  [FORK] if no hubUrl:
│   │      → createLocalRuntimeHost(options, distinctId)  @ line 245
│   └─ return
│
└─ default: createLocalRuntimeHost(options, distinctId)  @ line 247

── createLocalRuntimeHost(options, distinctId, backend?)  @ host.ts:99
    ├─ [FORK] backend ?? options.sessionService ?? createLocalBackend(options) @ line 106
    │   createLocalBackend → try SqliteSessionStore → CoreSessionService
    │                       catch → FileSessionService (fallback) @ host.ts:64-97
    └─ return new LocalRuntimeHost({...})               @ line 104-113
```

---

## 8. `LocalRuntimeHost` (`packages/core/src/runtime/host/local-runtime-host.ts`)

### Constructor (`local-runtime-host.ts:217`)
```
┌─ constructor(options: LocalRuntimeHostOptions)  @ line 217
│
├─ Static → setHomeDirIfUnset(homedir())             @ line 219
├─ Static → resolveCoreDistinctId(options.distinctId) @ line 220
│
├─ this.runtimeBuilder = options.runtimeBuilder ?? new DefaultRuntimeBuilder()  @ line 222
├─ this.createAgentInstance = options.createAgent ?? ((config) => new SessionRuntime(config))  @ line 223-224
│
├─ this.pendingPromptsController = new PendingPromptsController({...})  @ line 242-246
├─ this.pendingPrompts = { list, update, delete }    @ line 247-252
│
├─ this.eventBridge = new AgentEventBridge({...})    @ line 253-270
│
└─ ...other field initializations
```

### `startSession(input)` (`local-runtime-host.ts:298`)
```
┌─ startSession(input)  @ line 298
│
├─ Source = input.source ?? SessionSource.CLI         @ line 299
├─ Static → createSessionId()                          @ line 302
├─ Static → applyInitialOAuthCredentials(input)        @ line 303-304
│
├─ [FORK] initialMessages.length > 0
│   → summarizeUsageFromMessages     @ line 308
│   else → createInitialAccumulatedUsage()              @ line 309
│
├─ Static → resolveWorkspacePath(input.config)          @ line 324
├─ Static → SessionManifestSchema.parse({...})          @ line 326-343
│
├─ [FORK] isReadOnlyResumeStart → load existing manifest @ line 346-363
│
├─ ...seed aggregate usage, build capabilities, init subAgentDeps  @ lines 364-397
│
├─ Static → prepareLocalRuntimeBootstrap({...})         @ line 398-446
│   (resolves provider config, tools, hooks, plugins)
│
├─ this.runtimeBuilder.build(bootstrap.runtimeBuilderInput)  @ line 447-448
│   └─ DefaultRuntimeBuilder.build({...}) → BuiltRuntime
│
├─ runtime.teamRuntime && !config.teamName
│   → config.teamName = runtime.teamRuntime.getTeamName()  @ line 452-454
│
├─ tools = [...runtime.tools, ...configWithProvider.extraTools]  @ line 456
│
├─ Build agentConfig object (lines 459-526) including:
│   - sessionId, providerId, modelId, apiKey, baseUrl
│   - systemPrompt, maxIterations, execution
│   - prepareTurn: createContextCompactionPrepareTurn(configWithProvider)
│   - tools, hooks, extensions
│   - requestToolApproval wrapper
│   - consumePendingUserMessage closure
│   - onEvent → eventBridge.dispatchAgentEvent
│
├─ this.createAgentInstance(agentConfig)                @ line 562
│   → new SessionRuntime(agentConfig)                   @ (see constructor line 224 default)
│
├─ [FORK] agentConfig.onEvent → agent.subscribeEvents(...)  @ line 563-564
├─ [FORK] runtime.registerLeadAgent?.(agent)            @ line 566
│
├─ Static → emitSessionCreationTelemetry(...)            @ line 574-580
├─ Static → captureAgentCreated(...)                     @ line 581-588
├─ [FORK] runtime.teamRuntime → captureAgentTeamCreated  @ line 589-597
│
├─ Create ActiveSession object                           @ line 599-626
├─ this.sessions.set(sessionId, active)                  @ line 627
├─ this.emitStatus(sessionId, "running")                 @ line 628
│
├─ [FORK] initialMessages.length > 0 && !resumedArtifacts
│   → ensureSessionPersisted + persistSessionMessages   @ lines 629-640
│   → if !prompt → updateStatus(session, "completed")   @ line 637-639
│
├─ [FORK] startInput.prompt?.trim()                     @ line 644
│   → this.executeTurn(active, { prompt, userImages, userFiles })  @ line 645-649
│     │
│     ├─ this.prepareTurnInput(...)                      @ line 1001
│     │   → enrichPromptWithMentions, formatModePrompt  @ lines 1268-1295
│     │
│     ├─ this.ensureSessionPersisted(session)            @ line 1008
│     ├─ this.syncOAuthCredentials(session)              @ line 1009
│     ├─ this.markTurnRunning(session)                   @ line 1010
│     │
│     ├─ this.executeAgentTurn(session, prompt, ...)     @ line 1012-1017
│     │   └─ (see §9 executeAgentTurn)
│     │
│     └─ while shouldAutoContinueTeamRuns(session) loop  @ line 1019-1027
│         → waitForTeamRunUpdates, buildTeamRunContinuationPrompt
│         → this.executeAgentTurn(session, continuationPrompt)
│
│   [FORK] !active.interactive → this.finalizeSingleRun  @ line 651
│   else → this.completeInteractiveTurn                  @ line 653
│
├─ [catch] interactive && aborting → completeAbortedInteractiveTurn  @ line 657-658
│   else → captureSdkError + failSession + throw          @ line 660-683
│
└─ return { sessionId, manifest, manifestPath, messagesPath, result }  @ line 686-692
```

### `executeAgentTurn()` (`local-runtime-host.ts:1098`)

```
┌─ executeAgentTurn(session, prompt, userImages?, userFiles?)  @ line 1098
│
├─ shouldContinue = session.started || messages.length > 0   @ line 1104-1105
│
├─ ...usage baseline setup                                    @ lines 1106-1116
│
├─ Static → captureModeSwitch, captureConversationTurnEvent   @ lines 1118-1130
│
├─ runFn = shouldContinue
│   → session.agent.continue(prompt, userImages, userFiles)   @ line 1134
│   → session.agent.run(prompt, userImages, userFiles)        @ line 1135
│
├─ this.runWithAuthRetry(session, runFn, baselineMessages)    @ line 1136-1140
│   │
│   └── runWithAuthRetry @ line 1578
│       try → return await run()
│       catch → [FORK] isOAuthProvider && isLikelyAuthError
│         → syncOAuthCredentials(forceRefresh) + agent.restore(messages) + retry run()
│
├─ session.started = true                                     @ line 1142
├─ ...persist messages, accumulate usage                      @ lines 1143-1178
│
├─ this.observeTaskCompletionTool(session, result)            @ line 1179
│
└─ return result                                              @ line 1180

    catch: persist error messages + throw                     @ lines 1181-1201
```

### `runTurn(input)` (`local-runtime-host.ts:721`)

```
┌─ runTurn(input: SendSessionInput)  @ line 721
│
├─ session = this.getSessionOrThrow(input.sessionId)          @ line 722
├─ Static → canStartRun()                                     @ line 723
├─ delivery = input.delivery ?? (interactive && !canStartRun ? "queue" : undefined) @ line 724-726
│
├─ [FORK] delivery === "queue" || "steer"
│   → pendingPromptsController.enqueue(...); return undefined  @ lines 737-745
│
├─ else:
│   → this.executeTurn(session, { prompt, ... })              @ line 748-753
│   → [FORK] !session.interactive → finalizeSingleRun         @ line 754-755
│   → [FORK] session.interactive → completeInteractiveTurn    @ line 756-757
│   → [FORK] finishReason === "error" || "aborted" → return result @ line 759-764
│   → queueMicrotask → pendingPromptsController.drain          @ line 765-767
│   → return result                                            @ line 768
│
│   catch: [FORK] interactive && aborting → completeAbortedInteractiveTurn
│   else → captureSdkError + failSession + throw              @ lines 769-787
```

---

## 9. `DefaultRuntimeBuilder.build()` (`packages/core/src/runtime/orchestration/runtime-builder.ts`)

```
┌─ DefaultRuntimeBuilder.build(input: RuntimeBuilderInput)  @ runtime-builder.ts:336
│
├─ Static → normalizeConfig(config)                          @ line 350
│
├─ [FORK] normalized.enableSpawnAgent
│   → loadConfiguredAgentConfigs({workspaceRoot})            @ line 358-361
│
├─ Check config extensions (rules, skills, workflows, plugins)  @ lines 365-372
│
├─ [FORK] !!userInstructionService && (userInstructionsEnabled || configuredAgentsNeedSkills)
│   → createUserInstructionConfigService(...)                @ line 390-404
│
├─ [FORK] userInstructionService
│   → await userInstructionService.start().catch(...)         @ line 408
│
├─ Determine registerSkillsTool                               @ lines 411-424
│
├─ Static → userInstructionService.createExtension({...})    @ line 428-435
│
├─ tools: AgentTool[] = []                                    @ line 354
│
├─ [FORK] normalized.enableTools                              @ line 440
│   │
│   ├─ tools.push(...createBuiltinToolsList(...))             @ line 441-452
│   │   └── createBuiltinToolsList @ runtime-builder.ts:126
│   │       → ToolPresets[resolveToolPresetName({mode})]      @ line 136
│   │       → resolveToolRoutingConfig(providerId, modelId, mode, rules) @ line 137-141
│   │       → filterAvailableTools(createBuiltinTools({...}), toolPolicies) @ line 144-160
│   │
│   └─ [FORK] !normalized.disableMcpSettingsTools            @ line 453
│       → loadConfiguredMcpTools(config.logger)               @ line 454
│         → createDefaultMcpServerClientFactory               @ line 196-198
│         → registerMcpServersFromSettingsFile                 @ line 205-207
│         → enabled.map(r => createMcpTools({serverName, provider})) @ line 220
│       → tools.push(...mcpRuntime.tools)                     @ line 455
│
├─ [FORK] normalized.enableSpawnAgent && configuredAgents.configs.length > 0  @ line 495-496
│   → tools.push(...filterAvailableTools(
│       createConfiguredAgentTools({...}), toolPolicies))     @ line 497-532
│
├─ [FORK] normalized.enableSpawnAgent && createSpawnTool      @ line 641
│   → tools.push({ ...spawnTool, execute: async (...) => { ensureTeamRuntime(); ... } })  @ line 643-649
│
├─ [FORK] normalized.enableAgentTeams                         @ line 652
│   → ensureTeamRuntime()                                      @ line 653
│     (lazy-init AgentTeamsRuntime, bootstrapAgentTeams, add team tools)
│
├─ finalTools = filterAvailableTools(tools, toolPolicies)     @ line 656
│
├─ Build completionPolicy                                      @ lines 657-703
│
└─ return {
      tools: finalTools, teamRuntime, teamRestoredFromPersistence,
      delegatedAgentConfigProvider, extensions, completionPolicy,
      registerLeadAgent, shutdown
    }                                                         @ lines 705-735
```

---

## 10. `SessionRuntime` — The Per-Session Orchestrator (`packages/core/src/runtime/orchestration/session-runtime-orchestrator.ts`)

### Constructor (`session-runtime-orchestrator.ts:368`)

```
┌─ SessionRuntime(config: AgentConfig, deps?)  @ line 368
│
├─ this.createAgentRuntimeImpl = deps.createAgentRuntimeImpl ?? createAgentRuntime  @ line 376-377
│
├─ Static → new ConversationStore(config.initialMessages)     @ line 379
├─ Static → new MessageBuilder(...)                           @ line 380
├─ Static → createContributionRegistry({...})                 @ line 381-396
├─ Static → registry.resolve() + registry.validate()          @ lines 403-404
├─ Static → new MistakeTracker({...})                         @ line 407-422
├─ Static → new LoopDetectionTracker(loopConfig)              @ line 429
│
└─ ...field initialization
```

### `run()` / `continue()` → `executeRun()` (`session-runtime-orchestrator.ts:624-870`)

```
┌─ run(userMessage, userImages?, userFiles?)  @ line 624
│   Static → conversation.resetForRun()                        @ line 629
│   Static → resetConversationBoundaryTrackers()               @ line 630
│   → this.executeRun({ userMessage, ..., isContinue: false }) @ line 631-636
│
├─ continue(userMessage?, userImages?, userFiles?)  @ line 639
│   → this.executeRun({ ...isContinue: true })                @ line 644-649
│
└─ executeRunInternal(input)  @ line 683
    │
    ├─ [GUARD] shutdownCalled → throw                        @ line 689-693
    ├─ [GUARD] running → throw                                @ line 694-698
    │
    ├─ this.running = true                                    @ line 699
    ├─ ...reset state for new run                             @ lines 700-717
    │
    ├─ await this.ensureExtensionsInitialized()               @ line 707
    │   (runs extension setup() callbacks)
    │
    ├─ [FORK] effectiveUserMessage !== undefined
    │   → buildUserTurnContent → conversation.appendMessage   @ line 729-737
    │
    ├─ Static → composeSystemPrompt()                          @ line 740
    │   (collects rules from contribution registry, merges with systemPrompt)
    │
    ├─ Static → createAgentModelFromConfig(config, logger, telemetry)  @ line 741-745
    │   └─ (→ creates AgentModel via Llms handler factory)
    │
    ├─ Merge extension tools + config tools (deduped by name) @ lines 755-772
    │
    ├─ Static → createAgentRuntimeConfig({...})                @ line 782-802
    │   └─ (→ see §11 createAgentRuntimeConfig)
    │
    ├─ runtime = this.createAgentRuntimeImpl(runtimeConfig)    @ line 803
    │   └─ createAgentRuntime(runtimeConfig) → new AgentRuntime(config)
    │      (→ see §12 AgentRuntime)
    │
    ├─ [FORK] abortRequested → runtime.abort(reason)          @ line 805-807
    │
    ├─ const unsubscribe = runtime.subscribe(handleRuntimeEvent)  @ line 811-813
    │   └─ handleRuntimeEvent → translates AgentRuntimeEvent → AgentEvent → listeners
    │
    ├─ [FORK] input.isContinue
    │   → runResult = await runtime.continue(undefined)       @ line 823
    │   → runResult = await runtime.run("")                   @ line 825
    │
    ├─ [FORK] runResult.messages.length > 0
    │   → conversation.replaceMessages(...)                    @ line 852-857
    │
    └─ return this.buildLegacyResult({runResult, thrownError, ...})  @ line 861-866
```

### `abort(reason?)` (`session-runtime-orchestrator.ts:541`)
```
┌─ abort(reason?)  @ line 541
│   Static → set abortRequested, abortReason                 @ line 550-551
│   Conditional: activeRunPromise → .catch(noop)             @ line 599 (safety observer)
│   Static → this.activeRuntime?.abort(message)              @ line 601
```

---

## 11. `createAgentRuntimeConfig()` (`packages/core/src/runtime/config/agent-runtime-config-builder.ts`)

```
┌─ createAgentRuntimeConfig(input: CreateAgentRuntimeConfigInput)  @ line 84
│
├─ Static → buildModelOptions(agentConfig)                   @ line 89
│   (collects thinking, reasoningEffort, thinkingBudgetTokens, maxTokensPerTurn, apiTimeoutMs)
│
├─ Static → buildMessageModelInfo(agentConfig)               @ line 90
│   ({ id: modelId, provider: providerId, family })
│
├─ Static → resolveToolExecution(maxParallelToolCalls)       @ line 92
│   (→ "sequential" | "parallel" | undefined)
│
└─ return AgentRuntimeConfig {                               @ lines 94-118
      sessionId, agentId, conversationId, parentAgentId,
      systemPrompt, messageModelInfo, model, modelOptions,
      tools, hooks, prepareTurn, plugins, logger, telemetry,
      initialMessages, completionPolicy, maxIterations,
      toolExecution, toolPolicies, toolContextMetadata,
      requestToolApproval
    }
```

---

## 12. `AgentRuntime` (`packages/agents/src/agent-runtime.ts`)

### Constructor (`agent-runtime.ts:441`)

```
┌─ constructor(config: AgentRuntimeConfig)  @ line 441
│
├─ Static → resolveRuntimeConfig(config)                     @ line 442
│   [FORK] hasPrebuiltModel(config) → return config as-is    @ line 138-139
│   else:                                                     @ line 140-148
│     Static → createGateway({providerConfigs, telemetry})    @ line 143-146
│       └─ (→ see §13 DefaultGateway)
│     Static → gateway.createAgentModel({providerId, modelId}) @ line 147
│       → (→ see §13 GatewayModelAdapter)
│
├─ this.config = { ...resolved, toolExecution: "sequential"??resolved.toolExecution } @ line 443-446
├─ this.state.agentId = resolved.agentId ?? createUID("agent")  @ line 447
├─ this.state.messages = cloneMessages(resolved.initialMessages ?? []) @ line 450
└─ ...other field initialization
```

### `execute(input?)` — The Main Loop (`agent-runtime.ts:596`)

```
┌─ execute(input?: AgentRunInput)  @ line 596
│
├─ await this.ensureInitialized()                             @ line 597
│   └── initialize():
│       → registerHooks(this.config.hooks)                   @ line 528
│       → for tool of config.tools → this.tools.set(name, tool) @ line 529-531
│       → for plugin of config.plugins → plugin.setup()     @ line 532-542
│         → for setupTool of setup.tools → this.tools.set(name, tool)
│         → registerHooks(setup?.hooks)
│
├─ this.abortController = new AbortController()               @ line 602
├─ ...reset state                                              @ lines 603-608
│
├─ await this.callBeforeRunHooks()                             @ line 611
│
├─ for (message of normalizeInput(input))                     @ line 614
│   → this.state.messages.push(message); emit("message-added") @ lines 615-621
│
├─ MAIN LOOP while (iteration < maxIterations)               @ line 630-731
│   │
│   ├─ this.throwIfAborted()                                  @ line 634
│   ├─ iteration++                                            @ line 636
│   ├─ emit("turn-started")                                   @ line 637-641
│   │
│   ├─ ({ message, finishReason }) = this.generateAssistantMessage()  @ line 643
│   │   └─ (→ see §12a generateAssistantMessage)
│   │
│   ├─ this.state.messages.push(message); emit events        @ lines 645-657
│   │
│   ├─ [FORK] finishReason === "aborted" → throw              @ line 659-661
│   │
│   ├─ toolCalls = message.content.filter(tool-call parts)   @ line 663-666
│   │
│   ├─ [FORK] finishReason === "error" && no toolCalls → throw @ line 667-669
│   │
│   ├─ [FORK] toolCalls.length === 0                          @ line 672
│   │   → emit("turn-finished")                               @ line 673-678
│   │   → check completionReminderMessages                   @ line 679-686
│   │     if reminders found → addUserReminderMessage; continue
│   │   → finishRun("completed") + callAfterRunHooks + emit   @ lines 687-694
│   │   → return result
│   │
│   ├─ toolMessages = this.executeToolCalls(toolCalls)        @ line 697
│   │   └─ (→ see §12c executeToolCalls)
│   │
│   ├─ push toolMessages to state; emit                       @ lines 699-706
│   ├─ emit("turn-finished")                                  @ line 707-712
│   │
│   └─ [FORK] terminalToolMessage (completing tool)           @ line 713-730
│       → finishRun("completed") + callAfterRunHooks + emit
│       → return result
│
├─ [catch] → build AgentRunResult with status "aborted"/"failed"  @ lines 736-771
│   → callAfterRunHooks; emit; return result
│
└─ [finally] this.abortController = undefined                 @ line 773
```

### `(§12a) generateAssistantMessage()` (`agent-runtime.ts:792`)

```
┌─ generateAssistantMessage()  @ line 792
│
├─ Build AgentModelRequest {                                   @ lines 797-810
│     systemPrompt: composeSystemPrompt(config.systemPrompt, config.systemParts),
│     messages: cloneMessages(this.state.messages),
│     tools: [...this.tools.values()].map(to AgentToolDefinition),
│     signal: abortController?.signal,
│     options: config.modelOptions,
│   }
│
├─ [FORK] iteration > 1 → consumePendingUserMessage           @ line 812-816
│
├─ request = await this.prepareTurnForModelRequest(request)    @ line 818
│   → config.prepareTurn?.(context)                            @ line 1038-1060
│
├─ for (hook of this.hooks.beforeModel)                        @ line 820-838
│   → apply stop control; merge messages/tools/options
│
├─ const stream = await this.config.model.stream(request)     @ line 854
│   └─ (→ see §13 GatewayModelAdapter.stream → DefaultGateway.stream)
│
├─ for await (const event of stream)                           @ line 866
│   └─ Process text-delta, reasoning-delta, tool-call-delta, usage, finish
│
├─ Build content array + tool assemblies + invalid tool calls  @ lines 970-1005
│
├─ const message = createMessage("assistant", content, metadata)  @ line 1007-1011
│
├─ for (hook of this.hooks.afterModel)                         @ line 1019-1026
│
└─ return { message, finishReason }                            @ line 1028
```

### `(§12b) executeToolCalls(toolCalls)` (`agent-runtime.ts:1116`)

```
┌─ executeToolCalls(toolCalls: AgentToolCallPart[])  @ line 1116
│
├─ for each toolCall → prepareToolExecution(toolCall)          @ line 1121
│   └── prepareToolExecution(toolCall):                        @ line 1159
│       ├─ const tool = this.tools.get(toolCall.toolName)     @ line 1162
│       ├─ Check metadata.inputParseError → skipReason        @ line 1172-1174
│       ├─ Check metadata.toolSource.executionMode === "provider" → skipReason @ line 1182-1188
│       ├─ for (hook of this.hooks.beforeTool)                @ line 1192-1214
│       │   → apply stop control; check skip; merge policy
│       ├─ [FORK] tool exists + !skipReason                   @ line 1217-1235
│       │   → resolveToolPolicy(toolName, toolPolicies)
│       │   → if policy.enabled === false → skipReason
│       │   → elif policy.autoApprove === false
│       │       → requestToolApproval(toolCall, input, policy) @ line 1225-1229
│       └─ return { toolCall, tool, input, skipReason }       @ line 1237-1242
│
├─ [FORK] toolExecution === "parallel"                         @ line 1124
│   → Promise.all(prepared.map(executePreparedTool))           @ line 1125-1127
│
└─ else (sequential):
    → for each → executePreparedTool(execution)                 @ lines 1131-1134

── executePreparedTool(prepared):                               @ line 1285
    ├─ emit("tool-started")                                     @ line 1289-1294
    │
    ├─ [FORK] prepared.skipReason                               @ line 1297
    │   → result = { output: { error }, isError: true }        @ line 1298-1301
    │
    ├─ [FORK] !prepared.tool (unknown tool name)                @ line 1302
    │   → result = { output: { error: "Unknown tool" }, isError: true }  @ line 1303-1306
    │
    ├─ else:                                                    @ line 1307
    │   → const output = await prepared.tool.execute(
    │         prepared.input, {
    │           sessionId, agentId, conversationId,
    │           runId, iteration, toolCallId,
    │           signal: abortController?.signal,
    │           metadata: config.toolContextMetadata,
    │           snapshot, emitUpdate
    │         })                                                 @ line 1309-1328
    │     └─ ** THIS IS THE ACTUAL TOOL EXECUTION **
    │   → result = { output }                                    @ line 1329
    │   catch → result = { output: { error }, isError: true }   @ line 1330-1337
    │
    ├─ for (hook of this.hooks.afterTool)                       @ line 1343-1360
    │   → apply stop control; merge result
    │
    ├─ const message = createMessage("tool", [tool-result part]) @ line 1362-1370
    │
    ├─ emit("tool-finished")                                    @ line 1372-1378
    │
    └─ return message                                           @ line 1380
```

---

## 13. LLM Layer — Gateway → Provider

### `DefaultGateway.stream()` (`packages/llms/src/providers/gateway.ts:258`)

```
┌─ DefaultGateway.stream(request: GatewayStreamRequest)  @ gateway.ts:258
│
├─ const resolved = this.registry.resolveModel({providerId, modelId})  @ line 261-264
│   (looks up provider + model metadata in GatewayRegistry)
│
├─ const providerRecord = await this.registry.createProvider(providerId)  @ line 265-267
│   (creates the provider factory from registry)
│
├─ const provider = await providerRecord.createProvider(providerRecord.config)  @ line 268
│   └─ → createAiSdkProvider(kind)(config) → returns { async *stream(request, context) }
│      (→ see §14 createAiSdkProvider)
│
├─ [FORK] request.maxTokens
│   → resolveGatewayRequestMaxTokens({...})                    @ line 269-286
│
├─ const stream = await provider.stream({...request, maxTokens}, context)  @ line 287-302
│
└─ return toAsyncIterable(stream)                              @ line 304
```

### `GatewayModelAdapter.stream()` (`gateway.ts:47`)

```
┌─ GatewayModelAdapter.stream(request: AgentModelRequest)  @ gateway.ts:47
│
├─ Resolve reasoning/thinking from request options            @ lines 48-82
│
└─ return this.gateway.stream({                               @ lines 83-101
      providerId: this.selection.providerId,
      modelId: this.selection.modelId,
      systemPrompt, messages, tools,
      temperature, maxTokens, metadata,
      reasoning, signal
    })
```

---

## 14. `createAiSdkProvider()` & Provider Modules (`packages/llms/src/providers/ai-sdk.ts`)

```
┌─ createAiSdkProvider(kind: ProviderModuleKind)  @ ai-sdk.ts:893
│   Returns: async (config) => ({ async *stream(request, context) })
│
└─ Provider stream method (ai-sdk.ts:895-1029):
    │
    ├─ DEFAULT_MAX_RETRIES = process.env.VITEST ? 0 : 5       @ line 902
    ├─ wrapFetchWithRetry(config.fetch, logger, maxRetries)    @ line 904
    │
    ├─ const provider = await createProviderModule(kind, config, context)  @ line 905-912
    │   └── createProviderModule(kind, config, context)        @ line 824-891
    │       Switch on kind:
    │       "openai"           → Dynamic → createOpenAIProviderModule(config, context)
    │       "openai-compatible" → Dynamic → createOpenAICompatibleProviderModule(config, context)
    │       "anthropic"        → Dynamic → createAnthropicProviderModule(config, context)
    │       "google"           → Dynamic → createGoogleProviderModule(config, context)
    │       "vertex"           → Dynamic → createVertexProviderModule(config, context)
    │       "bedrock"          → Dynamic → createBedrockProviderModule(config)
    │       "mistral"          → Dynamic → createMistralProviderModule(config)
    │       "claude-code"      → Dynamic → createClaudeCodeProviderModule(config)
    │       "openai-codex"     → Dynamic → createOpenAICodexProviderModule(config)
    │       "opencode"         → Dynamic → createOpenCodeProviderModule(config)
    │       "dify"             → Dynamic → createDifyProviderModule(config)
    │       "sapaicore"        → Dynamic → createSapAiCoreProviderModule(config)
    │
    ├─ [FORK] providerDisablesExternalToolExecution → tools = undefined
    │   → else toAiSdkTools(request)                           @ line 913-915
    │     └─ Formats tools as Record<string, { description, inputSchema }>
    │
    ├─ [FORK] shouldApplyPromptCache(request, context)         @ line 920
    │   → buildCachedAiSdkMessages(...)                        @ line 921
    │   → toAiSdkMessages(request.messages, systemPrompt)     @ line 922
    │
    ├─ composeAiSdkProviderOptions(request, context, kind)     @ line 923-927
    │
    ├─ stream = streamText({                                    @ line 940-979
    │     model: provider.model(context.model.id),
    │     messages: aiMessages,
    │     [system], [tools], temperature, [maxOutputTokens],
    │     abortSignal: request.signal,
    │     providerOptions,
    │     onError: (capture error)
    │   })
    │
    ├─ suppressDanglingStreamPromises(stream)                   @ line 985
    │
    └─ yield* emitAiSdkEvents(stream, request, context, pricing, capturedError) @ line 987-993
        └── emitAiSdkEvents() @ line 648-822
            ├─ for await (part of stream.fullStream)
            │   yields: text-delta, reasoning-delta, tool-call-delta, usage, finish
            ├─ or stream.textStream → text-delta
            └─ catch → yield { type: "finish", reason: "error", error }
```

---

## 15. Decision Matrix — Key Fork Points

| Fork | File:Line | Condition | Path A | Path B |
|------|-----------|-----------|--------|--------|
| Hub daemon vs CLI | `index.ts:60` | `isHubDaemonProcess()` | `@cline/core/hub/daemon-entry` | `runCli()` |
| ACP vs normal | `main.ts:838` | `args.acpMode` | `runAcpMode()` | Normal flow |
| Input source | `main.ts:1106` | Piped stdin & !interactive | `runZen()` / `runAgent()` | Next check |
| Interactive mode | `main.ts:1138` | `interactive \|\| !prompt` | `runInteractive()` | Single prompt |
| Zen mode | `main.ts:948` | `mode === "zen"` | `runZen()` (hub dispatch) | `runAgent()` |
| Yolo mode | `main.ts:947` | `mode === "yolo"` | Forces local backend, disables spawn/teams | Normal |
| Backend mode | `host.ts:141-247` | Resolved mode | `remote` / `hub` / `auto` / `local` | Per case |
| Hub fallback | `host.ts:194-245` | `auto` + hub connect fails | `createLocalRuntimeHost()` | — |
| OAuth auth retry | `local-runtime-host.ts:1586-1595` | OAuth + auth error | `syncOAuthCredentials()` + retry | Throw |
| Tool execution | `agent-runtime.ts:1124` | `toolExecution === "parallel"` | `Promise.all(...)` | Sequential loop |
| Tool approval | `agent-runtime.ts:1224` | `policy.autoApprove === false` | `requestToolApproval()` | Execute |
| Completion guard | `agent-runtime.ts:679-686` | No tool calls + reminders | `addUserReminderMessage()` + continue | `finishRun("completed")` |
| Loop detection | `session-runtime-orch.ts:1189-1219` | `LoopDetectionTracker.inspect()` | Soft → recovery notice; Hard → mistake track + abort | Continue |
| Mistake limit | `session-runtime-orch.ts:1241-1254` | `MistakeTracker.record()` returns `action: "stop"` | Append stop notice + `abort()` | Continue |

---

## 16. Static vs Dynamic vs Conditional Edge Summary

**Static edges** (direct function calls):
- `initVcr()` → internal setup
- `runCli()` → most setup calls (createProgram, resolveConfigDirArg, etc.)
- `createCliCore()` → `ZenuxsCore.create()`
- `ZenuxsCore.create()` → `createRuntimeHost()` → `new LocalRuntimeHost()` / `new HubRuntimeHost()` / `new RemoteRuntimeHost()`
- `LocalRuntimeHost.startSession()` → `DefaultRuntimeBuilder.build()` (when default)
- `DefaultRuntimeBuilder.build()` → `createBuiltinTools()`, `createMcpTools()`, `createConfiguredAgentTools()`
- `LocalRuntimeHost.startSession()` → `new SessionRuntime(config)`
- `SessionRuntime.executeRunInternal()` → `createAgentRuntimeConfig()` → `createAgentRuntime(runtimeConfig)` → `new AgentRuntime(config)`
- `AgentRuntime.execute()` → `generateAssistantMessage()` → `model.stream(request)`
- `AgentRuntime.generateAssistantMessage()` → `executeToolCalls()` → `executePreparedTool()` → `tool.execute(input, context)`

**Dynamic edges** (imports, callbacks, events, promise chains):
- `index.ts:67` → `await import("./main")`
- `main.ts` subcommand handlers → `await import(...)` lazy loading
- `runCli()` → `loadCliRuntimeModules()` → `Promise.all([import(...)])`
- `SessionRuntime` subscriptions → `runtime.subscribe(handleRuntimeEvent)` → `listener(event)`
- `AgentRuntime.execute()` → `for await (const event of stream)` → async iteration
- `createAiSdkProvider()` → `streamText()` → AI SDK provider stream

**Conditional edges** (if/switch/config guarded):
- `index.ts:60` → hub daemon vs CLI
- `main.ts:838` → ACP mode
- `main.ts:947-948` → Yolo/Zen mode detection
- `main.ts:1106-1207` → piped/interactive/single prompt routing
- `host.ts:143-247` → backend mode routing (remote/hub/auto/local)
- `local-runtime-host.ts:644` → prompt present → executeTurn vs skip
- `local-runtime-host.ts:1104-1105` → `run()` vs `continue()` based on session state
- `agent-runtime.ts:1124` → parallel vs sequential tool execution
- `agent-runtime.ts:1217-1235` → tool approval policy check
- `agent-runtime.ts:672-695` → no tool calls → finish vs continue
- `ai-sdk.ts:920` → prompt cache routing
- `ai-sdk.ts:829-890` → provider module kind switch

---

## 17. Return Paths

```
runCli() exit paths:
├─ process.exit(exitCode)                     @ index.ts:78
├─ process.exitCode = ...; return             @ main.ts:683
├─ childExitCode → process.exitCode           @ main.ts:747
├─ runAcpMode() → return                      @ main.ts:841
├─ runZen() → return                          @ main.ts:1129, 1204
├─ runInteractive() → return                  @ main.ts:1183
└─ runAgent() → return                        @ main.ts:1131, 1207

runAgent() exit (via process.exitCode):
├─ process.exitCode = 0 (success)             @ run-agent.ts:410
├─ process.exitCode = 1 (error/timeout)       @ run-agent.ts:374, 398, 415
└─ process.exit(0) (SIGINT double-press)      @ run-agent.ts:256

runZen() exit:
├─ process.exitCode = 0 (dispatched)          @ run-zen.ts:165
├─ process.exitCode = 1 (error)               @ run-zen.ts:37, 47, 61, 177
└─ sessionClient.close()                      @ run-zen.ts:179

LocalRuntimeHost.startSession() returns:
├─ { sessionId, manifest, manifestPath, messagesPath, result }   @ line 686-692

AgentRuntime.execute() returns:
├─ AgentRunResult (completed)                 @ line 694, 729
├─ AgentRunResult (aborted)                   @ line 771
└─ AgentRunResult (failed)                    @ line 771

Tool execution returns:
├─ AgentMessage (tool-result)                 @ agent-runtime.ts:1362-1370
└─ thrown error → catch → { output: { error }, isError: true }   @ agent-runtime.ts:1330-1337
```
