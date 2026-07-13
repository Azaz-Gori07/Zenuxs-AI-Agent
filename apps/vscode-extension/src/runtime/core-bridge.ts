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

/**
 * Options for initializing the extension runtime bridge.
 * Mirrors the CLI's createCliCore() options.
 */
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
}

/**
 * Singleton bridge between the VS Code extension and the ZenuxsCore runtime.
 *
 * This mirrors the CLI's `createCliCore()` from apps/cli/src/session/session.ts
 * exactly, using the same ZenuxsCore.create() pattern with feature flags,
 * telemetry, hub options, and message artifact uploaders.
 *
 * One ZenuxsCore instance is created per VS Code window and shared across
 * all extension features (chat panel, commands, inline chat, etc.).
 */
export class ExtensionCoreBridge {
	private core: ZenuxsCore | undefined;
	private initPromise: Promise<ZenuxsCore> | undefined;
	private readonly options: ExtensionCoreBridgeOptions;
	private eventListeners = new Set<(event: CoreSessionEvent) => void>();
	private unsubscribeEvents: (() => void) | undefined;
	private userInstructionService: UserInstructionConfigService | undefined;

	constructor(options: ExtensionCoreBridgeOptions) {
		this.options = options;
	}

	/**
	 * Returns the ZenuxsCore instance, creating it if necessary.
	 * Subsequent calls return the same instance.
	 */
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

	/**
	 * Returns the user instruction config service.
	 */
	getUserInstructionService(): UserInstructionConfigService | undefined {
		return this.userInstructionService;
	}

	private async createCore(): Promise<ZenuxsCore> {
		const { cwd, workspaceRoot, logger } = this.options;

		// Initialize user instruction config service (rules, skills, workflows)
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

		// Create telemetry service matching CLI pattern
		const telemetry = this.options.telemetry;

		// Create feature flags service
		const featureFlags = this.createFeatureFlagsService(telemetry);

		// Build capabilities with tool approval
		const capabilities: RuntimeCapabilities = {
			...this.options.capabilities,
			requestToolApproval: this.options.onToolApprovalRequest
				? (request: ToolApprovalRequest) =>
						this.options.onToolApprovalRequest!(request)
				: undefined,
		};

		// Build core matching CLI's createCliCore() exactly
		const core = await ZenuxsCore.create({
			backendMode: "local", // Always local for VS Code extension
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

		// Poll feature flags on startup (matching CLI pattern)
		try {
			await core.featureFlags.poll();
		} catch (error) {
			logger?.error?.("Error polling feature flags", { error });
		}

		// Subscribe to all session events so we can fan them out to listeners
		this.unsubscribeEvents = core.subscribe((event: CoreSessionEvent) => {
			for (const listener of this.eventListeners) {
				try {
					listener(event);
				} catch {
					// Listener errors should not break the runtime
				}
			}
		});

		logger?.log?.("Extension core runtime initialized", {
			backendMode: "local",
		});

		return core;
	}

	/**
	 * Creates feature flags service matching CLI pattern.
	 */
	private createFeatureFlagsService(
		telemetry?: ITelemetryService,
	): FeatureFlagsService {
		return new FeatureFlagsService({
			provider: new NoOpFeatureFlagsProvider(),
			telemetry,
			logger: this.options.logger,
		});
	}

	/**
	 * Subscribe to all runtime events. Returns an unsubscribe function.
	 */
	subscribe(listener: (event: CoreSessionEvent) => void): () => void {
		this.eventListeners.add(listener);
		return () => {
			this.eventListeners.delete(listener);
		};
	}

	/**
	 * Prewarm the file index for faster tool execution (matching CLI pattern).
	 */
	async prewarmFileIndex(): Promise<void> {
		try {
			await prewarmFileIndex(this.options.cwd);
		} catch {
			// Best-effort
		}
	}

	/**
	 * List session history from the backend (matching CLI's listSessions()).
	 */
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

	/**
	 * Dispose the runtime and clean up all resources.
	 */
	async dispose(): Promise<void> {
		this.unsubscribeEvents?.();
		this.unsubscribeEvents = undefined;
		this.eventListeners.clear();

		if (this.userInstructionService) {
			await this.userInstructionService.stop().catch(() => {});
			this.userInstructionService = undefined;
		}

		if (this.core) {
			await this.core.dispose("vscode_extension_shutdown");
			this.core = undefined;
		}
		this.initPromise = undefined;
	}
}