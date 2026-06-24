const DEFAULT_API_BASE_URL = "http://localhost:5000";

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
	const baseUrl = getApiBaseUrl(options?.apiBaseUrl);
	const url = `${baseUrl}/api/sync/conversations`;

	try {
		const response = await fetch(url, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				title: options?.title || "Zenuxs Code Session",
				messages: options?.messages || [],
			}),
		});

		if (!response.ok) {
			console.warn(`[ZenuxsSync] Failed to create conversation: ${response.status}`);
			return null;
		}

		const data = (await response.json()) as ConversationResult;
		if (data.success && data.conversation?._id) {
			return data.conversation._id;
		}
		return null;
	} catch (err) {
		console.warn(`[ZenuxsSync] Error creating conversation:`, err);
		return null;
	}
}

export async function addRemoteMessages(
	authToken: string,
	remoteConvId: string,
	messages: SyncMessage[],
	options?: { apiBaseUrl?: string },
): Promise<boolean> {
	const baseUrl = getApiBaseUrl(options?.apiBaseUrl);
	const url = `${baseUrl}/api/sync/conversations/${encodeURIComponent(remoteConvId)}/messages`;

	try {
		const response = await fetch(url, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ messages }),
		});

		if (!response.ok) {
			console.warn(`[ZenuxsSync] Failed to push messages: ${response.status}`);
			return false;
		}

		const data = (await response.json()) as MessagesResult;
		return data.success;
	} catch (err) {
		console.warn(`[ZenuxsSync] Error pushing messages:`, err);
		return false;
	}
}

function toSyncMessage(msg: { role: string; content: string | unknown[] }): SyncMessage {
	return {
		role: msg.role === "user" || msg.role === "assistant" ? msg.role : "user",
		content: typeof msg.content === "string"
			? msg.content
			: Array.isArray(msg.content)
				? msg.content
						.map((p) => (p as { type?: string; text?: string }).text || "")
						.filter(Boolean)
						.join("")
				: JSON.stringify(msg.content),
	};
}

export function messagesToSyncMessages(
	messages: readonly { role: string; content: string | unknown[] }[],
): SyncMessage[] {
	return messages.map(toSyncMessage);
}
