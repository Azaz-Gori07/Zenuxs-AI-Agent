import type {
	AgentConfig,
	BasicLogger,
	CoreSessionEvent,
	ITelemetryService,
	RuntimeCapabilities,
	SessionHistoryRecord,
	ToolApprovalRequest,
	ToolApprovalResult,
	UserInstructionConfigService,
} from "@cline/core";
import {
	ZenuxsCore,
	listSessionHistoryFromBackend,
	resolveSessionBackend,
	createUserInstructionConfigService,
	prewarmFileIndex,
	FeatureFlagsService,
	NoOpFeatureFlagsProvider,
} from "@cline/core";

const SYNC_API = "https://aiapi.zenuxs.in/api";

let syncTimer: ReturnType<typeof setInterval> | undefined;
let pollTimer: ReturnType<typeof setInterval> | undefined;
let remoteConvId: string | undefined;
let lastSyncMessages = 0;
let getAuthToken: (() => string | undefined) | undefined;

async function syncFetch(path: string, opts?: RequestInit): Promise<any> {
	const token = getAuthToken?.();
	if (!token) return null;
	try {
		const res = await fetch(`${SYNC_API}${path}`, {
			...opts,
			headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...opts?.headers },
		});
		return res.ok ? await res.json() : null;
	} catch { return null; }
}

async function registerProject(workspaceRoot: string, logger?: BasicLogger) {
	const folderName = workspaceRoot.split(/[\\/]/).filter(Boolean).pop() || "vscode";
	const res = await syncFetch("/sync/projects/register", {
		method: "POST",
		body: JSON.stringify({ projectId: folderName, name: folderName, type: "local" }),
	});
	if (res?.success) logger?.log?.("[sync] project registered:", folderName);
}

function extractText(content: unknown): string {
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		return content.map((p) => (typeof p === "object" && p && "text" in p ? String(p.text) : "")).filter(Boolean).join("");
	}
	return "";
}

function messagesToSync(messages: { role: string; content: unknown }[]) {
	return messages.map((m) => ({
		role: m.role === "user" || m.role === "assistant" ? m.role : "user",
		content: extractText(m.content),
	})).filter((m) => m.content.trim());
}

async function syncConversation(
	sessionId: string,
	messages: { role: string; content: unknown }[],
	workspaceRoot: string,
	logger?: BasicLogger,
) {
	if (!sessionId || messages.length === 0) return;
	const syncable = messagesToSync(messages);
	if (syncable.length === 0 || syncable.length === lastSyncMessages) return;
	lastSyncMessages = syncable.length;

	const existing = remoteConvId;
	const url = existing
		? `/sync/conversations/${existing}`
		: "/sync/conversations";
	const res = await syncFetch(url, {
		method: existing ? "PUT" : "POST",
		body: JSON.stringify({
			conversationId: existing,
			title: syncable[0]?.content?.slice(0, 50) || "Extension Session",
			messages: syncable,
			workspaceRoot,
		}),
	});
	if (res?.conversation?._id) {
		if (remoteConvId !== res.conversation._id) {
			remoteConvId = res.conversation._id;
			logger?.log?.("[sync] conversation linked:", remoteConvId);
		}
	}
}

async function pollPendingMessages(logger?: BasicLogger) {
	if (!remoteConvId) return;
	try {
		const data = await syncFetch(`/sync/conversations/${remoteConvId}/pending`);
		const pending = (data?.pendingMessages || []).filter((m: any) => !m.delivered);
		if (pending.length > 0) {
			logger?.log?.("[sync] pending messages:", pending.length);
			await syncFetch(`/sync/conversations/${remoteConvId}/pending/deliver`, {
				method: "POST",
				body: JSON.stringify({ messageIds: pending.map((m: any) => m._id) }),
			});
		}
	} catch {}
}

function startSync(workspaceRoot: string, logger?: BasicLogger) {
	if (syncTimer) return;
	registerProject(workspaceRoot, logger);
	syncTimer = setInterval(() => registerProject(workspaceRoot, logger), 30000);
	pollTimer = setInterval(() => pollPendingMessages(logger), 5000);
}

function stopSync() {
	if (syncTimer) { clearInterval(syncTimer); syncTimer = undefined; }
	if (pollTimer) { clearInterval(pollTimer); pollTimer = undefined; }
}

export interface ExtensionCoreBridgeOptions {
	cwd: string;
	workspaceRoot: string;
	logger?: BasicLogger;
	telemetry?: ITelemetryService;
	capabilities?: RuntimeCapabilities;
	toolPolicies?: AgentConfig["toolPolicies"];
	onToolApprovalRequest?: (
		request: ToolApprovalRequest,
	) => Promise<ToolApprovalResult> | ToolApprovalResult;
	getAuthToken?: () => string | undefined;
}

export class ExtensionCoreBridge {
	private core: ZenuxsCore | undefined;
	private initPromise: Promise<ZenuxsCore> | undefined;
	private readonly options: ExtensionCoreBridgeOptions;
	private eventListeners = new Set<(event: CoreSessionEvent) => void>();
	private unsubscribeEvents: (() => void) | undefined;
	private userInstructionService: UserInstructionConfigService | undefined;
	private lastSnapshotSessionId: string | undefined;
	private syncDebounceTimer: ReturnType<typeof setTimeout> | undefined;

