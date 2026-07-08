import * as vscode from "vscode";
import * as fs from "fs";
import { ExtensionCoreBridge } from "../runtime/core-bridge.js";
import { mapCoreEventToWebview } from "../runtime/event-mapper.js";
import type { WebviewOutboundMessage } from "../runtime/event-mapper.js";
import { resolveExtensionConfig, resolveWorkspaceRoot, resolveCwd } from "../runtime/config-resolver.js";
import { captureEditorContext, formatEditorContextForPrompt } from "../context/editor-context.js";
import {
	fetchZenuxsRecommendedModels,
	createCoreSettingsService,
	ProviderSettingsManager,
	SessionSource,
	InMemoryMcpManager,
	createDefaultMcpServerClientFactory,
	setMcpServerDisabled,
	resolveMcpServerRegistrations,
	resolveDefaultMcpSettingsPath,
	type BasicLogger,
} from "@cline/core";
import type { AgentResult, CoreSessionEvent, ToolApprovalRequest, ToolApprovalResult, CheckpointEntry, McpServerSnapshot, McpServerRegistration } from "@cline/core";
import { AgentTeamsRuntime } from "@cline/core";
import { createSessionId } from "@cline/shared";
import { getWebviewHtml } from "../webview/webview-html.js";

export function logStartup(
	workerId: string,
	sessionId: string,
	component: string,
	func: string,
	event: "ENTER" | "EXIT" | "EVENT",
	duration: string | number = "N/A",
	status: string = "SUCCESS"
): void {
	try {
		const logFile = "D:/V3/zenuxs-code/startup-debug.log";
		const fs = require("fs");
		const durationStr = typeof duration === "number" ? `${duration}ms` : duration;
		const logLine = `[${new Date().toISOString()}] [${workerId}] [${sessionId || "None"}] [${component}] [${func}] [${event}] [${durationStr}] [${status}]\n`;
		fs.appendFileSync(logFile, logLine, "utf8");
	} catch (err) {
		console.error("Failed to write to startup log:", err);
	}
}


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
		logParams?: {
			workerId: string;
			sessionId: string;
			component: string;
			func: string;
			event: "ENTER" | "EXIT" | "EVENT";
			duration: string | number;
			status: string;
		};
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
	;

