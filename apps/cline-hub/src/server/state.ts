import {
	type ClineCore,
	CORE_BUILD_VERSION,
	type HubUIClient,
} from "@cline/core";
import type { WebviewHubEvent } from "../webview-protocol";
import type {
	BrowserPeer,
	PendingToolApproval,
	SessionContext,
	TrackedClient,
	TrackedSession,
} from "./types";
import {
	apiHealth,
	apiListClients,
	apiListSessions,
	apiRegisterClient,
	apiDeleteClient,
	apiCreateSession,
	apiUpdateSession,
	apiDeleteSession,
	apiPushEvent,
	resolveApiBase,
	resolveApiToken,
} from "./zenuxs-api";

/**
 * Shared mutable runtime state for the Cline Hub server. A single instance is
 * created in `server.ts` and threaded through the feature modules.
 *
 * Persistent data (clients, sessions, events) is stored in MongoDB via the
 * zenuxs AI backend API. Only transient state (peers, pending approvals) stays
 * in memory.
 */
export class HubContext {
	readonly peers = new Set<BrowserPeer>();
	readonly pendingToolApprovals = new Map<string, PendingToolApproval>();
	readonly clients = new Map<string, TrackedClient>();
	readonly sessions = new Map<string, TrackedSession>();
	readonly events: WebviewHubEvent[] = [];

	hubUrl = "";
	hubAuthToken = "";
	hubHealthy = false;
	cline: ClineCore | undefined;
	uiClient: HubUIClient | undefined;
	hubStartedAt: string | undefined;
	coreVersion: string | undefined = CORE_BUILD_VERSION;
	lastSessionContext: SessionContext | undefined;
	initialHubEventEmitted = false;

	get apiToken(): string | undefined {
		return this._apiToken || resolveApiToken();
	}
	private _apiToken: string | undefined;

	setApiToken(token: string): void {
		this._apiToken = token;
	}

	send(peer: BrowserPeer, payload: unknown): void {
		peer.socket.send(JSON.stringify(payload));
	}

	broadcast(payload: unknown): void {
		const data = JSON.stringify(payload);
		for (const peer of this.peers) {
			peer.socket.send(data);
		}
	}

	async refreshFromApi(): Promise<void> {
		const token = this.apiToken;
		if (!token) return;

		try {
			const health = await apiHealth(token);
			this.hubHealthy = health.healthy;

			const [clientRes, sessionRes] = await Promise.all([
				apiListClients(token),
				apiListSessions(token),
			]);

			this.clients.clear();
			for (const c of clientRes.clients) {
				this.clients.set(c.clientId, {
					clientId: c.clientId,
					displayName: c.displayName,
					clientType: c.clientType,
					connectedAt: c.connectedAt,
				});
			}

			this.sessions.clear();
			for (const s of sessionRes.sessions) {
				const sid = s.sessionId as string | undefined;
				if (sid) {
					this.sessions.set(sid, s as unknown as TrackedSession);
				}
			}
		} catch (err) {
			console.warn("[HubContext] refreshFromApi failed:", err);
		}
	}

	async registerClient(body: { clientId: string; displayName?: string; clientType: string }): Promise<void> {
		const token = this.apiToken;
		if (!token) return;
		try {
			await apiRegisterClient(token, body);
		} catch (err) {
			console.warn("[HubContext] registerClient failed:", err);
		}
	}

	async deleteClient(clientId: string): Promise<void> {
		const token = this.apiToken;
		if (!token) return;
		try {
			await apiDeleteClient(token, clientId);
		} catch (err) {
			console.warn("[HubContext] deleteClient failed:", err);
		}
	}

	async createSession(body: Record<string, unknown>): Promise<void> {
		const token = this.apiToken;
		if (!token) return;
		try {
			await apiCreateSession(token, body);
		} catch (err) {
			console.warn("[HubContext] createSession failed:", err);
		}
	}

	async updateSession(sessionId: string, body: Record<string, unknown>): Promise<void> {
		const token = this.apiToken;
		if (!token) return;
		try {
			await apiUpdateSession(token, sessionId, body);
		} catch (err) {
			console.warn("[HubContext] updateSession failed:", err);
		}
	}

	async deleteSession(sessionId: string): Promise<void> {
		const token = this.apiToken;
		if (!token) return;
		try {
			await apiDeleteSession(token, sessionId);
		} catch (err) {
			console.warn("[HubContext] deleteSession failed:", err);
		}
	}

	async pushEvent(
		title: string,
		body: string,
		severity: WebviewHubEvent["severity"] = "info",
		timestamp = Date.now(),
	): Promise<void> {
		this.events.unshift({
			id: `${timestamp}-${this.events.length}-${title}`,
			title,
			body,
			severity,
			timestamp,
		});
		if (this.events.length > 30) this.events.length = 30;

		const token = this.apiToken;
		if (!token) return;
		try {
			await apiPushEvent(token, { title, body, severity });
		} catch (err) {
			console.warn("[HubContext] pushEvent api failed:", err);
		}
	}

	sendToSelectedPeers(sessionId: string, payload: unknown): void {
		for (const peer of this.peers) {
			if (peer.selectedSessionId === sessionId) {
				this.send(peer, payload);
			}
		}
	}

	hasSelectedPeer(sessionId: string): boolean {
		for (const peer of this.peers) {
			if (peer.selectedSessionId === sessionId) return true;
		}
		return false;
	}
}