	constructor(options: ExtensionCoreBridgeOptions) {
		this.options = options;
		if (options.getAuthToken) {
			getAuthToken = options.getAuthToken;
		}
	}

	async getCore(): Promise<ZenuxsCore> {
		if (this.core) {
			return this.core;
		}
		if (this.initPromise) {
			return this.initPromise;
		}
		this.initPromise = this.createCore();
		this.core = await this.initPromise;
		return this.core;
	}

	getUserInstructionService(): UserInstructionConfigService | undefined {
		return this.userInstructionService;
	}

	private handleEvent(event: CoreSessionEvent) {
		if (event.type === "session_snapshot") {
			const { sessionId, snapshot } = event.payload;
			this.lastSnapshotSessionId = sessionId;
			const messages = snapshot?.turnHistory?.messages || snapshot?.messages || [];
			if (messages.length > 0) {
				if (this.syncDebounceTimer) clearTimeout(this.syncDebounceTimer);
				this.syncDebounceTimer = setTimeout(() => {
					syncConversation(sessionId, messages, this.options.workspaceRoot, this.options.logger);
				}, 2000);
			}
		}
		if (event.type === "ended") {
			lastSyncMessages = 0;
			remoteConvId = undefined;
		}
		for (const listener of this.eventListeners) {
			try { listener(event); } catch {}
		}
	}

	private async createCore(): Promise<ZenuxsCore> {
		const { cwd, workspaceRoot, logger } = this.options;

		this.userInstructionService = createUserInstructionConfigService({
			skills: {
				workspacePath: workspaceRoot,
				includePluginSkills: true,
				cwd,
			},
			rules: { workspacePath: workspaceRoot },
			workflows: { workspacePath: workspaceRoot },
		});
		await this.userInstructionService.start().catch(() => {});

		const telemetry = this.options.telemetry;
		const featureFlags = this.createFeatureFlagsService(telemetry);

		const { vsCodeEditorTool, vsCodeTerminalTool } = await import("../tools/index.js");

		const capabilities: RuntimeCapabilities = {
			...this.options.capabilities,
			requestToolApproval: this.options.onToolApprovalRequest
				? (request: ToolApprovalRequest) =>
						this.options.onToolApprovalRequest!(request)
				: undefined,
			toolExecutors: {
				...this.options.capabilities?.toolExecutors,
				editor: async (input: any) => {
					const res = await vsCodeEditorTool.editFile({
						filePath: input.path || input.filePath || "",
						edits: Array.isArray(input.edits)
							? input.edits
							: [{ startLine: input.startLine || 1, endLine: input.endLine || 1, replacement: input.content || input.replacement || "" }],
						workspaceRoot,
					});
					return res.summary;
				},
				bash: async (input: any) => {
					const commandStr = typeof input === "string" ? input : (input.command || String(input));
					const res = await vsCodeTerminalTool.runCommand({
						command: commandStr,
						cwd,
						longRunning: Boolean(input.longRunning),
					});
					return res.output;
				},
			},
		};

		const core = await ZenuxsCore.create({
			backendMode: "local",
			clientName: "vscode-extension",
			hub: {
				cwd,
				workspaceRoot,
				clientType: "vscode-extension",
				displayName: "Zenuxs VS Code",
			},
			capabilities,
			telemetry,
			featureFlags,
			logger,
			toolPolicies: this.options.toolPolicies,
		});

		try {
			await core.featureFlags.poll();
		} catch (error) {
			logger?.error?.("Error polling feature flags", { error });
		}

		this.unsubscribeEvents = core.subscribe((event: CoreSessionEvent) => {
			this.handleEvent(event);
		});

		startSync(workspaceRoot, logger);

		logger?.log?.("Extension core runtime initialized", {
			backendMode: "local",
		});

		return core;
	}

	private createFeatureFlagsService(
		telemetry?: ITelemetryService,
	): FeatureFlagsService {
		return new FeatureFlagsService({
			provider: new NoOpFeatureFlagsProvider(),
			telemetry,
			logger: this.options.logger,
		});
	}

	subscribe(listener: (event: CoreSessionEvent) => void): () => void {
		this.eventListeners.add(listener);
		return () => {
			this.eventListeners.delete(listener);
		};
	}

	async prewarmFileIndex(): Promise<void> {
		try {
			await prewarmFileIndex(this.options.cwd);
		} catch {}
	}

	async listSessions(
		limit = 50,
		options?: { workspaceRoot?: string; hydrate?: boolean },
	): Promise<SessionHistoryRecord[]> {
		try {
			const backend = await resolveSessionBackend({
				telemetry: this.options.telemetry,
			});
			return await listSessionHistoryFromBackend(backend, {
				limit,
				includeManifestFallback: true,
				hydrate: options?.hydrate ?? false,
				includeSubagents: false,
			});
		} catch {
			return [];
		}
	}

	async dispose(): Promise<void> {
		stopSync();
		this.unsubscribeEvents?.();
		this.unsubscribeEvents = undefined;
		this.eventListeners.clear();

		if (this.userInstructionService) {
			this.userInstructionService.stop();
			this.userInstructionService = undefined;
		}

		if (this.core) {
			await this.core.dispose("vscode_extension_shutdown");
			this.core = undefined;
		}
		this.initPromise = undefined;
	}
}
