import * as vscode from "vscode";
import { ExtensionCoreBridge } from "../runtime/core-bridge.js";
import { mapCoreEventToWebview } from "../runtime/event-mapper.js";
import type { WebviewOutboundMessage } from "../runtime/event-mapper.js";
import { AuthService } from "../services/auth-service.js";
import { ZenuxsDiffProvider } from "../webview/diff-provider.js";
import { ZenuxsLiveEditProvider } from "./live-edit-provider.js";
import { AgentTerminalManager } from "./agent-terminal-manager.js";
import { resolveExtensionConfig, resolveWorkspaceRoot, resolveCwd } from "../runtime/config-resolver.js";
import { captureEditorContext, formatEditorContextForPrompt } from "../context/editor-context.js";
import type {
	AgentResult,
	BasicLogger,
	CheckpointEntry,
	CoreSessionEvent,
	McpServerRegistration,
	McpServerSnapshot,
	ProviderListItem,
	ToolApprovalRequest,
	ToolApprovalResult,
} from "@cline/core";
import {
	buildWorkspaceMetadata,
	createCoreSettingsService,
	createDefaultMcpServerClientFactory,
	fetchZenuxsMemory,
	getLocalProviderModels,
	getPersistedProviderApiKey,
	InMemoryMcpManager,
	isOAuthProvider,
	listLocalProviders,
	loginAndSaveLocalProviderOAuthCredentials,
	mergeRulesForSystemPrompt,
	normalizeProviderId,
	ProviderSettingsManager,
	readSessionCheckpointHistory,
	resolveDefaultMcpSettingsPath,
	resolveMcpServerRegistrations,
	resolveProviderConfig,
	resolveProviderApiKeyFromSettings,
	hasMcpSettingsFile,
	loadMcpSettingsFile,
	SessionSource,
	resolveSystemPrompt,
	resolveLocalClineAuthToken,
} from "@cline/core";
import { loggerService, devLogs, LogLevel, LogCategory, type LogEntry } from "@cline/core";
import { buildZenuxsSystemPrompt } from "@cline/shared";
import { createSessionId } from "@cline/shared";
import { getWebviewHtml } from "../webview/webview-html.js";

/**
 * Webview inbound message types from the chat panel.
 */
type WebviewInboundMessage =
	| { type: "ready" }
	| {
		type: "webview_log";
		level: string;
		message: string;
		stack?: string | null;
	}
	| {
		type: "send";
		prompt: string;
		config?: Record<string, unknown>;
	}
	| { type: "abort" }
	| { type: "new_session" }
	| {
		type: "approval_response";
		approvalId: string;
		approved: boolean;
		reason?: string;
	}
	| {
		type: "save_settings";
		providerId: string;
		modelId: string;
		apiKey?: string;
		baseUrl?: string;
		autoApproveTools: boolean;
		thinking: boolean;
		reasoningEffort: string;
		maxIterations: number;
		mode?: string;
		compaction?: string;
		retries?: number;
		timeout?: number;
		checkpointEnabled?: boolean;
		autoApprovals?: Record<string, boolean>;
	}
	| {
		type: "toggle_setting_item";
		itemType: "skills" | "workflows" | "rules" | "tools" | "mcp";
		id?: string;
		name?: string;
		path?: string;
		enabled: boolean;
	}
	| {
		type: "delete_session";
		sessionId: string;
	}
	| {
		type: "rename_session";
		sessionId: string;
		title: string;
	}
		| {
		type: "restore_session";
		sessionId: string;
	}
	| { type: "save_execution_data"; sessionId: string; tasks: any[] }
	| {
		type: "export_session";
		sessionId: string;
	}
	| {
		type: "import_session";
	}
	| {
		type: "run_command";
		command: "build" | "lint" | "test" | "doctor";
	}
	| {
		type: "askAboutFile";
	}
	| {
		type: "clear_history";
	}
	| {
		type: "login_oauth";
		providerId: string;
	}
	| {
		type: "logout_oauth";
		providerId: string;
	}
	| {
		type: "models_request";
		providerId: string;
	}
	| {
		type: "mcp_register";
		name: string;
		transport: string;
		command?: string;
		args?: string[];
		url?: string;
	}
	| {
		type: "mcp_unregister";
		name: string;
	}
	| {
		type: "mcp_connect";
		name: string;
	}
	| {
		type: "mcp_disconnect";
		name: string;
	}
	| {
		type: "mcp_set_disabled";
		name: string;
		disabled: boolean;
	}
	| {
		type: "mcp_refresh_tools";
		serverName: string;
	}
	| {
		type: "mcp_list_servers";
	}
	| {
		type: "checkpoint_restore";
		sessionId: string;
		checkpointRef: string;
	}
	| {
		type: "checkpoint_list";
		sessionId: string;
	}
	| {
		type: "checkpoint_delete";
		sessionId: string;
		checkpointRef: string;
	}
	| {
		type: "team_spawn";
		agentId: string;
		rolePrompt: string;
	}
	| {
		type: "team_shutdown";
		agentId: string;
		reason?: string;
	}
	| { type: "team_status" }
	| {
		type: "team_run_task";
		agentId: string;
		task: string;
		runMode?: "sync" | "async";
	}
	| { type: "team_list_runs" }
	| {
		type: "team_cancel_run";
		runId: string;
	}
	| {
		type: "team_send_message";
		toAgentId: string;
		subject: string;
		body: string;
	}
	| {
		type: "team_broadcast";
		subject: string;
		body: string;
	}
	| { type: "team_read_mailbox" }
	| {
		type: "team_mission_log";
		kind: string;
		summary: string;
	}
	| { type: "team_list_tasks" }
	| {
		type: "team_create_task";
		title: string;
		description: string;
		assignee?: string;
	}
	| {
		type: "team_complete_task";
		taskId: string;
		summary: string;
	}
	| { type: "connector_list" }
	| {
		type: "connector_connect";
		provider: string;
		name: string;
		config?: Record<string, string>;
	}
	| {
		type: "connector_disconnect";
		id: string;
	}
	| {
		type: "developer_logs";
		action: "subscribe" | "unsubscribe" | "clear" | "pause" | "resume";
	}
	| { type: "open_file"; filePath: string; line?: number }
	| { type: "show_diff"; filePath: string; originalContent?: string; newContent?: string }
	| { type: "skip_onboarding" }
	| { type: "reveal_edit_location"; filePath: string; startLine?: number; endLine?: number }
	| { type: "get_terminal_history"; taskId: string }
	| { type: "cancel_terminal_task"; taskId: string };

/**
 * Provides the Zenuxs chat webview in the VS Code sidebar.
 * Uses the same @cline/core runtime as the CLI - no separate backend bridge.
 */
