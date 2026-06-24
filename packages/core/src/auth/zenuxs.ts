import type { ITelemetryService } from "@cline/shared";
import type { OAuthCredentials, OAuthLoginCallbacks } from "./types";
import { getProofKey } from "./utils";
import { startLocalOAuthServer, type LocalOAuthServer } from "./server";

function getAuthServerUrl(): string {
	if (typeof process !== "undefined" && process.env?.ZENUXS_AUTH_URL?.trim()) {
		return process.env.ZENUXS_AUTH_URL.trim().replace(/\/+$/, "");
	}
	return "https://api.auth.zenuxs.in";
}

function getClientId(): string {
	if (typeof process !== "undefined" && process.env?.ZENUXS_CLIENT_ID?.trim()) {
		return process.env.ZENUXS_CLIENT_ID.trim();
	}
	return "6f8764d705aa9541";
}
const LOCAL_CALLBACK_PORTS = [48821, 48822, 48823, 48824, 48825];
const CALLBACK_PATH = "/oauth/callback";
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

export interface ZenuxsAuthOptions {
	apiBaseUrl?: string;
	telemetry?: ITelemetryService;
}

function decodeJwtExpiry(token: string): number | null {
	try {
		const payload = token.split(".")[1];
		if (!payload) return null;
		const decoded = JSON.parse(atob(payload));
		return decoded.exp ? decoded.exp * 1000 : null;
	} catch {
		return null;
	}
}

function getApiBaseUrl(inputBaseUrl?: string): string {
	const url = inputBaseUrl?.trim();
	if (url) return url.replace(/\/+$/, "");
	if (typeof process !== "undefined" && process.env?.ZENUXS_API_URL?.trim()) {
		return process.env.ZENUXS_API_URL.trim().replace(/\/+$/, "");
	}
	return "http://localhost:5000";
}

export async function loginZenuxsAuth(
	options: ZenuxsAuthOptions & { callbacks: OAuthLoginCallbacks },
): Promise<OAuthCredentials> {
	const { callbacks } = options;
	const aiApiUrl = getApiBaseUrl(options.apiBaseUrl);

	// 1. Generate PKCE challenge
	const { verifier, challenge } = await getProofKey();
	const state = crypto.randomUUID();

	// 2. Start local OAuth callback server
	callbacks.onProgress?.("Starting OAuth callback server...");

	const server: LocalOAuthServer = await startLocalOAuthServer({
		ports: LOCAL_CALLBACK_PORTS,
		callbackPath: CALLBACK_PATH,
		expectedState: state,
		onListening: (info) => {
			callbacks.onServerListening?.(info);
		},
		onClose: (info) => {
			callbacks.onServerClose?.(info);
		},
	});

	if (!server.callbackUrl) {
		throw new Error("Failed to start local OAuth server");
	}

	// 3. Build the authorization URL
	const authUrl = getAuthServerUrl();
	const authorizeUrl = new URL(`${authUrl}/oauth/authorize`);
	authorizeUrl.searchParams.set("client_id", getClientId());
	authorizeUrl.searchParams.set("redirect_uri", server.callbackUrl);
	authorizeUrl.searchParams.set("response_type", "code");
	authorizeUrl.searchParams.set("scope", "openid profile email");
	authorizeUrl.searchParams.set("state", state);
	authorizeUrl.searchParams.set("nonce", crypto.randomUUID());
	authorizeUrl.searchParams.set("code_challenge", challenge);
	authorizeUrl.searchParams.set("code_challenge_method", "S256");

	// 4. Open browser for user to authenticate
	callbacks.onAuth({
		url: authorizeUrl.toString(),
		instructions:
			"Complete authentication in your browser, then return to this terminal.",
	});

	// 5. Wait for the OAuth callback
	const callbackResult = await server.waitForCallback();

	if (!callbackResult?.code) {
		const errorMsg = callbackResult?.error
			? `Authentication failed: ${callbackResult.error}`
			: "Authentication timed out or was cancelled";
		throw new Error(errorMsg);
	}

	callbacks.onProgress?.("Exchanging authorization code for tokens...");

	// 6. Exchange the authorization code for tokens
	const tokenUrl = `${getAuthServerUrl()}/oauth/token`;
	const tokenResponse = await fetch(tokenUrl, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			grant_type: "authorization_code",
			code: callbackResult.code,
			redirect_uri: server.callbackUrl,
			client_id: getClientId(),
			code_verifier: verifier,
		}),
	});

	if (!tokenResponse.ok) {
		const text = await tokenResponse.text();
		throw new Error(`Token exchange failed: ${text}`);
	}

	const tokens = (await tokenResponse.json()) as {
		access_token?: string;
		refresh_token?: string;
		expires_in?: number;
		id_token?: string;
	};
	const oauthAccessToken = tokens.access_token;
	const oauthRefreshToken = tokens.refresh_token;

	if (!oauthAccessToken) {
		throw new Error("No access token received");
	}

	callbacks.onProgress?.("Fetching user profile...");

	// 7. Fetch user info to get email/name
	let userEmail = "";
	let userName = "";
	try {
		const userinfoUrl = `${getAuthServerUrl()}/oauth/userinfo`;
		const userinfoRes = await fetch(userinfoUrl, {
			headers: { Authorization: `Bearer ${oauthAccessToken}` },
		});
		if (userinfoRes.ok) {
			const profile = (await userinfoRes.json()) as {
				email?: string;
				name?: string;
				preferred_username?: string;
				sub?: string;
			};
			userEmail = profile.email || "";
			userName = profile.name || profile.preferred_username || profile.sub || "";
		}
	} catch {}

	// 8. Exchange OAuth access token for app JWT via the AI backend
	callbacks.onProgress?.("Exchanging OAuth token for session...");

	const loginResponse = await fetch(`${aiApiUrl}/api/auth/oauth/login`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ accessToken: oauthAccessToken }),
	});

	let appJwt: string;
	let appUserId: string;

	if (loginResponse.ok) {
		const loginData = (await loginResponse.json()) as {
			success: boolean;
			token?: string;
			user?: { _id?: string; name?: string; email?: string };
		};
		if (loginData.success && loginData.token) {
			appJwt = loginData.token;
			appUserId = loginData.user?._id || "";
			userEmail = userEmail || loginData.user?.email || "";
			userName = userName || loginData.user?.name || "";
		} else {
			// Fall back to using the OAuth access token directly
			appJwt = oauthAccessToken;
			appUserId = "";
		}
	} else {
		// Fall back to using the OAuth access token directly
		appJwt = oauthAccessToken;
		appUserId = "";
	}

	const expiresIn = tokens.expires_in ? tokens.expires_in * 1000 : 3600 * 1000;
	const expires = decodeJwtExpiry(appJwt) ?? Date.now() + expiresIn;

	callbacks.onProgress?.("Authentication successful");

	return {
		access: appJwt,
		refresh: oauthRefreshToken || appJwt,
		expires,
		accountId: appUserId,
		email: userEmail,
		metadata: {
			name: userName,
			userId: appUserId,
		},
	};
}

