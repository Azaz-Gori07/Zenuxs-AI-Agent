import type * as vscode from "vscode";
import {
	getProviderAuthHandler,
	getProviderOAuthCredentialsFromSettings,
	formatProviderOAuthApiKey,
	ProviderSettingsManager,
} from "@cline/core";

export interface AuthUserInfo {
	id: string;
	email: string;
	displayName: string;
}

export interface AuthInfo {
	accessToken: string;
	refreshToken?: string;
	expiresAt?: number;
	userInfo: AuthUserInfo;
	provider: string;
}

export enum LogoutReason {
	USER_INITIATED = "user_initiated",
	CROSS_WINDOW_SYNC = "cross_window_sync",
	ERROR_RECOVERY = "error_recovery",
	UNKNOWN = "unknown",
}

export type AuthStateChangeHandler = (state: {
	authenticated: boolean;
	userInfo?: AuthUserInfo;
	provider?: string;
}) => void;

export class AuthService {
	private static instance: AuthService | null = null;

	private _secretStorage: vscode.SecretStorage | null = null;
	private _globalState: vscode.Memento | null = null;
	private _authenticated = false;
	private _authInfo: AuthInfo | null = null;
	private _refreshPromise: Promise<string | null> | null = null;
	private _authChangeHandlers = new Set<AuthStateChangeHandler>();

	private constructor() {}

	static getInstance(): AuthService {
		if (!AuthService.instance) {
			AuthService.instance = new AuthService();
		}
		return AuthService.instance;
	}

	setSecretStorage(secretStorage: vscode.SecretStorage): void {
		this._secretStorage = secretStorage;
	}

	setGlobalState(globalState: vscode.Memento): void {
		this._globalState = globalState;
	}

	get authenticated(): boolean {
		return this._authenticated;
	}

	get authInfo(): AuthInfo | null {
		return this._authInfo;
	}

	get authToken(): string | null {
		if (!this._authInfo?.accessToken) return null;
		return formatProviderOAuthApiKey(this._authInfo.provider, { access: this._authInfo.accessToken });
	}

	onAuthStateChange(handler: AuthStateChangeHandler): () => void {
		this._authChangeHandlers.add(handler);
		return () => this._authChangeHandlers.delete(handler);
	}

	notifyAuthChange(): void {
		const state = {
			authenticated: this._authenticated,
			userInfo: this._authInfo?.userInfo,
			provider: this._authInfo?.provider,
		};
		for (const handler of this._authChangeHandlers) {
			try {
				handler(state);
			} catch {
				// Handler errors are non-fatal
			}
		}
	}

	/**
	 * Update in-memory auth state after a successful login.
	 * Reads credentials from ProviderSettingsManager.
	 */
	async onLoginComplete(providerId: string): Promise<void> {
		try {
			const handler = getProviderAuthHandler(providerId);
			if (!handler) return;

			const storageId = handler.storageProviderId ?? providerId;
			const psm = new ProviderSettingsManager();
			const settings = psm.getProviderSettings(storageId);
			const credentials = getProviderOAuthCredentialsFromSettings(storageId, settings);

			if (!credentials?.access) {
				this._authenticated = false;
				this._authInfo = null;
				this.notifyAuthChange();
				return;
			}

			this._authInfo = {
				accessToken: credentials.access,
				refreshToken: credentials.refresh,
				expiresAt: credentials.expires,
				userInfo: {
					id: credentials.accountId ?? "",
					email: credentials.email ?? "",
					displayName: "",
				},
				provider: storageId,
			};
			this._authenticated = true;
			this.notifyAuthChange();
		} catch (error) {
			console.error("[AuthService] onLoginComplete error:", error);
		}
	}

	async logout(reason: LogoutReason = LogoutReason.USER_INITIATED): Promise<void> {
		try {
			if (this._authInfo?.provider) {
				const handler = getProviderAuthHandler(this._authInfo.provider);
				if (handler) {
					const storageId = handler.storageProviderId ?? this._authInfo.provider;
					const psm = new ProviderSettingsManager();
					const existing = psm.getProviderSettings(storageId);
					if (existing) {
						psm.saveProviderSettings(
							{ ...existing, auth: undefined },
							{ tokenSource: "manual" },
						);
					}
				}
			}
			this._authInfo = null;
			this._authenticated = false;
			this._refreshPromise = null;
			if (this._globalState) {
				await this._globalState.update("zenuxs.onboardingSkipped", false);
			}
			this.notifyAuthChange();
		} catch (error) {
			console.error("[AuthService] Logout error:", error);
		}
	}

