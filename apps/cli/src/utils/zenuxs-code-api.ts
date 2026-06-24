import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DEFAULT_API_BASE = process.env.ZENUXS_CODE_API_URL?.trim() || "http://localhost:5000";

function headers(token: string): Record<string, string> {
	return {
		Authorization: `Bearer ${token}`,
		"Content-Type": "application/json",
	};
}

/**
 * Try to read provider settings from the old `.cline/data/GlobalState.json`
 * format as a fallback when the new `.zenuxs/data/settings/providers.json`
 * returns empty. This covers users who have Cline data in the legacy
 * `.cline` directory rather than the current `.zenuxs` directory.
 */
export function readLegacyClineProviders(): {
	providers: Record<string, unknown>;
	lastUsedProvider?: string;
	version?: number;
} {
	const home = homedir();
	const oldDataDir = join(home, ".cline", "data");
	const globalStatePath = join(oldDataDir, "globalState.json");
	const secretsPath = join(oldDataDir, "secrets.json");

	if (!existsSync(globalStatePath)) {
		return { providers: {} };
	}

	try {
		const globalStateRaw = readFileSync(globalStatePath, "utf8");
		const globalState = JSON.parse(globalStateRaw) as Record<string, unknown>;
		const secrets: Record<string, unknown> = existsSync(secretsPath)
			? JSON.parse(readFileSync(secretsPath, "utf8"))
			: {};

		const mode =
			(globalState.mode as string) === "plan" ? "plan" : "act";
		const activeProvider =
			(globalState[`${mode}ModeApiProvider`] as string)?.trim() || "";
		if (!activeProvider) {
			return { providers: {} };
		}

		const now = new Date().toISOString();
		const providers: Record<string, unknown> = {};

		// Collect candidate providers from active provider + secrets
		const candidates = new Set<string>([activeProvider]);

		// Also check for other providers that have API keys in secrets
		const secretProviderMap: Record<string, string> = {
			apiKey: "anthropic",
			openRouterApiKey: "openrouter",
			openAiApiKey: "openai",
			openAiNativeApiKey: "openai-native",
			geminiApiKey: "gemini",
			ollamaApiKey: "ollama",
			deepSeekApiKey: "deepseek",
			requestyApiKey: "requesty",
			togetherApiKey: "together",
			fireworksApiKey: "fireworks",
			groqApiKey: "groq",
			clineApiKey: "cline",
			"cline:clineAccountId": "cline",
			ocaApiKey: "oca",
		};
		for (const [secretKey, providerId] of Object.entries(secretProviderMap)) {
			if (secrets[secretKey] && typeof secrets[secretKey] === "string" && (secrets[secretKey] as string).trim()) {
				candidates.add(providerId);
			}
		}

		// Map legacy providerId to the model-key suffix used in GlobalState.json
		const providerModelSuffixMap: Record<string, string> = {
			anthropic: "Anthropic",
			openrouter: "OpenRouter",
			cline: "Cline",
			openai: "OpenAi",
			"openai-native": "OpenAiNative",
			ollama: "Ollama",
			lmstudio: "LmStudio",
			litellm: "LiteLlm",
			gemini: "Gemini",
			requesty: "Requesty",
			together: "Together",
			fireworks: "Fireworks",
			sapaicore: "SapAiCore",
			groq: "Groq",
			baseten: "Baseten",
			huggingface: "HuggingFace",
			deepseek: "DeepSeek",
			oca: "Oca",
			aihubmix: "Aihubmix",
			hicap: "Hicap",
			nousResearch: "NousResearch",
			"vercel-ai-gateway": "VercelAiGateway",
			nvidia: "Nvidia",
		};

		for (const providerId of candidates) {
			const suffix = providerModelSuffixMap[providerId];
			const modelKey = suffix ? `${mode}Mode${suffix}ModelId` : undefined;
			const modelId = modelKey
				? ((globalState[modelKey] as string)?.trim() || (globalState[`${mode}ModeApiModelId`] as string)?.trim())
				: (globalState[`${mode}ModeApiModelId`] as string)?.trim();
			const baseUrlKey = providerId === "openai" ? "openAiBaseUrl"
				: providerId === "anthropic" ? "anthropicBaseUrl"
				: providerId === "ollama" ? "ollamaBaseUrl"
				: providerId === "lmstudio" ? "lmStudioBaseUrl"
				: providerId === "litellm" ? "liteLlmBaseUrl"
				: providerId === "gemini" ? "geminiBaseUrl"
				: providerId === "requesty" ? "requestyBaseUrl"
				: undefined;
			const baseUrl = baseUrlKey ? (globalState[baseUrlKey] as string)?.trim() : undefined;

			const settings: Record<string, unknown> = {
				provider: providerId,
			};

			// Map legacy secret keys to provider settings
			const secretToApiKey: Record<string, string | undefined> = {
				anthropic: secrets.apiKey as string,
				cline: (secrets.clineApiKey as string) || undefined,
				openai: secrets.openAiApiKey as string,
				"openai-native": secrets.openAiNativeApiKey as string,
				openrouter: secrets.openRouterApiKey as string,
				gemini: secrets.geminiApiKey as string,
				ollama: secrets.ollamaApiKey as string,
				deepseek: secrets.deepSeekApiKey as string,
				requesty: secrets.requestyApiKey as string,
				together: secrets.togetherApiKey as string,
				fireworks: secrets.fireworksApiKey as string,
				groq: secrets.groqApiKey as string,
				oca: secrets.ocaApiKey as string,
			};
			const apiKey = secretToApiKey[providerId];
			if (apiKey) settings.apiKey = apiKey;
			if (modelId) settings.model = modelId;
			if (baseUrl) settings.baseUrl = baseUrl;

			// Handle cline auth from "cline:clineAccountId" secret
			if (providerId === "cline") {
				const rawAuth = (secrets["cline:clineAccountId"] as string)?.trim();
				if (rawAuth) {
					try {
						const authData = JSON.parse(rawAuth) as Record<string, unknown>;
						const userInfo = authData.userInfo as Record<string, unknown> | undefined;
						const expiresAt = typeof authData.expiresAt === "number"
							? (authData.expiresAt < 10_000_000_000 ? authData.expiresAt * 1000 : authData.expiresAt)
							: undefined;
						settings.auth = {
							accessToken: authData.idToken,
							refreshToken: authData.refreshToken,
							...(expiresAt ? { expiresAt } : {}),
							...(userInfo?.id ? { accountId: userInfo.id } : {}),
						};
					} catch { /* skip invalid auth */ }
				}
			}

			if (!providers[providerId]) {
				providers[providerId] = {
					settings,
					updatedAt: now,
					tokenSource: "sync",
				};
			}
		}

		return {
			providers,
			lastUsedProvider: activeProvider,
			version: 1,
		};
	} catch {
		return { providers: {} };
	}
}