export async function refreshZenuxsAuth(
	credentials: OAuthCredentials,
	options?: { forceRefresh?: boolean; telemetry?: ITelemetryService },
): Promise<OAuthCredentials | null> {
	if (!options?.forceRefresh && credentials.expires > Date.now() + REFRESH_BUFFER_MS) {
		return credentials;
	}

		// Try refreshing with the OAuth refresh token
	if (credentials.refresh && credentials.refresh !== credentials.access) {
		try {
			const tokenUrl = `${getAuthServerUrl()}/oauth/token`;
			const tokenResponse = await fetch(tokenUrl, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					grant_type: "refresh_token",
					refresh_token: credentials.refresh,
					client_id: getClientId(),
				}),
			});

			if (tokenResponse.ok) {
				const tokens = (await tokenResponse.json()) as {
					access_token?: string;
					refresh_token?: string;
					expires_in?: number;
				};
				if (tokens.access_token) {
					const newExpiry = tokens.expires_in
						? Date.now() + tokens.expires_in * 1000
						: credentials.expires;
					return {
						...credentials,
						access: tokens.access_token,
						refresh: tokens.refresh_token || credentials.refresh,
						expires: newExpiry,
					};
				}
			}
		} catch {}
	}

	// Fall back: check if the current app JWT is still valid
	try {
		const baseUrl = getApiBaseUrl();
		const response = await fetch(`${baseUrl}/api/auth/me`, {
			headers: { Authorization: `Bearer ${credentials.access}` },
		});
		if (response.ok) {
			const expires = decodeJwtExpiry(credentials.access);
			if (expires && expires > Date.now()) {
				return { ...credentials, expires };
			}
		}
	} catch {}

	return null;
}

export async function getValidZenuxsCredentials(
	credentials: OAuthCredentials,
	options?: { forceRefresh?: boolean; telemetry?: ITelemetryService },
): Promise<OAuthCredentials> {
	if (!options?.forceRefresh && credentials.expires > Date.now() + REFRESH_BUFFER_MS) {
		return credentials;
	}

	const refreshed = await refreshZenuxsAuth(credentials, options);
	if (refreshed) return refreshed;

	throw new Error(
		"Zenuxs AI session expired. Please re-authenticate by running: zenuxs auth -p zenuxs",
	);
}