	/**
	 * Restore auth state on startup by reading persisted credentials.
	 * Checks last used provider as well as registered OAuth handlers (zenuxs, cline, cline-pass).
	 */
	async restoreOnStartup(): Promise<void> {
		try {
			const psm = new ProviderSettingsManager();
			const lastUsed = psm.getLastUsedProviderSettings();
			const providersToCheck = Array.from(new Set([
				lastUsed?.provider,
				"cline",
				"zenuxs",
				"cline-pass",
			])).filter(Boolean) as string[];

			for (const providerId of providersToCheck) {
				const handler = getProviderAuthHandler(providerId);
				if (!handler) continue;

				const storageId = handler.storageProviderId ?? providerId;
				const settings = psm.getProviderSettings(storageId);
				const credentials = getProviderOAuthCredentialsFromSettings(storageId, settings);

				if (credentials?.access) {
					this._authInfo = {
						accessToken: credentials.access,
						refreshToken: credentials.refresh,
						expiresAt: credentials.expires,
						userInfo: {
							id: credentials.accountId ?? "",
							email: credentials.email ?? "",
							displayName: "",
						},
						provider: storageId,
					};
					this._authenticated = true;
					this.notifyAuthChange();
					return;
				}
			}

			this._authenticated = false;
			this._authInfo = null;
		} catch (error) {
			console.error("[AuthService] Restore error:", error);
			this._authenticated = false;
			this._authInfo = null;
		}
	}

	/**
	 * Handle an OAuth callback from a vscode:// URI redirect.
	 */
	async handleAuthCallback(authorizationCode: string, provider: string): Promise<void> {
		try {
			const handler = getProviderAuthHandler(provider);
			if (!handler) return;

			const storageId = handler.storageProviderId ?? provider;
			await this.onLoginComplete(storageId);
		} catch (error) {
			console.error("[AuthService] Auth callback error:", error);
		}
	}

	/**
	 * Get the current auth token, refreshing if needed.
	 */
	async getValidToken(): Promise<string | null> {
		if (!this._authInfo?.accessToken) return null;

		if (this._refreshPromise) {
			return this._refreshPromise;
		}

		const expiresAt = this._authInfo.expiresAt;
		if (expiresAt) {
			const bufferMs = 5 * 60 * 1000;
			if (Date.now() + bufferMs >= expiresAt) {
				this._refreshPromise = this.refreshToken();
				const result = await this._refreshPromise;
				this._refreshPromise = null;
				if (!result) return null;
				return formatProviderOAuthApiKey(this._authInfo.provider, { access: result });
			}
		}

		return formatProviderOAuthApiKey(this._authInfo.provider, { access: this._authInfo.accessToken });
	}

	private async refreshToken(): Promise<string | null> {
		if (!this._authInfo?.refreshToken) return null;

		try {
			const handler = getProviderAuthHandler(this._authInfo.provider);
			if (!handler?.refresh) return null;

			const storageId = handler.storageProviderId ?? this._authInfo.provider;
			const psm = new ProviderSettingsManager();
			const settings = psm.getProviderSettings(storageId);

			const refreshed = await handler.refresh({
				settings,
				credentials: {
					access: this._authInfo.accessToken,
					refresh: this._authInfo.refreshToken,
					expires: this._authInfo.expiresAt ?? 0,
					accountId: this._authInfo.userInfo.id,
					email: this._authInfo.userInfo.email,
				},
			});

			if (!refreshed) {
				await this.logout(LogoutReason.ERROR_RECOVERY);
				return null;
			}

			this._authInfo.accessToken = refreshed.access;
			this._authInfo.refreshToken = refreshed.refresh;
			this._authInfo.expiresAt = refreshed.expires;
			this._authenticated = true;

			this.notifyAuthChange();
			return refreshed.access;
		} catch (error) {
			console.error("[AuthService] Token refresh failed:", error);
			return null;
		}
	}
}
