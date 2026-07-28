const DEFAULT_API_BASE_URL = "https://aiapi.zenuxs.in";

function getApiBaseUrl(inputBaseUrl?: string): string {
	const url = inputBaseUrl?.trim();
	if (url) return url.replace(/\/+$/, "");
	if (typeof process !== "undefined" && process.env?.ZENUXS_API_URL?.trim()) {
		return process.env.ZENUXS_API_URL.trim().replace(/\/+$/, "");
	}
	return DEFAULT_API_BASE_URL;
}

interface SyncMessage {
	role: "user" | "assistant";
	content: string;
	model?: string;
}

interface ConversationResult {
	success: boolean;
	conversation?: { _id: string };
}

interface MessagesResult {
	success: boolean;
}

export async function createRemoteConversation(
	authToken: string,
	options?: {
		title?: string;
		messages?: SyncMessage[];
		apiBaseUrl?: string;
	},
): Promise<string | null> {
	const token = typeof authToken === "string" ? authToken.trim() : "";
	const baseUrl = getApiBaseUrl(options?.apiBaseUrl);
	const url = `${baseUrl}/api/sync/conversations`;

	if (!token) {
		console.warn("[ZenuxsSync] Request skipped", {
			endpoint: url,
			httpStatus: 0,
			responseBody: "",
			requestId: "none",
			authStatus: "missing_token",
			failureReason: "No auth token provided for conversation creation",
		});
		return null;
	}

	try {
		const response = await fetch(url, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				title: options?.title || "Zenuxs Code Session",
				messages: options?.messages || [],
			}),
		});

		if (!response.ok) {
			const errorBody = await response.text().catch(() => "");
			const requestId =
				response.headers.get("x-request-id") ||
				response.headers.get("request-id") ||
				"unknown";
			console.warn("[ZenuxsSync] Failed to create conversation", {
				endpoint: url,
				httpStatus: response.status,
				responseBody: errorBody,
				requestId,
				authStatus: response.status === 401 ? "unauthorized" : "authenticated",
				failureReason:
					response.status === 401
						? "Invalid or expired Bearer token"
						: response.statusText || `HTTP ${response.status}`,
			});
			return null;
		}

		const data = (await response.json()) as ConversationResult;
		if (data.success && data.conversation?._id) {
			return data.conversation._id;
		}
		return null;
	} catch (err) {
		console.warn("[ZenuxsSync] Error creating conversation", {
			endpoint: url,
			httpStatus: 0,
			responseBody: "",
			requestId: "unknown",
			authStatus: "unknown",
			failureReason: err instanceof Error ? err.message : String(err),
		});
		return null;
	}
}

export async function addRemoteMessages(
	authToken: string,
	remoteConvId: string,
	messages: SyncMessage[],
	options?: { apiBaseUrl?: string },
): Promise<boolean> {
	const token = typeof authToken === "string" ? authToken.trim() : "";
	const convId = typeof remoteConvId === "string" ? remoteConvId.trim() : "";
	const baseUrl = getApiBaseUrl(options?.apiBaseUrl);

	if (!convId) {
		console.warn("[ZenuxsSync] Request skipped: missing remoteConvId");
		return false;
	}

	const url = `${baseUrl}/api/sync/conversations/${encodeURIComponent(convId)}/messages`;

	if (!token) {
		console.warn("[ZenuxsSync] Request skipped", {
			endpoint: url,
			httpStatus: 0,
			responseBody: "",
			requestId: "none",
			authStatus: "missing_token",
			failureReason: "No auth token provided for pushing messages",
		});
		return false;
	}

	try {
		const response = await fetch(url, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ messages: messages || [] }),
		});

		if (!response.ok) {
			const errorBody = await response.text().catch(() => "");
			const requestId =
				response.headers.get("x-request-id") ||
				response.headers.get("request-id") ||
				"unknown";
			console.warn("[ZenuxsSync] Failed to push messages", {
				endpoint: url,
				httpStatus: response.status,
				responseBody: errorBody,
				requestId,
				authStatus: response.status === 401 ? "unauthorized" : "authenticated",
				failureReason:
					response.status === 401
						? "Invalid or expired Bearer token"
						: response.statusText || `HTTP ${response.status}`,
			});
			return false;
		}

		const data = (await response.json()) as MessagesResult;
		return Boolean(data.success);
	} catch (err) {
		console.warn("[ZenuxsSync] Error pushing messages", {
			endpoint: url,
			httpStatus: 0,
			responseBody: "",
			requestId: "unknown",
			authStatus: "unknown",
			failureReason: err instanceof Error ? err.message : String(err),
		});
		return false;
	}
}

function toSyncMessage(msg: { role: string; content: string | unknown[] }): SyncMessage {
	if (!msg) {
		return { role: "user", content: "" };
	}
	const role = msg.role === "user" || msg.role === "assistant" ? msg.role : "user";
	let content = "";
	if (typeof msg.content === "string") {
		content = msg.content;
	} else if (Array.isArray(msg.content)) {
		content = msg.content
			.map((p) =>
				p && typeof p === "object" && "text" in p && typeof p.text === "string"
					? p.text
					: "",
			)
			.filter(Boolean)
			.join("");
	} else if (msg.content !== undefined && msg.content !== null) {
		try {
			content = JSON.stringify(msg.content);
		} catch {
			content = "";
		}
	}
	return { role, content };
}

export function messagesToSyncMessages(
	messages: readonly { role: string; content: string | unknown[] }[],
): SyncMessage[] {
	if (!Array.isArray(messages)) return [];
	return messages.map(toSyncMessage);
}
