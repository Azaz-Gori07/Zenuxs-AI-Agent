import { loggerService } from "@cline/core";
import type {
	LogEntry,
	WebviewDeveloperLog,
} from "@cline/core";
import type { HubContext } from "./state";
import type { BrowserPeer } from "./types";

const subscribersByPeer = new WeakMap<
	BrowserPeer,
	() => void
>();

function toWebviewEntry(entry: LogEntry): WebviewDeveloperLog {
	return {
		id: entry.id,
		seq: entry.seq,
		timestamp: entry.timestamp,
		iso: entry.iso,
		level: entry.level,
		category: entry.category,
		message: entry.message,
		source: entry.source,
		requestId: entry.requestId,
		sessionId: entry.sessionId,
		conversationId: entry.conversationId,
		provider: entry.provider,
		model: entry.model,
		data: entry.data,
		stack: entry.stack,
		parentId: entry.parentId,
		childIds: entry.childIds,
	};
}

/**
 * Start streaming developer logs to a peer. Sends a backlog batch first, then
 * live entries as they arrive.
 */
export function attachDeveloperLogsToPeer(
	ctx: HubContext,
	peer: BrowserPeer,
): void {
	if (subscribersByPeer.has(peer)) return;

	const backlog = loggerService.getEntries();
	if (backlog.length > 0) {
		ctx.send(peer, {
			type: "developer_logs_batch",
			entries: backlog.map(toWebviewEntry),
		});
	}
	ctx.send(peer, { type: "developer_logs_state", enabled: loggerService.isEnabled() });

	const unsubscribe = loggerService.subscribe((entry) => {
		ctx.send(peer, {
			type: "developer_logs_batch",
			entries: [toWebviewEntry(entry)],
		});
	});
	subscribersByPeer.set(peer, unsubscribe);
}

export function detachDeveloperLogsFromPeer(peer: BrowserPeer): void {
	const unsubscribe = subscribersByPeer.get(peer);
	if (unsubscribe) {
		unsubscribe();
		subscribersByPeer.delete(peer);
	}
}

export function handleDeveloperLogsMessage(
	ctx: HubContext,
	peer: BrowserPeer,
	action: "subscribe" | "unsubscribe" | "clear" | "pause" | "resume",
): void {
	switch (action) {
		case "subscribe":
			attachDeveloperLogsToPeer(ctx, peer);
			break;
		case "unsubscribe":
			detachDeveloperLogsFromPeer(peer);
			break;
		case "clear":
			loggerService.clear();
			break;
		case "pause":
			loggerService.setEnabled(false);
			ctx.send(peer, { type: "developer_logs_state", enabled: false });
			break;
		case "resume":
			loggerService.setEnabled(true);
			ctx.send(peer, { type: "developer_logs_state", enabled: true });
			break;
	}
}
