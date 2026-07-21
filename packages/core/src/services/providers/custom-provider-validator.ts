export interface CustomProviderValidationConfig {
	baseUrl: string;
	apiKey?: string;
	modelId: string;
	headers?: Record<string, string>;
	timeoutMs?: number;
}

function cleanBaseUrl(url: string): string {
	const trimmed = url.trim();
	if (!trimmed) {
		throw new Error("Invalid Base URL");
	}
	try {
		const parsed = new URL(trimmed);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			throw new Error("Invalid Base URL");
		}
		return trimmed.replace(/\/+$/, "");
	} catch {
		throw new Error("Invalid Base URL");
	}
}

/**
 * Perform end-to-end 3-step validation for Custom Provider configuration:
 * Step 1: Base URL reachability & structure
 * Step 2: API key authentication
 * Step 3: Model availability & execution readiness
 */
export async function validateCustomProviderConfig(
	config: CustomProviderValidationConfig,
): Promise<{ success: boolean; message: string; normalizedBaseUrl: string }> {
	// --- STEP 1: Validate Base URL Structure ---
	const normalizedUrl = cleanBaseUrl(config.baseUrl);
	const timeoutMs = config.timeoutMs ?? 10_000;
	const apiKey = config.apiKey?.trim();

	const authHeaders: Record<string, string> = {
		"Content-Type": "application/json",
		Accept: "application/json",
		...(config.headers ?? {}),
	};
	if (apiKey) {
		authHeaders["Authorization"] = `Bearer ${apiKey}`;
		authHeaders["api-key"] = apiKey;
	}

	const modelsUrl = `${normalizedUrl}/models`;
	const completionsUrl = `${normalizedUrl}/chat/completions`;

	let response: Response | null = null;
	try {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeoutMs);
		response = await fetch(modelsUrl, {
			method: "GET",
			headers: authHeaders,
			signal: controller.signal,
		});
		clearTimeout(timer);
	} catch {
		throw new Error("Invalid Base URL");
	}

	if (!response) {
		throw new Error("Invalid Base URL");
	}

	// --- STEP 2: Validate API Key ---
	if (response.status === 401 || response.status === 403) {
		throw new Error("Invalid API Key");
	}

	// --- STEP 3: Validate Model ---
	const modelId = config.modelId.trim();
	if (!modelId) {
		throw new Error("Invalid Model");
	}

	let modelVerified = false;

	if (response.ok) {
		try {
			const data = (await response.json()) as {
				data?: Array<{ id?: string; name?: string }>;
				models?: Array<{ id?: string; name?: string }>;
			};
			const modelList = data?.data ?? data?.models ?? [];
			if (Array.isArray(modelList)) {
				modelVerified = modelList.some(
					(m) =>
						m.id?.toLowerCase() === modelId.toLowerCase() ||
						m.name?.toLowerCase() === modelId.toLowerCase(),
				);
			}
		} catch {
			// Parsing models payload failed; fallback to completion test below
		}
	}

	if (!modelVerified) {
		try {
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), timeoutMs);
			const testCompletion = await fetch(completionsUrl, {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({
					model: modelId,
					messages: [{ role: "user", content: "ping" }],
					max_tokens: 1,
				}),
				signal: controller.signal,
			});
			clearTimeout(timer);

			if (testCompletion.status === 401 || testCompletion.status === 403) {
				throw new Error("Invalid API Key");
			}

			if (testCompletion.ok) {
				modelVerified = true;
			} else {
				const text = await testCompletion.text();
				if (
					testCompletion.status === 404 ||
					testCompletion.status === 400 ||
					text.toLowerCase().includes("model_not_found") ||
					text.toLowerCase().includes("does not exist") ||
					text.toLowerCase().includes("invalid model")
				) {
					throw new Error("Invalid Model");
				}
				// 2xx/5xx or endpoint reachability without explicit model error
				modelVerified = true;
			}
		} catch (err: any) {
			if (
				err.message === "Invalid Model" ||
				err.message === "Invalid API Key" ||
				err.message === "Invalid Base URL"
			) {
				throw err;
			}
			throw new Error("Invalid Model");
		}
	}

	if (!modelVerified) {
		throw new Error("Invalid Model");
	}

	return {
		success: true,
		message: "Custom Provider configuration validated successfully.",
		normalizedBaseUrl: normalizedUrl,
	};
}
