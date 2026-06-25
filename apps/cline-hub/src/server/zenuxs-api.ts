const DEFAULT_API_BASE = "https://aiapi.zenuxs.in";

export function resolveApiBase(): string {
	return process.env.ZENUXS_CODE_API_URL?.trim() || DEFAULT_API_BASE;
}

export function resolveApiToken(): string | undefined {
	return process.env.ZENUXS_CODE_API_TOKEN?.trim() || undefined;
}

function headers(token: string): Record<string, string> {
	return {
		Authorization: `Bearer ${token}`,
		"Content-Type": "application/json",
	};
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
	const response = await fetch(url, init);
	if (!response.ok) {
		const text = await response.text().catch(() => "");
		throw new Error(`API ${response.status}: ${text.slice(0, 200) || response.statusText}`);
	}
	return response.json() as Promise<T>;
}

// ── Clients ──────────────────────────────────────────────────────────────

export async function apiListClients(token: string): Promise<{ clients: Array<{ clientId: string; displayName?: string; clientType: string; connectedAt: number }> }> {
	return fetchJson(`${resolveApiBase()}/api/zenuxs-code/clients`, { headers: headers(token) });
}

export async function apiRegisterClient(token: string, body: { clientId: string; displayName?: string; clientType: string }): Promise<void> {
	await fetchJson(`${resolveApiBase()}/api/zenuxs-code/clients`, {
		method: "POST",
		headers: headers(token),
		body: JSON.stringify(body),
	});
}

export async function apiDeleteClient(token: string, clientId: string): Promise<void> {
	await fetchJson(`${resolveApiBase()}/api/zenuxs-code/clients/${encodeURIComponent(clientId)}`, {
		method: "DELETE",
		headers: headers(token),
	});
}

// ── Sessions ─────────────────────────────────────────────────────────────

export async function apiListSessions(token: string): Promise<{ sessions: Array<Record<string, unknown>> }> {
	return fetchJson(`${resolveApiBase()}/api/zenuxs-code/sessions`, { headers: headers(token) });
}

export async function apiCreateSession(token: string, body: Record<string, unknown>): Promise<{ session: Record<string, unknown> }> {
	return fetchJson(`${resolveApiBase()}/api/zenuxs-code/sessions`, {
		method: "POST",
		headers: headers(token),
		body: JSON.stringify(body),
	});
}

export async function apiUpdateSession(token: string, sessionId: string, body: Record<string, unknown>): Promise<{ session: Record<string, unknown> }> {
	return fetchJson(`${resolveApiBase()}/api/zenuxs-code/sessions/${encodeURIComponent(sessionId)}`, {
		method: "PATCH",
		headers: headers(token),
		body: JSON.stringify(body),
	});
}

export async function apiDeleteSession(token: string, sessionId: string): Promise<void> {
	await fetchJson(`${resolveApiBase()}/api/zenuxs-code/sessions/${encodeURIComponent(sessionId)}`, {
		method: "DELETE",
		headers: headers(token),
	});
}

// ── Events ───────────────────────────────────────────────────────────────

export async function apiPushEvent(token: string, body: { title: string; body?: string; severity?: string }): Promise<void> {
	await fetchJson(`${resolveApiBase()}/api/zenuxs-code/events`, {
		method: "POST",
		headers: headers(token),
		body: JSON.stringify(body),
	});
}

// ── MCP Servers ──────────────────────────────────────────────────────────

export async function apiListMCP(token: string): Promise<{ servers: Array<Record<string, unknown>> }> {
	return fetchJson(`${resolveApiBase()}/api/zenuxs-code/mcp/servers`, { headers: headers(token) });
}

export async function apiUpsertMCP(token: string, body: Record<string, unknown>): Promise<{ server: Record<string, unknown> }> {
	return fetchJson(`${resolveApiBase()}/api/zenuxs-code/mcp/servers`, {
		method: "POST",
		headers: headers(token),
		body: JSON.stringify(body),
	});
}

export async function apiDeleteMCP(token: string, name: string): Promise<void> {
	await fetchJson(`${resolveApiBase()}/api/zenuxs-code/mcp/servers/${encodeURIComponent(name)}`, {
		method: "DELETE",
		headers: headers(token),
	});
}

export async function apiHealth(token: string): Promise<{ connected: boolean; healthy: boolean; sessions: number; clients: number }> {
	return fetchJson(`${resolveApiBase()}/api/zenuxs-code/health`, { headers: headers(token) });
}