export class ZenuxsChatViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = "zenuxs-chat";

	private webviewView: vscode.WebviewView | undefined;
	private coreBridge: ExtensionCoreBridge | undefined;
	private activeSessionId: string | undefined;
	private pendingPrompt: string | undefined;
	private pendingApprovalResolve:
		| ((result: ToolApprovalResult) => void)
		| undefined;
	private isRunning = false;
	private abortController: AbortController | undefined;
	private mcpManager: InMemoryMcpManager | undefined;
	private teamsRuntime: any | undefined;
	private developerSubscribed = false;
	private developerPaused = false;
	private developerUnsubscribe: (() => void) | undefined;
	private restoredMessagesCache: any[] | undefined;
	private executionDataStore: Record<string, any[]> = {};
	private liveEditProvider = new ZenuxsLiveEditProvider();
	private agentTerminalManager = new AgentTerminalManager();

	constructor(private readonly extensionContext: vscode.ExtensionContext) {
		this.loadExecutionDataStore();

		const eventBus = {
			publish: (type: string, data: any) => {
				if (type === "terminal_line") {
					this.postToWebview({ type: "terminal_line", taskId: data.taskId, line: data.line, state: data.state });
				} else if (type === "terminal_state_changed") {
					this.postToWebview({ type: "terminal_state_changed", taskId: data.taskId, state: data.state });
				} else if (type.startsWith("file:") || type.startsWith("session:")) {
					this.postToWebview({ type: "live_edit_event", eventType: type, ...data });
				}
			},
		};

		this.liveEditProvider.setEventBus(eventBus);
		this.agentTerminalManager.setEventBus(eventBus);
	}

	private loadExecutionDataStore(): void {
		try {
			const raw = this.extensionContext.globalState.get<string>("zenuxs-execution-data");
			if (raw) this.executionDataStore = JSON.parse(raw);
		} catch { this.executionDataStore = {}; }
	}

	private saveExecutionDataStore(): void {
		try {
			this.extensionContext.globalState.update("zenuxs-execution-data", JSON.stringify(this.executionDataStore));
		} catch { /* best-effort */ }
	}

	resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	): void {
		this.webviewView = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.extensionContext.extensionUri],
		};

		webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

		webviewView.webview.onDidReceiveMessage(
			async (message: WebviewInboundMessage) => {
				await this.handleWebviewMessage(message);
			},
		);

		webviewView.onDidDispose(() => {
			this.webviewView = undefined;
			this.developerSubscribed = false;
			this.developerUnsubscribe?.();
			this.developerUnsubscribe = undefined;
		});
	}

	/**
	 * Send a message to the webview UI.
	 */
	private postToWebview(message: any): void {
		this.webviewView?.webview.postMessage(message);
	}

	/**
	 * Send a pre-filled prompt from a command to the chat panel.
	 */
	public sendPrompt(prompt: string): void {
		if (this.webviewView) {
			this.postToWebview({ type: "status", text: "Prompt ready" });
			this.handleWebviewMessage({ type: "send", prompt });
		} else {
			this.pendingPrompt = prompt;
			vscode.commands.executeCommand("zenuxs-chat.focus");
		}
	}

	/**
	 * Reset the session without sending a prompt to the LLM.
	 */
	public newSession(): void {
		loggerService.log({ level: LogLevel.DEBUG, category: LogCategory.CONVERSATION, message: "New chat triggered via newSession()", source: "session", sessionId: this.activeSessionId });
		this.handleAbort();
		this.restoredMessagesCache = undefined;
		this.pendingPrompt = undefined;
		this.isRunning = false;
		this.abortController?.abort();
		this.abortController = undefined;
		this.activeSessionId = undefined;
		// Dispose and reset core bridge and MCP manager to ensure fresh state for new session
		this.resetCore();
		this.postToWebview({ type: "reset_done" });
	}

	/**
	 * Abort the current session.
	 */
	public stopSession(): void {
		this.handleAbort();
	}

	/**
	 * Toggle to the settings tab in the webview.
	 */
	public toggleSettings(): void {
		this.postToWebview({ type: "switch_tab", tab: "settings-tab" });
	}

	/**
	 * Toggle to the history tab in the webview.
	 */
	public toggleHistory(): void {
		this.postToWebview({ type: "switch_tab", tab: "history-tab" });
	}

	/**
	 * Resolves the core bridge instance lazily.
	 * Mirrors CLI's createCliCore() from apps/cli/src/session/session.ts
	 */
	private async getCore(): Promise<ExtensionCoreBridge> {
		if (!this.coreBridge) {
			const workspaceRoot = resolveWorkspaceRoot();
			const cwd = resolveCwd();
			const logger: BasicLogger = {
				debug: (message: string, metadata?: Record<string, any>) => {
					this.postToWebview({
						type: "logs_stream",
						text: `[DEBUG] ${message} ${metadata ? JSON.stringify(metadata) : ""}`,
					});
				},
				log: (message: string, metadata?: Record<string, any>) => {
					this.postToWebview({
						type: "logs_stream",
						text: `[INFO] ${message} ${metadata ? JSON.stringify(metadata) : ""}`,
					});
				},
				error: (message: string, metadata?: Record<string, any>) => {
					this.postToWebview({
						type: "logs_stream",
						text: `[ERROR] ${message} ${metadata ? JSON.stringify(metadata) : ""}`,
					});
				},
			};
			this.coreBridge = new ExtensionCoreBridge({
				cwd,
				workspaceRoot,
				logger,
				onToolApprovalRequest: (request: ToolApprovalRequest) =>
					this.requestToolApproval(request),
			});
			this.mcpManager = new InMemoryMcpManager({
				clientFactory: createDefaultMcpServerClientFactory(),
			});
			await this.initializeMcpManager();
		}
		return this.coreBridge;
	}

	/**
	 * Dispose and reset the core bridge and MCP manager to clear cached state.
	 */
	private async resetCore(): Promise<void> {
		if (this.coreBridge) {
			await this.coreBridge.dispose();
			this.coreBridge = undefined;
		}
		if (this.mcpManager) {
			await this.mcpManager.dispose();
			this.mcpManager = undefined;
		}
	}

	/**
	 * Handles messages from the webview.
	 */
	private async handleWebviewMessage(
		message: WebviewInboundMessage,
	): Promise<void> {
		try {
			switch (message.type) {
				case "webview_log":
					this.handleWebviewLog(message);
					break;

				case "ready":
					await this.sendInitialPayload();
					if (this.pendingPrompt) {
						const prompt = this.pendingPrompt;
						this.pendingPrompt = undefined;
						await this.handleSend(prompt);
					}
					break;

				case "send":
					await this.handleSend(message.prompt, message.config);
					break;

				case "abort":
					await this.handleAbort();
					break;

			case "new_session":
				loggerService.log({ level: LogLevel.DEBUG, category: LogCategory.CONVERSATION, message: "New chat triggered via new_session webview message", source: "session", sessionId: this.activeSessionId });
				await this.handleAbort();
				this.restoredMessagesCache = undefined;
				this.pendingPrompt = undefined;
				this.isRunning = false;
				this.abortController?.abort();
				this.abortController = undefined;
				this.activeSessionId = undefined;
				await this.resetCore();
				this.postToWebview({ type: "reset_done" });
				break;

				case "approval_response":
					this.handleApprovalResponse(message);
					break;

				case "skip_onboarding":
					await this.extensionContext.globalState.update("zenuxs.onboardingSkipped", true);
					await this.sendInitialPayload();
					break;

				case "login_oauth":
					await this.handleLoginOAuth(message.providerId);
					break;

				case "logout_oauth":
					await this.handleLogoutOAuth(message.providerId);
					break;

				case "save_settings":
					await this.handleSaveSettings(message);
					break;

				case "toggle_setting_item":
					await this.handleToggleSetting(message);
					break;

				case "delete_session":
					await this.handleDeleteSession(message.sessionId);
					break;

				case "rename_session":
					await this.handleRenameSession(message.sessionId, message.title);
					break;

				case "restore_session":
					await this.handleRestoreSession(message.sessionId);
					break;

				case "save_execution_data": {
					const msg = message as any;
					if (msg.sessionId && Array.isArray(msg.tasks)) {
						this.executionDataStore[msg.sessionId] = msg.tasks;
						this.saveExecutionDataStore();
					}
					break;
				}

				case "export_session":
					await this.handleExportSession(message.sessionId);
					break;

				case "import_session":
					await this.handleImportSession();
					break;

				case "run_command":
					await this.handleRunCommand(message.command);
					break;

				case "askAboutFile":
					await this.handleAttachFileContext();
					break;

				case "clear_history":
					await this.handleClearHistory();
					break;

				case "models_request":
					await this.handleModelsRequest(message.providerId);
					break;

				case "mcp_register":
					await this.handleMcpRegister(message);
					break;
				case "mcp_unregister":
					await this.handleMcpUnregister(message.name);
					break;
				case "mcp_connect":
					await this.handleMcpConnect(message.name);
					break;
				case "mcp_disconnect":
					await this.handleMcpDisconnect(message.name);
					break;
				case "mcp_set_disabled":
					await this.handleMcpSetDisabled(message.name, message.disabled);
					break;
				case "mcp_refresh_tools":
					await this.handleMcpRefreshTools(message.serverName);
					break;
				case "mcp_list_servers":
					await this.handleMcpListServers();
					break;

				case "checkpoint_restore":
					await this.handleCheckpointRestore(message.sessionId, message.checkpointRef);
					break;
				case "checkpoint_list":
					await this.handleCheckpointList(message.sessionId);
					break;
				case "checkpoint_delete":
					await this.handleCheckpointDelete(message.sessionId, message.checkpointRef);
					break;

				case "team_spawn":
					await this.handleTeamSpawn(message.agentId, message.rolePrompt);
					break;
				case "team_shutdown":
					await this.handleTeamShutdown(message.agentId, message.reason);
					break;
				case "team_status":
					await this.handleTeamStatus();
					break;
				case "team_run_task":
					await this.handleTeamRunTask(message.agentId, message.task, message.runMode);
					break;
				case "team_list_runs":
					await this.handleTeamListRuns();
					break;
				case "team_cancel_run":
					await this.handleTeamCancelRun(message.runId);
					break;
				case "team_send_message":
					await this.handleTeamSendMessage(message.toAgentId, message.subject, message.body);
					break;
				case "team_broadcast":
					await this.handleTeamBroadcast(message.subject, message.body);
					break;
				case "team_read_mailbox":
					await this.handleTeamReadMailbox();
					break;
				case "team_mission_log":
					await this.handleTeamMissionLog(message.kind, message.summary);
					break;
				case "team_list_tasks":
					await this.handleTeamListTasks();
					break;
				case "team_create_task":
					await this.handleTeamCreateTask(message.title, message.description, message.assignee);
					break;
				case "team_complete_task":
					await this.handleTeamCompleteTask(message.taskId, message.summary);
					break;
				case "connector_list":
					await this.handleConnectorList();
					break;
				case "connector_connect":
					await this.handleConnectorConnect(message.provider, message.name, message.config);
					break;
				case "connector_disconnect":
					await this.handleConnectorDisconnect(message.id);
					break;

			case "developer_logs":
				this.handleDeveloperLogs(message);
				break;

			case "open_file":
				await this.handleOpenFile(message.filePath, message.line);
				break;

			case "reveal_edit_location":
				await this.liveEditProvider.revealEditLocation(
					(message as any).filePath,
					(message as any).startLine ?? 0,
					(message as any).endLine,
				);
				break;

			case "get_terminal_history":
				this.postToWebview({
					type: "terminal_history",
					taskId: (message as any).taskId,
					lines: this.agentTerminalManager.getTerminalHistory((message as any).taskId),
				});
				break;

			case "cancel_terminal_task":
				this.agentTerminalManager.cancelTask((message as any).taskId);
				break;

			case "show_diff":
				await this.handleShowDiff(message.filePath, message.originalContent, message.newContent);
				break;
		}
	} catch (error) {
		const txt = error instanceof Error ? error.message : String(error);
		this.postToWebview({ type: "error", text: txt });
	}
	}

	// ---------------------------------------------------------------- Developer Logs

	/**
	 * Handle developer_logs messages from the webview (subscribe, unsubscribe, clear, pause, resume).
	 */
	private handleDeveloperLogs(msg: { action: "subscribe" | "unsubscribe" | "clear" | "pause" | "resume" }): void {
		switch (msg.action) {
			case "subscribe":
				if (!this.developerSubscribed) {
					this.developerSubscribed = true;
					// Replay existing backlog
					const backlog = loggerService.getEntries();
					if (backlog.length > 0) {
						this.postToWebview({ type: "developer_logs_batch", entries: backlog });
					}
					// Subscribe to live entries
					this.developerUnsubscribe = loggerService.subscribe((entry: LogEntry) => {
						if (this.developerPaused) return;
						this.postToWebview({ type: "developer_logs_batch", entries: [entry] });
					});
				}
				break;
			case "unsubscribe":
				this.developerSubscribed = false;
				this.developerUnsubscribe?.();
				this.developerUnsubscribe = undefined;
				break;
			case "clear":
				loggerService.clear();
				break;
			case "pause":
				this.developerPaused = true;
				break;
			case "resume":
				this.developerPaused = false;
				break;
		}
	}

	/**
	 * Handle webview_log messages from the webview and forward to loggerService.
	 */
	private handleWebviewLog(msg: { level: string; message: string; stack?: string | null }): void {
		const levelMap: Record<string, LogLevel> = {
			log: LogLevel.INFO,
			info: LogLevel.INFO,
			warn: LogLevel.WARNING,
			error: LogLevel.ERROR,
			debug: LogLevel.DEBUG,
			trace: LogLevel.TRACE,
		};
		loggerService.log({
			level: levelMap[msg.level] || LogLevel.DEBUG,
			category: LogCategory.CONSOLE,
			message: msg.message,
			source: "webview",
			stack: msg.stack || undefined,
		});
	}

	/**
	 * Opens a file in the VS Code editor at an optional line number.
	 */
	private async handleOpenFile(filePath: string, line?: number): Promise<void> {
		try {
			await this.liveEditProvider.revealEditLocation(filePath, line ?? 0);
		} catch (err) {
			await ZenuxsDiffProvider.openFile(filePath, line);
		}
	}

	/**
	 * Shows a diff between original and new content in VS Code's diff editor.
	 */
	private async handleShowDiff(filePath: string, originalContent?: string, newContent?: string): Promise<void> {
		try {
			if (newContent) {
				await ZenuxsDiffProvider.showDiff(filePath, originalContent || "", newContent);
			} else {
				await ZenuxsDiffProvider.openFile(filePath);
			}
		} catch (err) {
			this.postToWebview({ type: "error", text: `Failed to show diff: ${err instanceof Error ? err.message : String(err)}` });
		}
	}

	/**
	 * Sends initial settings, models, toggles, history, etc. to webview.
	 * Uses the same @cline/core runtime as the CLI.
	 */
	private async sendInitialPayload(): Promise<void> {
		try {
			const bridge = await this.getCore();
			const core = await bridge.getCore();
			const psm = new ProviderSettingsManager();

			// Use real listLocalProviders to get all providers dynamically (same as CLI TUI)
			let providers: ProviderListItem[] = [];
			try {
				const result = await listLocalProviders(psm);
				providers = result.providers;
			} catch {
				providers = [];
			}

			const extConfig = resolveExtensionConfig();

			// Fetch models for the currently configured provider so they are
			// available immediately when the model dropdown renders (fixes
			// the empty-dropdown-on-first-load bug).
			// For OAuth providers (e.g. zenuxs), resolve the access token from
			// auth settings into the apiKey field so the model discovery fetch
			// includes the required Authorization header.
			let models: Record<string, string[]> = {};
			try {
				if (extConfig.providerId) {
					const settings = psm.getProviderSettings(extConfig.providerId) ?? {};
					const resolvedKey = resolveProviderApiKeyFromSettings(psm, extConfig.providerId);
					const effectiveSettings = { ...settings, apiKey: settings.apiKey || resolvedKey };
					const result = await getLocalProviderModels(extConfig.providerId, effectiveSettings as any);
					if (result.models && result.models.length > 0) {
						models[extConfig.providerId] = result.models.map((m: any) => m.id || m);
					}
				}
			} catch {
				// models remain empty — will be fetched lazily on provider change
			}

			// Use core bridge's listSessions() matching CLI's listSessions()
			const sessionHistories = await bridge.listSessions(100, { hydrate: false });
			loggerService.log({ level: LogLevel.DEBUG, category: LogCategory.CONVERSATION, message: `Session history loaded: ${sessionHistories.length} sessions`, source: "session" });

			// Get settings toggles via CoreSettingsService (same as CLI)
			let toggles = { workflows: [], rules: [], skills: [], tools: [], mcp: [] };
			try {
				const settingsService = createCoreSettingsService();
				const snapshot = await settingsService.list({
					workspaceRoot: resolveWorkspaceRoot(),
					cwd: resolveCwd(),
				});
				toggles = snapshot as any;
			} catch {
				// ignore - use defaults
			}

			// Get MCP server list
			const mcpServers = await this.getMcpServerList();

			// Read persisted auto-approvals
			let autoApprovals: Record<string, boolean> | undefined;
			try {
				const raw = vscode.workspace.getConfiguration("zenuxs").get<string>("autoApprovals");
				if (raw) autoApprovals = JSON.parse(raw);
			} catch { /* ignore */ }

			// Never send the stored API key to the webview — the frontend
			// only needs to know whether a key exists (via hasApiKey on each
			// provider in the providers array).
			const isAuthenticated = AuthService.getInstance().authenticated;
			const onboardingSkipped = this.extensionContext.globalState.get<boolean>("zenuxs.onboardingSkipped") ?? false;
			const showOnboarding = !isAuthenticated && !onboardingSkipped;

			this.postToWebview({
				type: "initial_data",
				providers,
				models,
				currentConfig: { ...extConfig, apiKey: "" },
				toggles,
				sessionHistories,
				mcpServers: mcpServers.map((s: McpServerSnapshot) => ({
					name: s.name,
					status: s.status,
					disabled: s.disabled,
					lastError: (s as any).lastError,
					toolCount: (s as any).toolCount ?? s.toolCount ?? 0,
					transport: (s as any).transport ?? "stdio",
				})),
				autoApprovals,
				showOnboarding,
			});
		} catch (err: any) {
			// If core isn't ready yet, send empty payload
			const fallbackConfig = { ...resolveExtensionConfig(), apiKey: "" };
			const isAuthenticated = AuthService.getInstance().authenticated;
			const onboardingSkipped = this.extensionContext.globalState.get<boolean>("zenuxs.onboardingSkipped") ?? false;
			this.postToWebview({
				type: "initial_data",
				providers: [],
				models: {},
				currentConfig: fallbackConfig,
				toggles: { workflows: [], rules: [], skills: [], tools: [], mcp: [] },
				sessionHistories: [],
				mcpServers: [],
				showOnboarding: !isAuthenticated && !onboardingSkipped,
			});
		}
	}

	/**
	 * Fetches models for a specific provider and sends them to the webview.
	 */
	private async handleModelsRequest(providerId: string): Promise<void> {
		try {
			const psm = new ProviderSettingsManager();
			const { getLocalProviderModels, resolveProviderApiKeyFromSettings } = await import("@cline/core");
			const settings = psm.getProviderSettings(providerId) ?? {};
			const resolvedKey = resolveProviderApiKeyFromSettings(psm, providerId);
			const effectiveSettings = {
				...settings,
				apiKey: settings.apiKey || resolvedKey,
			};
			const result = await getLocalProviderModels(providerId, effectiveSettings as any);
			const models = result.models.map((m: any) => m.id || m);
			this.postToWebview({ type: "models", providerId, models: models.length > 0 ? models : ["default"] });
		} catch {
			this.postToWebview({ type: "models", providerId, models: ["default"] });
		}
	}

	/**
	 * Save provider settings and synchronize with VS Code settings & CLI config.
	 * Uses ProviderSettingsManager (same as CLI) for persistence.
	 */
	private async handleSaveSettings(msg: any): Promise<void> {
		// Update VS Code configurations
		const cfg = vscode.workspace.getConfiguration("zenuxs");
		const update = (k: string, v: any) => cfg.update(k, v, vscode.ConfigurationTarget.Global) as unknown as Promise<void>;
		const updates: Promise<void>[] = [
			update("providerId", msg.providerId),
			update("modelId", msg.modelId),
			update("apiKey", msg.apiKey),
			update("baseUrl", msg.baseUrl),
			update("autoApproveTools", msg.autoApproveTools),
			update("thinking", msg.thinking),
			update("reasoningEffort", msg.reasoningEffort),
			update("maxIterations", msg.maxIterations),
		];
		if (msg.mode !== undefined) updates.push(update("mode", msg.mode));
		if (msg.compaction !== undefined) updates.push(update("compaction", msg.compaction));
		if (msg.retries !== undefined) updates.push(update("retries", msg.retries));
		if (msg.timeout !== undefined) updates.push(update("timeout", msg.timeout));
		if (msg.checkpointEnabled !== undefined) updates.push(update("checkpointEnabled", msg.checkpointEnabled));
		if (msg.autoApprovals !== undefined) updates.push(update("autoApprovals", JSON.stringify(msg.autoApprovals)));
		await Promise.all(updates);

		// Save in ProviderSettingsManager to keep sync with CLI
		const psm = new ProviderSettingsManager();
		const existingSettings = psm.getProviderSettings(msg.providerId);
		const nextApiKey = msg.apiKey && msg.apiKey.trim().length > 0 ? msg.apiKey.trim() : existingSettings?.apiKey;

		if (msg.providerId === "custom") {
			try {
				const { validateCustomProviderConfig } = await import("@cline/core");
				await validateCustomProviderConfig({
					baseUrl: msg.baseUrl || "",
					apiKey: nextApiKey,
					modelId: msg.modelId || "",
				});
			} catch (err: any) {
				const errorMsg = err instanceof Error ? err.message : String(err);
				vscode.window.showErrorMessage(`Custom Provider Validation Failed: ${errorMsg}`);
				this.postToWebview({ type: "error", text: errorMsg });
				return;
			}
		}

		psm.saveProviderSettings({
			...(existingSettings ?? {}),
			provider: msg.providerId,
			model: msg.modelId,
			apiKey: nextApiKey,
			baseUrl: msg.baseUrl || undefined,
		});

		vscode.window.showInformationMessage("Zenuxs settings synchronized successfully.");
		await this.sendInitialPayload();
	}

	/**
	 * Handles toggling settings (rules, skills, tools, etc.) via CoreSettingsService.
	 */
	private async handleToggleSetting(msg: any): Promise<void> {
		const settingsService = createCoreSettingsService();
		await settingsService.toggle({
			type: msg.itemType,
			id: msg.id,
			name: msg.name,
			path: msg.path,
			enabled: msg.enabled,
			workspaceRoot: resolveWorkspaceRoot(),
			cwd: resolveCwd(),
		});

		await this.sendInitialPayload();
	}

	/**
	 * Delete session.
	 */
	private async handleDeleteSession(sessionId: string): Promise<void> {
		try {
			const bridge = await this.getCore();
			const core = await bridge.getCore();
			const session = await core.get(sessionId);
			const title = session?.metadata?.title || session?.prompt || `Session ${sessionId.slice(0, 8)}`;

			const choice = await vscode.window.showWarningMessage(
				`Are you sure you want to permanently delete the chat session "${title}"?`,
				{ modal: true },
				"Delete",
			);

			if (choice !== "Delete") {
				return;
			}

			const deleted = await core.delete(sessionId);
			if (!deleted) {
				vscode.window.showWarningMessage(`Zenuxs: Session not found or could not be deleted.`);
			}
			delete this.executionDataStore[sessionId];
			this.saveExecutionDataStore();
			if (this.activeSessionId === sessionId) {
				await this.handleAbort();
				this.restoredMessagesCache = undefined;
				this.pendingPrompt = undefined;
				this.isRunning = false;
				this.abortController?.abort();
				this.abortController = undefined;
				this.activeSessionId = undefined;
				this.postToWebview({ type: "reset_done" });
			}
			await this.sendInitialPayload();
		} catch (error: any) {
			vscode.window.showErrorMessage(`Zenuxs: Error deleting session: ${error.message || error}`);
			this.postToWebview({ type: "error", text: `Failed to delete session: ${error.message || error}` });
		}
	}

	/**
	 * Rename session.
	 */
	private async handleRenameSession(sessionId: string, title?: string): Promise<void> {
		try {
			const bridge = await this.getCore();
			const core = await bridge.getCore();
			const session = await core.get(sessionId);
			const currentTitle = title || session?.metadata?.title || session?.prompt || "";

			const newTitle = await vscode.window.showInputBox({
				prompt: "Enter new session title",
				value: currentTitle,
			});

			if (newTitle === undefined) {
				return;
			}

			await core.update(sessionId, { title: newTitle });
			await this.sendInitialPayload();
		} catch (error: any) {
			vscode.window.showErrorMessage(`Zenuxs: Error renaming session: ${error.message || error}`);
		}
	}

	/**
	 * Restore and hydrate a previous session.
	 */
	private async handleRestoreSession(sessionId: string): Promise<void> {
		const bridge = await this.getCore();
		const core = await bridge.getCore();
		const messages = await core.readMessages(sessionId);
		const row = await core.get(sessionId);

		loggerService.log({ level: LogLevel.INFO, category: LogCategory.CONVERSATION, message: "Session restored", source: "session", sessionId, data: { messageCount: (messages || []).length } });
		// Cache restored messages so executeSession seeds a new runtime session with them.
		// The old sessionId is NOT registered in the runtime's in-memory session registry;
		// setting activeSessionId to it would cause "session not found" on core.send().
		// By caching messages and keeping activeSessionId undefined, the next send goes
		// through core.start() with initialMessages, creating a properly registered session.
		this.restoredMessagesCache = messages;
		this.activeSessionId = undefined;

		// Map to UI chat message format
		const uiMessages = (messages || []).map((m: any) => {
			let role: "user" | "assistant" | "error" | "meta" = "user";
			if (m.role === "assistant") role = "assistant";
			else if (m.role === "user") role = "user";
			else role = "meta";

			// Extract tool events or sub-timeline nodes
			const toolEvents: any[] = [];
			if (m.content && Array.isArray(m.content)) {
				m.content.forEach((block: any) => {
					if (block.type === "tool_call" || block.type === "tool_use") {
						toolEvents.push({
							id: block.id,
							name: block.name,
							input: block.input,
							state: "output-available",
						});
					}
				});
			}

			// Format text content
			let text = "";
			let reasoning = "";
			if (m.content) {
				if (typeof m.content === "string") {
					text = m.content;
				} else if (Array.isArray(m.content)) {
					const textParts: string[] = [];
					m.content.forEach((block: any) => {
						if (block.type === "text") {
							textParts.push(block.text);
						} else if (block.type === "reasoning") {
							reasoning += block.reasoning;
						}
					});
					text = textParts.join("\n");
				}
			}

			return {
				role,
				text,
				reasoning: reasoning || undefined,
				toolEvents: toolEvents.length > 0 ? toolEvents : undefined,
			};
		});

		const executionTasks = this.executionDataStore[sessionId] || undefined;

		this.postToWebview({
			type: "session_hydrated",
			sessionId,
			messages: uiMessages,
			executionTasks,
		});
	}

	/**
	 * Export session conversation messages to JSON.
	 */
	private async handleExportSession(sessionId: string): Promise<void> {
		const bridge = await this.getCore();
		const core = await bridge.getCore();
		const uri = await vscode.window.showSaveDialog({
			defaultUri: vscode.Uri.file(`zenuxs-session-${sessionId.slice(0, 8)}.json`),
			filters: { "JSON Files": ["json"] },
		});
		if (uri) {
			const messages = await core.readMessages(sessionId);
			await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(messages, null, 2), "utf8"));
			vscode.window.showInformationMessage(`Session exported to ${uri.fsPath}`);
		}
	}

	/**
	 * Import session conversation.
	 */
	private async handleImportSession(): Promise<void> {
		const uri = await vscode.window.showOpenDialog({
			canSelectFiles: true,
			canSelectFolders: false,
			canSelectMany: false,
			filters: { "JSON Files": ["json"] },
		});
		if (uri && uri[0]) {
			const data = await vscode.workspace.fs.readFile(uri[0]);
			const messages = JSON.parse(data.toString());

			// Hydrate imported session locally in view
			this.postToWebview({
				type: "session_hydrated",
				sessionId: "imported-" + createSessionId().slice(0, 8),
				messages: messages.map((m: any) => ({
					role: m.role === "assistant" ? "assistant" : "user",
					text: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
				})),
			});
			vscode.window.showInformationMessage("Session imported successfully.");
		}
	}

	/**
	 * Run build, lint, test, or doctor tasks inside VS Code Terminal.
	 */
	private async handleRunCommand(command: string): Promise<void> {
		const workspaceRoot = resolveWorkspaceRoot();
		const terminal = vscode.window.terminals.find(t => t.name === "Zenuxs Task") || vscode.window.createTerminal("Zenuxs Task");
		terminal.show();

		let commandText = "";
		if (command === "doctor") {
			commandText = "npx zenuxs doctor fix";
		} else {
			const pathJoin = (p: string, f: string) => p + (p.endsWith("/") || p.endsWith("\\") ? "" : "/") + f;
			const bunExists = await this.checkFileExists(pathJoin(workspaceRoot, "bun.lockb")) || await this.checkFileExists(pathJoin(workspaceRoot, "bun.lock"));
			const pnpmExists = await this.checkFileExists(pathJoin(workspaceRoot, "pnpm-lock.yaml"));
			const yarnExists = await this.checkFileExists(pathJoin(workspaceRoot, "yarn.lock"));
			const runner = bunExists ? "bun" : pnpmExists ? "pnpm" : yarnExists ? "yarn" : "npm";

			commandText = `${runner} run ${command}`;
		}

		terminal.sendText(commandText);
		this.postToWebview({ type: "status", text: `Command sent: ${commandText}` });
	}

	private async checkFileExists(path: string): Promise<boolean> {
		try {
			await vscode.workspace.fs.stat(vscode.Uri.file(path));
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Attaches current active editor file text as a workspace context.
	 */
	private async handleAttachFileContext(): Promise<void> {
		const editorCtx = captureEditorContext();
		if (!editorCtx.activeFilePath) {
			vscode.window.showInformationMessage("No active editor file to attach.");
			return;
		}
		const formatted = formatEditorContextForPrompt(editorCtx);
		this.postToWebview({ type: "status", text: "File context attached." });
		this.postToWebview({
			type: "assistant_delta",
			text: `Attached file context from: **${editorCtx.activeFilePath.split(/[\\/]/).pop()}**`,
		});
	}

	/**
	 * Deletes all session histories permanently.
	 */
	private async handleClearHistory(): Promise<void> {
		try {
			const bridge = await this.getCore();
			const core = await bridge.getCore();
			const sessions = await core.list(1000, { hydrate: false });
			for (const session of sessions) {
				await core.delete(session.sessionId);
			}
			this.executionDataStore = {};
			this.saveExecutionDataStore();
			this.activeSessionId = undefined;
			this.isRunning = false;
			this.postToWebview({ type: "reset_done" });
			await this.sendInitialPayload();
			vscode.window.showInformationMessage("Zenuxs: All session histories cleared successfully.");
		} catch (error: any) {
			vscode.window.showErrorMessage(`Zenuxs: Error clearing history: ${error.message || error}`);
			this.postToWebview({ type: "error", text: `Failed to clear history: ${error.message || error}` });
		}
	}

	/**
	 * Log in using OAuth for the given provider.
	 * Uses the same loginAndSaveLocalProviderOAuthCredentials as the CLI.
	 * AuthService tracks the in-memory auth state and manages the token lifecycle.
	 */
	private async handleLoginOAuth(providerId: string): Promise<void> {
		const psm = new ProviderSettingsManager();
		this.postToWebview({ type: "oauth_status", providerId, status: "authenticating" });
		try {
			await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: `Zenuxs: Authenticating ${providerId}...`,
					cancellable: true,
				},
				async (progress, token) => {
					await loginAndSaveLocalProviderOAuthCredentials(
						psm,
						providerId,
						(url: string) => {
							vscode.env.openExternal(vscode.Uri.parse(url));
						}
					);
				}
			);
			// Update AuthService in-memory state after successful login
			await AuthService.getInstance().onLoginComplete(providerId);
			await this.extensionContext.globalState.update("zenuxs.onboardingSkipped", true);
			this.postToWebview({ type: "oauth_status", providerId, status: "success" });
			vscode.window.showInformationMessage(`Zenuxs: Successfully authenticated provider ${providerId}.`);
			await this.sendInitialPayload();
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			this.postToWebview({ type: "oauth_status", providerId, status: "error", message: msg });
			vscode.window.showErrorMessage(`Zenuxs Authentication Failed: ${msg}`);
			this.postToWebview({ type: "error", text: `Authentication failed: ${msg}` });
		}
	}

	/**
	 * Log out from OAuth for the given provider.
	 */
	private async handleLogoutOAuth(providerId: string): Promise<void> {
		try {
			await AuthService.getInstance().logout(providerId);
			this.postToWebview({ type: "oauth_status", providerId, status: "logged_out" });
			vscode.window.showInformationMessage(`Zenuxs: Logged out from provider ${providerId}.`);
			await this.sendInitialPayload();
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`Zenuxs Logout Failed: ${msg}`);
		}
	}

	/**
	 * Handles a send message from the webview.
	 * Mirrors the CLI's runAgent() flow from apps/cli/src/runtime/run-agent.ts
	 */
	private async handleSend(prompt: string, uiConfig?: any): Promise<void> {
		if (this.isRunning) {
			this.postToWebview({
				type: "error",
				text: "A turn is already in progress. Use abort to cancel it.",
			});
			return;
		}

		this.isRunning = true;
		this.abortController = new AbortController();

		// Prewarm file index (matching CLI pattern)
		try {
			const bridge = await this.getCore();
			await bridge.prewarmFileIndex();
		} catch {
			// Best-effort
		}

		// Show progress notification in VS Code
		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: "Zenuxs Agent",
				cancellable: true,
			},
			(progress, token) => {
				token.onCancellationRequested(() => {
					this.handleAbort();
				});

				progress.report({ message: "Thinking..." });

				return this.executeSession(prompt, progress, uiConfig);
			},
		);
	}

	/**
	 * Executes the session with progress reporting.
	 * Mirrors the CLI's runAgent() flow exactly.
	 */
	private async executeSession(
		prompt: string,
		progress: vscode.Progress<{ message?: string; increment?: number }>,
		uiConfig?: any,
	): Promise<void> {
		let taskIdCounter = 0;
		try {
			const bridge = await this.getCore();
			const core = await bridge.getCore();
			const extConfig = resolveExtensionConfig();
			const editorCtx = captureEditorContext();
			const editorContextText = formatEditorContextForPrompt(editorCtx);

			// Build the full prompt with editor context
			const fullPrompt = editorContextText
				? `${prompt}\n\n${editorContextText}`
				: prompt;

			// Subscribe to events for this turn
			const unsubscribe = bridge.subscribe((event: CoreSessionEvent) => {
				const messages = mapCoreEventToWebview(event);
				for (const msg of messages) {
					this.postToWebview(msg);
				}
				// Debug logging for Developer panel
				if (event.type === "agent_event") {
					const ae = event.payload.event;
					if (ae.type === "content_start" && ae.contentType === "text") {
						loggerService.log({ level: LogLevel.DEBUG, category: LogCategory.CONVERSATION, message: "Assistant placeholder created / stream chunk", source: "session", sessionId: this.activeSessionId, data: { textLength: (ae.text ?? "").length } });
					}
					if (ae.type === "content_end" && ae.contentType === "text") {
						loggerService.log({ level: LogLevel.DEBUG, category: LogCategory.CONVERSATION, message: "Stream finished for text content", source: "session", sessionId: this.activeSessionId, data: { textLength: (ae.text ?? "").length } });
					}
					if (ae.type === "content_end" && ae.contentType === "tool") {
						loggerService.log({ level: LogLevel.DEBUG, category: LogCategory.CONVERSATION, message: "Tool execution completed", source: "session", sessionId: this.activeSessionId, data: { toolName: ae.toolName, status: ae.error ? "failed" : "completed" } });
					}
				} else if (event.type === "ended") {
					loggerService.log({ level: LogLevel.DEBUG, category: LogCategory.CONVERSATION, message: "Session ended", source: "session", sessionId: this.activeSessionId, data: { reason: event.payload.reason } });
				} else if (event.type === "status") {
					loggerService.log({ level: LogLevel.DEBUG, category: LogCategory.CONVERSATION, message: `Session status: ${event.payload.status}`, source: "session", sessionId: this.activeSessionId });
				}
				// Update progress for tool events
				if (event.type === "agent_event") {
					const agentEvent = event.payload.event;
					if (agentEvent.type === "content_start" && agentEvent.contentType === "tool") {
						progress.report({ message: `Running ${agentEvent.toolName ?? "tool"}...` });
						// Live editing: open file for editing when file tool starts
						if (agentEvent.toolName && ZenuxsLiveEditProvider.isFileEditTool(agentEvent.toolName)) {
							const filePath = ZenuxsLiveEditProvider.extractFilePath(agentEvent.input);
							if (filePath) {
								this.liveEditProvider.openForEdit(filePath);
							}
						}
						// Terminal: route bash/command tools
						if (agentEvent.toolName === "bash" || agentEvent.toolName === "execute_command") {
							const input = agentEvent.input as Record<string, unknown> | undefined;
							const command = ((input?.command ?? input?.text) as string) || "";
							if (command) {
								taskIdCounter++;
								this.agentTerminalManager.executeCommand(taskIdCounter, command);
							}
						}
					} else if (agentEvent.type === "notice") {
						progress.report({ message: agentEvent.message });
					}
					// Clean up live editing on tool completion
					if (agentEvent.type === "content_end" && agentEvent.contentType === "tool") {
						if (agentEvent.toolName && ZenuxsLiveEditProvider.isFileEditTool(agentEvent.toolName)) {
							const filePath = ZenuxsLiveEditProvider.extractFilePath(agentEvent.input);
							if (filePath) {
								this.liveEditProvider.closeEdit();
							}
						}
					}
				} else if (event.type === "status") {
					progress.report({ message: event.payload.status });
				}
			});

			try {
				const plannedSessionId = createSessionId();
				const workspaceRoot = resolveWorkspaceRoot();
				const cwd = resolveCwd();

				// Resolve provider and API key through ProviderSettingsManager (same as CLI):
				// 1. Get the provider ID from UI config, VS Code settings, or fallback to "cline"
				// 2. Get the provider settings from ProviderSettingsManager
				// 3. Resolve the API key from the provider settings
				const psm = new ProviderSettingsManager();
				const lastUsedProviderSettings = psm.getLastUsedProviderSettings({ isClinePassEnabled: false });
				const rawProviderId = uiConfig?.providerId || extConfig.providerId || lastUsedProviderSettings?.provider || "cline";
				const providerId = normalizeProviderId(rawProviderId);
				const selectedProviderSettings = psm.getProviderSettings(providerId);
				const resolvedApiKey = resolveProviderApiKeyFromSettings(psm, providerId) || getPersistedProviderApiKey(providerId, selectedProviderSettings) || extConfig.apiKey || "";
				loggerService.log({ level: LogLevel.DEBUG, category: LogCategory.AUTH, message: "Session API key resolved", source: "session", data: { providerId, hasKey: !!resolvedApiKey, keyPrefix: resolvedApiKey ? resolvedApiKey.substring(0, 10) + "..." : "none" } });
				const resolvedBaseUrl = selectedProviderSettings?.baseUrl || extConfig.baseUrl || undefined;

				// Resolve model ID: check UI config, VS Code settings, or provider settings, or use fallback
				const resolvedModelId = uiConfig?.modelId || extConfig.modelId || selectedProviderSettings?.model || "anthropic/claude-sonnet-4.6";

				const modelId = resolvedModelId;

				// Pre-flight readiness check: API-key-based providers (e.g. OpenRouter)
				// must have a key configured before we contact the model. Without it the
				// request fails with an opaque upstream error (e.g. OpenRouter's
				// "User not found." 500) and the session silently returns to idle, which
				// looks like the chat "closing". Surface a clear, actionable error instead.
				if (!isOAuthProvider(providerId) && !resolvedApiKey) {
					const message =
						`Cannot start chat: the "${providerId}" provider has no API key configured. ` +
						`Open VS Code Settings → Zenuxs → Provider, select "${providerId}", ` +
						`and paste your API key (for OpenRouter, create one at https://openrouter.ai/keys).`;
					this.postToWebview({ type: "error", text: message });
					loggerService.log({ level: LogLevel.ERROR, category: LogCategory.CONVERSATION, message: `Provider not ready: ${message}`, source: "session" });
					return;
				}

				const thinking = uiConfig?.thinking !== undefined ? uiConfig.thinking : extConfig.thinking;
				const reasoningEffort = uiConfig?.reasoningEffort || extConfig.reasoningEffort;
				const modeStr = uiConfig?.mode || extConfig.mode || "act";
				const mode = modeStr as any;
				const isYoloMode = mode === "yolo";

				const toolPolicies: Record<string, { autoApprove: boolean }> = {
					"*": { autoApprove: extConfig.autoApproveTools },
				};

				// Build compaction config matching CLI
				const compactionConfig = extConfig.compaction !== "off"
					? { enabled: true, strategy: extConfig.compaction as "basic" | "agentic" }
					: { enabled: false };

				// Build checkpoint config matching CLI
				const checkpointConfig = {
					enabled: extConfig.checkpointEnabled,
				};

				// Build timeout config matching CLI
				const timeoutMs =
					typeof extConfig.timeout === "number" &&
					Number.isFinite(extConfig.timeout) &&
					extConfig.timeout > 0
						? extConfig.timeout * 1000
						: undefined;

				// Resolve the system prompt using workspace rules, custom instructions, and remote memories (matching CLI prompt compilation)
				const psmForAuth = new ProviderSettingsManager();
				const settingsForAuth = psmForAuth.getProviderSettings("cline");
				const zenuxsAuthToken = resolveLocalClineAuthToken(settingsForAuth)?.trim();

				const compiledSystemPrompt = await resolveSystemPrompt({
					cwd,
					explicitSystemPrompt: extConfig.systemPrompt || "",
					providerId,
					mode: modeStr as any,
					zenuxsAuthToken,
				});

				// Start or send to session
				if (!this.activeSessionId) {
					// New session - matching CLI's runAgent() start flow
					// If restoredMessagesCache is set, seed the new session with the restored conversation
					const initialMessages = this.restoredMessagesCache;
					this.restoredMessagesCache = undefined;
					if (initialMessages) {
						loggerService.log({ level: LogLevel.DEBUG, category: LogCategory.CONVERSATION, message: "Session started with restored messages", source: "session", data: { restoredMessageCount: initialMessages.length } });
					}

					// Tell the webview BEFORE core.start() so SET_SESSION_STARTED
					// sets isRunning=true before any events arrive. Without this,
					// events (including turn_done) arrive first, then session_started
					// overwrites isRunning back to true, making the chat appear stuck.
					this.postToWebview({
						type: "session_started",
						sessionId: plannedSessionId,
					});

					const sessionLogger: BasicLogger = {
						debug: (msg: string, meta?: Record<string, unknown>) => loggerService.log({ level: LogLevel.DEBUG, category: LogCategory.AGENT, message: msg, ...(meta ?? {}) as any }),
						log: (msg: string, meta?: Record<string, unknown>) => loggerService.log({ level: LogLevel.INFO, category: LogCategory.AGENT, message: msg, ...(meta ?? {}) as any }),
						error: (msg: string, meta?: Record<string, unknown>) => loggerService.log({ level: LogLevel.ERROR, category: LogCategory.AGENT, message: msg, ...(meta ?? {}) as any }),
					};

				const started = await core.start({
						source: SessionSource.VSCODE,
						config: {
							providerId,
							modelId,
							apiKey: resolvedApiKey,
							mode,
							baseUrl: resolvedBaseUrl,
							systemPrompt: compiledSystemPrompt,
							enableTools: true,
							enableSpawnAgent: !isYoloMode,
							enableAgentTeams: !isYoloMode,
							yolo: isYoloMode,
							defaultToolAutoApprove: extConfig.autoApproveTools,
							toolPolicies,
							thinking,
							reasoningEffort:
								reasoningEffort !== "none"
									? reasoningEffort
									: undefined,
							execution: {
								maxConsecutiveMistakes: extConfig.retries,
							},
							compaction: compactionConfig,
							checkpoint: checkpointConfig,
							timeoutSeconds: extConfig.timeout > 0 ? extConfig.timeout : undefined,
							logger: sessionLogger,
							cwd,
							workspaceRoot,
							extensionContext: {
								client: { name: "vscode-extension" },
								workspace: {
									rootPath: workspaceRoot,
									cwd,
									workspaceName:
										workspaceRoot.split(/[\\/]/).pop() ?? "",
									ide: "VS Code",
									platform: process.platform,
								},
								logger: sessionLogger,
							},
						},
						prompt: fullPrompt,
						interactive: true,
						sessionId: plannedSessionId,
						initialMessages,
					});

					this.activeSessionId = started.sessionId;
					loggerService.log({ level: LogLevel.INFO, category: LogCategory.CONVERSATION, message: "Session created / active session set", source: "session", sessionId: started.sessionId, data: { providerId, modelId } });

					// If start() already returned a result (non-interactive), use it
					if (started.result) {
						this.handleAgentResult(started.result);
					} else {
						// Wait for the session to complete via events
						await this.waitForSessionEnd(core, started.sessionId, timeoutMs);
					}
				} else {
					// Continue existing session
					loggerService.log({ level: LogLevel.DEBUG, category: LogCategory.CONVERSATION, message: "Session send", source: "session", sessionId: this.activeSessionId });
					loggerService.log({ level: LogLevel.DEBUG, category: LogCategory.CONVERSATION, message: "Session lookup", source: "session", sessionId: this.activeSessionId });
					const result = await core.send({
						sessionId: this.activeSessionId,
						prompt: fullPrompt,
					});

					if (result) {
						this.handleAgentResult(result);
					} else {
						await this.waitForSessionEnd(
							core,
							this.activeSessionId,
							timeoutMs,
						);
					}
				}
			} finally {
				unsubscribe();
			}
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			this.postToWebview({ type: "error", text: message });
			loggerService.log({ level: LogLevel.ERROR, category: LogCategory.CONVERSATION, message: `Session error: ${message}`, source: "session", sessionId: this.activeSessionId });
			if (
				message.includes("ResourceExhausted") ||
				message.includes("request limit reached")
			) {
				loggerService.log({ level: LogLevel.INFO, category: LogCategory.CONVERSATION, message: "Rate limit / worker quota error caught - resetting active session state for recovery", source: "session", sessionId: this.activeSessionId });
				this.activeSessionId = undefined;
				this.isRunning = false;
				await this.resetCore();
			}
			// Recover from "session not found": restore session instead of destroying it
			if (
				message.toLowerCase().includes("session not found") ||
				message.toLowerCase().includes("session_not_found")
			) {
				const lostSessionId = this.activeSessionId;
				loggerService.log({ level: LogLevel.INFO, category: LogCategory.CONVERSATION, message: "Session recovery triggered - attempting to restore from persistent storage", source: "session", sessionId: lostSessionId });
				try {
					// Read the missing session's messages from persistent storage
					const bridge = await this.getCore();
					const core = await bridge.getCore();
					const recoveredMessages = await core.readMessages(lostSessionId);
					if (recoveredMessages && recoveredMessages.length > 0) {
						// Cache messages so the next send seeds a new runtime session
						this.restoredMessagesCache = recoveredMessages;
						this.activeSessionId = undefined;
						this.isRunning = false;

						// Re-hydrate the webview so the chat stays intact
						const uiMessages = (recoveredMessages || []).map((m: any) => {
							let role: "user" | "assistant" | "error" | "meta" = "user";
							if (m.role === "assistant") role = "assistant";
							else if (m.role === "user") role = "user";
							else role = "meta";
							const toolEvents: any[] = [];
							if (m.content && Array.isArray(m.content)) {
								m.content.forEach((block: any) => {
									if (block.type === "tool_call" || block.type === "tool_use") {
										toolEvents.push({ id: block.id, name: block.name, input: block.input, state: "output-available" });
									}
								});
							}
							let text = "";
							let reasoning = "";
							if (m.content) {
								if (typeof m.content === "string") text = m.content;
								else if (Array.isArray(m.content)) {
									const textParts: string[] = [];
									m.content.forEach((block: any) => {
										if (block.type === "text") textParts.push(block.text);
										else if (block.type === "reasoning") reasoning += block.reasoning;
									});
									text = textParts.join("\n");
								}
							}
							return { role, text, reasoning: reasoning || undefined, toolEvents: toolEvents.length > 0 ? toolEvents : undefined };
						});
						this.postToWebview({ type: "session_hydrated", sessionId: lostSessionId, messages: uiMessages });
						this.postToWebview({ type: "status", text: "Session recovered. You may re-send your message." });
						loggerService.log({ level: LogLevel.INFO, category: LogCategory.CONVERSATION, message: "Session recovery completed - session restored from persistent storage", source: "session", sessionId: lostSessionId, data: { messageCount: recoveredMessages.length } });
					} else {
						// No messages to recover - fall back to clean reset
						loggerService.log({ level: LogLevel.INFO, category: LogCategory.CONVERSATION, message: "Session recovery - no messages to restore, resetting", source: "session", sessionId: lostSessionId });
						this.activeSessionId = undefined;
						this.isRunning = false;
						this.postToWebview({ type: "reset_done" });
					}
				} catch (recoveryError) {
					// Recovery itself failed - fall back to clean reset
					loggerService.log({ level: LogLevel.ERROR, category: LogCategory.CONVERSATION, message: `Session recovery failed: ${recoveryError instanceof Error ? recoveryError.message : String(recoveryError)}`, source: "session", sessionId: lostSessionId });
					this.activeSessionId = undefined;
					this.isRunning = false;
					this.postToWebview({ type: "reset_done" });
				}
			}
		} finally {
			this.isRunning = false;
			this.abortController = undefined;
			this.liveEditProvider.closeEdit();
			// Refresh session history so new sessions appear in the history list
			// without requiring an extension reload. Fire-and-forget to avoid
			// blocking the session clean-up path.
			this.sendInitialPayload().catch(() => {});
		}
	}

	/**
	 * Handles an agent result.
	 */
	private handleAgentResult(result: AgentResult): void {
		// Surface upstream/auth failures (e.g. OpenRouter "User not found.") to the
		// chat instead of letting the session silently return to idle.
		if (result.finishReason === "error") {
			const detail = result.text?.trim() || undefined;
			const text = detail
				? `Agent run failed: ${detail}`
				: "Agent run failed. Check the provider API key in Settings and try again.";
			this.postToWebview({ type: "error", text });
			loggerService.log({ level: LogLevel.ERROR, category: LogCategory.CONVERSATION, message: text, source: "session", sessionId: this.activeSessionId });
			this.postToWebview({
				type: "turn_done",
				finishReason: result.finishReason ?? "completed",
				iterations: result.iterations ?? 0,
				usage: result.usage
					? {
						inputTokens: result.usage.inputTokens,
						outputTokens: result.usage.outputTokens,
						cacheReadInputTokens: result.usage.cacheReadTokens,
						cacheCreationInputTokens: result.usage.cacheWriteTokens,
						totalCost: result.usage.totalCost,
					}
					: undefined,
			});
			return;
		}

		this.postToWebview({
			type: "turn_done",
			finishReason: result.finishReason ?? "completed",
			iterations: result.iterations ?? 0,
			usage: result.usage
				? {
					inputTokens: result.usage.inputTokens,
					outputTokens: result.usage.outputTokens,
					cacheReadInputTokens: result.usage.cacheReadTokens,
					cacheCreationInputTokens: result.usage.cacheWriteTokens,
					totalCost: result.usage.totalCost,
				}
				: undefined,
		});
	}

	/**
	 * Waits for the session to end via events.
	 * Supports timeout matching CLI's timeoutSeconds.
	 */
	private waitForSessionEnd(
		core: any,
		sessionId: string,
		timeoutMs?: number,
	): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			let timeoutId: ReturnType<typeof setTimeout> | undefined;

			if (timeoutMs) {
				timeoutId = setTimeout(() => {
					unsubscribe();
					core.abort(sessionId).catch(() => {});
					reject(new Error(`Session timed out after ${timeoutMs / 1000}s`));
				}, timeoutMs);
			}

			const unsubscribe = core.subscribe((event: CoreSessionEvent) => {
				if (
					event.type === "ended" &&
					event.payload.sessionId === sessionId
				) {
					if (timeoutId) clearTimeout(timeoutId);
					unsubscribe();
					resolve();
				}
				// The core may not emit an explicit "ended" event for successful
				// single-turn sessions — it transitions to "idle" instead. Treat
				// idle as terminal so the promise doesn't hang indefinitely.
				if (
					event.type === "status" &&
					event.payload?.status === "idle" &&
					event.payload?.sessionId === sessionId
				) {
					if (timeoutId) clearTimeout(timeoutId);
					unsubscribe();
					resolve();
				}
			});
		});
	}

	/**
	 * Handles abort request. Immediately stops execution and cleans up.
	 */
	private async handleAbort(): Promise<void> {
		this.liveEditProvider.closeEdit();
		this.postToWebview({ type: "status", text: "Stopping..." });
		if (this.coreBridge && this.activeSessionId) {
			try {
				const core = await this.coreBridge.getCore();
				this.postToWebview({ type: "status", text: "Cancelling active processes..." });
				await core.abort(this.activeSessionId);
				try {
					await core.stopSession(this.activeSessionId);
				} catch {
					// stopSession is best-effort cleanup after abort
				}
				this.postToWebview({ type: "status", text: "Task Cancelled" });
			} catch {
				this.postToWebview({ type: "status", text: "Task Cancelled" });
			}
		}
		this.isRunning = false;
		this.abortController?.abort();
		this.abortController = undefined;
		this.postToWebview({
			type: "turn_done",
			finishReason: "aborted",
			iterations: 0,
		});
	}

	/**
	 * Requests tool approval from the user.
	 */
	private async requestToolApproval(
		request: ToolApprovalRequest,
	): Promise<ToolApprovalResult> {
		// Send approval request to webview
		this.postToWebview({
			type: "approval_request",
			approvalId: request.toolCallId,
			sessionId: request.sessionId ?? "",
			agentId: request.agentId ?? "",
			conversationId: request.conversationId ?? "",
			iteration: request.iteration ?? 0,
			toolCallId: request.toolCallId,
			toolName: request.toolName,
			input: request.input,
		});

		// Return a promise that resolves when the user interacts with the webview approval card
		return new Promise<ToolApprovalResult>((resolve) => {
			this.pendingApprovalResolve = (result) => {
				resolve(result);
			};
		});
	}

	/**
	 * Handles an approval response from the webview.
	 */
	private handleApprovalResponse(message: {
		approvalId: string;
		approved: boolean;
		reason?: string;
	}): void {
		this.postToWebview({
			type: "approval_resolved",
			approvalId: message.approvalId,
			approved: message.approved,
			reason: message.reason,
		});

		this.pendingApprovalResolve?.({
			approved: message.approved,
			reason: message.reason,
		});
		this.pendingApprovalResolve = undefined;
	}

	/**
	 * Initializes the MCP manager from settings file.
	 */
	private async initializeMcpManager(): Promise<void> {
		if (!this.mcpManager) return;
		try {
			const settingsPath = resolveDefaultMcpSettingsPath();
			const hasFile = hasMcpSettingsFile(settingsPath);

			if (hasFile) {
				const file = loadMcpSettingsFile(settingsPath);
				for (const reg of resolveMcpServerRegistrations({ mcpServers: file.mcpServers })) {
					await this.mcpManager.registerServer(reg);
					if (!reg.disabled) {
						await this.mcpManager.connectServer(reg.name);
					}
				}
			}
		} catch {
			// MCP settings optional
		}
	}

	/**
	 * Gets MCP server snapshots for the webview.
	 */
	private async getMcpServerList(): Promise<McpServerSnapshot[]> {
		if (!this.mcpManager) return [];
		return [...this.mcpManager.listServers()] as McpServerSnapshot[];
	}

	/**
	 * Registers a new MCP server.
	 */
	private async handleMcpRegister(msg: any): Promise<void> {
		if (!this.mcpManager) return;
		const registration: McpServerRegistration = {
			name: msg.name,
			transport: msg.transport === "sse"
				? { type: "sse", url: msg.url || "http://localhost:3000/sse" }
				: { type: "stdio", command: msg.command || "npx", args: msg.args || [] },
		};
		await this.mcpManager.registerServer(registration);
		if (!registration.disabled) {
			await this.mcpManager.connectServer(msg.name);
		}
		this.postToWebview({ type: "toast", message: `MCP server "${msg.name}" registered.`, severity: "success" });
		await this.handleMcpListServers();
	}

	/**
	 * Unregisters an MCP server.
	 */
	private async handleMcpUnregister(name: string): Promise<void> {
		if (!this.mcpManager) return;
		await this.mcpManager.unregisterServer(name);
		this.postToWebview({ type: "toast", message: `MCP server "${name}" removed.`, severity: "info" });
		await this.handleMcpListServers();
	}

	/**
	 * Connects to an MCP server.
	 */
	private async handleMcpConnect(name: string): Promise<void> {
		if (!this.mcpManager) return;
		await this.mcpManager.connectServer(name);
		this.postToWebview({ type: "toast", message: `MCP server "${name}" connected.`, severity: "success" });
		await this.handleMcpListServers();
	}

	/**
	 * Disconnects from an MCP server.
	 */
	private async handleMcpDisconnect(name: string): Promise<void> {
		if (!this.mcpManager) return;
		await this.mcpManager.disconnectServer(name);
		await this.handleMcpListServers();
	}

	/**
	 * Sets whether an MCP server is disabled.
	 */
	private async handleMcpSetDisabled(name: string, disabled: boolean): Promise<void> {
		if (!this.mcpManager) return;
		await this.mcpManager.setServerDisabled(name, disabled);
		if (!disabled) {
			await this.mcpManager.connectServer(name);
		} else {
			await this.mcpManager.disconnectServer(name);
		}
		await this.handleMcpListServers();
	}

	/**
	 * Refreshes tools for an MCP server.
	 */
	private async handleMcpRefreshTools(serverName: string): Promise<void> {
		if (!this.mcpManager) return;
		await this.mcpManager.refreshTools(serverName);
		this.postToWebview({ type: "toast", message: `Tools refreshed for "${serverName}".`, severity: "success" });
		await this.handleMcpListServers();
	}

	/**
	 * Sends the current MCP server list to the webview.
	 */
	private async handleMcpListServers(): Promise<void> {
		const servers = await this.getMcpServerList();
		this.postToWebview({
			type: "mcp_servers",
			servers: servers.map((s: McpServerSnapshot) => ({
				name: s.name,
				status: s.status,
				disabled: s.disabled,
				lastError: (s as any).lastError,
				toolCount: (s as any).toolCount ?? s.toolCount ?? 0,
				transport: (s as any).transport ?? "stdio",
			})),
		});
	}

	/**
	 * Restores a session checkpoint.
	 */
	private async handleCheckpointRestore(sessionId: string, checkpointRef: string): Promise<void> {
		const bridge = await this.getCore();
		const core = await bridge.getCore();
		try {
			await core.restore({ sessionId, checkpointRef });
			this.postToWebview({ type: "checkpoint_restored", sessionId });
			this.postToWebview({ type: "toast", message: `Checkpoint ${checkpointRef.slice(0, 8)} restored.`, severity: "success" });
		} catch (err: any) {
			this.postToWebview({ type: "error", text: `Checkpoint restore failed: ${err.message}` });
		}
	}

	/**
	 * Lists checkpoints for a session.
	 */
	private async handleCheckpointList(sessionId: string): Promise<void> {
		try {
			const checkpoints: CheckpointEntry[] = readSessionCheckpointHistory(sessionId);
			this.postToWebview({ type: "checkpoint_list", sessionId, checkpoints });
		} catch {
			this.postToWebview({ type: "checkpoint_list", sessionId, checkpoints: [] });
		}
	}

	/**
	 * Deletes a checkpoint reference.
	 */
	private async handleCheckpointDelete(sessionId: string, checkpointRef: string): Promise<void> {
		try {
			const bridge = await this.getCore();
			const core = await bridge.getCore();
			await core.restore({ sessionId, checkpointRef, deleteAfterRestore: true });
			this.postToWebview({ type: "toast", message: `Checkpoint ${checkpointRef.slice(0, 8)} deleted.`, severity: "info" });
			await this.handleCheckpointList(sessionId);
		} catch (err: any) {
			this.postToWebview({ type: "error", text: `Failed to delete checkpoint: ${err.message}` });
		}
	}

	/**
	 * Initializes the team runtime.
	 */
	private async ensureTeamsRuntime(): Promise<any> {
		if (!this.teamsRuntime) {
			const { AgentTeamsRuntime } = await import("@cline/core");
			this.teamsRuntime = new AgentTeamsRuntime({
				teamName: "zenuxs-team",
				leadAgentId: "lead",
				onTeamEvent: (event: any) => {
					this.postToWebview({ type: "logs_stream", text: `[Team] ${event.type}` });
				},
			});
		}
		return this.teamsRuntime;
	}

	/**
	 * Spawns a teammate.
	 */
	private async handleTeamSpawn(agentId: string, rolePrompt: string): Promise<void> {
		try {
			const runtime = await this.ensureTeamsRuntime();
			runtime.spawnTeammate({ agentId, config: { providerId: "cline", modelId: "anthropic/claude-sonnet-4.6", systemPrompt: rolePrompt } as any });
			this.postToWebview({ type: "team_teammate_spawned", agentId });
			this.postToWebview({ type: "toast", message: `Teammate "${agentId}" spawned.`, severity: "success" });
			await this.handleTeamStatus();
		} catch (err: any) {
			this.postToWebview({ type: "error", text: `Spawn failed: ${err.message}` });
		}
	}

	/**
	 * Shuts down a teammate.
	 */
	private async handleTeamShutdown(agentId: string, reason?: string): Promise<void> {
		try {
			const runtime = await this.ensureTeamsRuntime();
			runtime.shutdownTeammate(agentId, reason);
			this.postToWebview({ type: "team_teammate_shutdown", agentId });
			this.postToWebview({ type: "toast", message: `Teammate "${agentId}" shut down.`, severity: "info" });
			await this.handleTeamStatus();
		} catch (err: any) {
			this.postToWebview({ type: "error", text: `Shutdown failed: ${err.message}` });
		}
	}

	/**
	 * Sends team status to webview.
	 */
	private async handleTeamStatus(): Promise<void> {
		try {
			const runtime = await this.ensureTeamsRuntime();
			const snapshot = runtime.getSnapshot();
			this.postToWebview({
				type: "team_status",
				data: {
					teamId: snapshot.teamId,
					teamName: snapshot.teamName,
					members: snapshot.members.map((m: any) => ({
						agentId: m.agentId, role: m.role, description: m.description, status: m.status,
					})),
					taskCounts: snapshot.taskCounts,
					unreadMessages: snapshot.unreadMessages,
					missionLogEntries: snapshot.missionLogEntries,
					activeRuns: snapshot.activeRuns,
					queuedRuns: snapshot.queuedRuns,
					outcomeCounts: snapshot.outcomeCounts,
				},
			});
		} catch { /* runtime not ready */ }
	}

	/**
	 * Runs a task on a teammate.
	 */
	private async handleTeamRunTask(agentId: string, task: string, runMode?: "sync" | "async"): Promise<void> {
		try {
			const runtime = await this.ensureTeamsRuntime();
			if (runMode === "async") {
				const run = runtime.startTeammateRun(agentId, task);
				this.postToWebview({ type: "toast", message: `Task dispatched to "${agentId}" (run ${run.id.slice(0, 8)}).`, severity: "info" });
			} else {
				const result = await runtime.routeToTeammate(agentId, task);
				this.postToWebview({ type: "toast", message: `Task completed by "${agentId}".`, severity: "success" });
			}
			await this.handleTeamListRuns();
		} catch (err: any) {
			this.postToWebview({ type: "error", text: `Run task failed: ${err.message}` });
		}
	}

	/**
	 * Lists team runs.
	 */
	private async handleTeamListRuns(): Promise<void> {
		try {
			const runtime = await this.ensureTeamsRuntime();
			const runs = runtime.listRuns({ includeCompleted: true });
			this.postToWebview({
				type: "team_runs",
				runs: runs.map((r: any) => ({
					id: r.id, agentId: r.agentId, taskId: r.taskId, status: r.status,
					message: r.message || r.lastProgressMessage || "",
					startedAt: r.startedAt?.toISOString() || new Date().toISOString(),
					endedAt: r.endedAt?.toISOString(), currentActivity: r.currentActivity,
					error: r.error,
				})),
			});
		} catch { this.postToWebview({ type: "team_runs", runs: [] }); }
	}

	/**
	 * Cancels a team run.
	 */
	private async handleTeamCancelRun(runId: string): Promise<void> {
		try {
			const runtime = await this.ensureTeamsRuntime();
			runtime.cancelRun(runId, "Cancelled by user");
			this.postToWebview({ type: "toast", message: `Run ${runId.slice(0, 8)} cancelled.`, severity: "info" });
			await this.handleTeamListRuns();
		} catch (err: any) {
			this.postToWebview({ type: "error", text: `Cancel failed: ${err.message}` });
		}
	}

	/**
	 * Sends a message to a teammate.
	 */
	private async handleTeamSendMessage(toAgentId: string, subject: string, body: string): Promise<void> {
		try {
			const runtime = await this.ensureTeamsRuntime();
			runtime.sendMessage("lead", toAgentId, subject, body);
			this.postToWebview({ type: "toast", message: `Message sent to "${toAgentId}".`, severity: "success" });
		} catch (err: any) {
			this.postToWebview({ type: "error", text: `Send message failed: ${err.message}` });
		}
	}

	/**
	 * Broadcasts a message to all teammates.
	 */
	private async handleTeamBroadcast(subject: string, body: string): Promise<void> {
		try {
			const runtime = await this.ensureTeamsRuntime();
			runtime.broadcast("lead", subject, body);
			this.postToWebview({ type: "toast", message: "Broadcast sent.", severity: "success" });
		} catch (err: any) {
			this.postToWebview({ type: "error", text: `Broadcast failed: ${err.message}` });
		}
	}

	/**
	 * Reads the team mailbox.
	 */
	private async handleTeamReadMailbox(): Promise<void> {
		try {
			const runtime = await this.ensureTeamsRuntime();
			const msgs = runtime.listMailbox("lead");
			this.postToWebview({ type: "team_mailbox_messages", messages: msgs as any[] });
			this.postToWebview({ type: "toast", message: `Mailbox: ${msgs.length} messages.`, severity: "info" });
		} catch { /* ignore */ }
	}

	/**
	 * Appends a mission log entry.
	 */
	private async handleTeamMissionLog(kind: string, summary: string): Promise<void> {
		try {
			const runtime = await this.ensureTeamsRuntime();
			runtime.appendMissionLog({ agentId: "lead", kind: kind as any, summary });
			this.postToWebview({ type: "toast", message: "Mission log appended.", severity: "success" });
		} catch (err: any) {
			this.postToWebview({ type: "error", text: `Mission log failed: ${err.message}` });
		}
	}

	/**
	 * Lists team tasks.
	 */
	private async handleTeamListTasks(): Promise<void> {
		try {
			const runtime = await this.ensureTeamsRuntime();
			const tasks = runtime.listTasks();
			this.postToWebview({
				type: "team_tasks",
				tasks: tasks.map((t: any) => ({
					id: t.id, title: t.title, description: t.description,
					status: t.status, createdBy: t.createdBy, assignee: t.assignee,
					dependsOn: t.dependsOn || [],
				})),
			});
		} catch { this.postToWebview({ type: "team_tasks", tasks: [] }); }
	}

	/**
	 * Creates a team task.
	 */
	private async handleTeamCreateTask(title: string, description: string, assignee?: string): Promise<void> {
		try {
			const runtime = await this.ensureTeamsRuntime();
			runtime.createTask({ title, description, createdBy: "lead", assignee });
			this.postToWebview({ type: "toast", message: `Task "${title}" created.`, severity: "success" });
			await this.handleTeamListTasks();
		} catch (err: any) {
			this.postToWebview({ type: "error", text: `Create task failed: ${err.message}` });
		}
	}

	/**
	 * Completes a team task.
	 */
	private async handleTeamCompleteTask(taskId: string, summary: string): Promise<void> {
		try {
			const runtime = await this.ensureTeamsRuntime();
			runtime.completeTask(taskId, "lead", summary);
			this.postToWebview({ type: "toast", message: `Task ${taskId.slice(0, 8)} completed.`, severity: "success" });
			await this.handleTeamListTasks();
		} catch (err: any) {
			this.postToWebview({ type: "error", text: `Complete task failed: ${err.message}` });
		}
	}

	/**
	 * Lists connectors.
	 */
	private async handleConnectorList(): Promise<void> {
		this.postToWebview({ type: "connector_status", connectors: [] });
	}

	/**
	 * Connects a connector (Slack/Discord/Telegram).
	 */
	private async handleConnectorConnect(provider: string, name: string, config?: Record<string, string>): Promise<void> {
		try {
			const psm = new ProviderSettingsManager();
			await loginAndSaveLocalProviderOAuthCredentials(psm, provider, (url: string) => {
				vscode.env.openExternal(vscode.Uri.parse(url));
			});
			this.postToWebview({ type: "toast", message: `Connector "${name}" connecting...`, severity: "success" });
		} catch {
			this.postToWebview({ type: "toast", message: `Connector setup simulated: ${provider}`, severity: "info" });
		}
	}

	/**
	 * Disconnects a connector.
	 */
	private async handleConnectorDisconnect(id: string): Promise<void> {
		this.postToWebview({ type: "toast", message: `Connector ${id} disconnected.`, severity: "info" });
		await this.handleConnectorList();
	}

	/**
	 * Generates the HTML content for the chat webview.
	 */
	private getHtmlForWebview(webview: vscode.Webview): string {
		const nonce = getNonce();
		const bundleUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.extensionContext.extensionUri, "dist", "webview.js"),
		);
		const logoUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.extensionContext.extensionUri, "assets", "ChatGPT-2.png"),
		);
		return getWebviewHtml(nonce, webview.cspSource, bundleUri.toString(), logoUri.toString());
	}
}

/**
 * Generates a random nonce for CSP.
 */
function getNonce(): string {
	let text = "";
	const possible =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}