/**
 * Provides the Zenuxs chat webview in the VS Code sidebar.
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
	private mcpManager: InMemoryMcpManager | undefined;
	private teamsRuntime: AgentTeamsRuntime | undefined;

	constructor(private readonly extensionContext: vscode.ExtensionContext) { }

	resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	): void {
		logStartup("EXT-HOST", this.activeSessionId || "None", "Extension", "resolveWebviewView", "ENTER", "N/A", "START");
		const startTime = Date.now();
		this.webviewView = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.extensionContext.extensionUri],
		};

		webviewView.webview.html = this.getHtmlForWebview(
			webviewView.webview,
		);

		webviewView.webview.onDidReceiveMessage(
			async (message: WebviewInboundMessage) => {
				await this.handleWebviewMessage(message);
			},
		);
		logStartup("EXT-HOST", this.activeSessionId || "None", "Extension", "resolveWebviewView", "EXIT", Date.now() - startTime, "SUCCESS");
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
		this.activeSessionId = undefined;
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
	 */
	private async getCore(): Promise<any> {
		logStartup("EXT-HOST", this.activeSessionId || "None", "Extension", "getCore", "ENTER");
		const startGetCore = Date.now();
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

			logStartup("EXT-HOST", this.activeSessionId || "None", "Extension", "initializeMcpManager", "ENTER");
			const startMcp = Date.now();
			await this.initializeMcpManager();
			logStartup("EXT-HOST", this.activeSessionId || "None", "Extension", "initializeMcpManager", "EXIT", Date.now() - startMcp, "SUCCESS");
		}

		logStartup("EXT-HOST", this.activeSessionId || "None", "Extension", "coreBridge.getCore", "ENTER");
		const startBridge = Date.now();
		const core = await this.coreBridge.getCore();
		logStartup("EXT-HOST", this.activeSessionId || "None", "Extension", "coreBridge.getCore", "EXIT", Date.now() - startBridge, "SUCCESS");

		logStartup("EXT-HOST", this.activeSessionId || "None", "Extension", "getCore", "EXIT", Date.now() - startGetCore, "SUCCESS");
		return core;
	}

	/**
	 * Handles messages from the webview.
	 */
	private async handleWebviewMessage(
		message: WebviewInboundMessage,
	): Promise<void> {
		try {
			logStartup("EXT-HOST", this.activeSessionId || "None", "Extension", "handleWebviewMessage", "EVENT", "N/A", `RECEIVED: ${message.type}`);
			switch (message.type) {
				case "webview_log": {
					if (message.logParams) {
						logStartup(
							message.logParams.workerId,
							message.logParams.sessionId,
							message.logParams.component,
							message.logParams.func,
							message.logParams.event,
							message.logParams.duration,
							message.logParams.status
						);
					} else {
						const worker = message.level === "error" ? "WEBVIEW-ERROR" : "WEBVIEW-CONSOLE";
						logStartup(worker, this.activeSessionId || "None", "Webview", message.message, "EVENT", "N/A", message.level.toUpperCase());
					}
					if (message.stack) {
						const fs = require("fs");
						fs.appendFileSync("D:/V3/zenuxs-code/startup-debug.log", `Stack: ${message.stack}\n`, "utf8");
					}
					break;
				}

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
					this.activeSessionId = undefined;
					this.postToWebview({ type: "reset_done" });
					break;

				case "approval_response":
					this.handleApprovalResponse(message);
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

			case "login_oauth":
				await this.handleLoginOAuth(message.providerId);
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
			}
		} catch (error) {
			const txt = error instanceof Error ? error.message : String(error);
			this.postToWebview({ type: "error", text: txt });
		}
	}

	/**
	 * Sends initial settings, models, toggles, history, etc. to webview.
	 */
	private async sendInitialPayload(): Promise<void> {
		logStartup("EXT-HOST", this.activeSessionId || "None", "Extension", "sendInitialPayload", "ENTER");
		const startPayload = Date.now();
		try {
			logStartup("EXT-HOST", this.activeSessionId || "None", "Extension", "getCore_in_payload", "ENTER");
			const startGetCore = Date.now();
			const core = await this.getCore();
			logStartup("EXT-HOST", this.activeSessionId || "None", "Extension", "getCore_in_payload", "EXIT", Date.now() - startGetCore, "SUCCESS");

			const psm = new ProviderSettingsManager();

			// Use real listLocalProviders to get all providers dynamically (same as CLI TUI)
			logStartup("EXT-HOST", this.activeSessionId || "None", "Extension", "listLocalProviders", "ENTER");
			const startProv = Date.now();
			let providers: import("@cline/shared").ProviderListItem[] = [];
			try {
				const { listLocalProviders: listProviders } = await import("@cline/core");
				const result = await listProviders(psm);
				providers = result.providers;
			} catch {
				// fallback - use hardcoded list
				providers = [];
			}
			logStartup("EXT-HOST", this.activeSessionId || "None", "Extension", "listLocalProviders", "EXIT", Date.now() - startProv, `SUCCESS_${providers.length}`);

			const extConfig = resolveExtensionConfig();

			logStartup("EXT-HOST", this.activeSessionId || "None", "Extension", "core.list", "ENTER");
			const startList = Date.now();
			const sessionHistories = await core.list(100, { hydrate: false });
			logStartup("EXT-HOST", this.activeSessionId || "None", "Extension", "core.list", "EXIT", Date.now() - startList, `SUCCESS_${sessionHistories?.length || 0}`);

			let toggles = { workflows: [], rules: [], skills: [], tools: [], mcp: [] };
			logStartup("EXT-HOST", this.activeSessionId || "None", "Extension", "settingsService.list", "ENTER");
			const startSettings = Date.now();
			try {
				const settingsService = createCoreSettingsService();
				const snapshot = await settingsService.list({
					workspaceRoot: resolveWorkspaceRoot(),
					cwd: resolveCwd(),
				});
				toggles = snapshot as any;
				logStartup("EXT-HOST", this.activeSessionId || "None", "Extension", "settingsService.list", "EXIT", Date.now() - startSettings, "SUCCESS");
			} catch (err: any) {
				logStartup("EXT-HOST", this.activeSessionId || "None", "Extension", "settingsService.list", "EXIT", Date.now() - startSettings, `ERROR_${err.message}`);
				// ignore - use defaults
			}

			logStartup("EXT-HOST", this.activeSessionId || "None", "Extension", "getMcpServerList", "ENTER");
			const startMcpList = Date.now();
			const mcpServers = await this.getMcpServerList();
			logStartup("EXT-HOST", this.activeSessionId || "None", "Extension", "getMcpServerList", "EXIT", Date.now() - startMcpList, `SUCCESS_${mcpServers?.length || 0}`);

			logStartup("EXT-HOST", this.activeSessionId || "None", "Extension", "postMessage(initial_data)", "ENTER");
			this.postToWebview({
				type: "initial_data",
				providers,
				models: {},
				currentConfig: extConfig,
				toggles,
				sessionHistories,
				mcpServers: mcpServers.map((s: McpServerSnapshot) => ({
					name: s.name,
					status: s.status,
					disabled: s.disabled,
					lastError: s.lastError,
					toolCount: s.toolCount,
					transport: s.transport,
				})),
			});
			logStartup("EXT-HOST", this.activeSessionId || "None", "Extension", "postMessage(initial_data)", "EXIT", "N/A", "SUCCESS");
			logStartup("EXT-HOST", this.activeSessionId || "None", "Extension", "sendInitialPayload", "EXIT", Date.now() - startPayload, "SUCCESS");
		} catch (err: any) {
			logStartup("EXT-HOST", this.activeSessionId || "None", "Extension", "sendInitialPayload", "EXIT", Date.now() - startPayload, `ERROR_${err.message}`);
			throw err;
		}
	}

	/**
	 * Fetches models for a specific provider and sends them to the webview.
	 */
	private async handleModelsRequest(providerId: string): Promise<void> {
		try {
			const psm = new ProviderSettingsManager();
			const { getLocalProviderModels } = await import("@cline/core");
			const result = await getLocalProviderModels(providerId, psm.getProviderSettings(providerId));
			const models = result.models.map((m: any) => m.id || m);
			this.postToWebview({ type: "models", providerId, models: models.length > 0 ? models : ["default"] });
		} catch {
			this.postToWebview({ type: "models", providerId, models: ["default"] });
		}
	}

	/**
	 * Save provider settings and synchronize with VS Code settings & CLI config.
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
		await Promise.all(updates);

		// Save in ProviderSettingsManager to keep sync with CLI
		const psm = new ProviderSettingsManager();
		psm.saveProviderSettings({
			provider: msg.providerId,
			model: msg.modelId,
			apiKey: msg.apiKey || undefined,
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
			const core = await this.getCore();
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
			if (this.activeSessionId === sessionId) {
				this.activeSessionId = undefined;
				this.isRunning = false;
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
			const core = await this.getCore();
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
		const core = await this.getCore();
		const messages = await core.readMessages(sessionId);
		const row = await core.get(sessionId);

		this.activeSessionId = sessionId;

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

		this.postToWebview({
			type: "session_hydrated",
			sessionId,
			messages: uiMessages,
		});
	}

	/**
	 * Export session conversation messages to JSON.
	 */
	private async handleExportSession(sessionId: string): Promise<void> {
		const core = await this.getCore();
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
			const core = await this.getCore();
			const sessions = await core.list(1000, { hydrate: false });
			for (const session of sessions) {
				await core.delete(session.sessionId);
			}
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
	 */
	private async handleLoginOAuth(providerId: string): Promise<void> {
		const psm = new ProviderSettingsManager();
		try {
			await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: `Zenuxs: Authenticating ${providerId}...`,
					cancellable: true,
				},
				async (progress, token) => {
					const { loginAndSaveLocalProviderOAuthCredentials } = await import("@cline/core");
					await loginAndSaveLocalProviderOAuthCredentials(
						psm,
						providerId,
						(url: string) => {
							vscode.env.openExternal(vscode.Uri.parse(url));
						}
					);
				}
			);
			vscode.window.showInformationMessage(`Zenuxs: Successfully authenticated provider ${providerId}.`);
			await this.sendInitialPayload();
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`Zenuxs Authentication Failed: ${msg}`);
			this.postToWebview({ type: "error", text: `Authentication failed: ${msg}` });
		}
	}

	/**
	 * Handles a send message from the webview.
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
	 */
	private async executeSession(
		prompt: string,
		progress: vscode.Progress<{ message?: string; increment?: number }>,
		uiConfig?: any,
	): Promise<void> {
		try {
			const core = await this.getCore();
			const extConfig = resolveExtensionConfig();
			const editorCtx = captureEditorContext();
			const editorContextText = formatEditorContextForPrompt(editorCtx);

			// Build the full prompt with editor context
			const fullPrompt = editorContextText
				? `${prompt}\n\n${editorContextText}`
				: prompt;

			// Subscribe to events for this turn
			const unsubscribe = this.coreBridge!.subscribe((event: CoreSessionEvent) => {
				const messages = mapCoreEventToWebview(event);
				for (const msg of messages) {
					this.postToWebview(msg);
				}
				// Update progress for tool events
				if (event.type === "agent_event") {
					const agentEvent = event.payload.event;
					if (agentEvent.type === "content_start" && agentEvent.contentType === "tool") {
						progress.report({ message: `Running ${agentEvent.toolName ?? "tool"}...` });
					} else if (agentEvent.type === "notice") {
						progress.report({ message: agentEvent.message });
					}
				} else if (event.type === "status") {
					progress.report({ message: event.payload.status });
				}
			});

			try {
				const plannedSessionId = createSessionId();
				const workspaceRoot = resolveWorkspaceRoot();
				const cwd = resolveCwd();

				const providerId = uiConfig?.providerId || extConfig.providerId;
				const modelId = uiConfig?.modelId || extConfig.modelId || "anthropic/claude-sonnet-4.6";
				const thinking = uiConfig?.thinking !== undefined ? uiConfig.thinking : extConfig.thinking;
				const reasoningEffort = uiConfig?.reasoningEffort || extConfig.reasoningEffort;
				const modeStr = uiConfig?.mode || extConfig.mode || "act";

				const toolPolicies: Record<string, { autoApprove: boolean }> = {
					"*": { autoApprove: extConfig.autoApproveTools },
				};

				// Start or send to session
				if (!this.activeSessionId) {
					// New session
					const started = await core.start({
						source: SessionSource.VSCODE,
						config: {
							providerId,
							modelId,
							apiKey: extConfig.apiKey,
							baseUrl: extConfig.baseUrl || undefined,
							systemPrompt: "",
							enableTools: true,
							enableSpawnAgent: true,
							enableAgentTeams: true,
							yolo: modeStr === "yolo",
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
							compaction: extConfig.compaction !== "off"
								? { enabled: true, strategy: extConfig.compaction }
								: { enabled: false },
							checkpoint: {
								enabled: extConfig.checkpointEnabled,
							},
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
							},
						},
						prompt: fullPrompt,
						interactive: false,
						sessionId: plannedSessionId,
					});

					this.activeSessionId = started.sessionId;
					this.postToWebview({
						type: "session_started",
						sessionId: started.sessionId,
					});

					// If start() already returned a result (non-interactive), use it
					if (started.result) {
						this.handleAgentResult(started.result);
					} else {
						// Wait for the session to complete via events
						await this.waitForSessionEnd(core, started.sessionId);
					}
				} else {
					// Continue existing session
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
		} finally {
			this.isRunning = false;
		}
	}

	/**
	 * Handles an agent result.
	 */
	private handleAgentResult(result: AgentResult): void {
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
	 */
	private waitForSessionEnd(
		core: any,
		sessionId: string,
	): Promise<void> {
		return new Promise<void>((resolve) => {
			const unsubscribe = core.subscribe((event: CoreSessionEvent) => {
				if (
					event.type === "ended" &&
					event.payload.sessionId === sessionId
				) {
					unsubscribe();
					resolve();
				}
			});
		});
	}

	/**
	 * Handles abort request.
	 */
	private async handleAbort(): Promise<void> {
		if (this.coreBridge && this.activeSessionId) {
			try {
				const core = await this.coreBridge.getCore();
				await core.abort(this.activeSessionId);
				this.postToWebview({
					type: "status",
					text: "Session aborted",
				});
			} catch {
				// Abort is best-effort
			}
		}
		this.isRunning = false;
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
		logStartup("EXT-HOST", this.activeSessionId || "None", "Extension", "initializeMcpManager_internal", "ENTER");
		const startTime = Date.now();
		if (!this.mcpManager) {
			logStartup("EXT-HOST", this.activeSessionId || "None", "Extension", "initializeMcpManager_internal", "EXIT", Date.now() - startTime, "NO_MANAGER");
			return;
		}
		try {
			logStartup("EXT-HOST", this.activeSessionId || "None", "Extension", "import_cline_core", "ENTER");
			const startImport = Date.now();
			const { hasMcpSettingsFile, loadMcpSettingsFile } = await import("@cline/core");
			logStartup("EXT-HOST", this.activeSessionId || "None", "Extension", "import_cline_core", "EXIT", Date.now() - startImport, "SUCCESS");

			const settingsPath = resolveDefaultMcpSettingsPath();
			logStartup("EXT-HOST", this.activeSessionId || "None", "Extension", "hasMcpSettingsFile", "ENTER");
			const startHasMcp = Date.now();
			const hasFile = hasMcpSettingsFile(settingsPath);
			logStartup("EXT-HOST", this.activeSessionId || "None", "Extension", "hasMcpSettingsFile", "EXIT", Date.now() - startHasMcp, `SUCCESS_${hasFile}`);

			if (hasFile) {
				const file = loadMcpSettingsFile(settingsPath);
				for (const reg of resolveMcpServerRegistrations({ mcpServers: file.mcpServers })) {
					logStartup("EXT-HOST", this.activeSessionId || "None", "Extension", `registerServer_${reg.name}`, "ENTER");
					const startReg = Date.now();
					await this.mcpManager.registerServer(reg);
					logStartup("EXT-HOST", this.activeSessionId || "None", "Extension", `registerServer_${reg.name}`, "EXIT", Date.now() - startReg, "SUCCESS");

					if (!reg.disabled) {
						logStartup("EXT-HOST", this.activeSessionId || "None", "Extension", `connectServer_${reg.name}`, "ENTER");
						const startConn = Date.now();
						await this.mcpManager.connectServer(reg.name);
						logStartup("EXT-HOST", this.activeSessionId || "None", "Extension", `connectServer_${reg.name}`, "EXIT", Date.now() - startConn, "SUCCESS");
					}
				}
			}
			logStartup("EXT-HOST", this.activeSessionId || "None", "Extension", "initializeMcpManager_internal", "EXIT", Date.now() - startTime, "SUCCESS");
		} catch (err: any) {
			logStartup("EXT-HOST", this.activeSessionId || "None", "Extension", "initializeMcpManager_internal", "EXIT", Date.now() - startTime, `ERROR_${err.message}`);
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
		const core = await this.getCore();
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
			const { readSessionCheckpointHistory } = await import("@cline/core");
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
			const core = await this.getCore();
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
	private async ensureTeamsRuntime(): Promise<AgentTeamsRuntime> {
		if (!this.teamsRuntime) {
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
			const { loginAndSaveLocalProviderOAuthCredentials } = await import("@cline/core");
			const psm = new ProviderSettingsManager();
			await loginAndSaveLocalProviderOAuthCredentials(psm, provider, (url: string) => {
				vscode.env.openExternal(vscode.Uri.parse(url));
			});
			this.postToWebview({ type: "toast", message: `Connector "${name}" connecting...`, severity: "success" });
		} catch (err: any) {
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
