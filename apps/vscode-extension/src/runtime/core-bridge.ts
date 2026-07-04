import type {
	BasicLogger,
	ToolApprovalRequest,
	ToolApprovalResult,
} from "@cline/core";
import { ZenuxsCore } from "@cline/core";
import type { CoreSessionEvent } from "@cline/core";

/**
 * Options for initializing the extension runtime bridge.
 */
export interface ExtensionCoreBridgeOptions {
	cwd: string;
	workspaceRoot: string;
	logger?: BasicLogger;
	onToolApprovalRequest?: (
		request: ToolApprovalRequest,
	) => Promise<ToolApprovalResult> | ToolApprovalResult;
}

/**
 * Singleton bridge between the VS Code extension and the ZenuxsCore runtime.
 *
 * This mirrors the pattern used by the CLI in `apps/cli/src/session/session.ts`
 * (`createCliCore()`), but tailored for the VS Code extension host.
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

	private async createCore(): Promise<ZenuxsCore> {
		const requestToolApproval = this.options.onToolApprovalRequest;
		const core = await ZenuxsCore.create({
			backendMode: "local",
			clientName: "vscode-extension",
			capabilities: {
				requestToolApproval: requestToolApproval
					? (request: ToolApprovalRequest) => requestToolApproval(request)
					: undefined,
			},
			cwd: this.options.cwd,
			workspaceRoot: this.options.workspaceRoot,
			logger: this.options.logger,
		});

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

		return core;
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
	 * Dispose the runtime and clean up all resources.
	 */
	async dispose(): Promise<void> {
		this.unsubscribeEvents?.();
		this.unsubscribeEvents = undefined;
		this.eventListeners.clear();
		if (this.core) {
			await this.core.dispose("vscode_extension_shutdown");
			this.core = undefined;
		}
		this.initPromise = undefined;
	}
}
