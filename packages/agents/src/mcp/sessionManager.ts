import { nanoid } from "nanoid";
import type { McpSession } from "./types";

export class SessionManager {
	private sessions = new Map<string, McpSession>();
	private idleTimeoutMs = 300000; // 5 minutes

	setIdleTimeout(ms: number): void {
		this.idleTimeoutMs = ms;
	}

	createSession(serverName: string): McpSession {
		const session: McpSession = {
			sessionId: `mcp_ses_${nanoid(8)}`,
			serverName,
			createdAt: Date.now(),
			lastActivity: Date.now(),
			toolCallCount: 0,
			status: "active",
		};
		this.sessions.set(session.sessionId, session);
		return session;
	}

	getSession(sessionId: string): McpSession | undefined {
		return this.sessions.get(sessionId);
	}

	getSessionsForServer(serverName: string): McpSession[] {
		return Array.from(this.sessions.values()).filter(
			(s) => s.serverName === serverName,
		);
	}

	recordActivity(sessionId: string): void {
		const session = this.sessions.get(sessionId);
		if (session) {
			session.lastActivity = Date.now();
			session.toolCallCount++;
		}
	}

	closeSession(sessionId: string): void {
		const session = this.sessions.get(sessionId);
		if (session) {
			session.status = "closed";
		}
	}

	closeAllForServer(serverName: string): void {
		for (const session of this.sessions.values()) {
			if (session.serverName === serverName) {
				session.status = "closed";
			}
		}
	}

	pruneIdleSessions(): number {
		const now = Date.now();
		let pruned = 0;
		for (const [id, session] of this.sessions) {
			if (
				session.status === "active" &&
				now - session.lastActivity > this.idleTimeoutMs
			) {
				session.status = "idle";
				pruned++;
			}
		}
		return pruned;
	}

	getActiveSessionCount(): number {
		return Array.from(this.sessions.values()).filter(
			(s) => s.status === "active",
		).length;
	}

	getTotalSessionCount(): number {
		return this.sessions.size;
	}
}