function apiUrl(path: string): string {
	return `${DEFAULT_API_BASE}/api/zenuxs-code${path}`;
}

export async function registerCliClient(token: string): Promise<void> {
	if (!token) return;
	try {
		await fetch(apiUrl("/clients"), {
			method: "POST",
			headers: headers(token),
			body: JSON.stringify({
				clientId: `cli-${process.pid}`,
				displayName: `Zenuxs CLI (pid ${process.pid})`,
				clientType: "code-sidecar",
			}),
		});
	} catch {
		// best-effort
	}
}

export async function syncSessionToZenuxsCode(
	token: string,
	sessionId: string,
	data: {
		status?: string;
		title?: string;
		provider?: string;
		model?: string;
		prompt?: string;
		workspaceRoot?: string;
		cwd?: string;
	},
): Promise<void> {
	if (!token || !sessionId) return;
	try {
		await fetch(apiUrl("/sessions"), {
			method: "POST",
			headers: headers(token),
			body: JSON.stringify({ sessionId, ...data }),
		});
	} catch {
		// best-effort
	}
}

export async function updateSessionOnZenuxsCode(
	token: string,
	sessionId: string,
	updates: Record<string, unknown>,
): Promise<void> {
	if (!token || !sessionId) return;
	try {
		await fetch(apiUrl(`/sessions/${encodeURIComponent(sessionId)}`), {
			method: "PATCH",
			headers: headers(token),
			body: JSON.stringify(updates),
		});
	} catch {
		// best-effort
	}
}

export async function deleteSessionOnZenuxsCode(
	token: string,
	sessionId: string,
): Promise<void> {
	if (!token || !sessionId) return;
	try {
		await fetch(apiUrl(`/sessions/${encodeURIComponent(sessionId)}`), {
			method: "DELETE",
			headers: headers(token),
		});
	} catch {
		// best-effort
	}
}

export async function syncProvidersToZenuxsCode(
	token: string,
	providersJson: { version?: number; lastUsedProvider?: string; providers: Record<string, unknown> },
): Promise<void> {
	if (!token) return;
	if (!providersJson?.providers || typeof providersJson.providers !== "object") return;
	try {
		await fetch(apiUrl("/providers/sync"), {
			method: "POST",
			headers: headers(token),
			body: JSON.stringify({ providers: providersJson.providers }),
		});
	} catch {
		// best-effort
	}
}
