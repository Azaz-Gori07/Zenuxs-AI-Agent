const DEFAULT_API_BASE_URL = "https://aiapi.zenuxs.in";

function getApiBaseUrl(inputBaseUrl?: string): string {
	const url = inputBaseUrl?.trim();
	if (url) return url.replace(/\/+$/, "");
	if (typeof process !== "undefined" && process.env?.ZENUXS_API_URL?.trim()) {
		return process.env.ZENUXS_API_URL.trim().replace(/\/+$/, "");
	}
	return DEFAULT_API_BASE_URL;
}

interface ZenuxsMemoryEntry {
	key: string;
	content: string;
	pinned: boolean;
}

interface ZenuxsMemoryResponse {
	success: boolean;
	memory: {
		personalityMinimal: string;
		personalityDetailed: string;
		categories: string[];
		categoryMemories: Record<string, ZenuxsMemoryEntry[]>;
	};
}

export interface ZenuxsMemoryContext {
	/** Raw block to inject into system prompt, or empty string if no memory */
	promptBlock: string;
	personalityMinimal: string;
	personalityDetailed: string;
	hasMemories: boolean;
}

/**
 * Fetch user memory from the Zenuxs AI backend and format for system prompt injection.
 */
export async function fetchZenuxsMemory(
	authToken: string,
	options?: { apiBaseUrl?: string },
): Promise<ZenuxsMemoryContext> {
	const token = typeof authToken === "string" ? authToken.trim() : "";
	const baseUrl = getApiBaseUrl(options?.apiBaseUrl);
	const url = `${baseUrl}/api/sync/memory`;

	if (!token) {
		console.warn("[ZenuxsMemory] Request skipped", {
			endpoint: url,
			httpStatus: 0,
			responseBody: "",
			requestId: "none",
			authStatus: "missing_token",
			failureReason: "No auth token provided",
		});
		return emptyContext();
	}

	try {
		const response = await fetch(url, {
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
		});

		if (!response.ok) {
			const errorBody = await response.text().catch(() => "");
			const requestId =
				response.headers.get("x-request-id") ||
				response.headers.get("request-id") ||
				"unknown";
			console.warn("[ZenuxsMemory] Request failed", {
				endpoint: url,
				httpStatus: response.status,
				responseBody: errorBody,
				requestId,
				authStatus: response.status === 401 ? "unauthorized" : "authenticated",
				failureReason:
					response.status === 401
						? "Invalid, expired, or rejected Bearer token"
						: response.statusText || `HTTP ${response.status}`,
			});
			return emptyContext();
		}

		const data = (await response.json()) as ZenuxsMemoryResponse;
		if (!data.success || !data.memory) {
			return emptyContext();
		}

		const { memory } = data;
		const lines: string[] = [];

		if (memory.personalityMinimal) {
			lines.push(`Personality: ${memory.personalityMinimal}`);
		}

		if (memory.personalityDetailed) {
			// Include detailed personality only if it adds value beyond minimal
			if (
				!memory.personalityMinimal ||
				!memory.personalityDetailed.includes(memory.personalityMinimal)
			) {
				lines.push(`Detailed Profile: ${memory.personalityDetailed}`);
			}
		}

		if (memory.categoryMemories && Object.keys(memory.categoryMemories).length > 0) {
			lines.push("");
			lines.push("User Memories:");
			for (const [category, entries] of Object.entries(memory.categoryMemories)) {
				const facts = entries.map((e) => {
					const prefix = e.pinned ? "[PINNED] " : "";
					return `${prefix}${e.key ? `${e.key}: ` : ""}${e.content}`;
				});
				lines.push(`  [${category}] ${facts.join("; ")}`);
			}
		}

		const promptBlock = lines.length > 0
			? `\n\n[User Context from Zenuxs AI]\n${lines.join("\n")}`
			: "";

		return {
			promptBlock,
			personalityMinimal: memory.personalityMinimal || "",
			personalityDetailed: memory.personalityDetailed || "",
			hasMemories: lines.length > 0,
		};
	} catch (err) {
		console.warn("[ZenuxsMemory] Request error", {
			endpoint: url,
			httpStatus: 0,
			responseBody: "",
			requestId: "unknown",
			authStatus: "unknown",
			failureReason: err instanceof Error ? err.message : String(err),
		});
		return emptyContext();
	}
}

function emptyContext(): ZenuxsMemoryContext {
	return {
		promptBlock: "",
		personalityMinimal: "",
		personalityDetailed: "",
		hasMemories: false,
	};
}
