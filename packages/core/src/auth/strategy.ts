import type * as LlmsProviders from "@cline/llms";
import { type AgentResult, isLikelyAuthError } from "@cline/shared";
import type { StartSessionInput } from "../runtime/host/runtime-host";
import type { ActiveSession } from "../types/session";
import {
	OAuthReauthRequiredError,
	type RuntimeOAuthTokenManager,
} from "../runtime/orchestration/runtime-oauth-token-manager";

export interface AuthenticationStrategy {
	applyInitialCredentials(input: StartSessionInput): Promise<StartSessionInput>;
	syncCredentials(
		session: ActiveSession,
		options?: { forceRefresh?: boolean },
	): Promise<void>;
	runWithRetry(
		session: ActiveSession,
		run: () => Promise<AgentResult>,
		baselineMessages: LlmsProviders.Message[],
	): Promise<AgentResult>;
}

export class OAuthStrategy implements AuthenticationStrategy {
	constructor(
		private readonly oauthTokenManager: RuntimeOAuthTokenManager,
		private readonly logCallback?: (stage: string, context: any) => void,
	) {}

	async applyInitialCredentials(input: StartSessionInput): Promise<StartSessionInput> {
		this.logCallback?.("SESSION_START", {
			enteredOAuthPipeline: true,
			enteredApiKeyPipeline: false,
			retryInvoked: false,
			authManagerInvoked: !input.config.apiKey?.trim(),
		});

		if (input.config.apiKey?.trim()) {
			return input;
		}

		const resolved = await this.oauthTokenManager.resolveProviderApiKey({
			providerId: input.config.providerId,
		});
		if (!resolved?.apiKey) {
			return input;
		}

		return {
			...input,
			config: {
				...input.config,
				apiKey: resolved.apiKey,
			},
		};
	}

	async syncCredentials(
		session: ActiveSession,
		options?: { forceRefresh?: boolean },
	): Promise<void> {
		this.logCallback?.("SYNC_CREDENTIALS", {
			enteredOAuthPipeline: true,
			enteredApiKeyPipeline: false,
			retryInvoked: false,
			authManagerInvoked: true,
		});

		let resolved: any = null;
		try {
			resolved = await this.oauthTokenManager.resolveProviderApiKey({
				providerId: session.config.providerId,
				forceRefresh: options?.forceRefresh,
			});
		} catch (error) {
			if (error instanceof OAuthReauthRequiredError) {
				throw new Error(`${error.providerId} requires re-authentication.`);
			}
			throw error;
		}
		if (!resolved?.apiKey || session.config.apiKey === resolved.apiKey) return;
		session.config.apiKey = resolved.apiKey;
		session.agent.updateConnection({ apiKey: resolved.apiKey });
		if (session.runtime) {
			session.runtime.delegatedAgentConfigProvider?.updateConnectionDefaults({
				apiKey: resolved.apiKey,
			});
			session.runtime.teamRuntime?.updateTeammateConnections({
				apiKey: resolved.apiKey,
			});
		}
	}

	async runWithRetry(
		session: ActiveSession,
		run: () => Promise<AgentResult>,
		baselineMessages: LlmsProviders.Message[],
	): Promise<AgentResult> {
		this.logCallback?.("RUN_START", {
			enteredOAuthPipeline: true,
			enteredApiKeyPipeline: false,
			retryInvoked: false,
			authManagerInvoked: false,
		});

		try {
			const res = await run();
			this.logCallback?.("RUN_SUCCESS", {
				enteredOAuthPipeline: true,
				enteredApiKeyPipeline: false,
				retryInvoked: false,
				authManagerInvoked: false,
			});
			return res;
		} catch (error) {
			const likelyAuth = isLikelyAuthError(error);
			this.logCallback?.("RUN_FAILED", {
				enteredOAuthPipeline: true,
				enteredApiKeyPipeline: false,
				retryInvoked: likelyAuth,
				authManagerInvoked: likelyAuth,
				error,
			});

			if (!likelyAuth) {
				throw error;
			}
			await this.syncCredentials(session, { forceRefresh: true });
			session.agent.restore(baselineMessages);
			return run();
		}
	}
}

export class ApiKeyStrategy implements AuthenticationStrategy {
	constructor(private readonly logCallback?: (stage: string, context: any) => void) {}

	async applyInitialCredentials(input: StartSessionInput): Promise<StartSessionInput> {
		this.logCallback?.("SESSION_START", {
			enteredOAuthPipeline: false,
			enteredApiKeyPipeline: true,
			retryInvoked: false,
			authManagerInvoked: false,
		});
		return input;
	}

	async syncCredentials(
		_session: ActiveSession,
		_options?: { forceRefresh?: boolean },
	): Promise<void> {
		this.logCallback?.("SYNC_CREDENTIALS", {
			enteredOAuthPipeline: false,
			enteredApiKeyPipeline: true,
			retryInvoked: false,
			authManagerInvoked: false,
		});
	}

	async runWithRetry(
		_session: ActiveSession,
		run: () => Promise<AgentResult>,
		_baselineMessages: LlmsProviders.Message[],
	): Promise<AgentResult> {
		this.logCallback?.("RUN_START", {
			enteredOAuthPipeline: false,
			enteredApiKeyPipeline: true,
			retryInvoked: false,
			authManagerInvoked: false,
		});

		try {
			const res = await run();
			this.logCallback?.("RUN_SUCCESS", {
				enteredOAuthPipeline: false,
				enteredApiKeyPipeline: true,
				retryInvoked: false,
				authManagerInvoked: false,
			});
			return res;
		} catch (error) {
			this.logCallback?.("RUN_FAILED", {
				enteredOAuthPipeline: false,
				enteredApiKeyPipeline: true,
				retryInvoked: false,
				authManagerInvoked: false,
				error,
			});
			throw error;
		}
	}
}
