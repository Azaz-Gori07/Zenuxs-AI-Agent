import { ProviderSettingsManager, getProviderOAuthCredentialsFromSettings } from "@cline/core";

const DEFAULT_API_BASE = process.env.ZENUXS_CODE_API_URL?.trim() || "https://aiapi.zenuxs.in";

function headers(token: string): Record<string, string> {
	return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function resolveToken(): Promise<string | undefined> {
	try {
		const psm = new ProviderSettingsManager();
		return (
			getProviderOAuthCredentialsFromSettings("zenuxs", psm.getProviderSettings("zenuxs") ?? {} as never)?.access
			|| getProviderOAuthCredentialsFromSettings("cline", psm.getProviderSettings("cline") ?? {} as never)?.access
			|| undefined
		);
	} catch { return undefined; }
}

function extractText(content: unknown): string {
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		return content.map((p) => (typeof p === "object" && p && "text" in p ? String(p.text) : "")).filter(Boolean).join("");
	}
	return "";
}

export async function syncSessionConversation(
	sessionId: string,
	messages: readonly { role: string; content: unknown }[],
	workspaceRoot?: string,
	existingConversationId?: string,
): Promise<string | undefined> {
	const token = await resolveToken();
	if (!token) { console.warn("[zenuxs-sync] no token"); return; }
	if (!sessionId) { console.warn("[zenuxs-sync] no sessionId"); return; }
	if (messages.length === 0) { console.warn("[zenuxs-sync] no messages"); return; }
	try {
		const syncMessages = messages.map((m) => ({
			role: m.role === "user" || m.role === "assistant" ? m.role : "user",
			content: extractText(m.content),
		})).filter((m) => m.content.trim());

		console.warn(`[zenuxs-sync] ${messages.length} raw msgs -> ${syncMessages.length} syncable`);
		if (syncMessages.length === 0) return;

		const base = DEFAULT_API_BASE;
		const url = existingConversationId
			? `${base}/api/sync/conversations/${existingConversationId}`
			: `${base}/api/sync/conversations`;
		const res = await fetch(url, {
			method: existingConversationId ? "PUT" : "POST",
			headers: headers(token),
			body: JSON.stringify({
				conversationId: existingConversationId,
				title: syncMessages[0]?.content?.slice(0, 50) || "CLI Session",
				messages: syncMessages,
				workspaceRoot: workspaceRoot || "",
			}),
		});
		console.warn(`[zenuxs-sync] POST /api/sync/conversations -> ${res.status}`);
		if (!res.ok) {
			const body = await res.text().catch(() => "");
			console.warn(`[zenuxs-sync] response body: ${body}`);
			return existingConversationId;
		}
		const data = await res.json();
		return data.conversation?._id || data.conversation?.id || existingConversationId;
	} catch (err) {
		console.warn("[zenuxs-sync] sync error:", err);
		return existingConversationId;
	}
}

export async function checkPendingMessages(
	conversationId: string,
): Promise<{ _id: string; content: string }[]> {
	const token = await resolveToken();
	if (!token) { console.warn("[zenuxs-sync] no token"); return []; }
	try {
		const base = DEFAULT_API_BASE;
		const res = await fetch(`${base}/api/sync/conversations/${conversationId}/pending`, {
			headers: headers(token),
		});
		if (!res.ok) return [];
		const data = await res.json();
		return (data.pendingMessages || []).filter((m: any) => !m.delivered);
	} catch { return []; }
}

export async function deliverPendingMessages(
	conversationId: string,
	messageIds?: string[],
): Promise<void> {
	const token = await resolveToken();
	if (!token) return;
	try {
		const base = DEFAULT_API_BASE;
		await fetch(`${base}/api/sync/conversations/${conversationId}/pending/deliver`, {
			method: "POST",
			headers: headers(token),
			body: JSON.stringify({ messageIds: messageIds || [] }),
		});
	} catch {}
}
