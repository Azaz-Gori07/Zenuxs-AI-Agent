import type {
	WebviewDeveloperLog,
	WebviewDeveloperLogCategory,
	WebviewDeveloperLogLevel,
	WebviewOutboundMessage,
} from "../../../../webview-protocol";
import { postToHost } from "../vscode";

export type DeveloperLog = WebviewDeveloperLog;
export type DeveloperLogLevel = WebviewDeveloperLogLevel;
export type DeveloperLogCategory = WebviewDeveloperLogCategory;

export { LogLevel, LogCategory } from "@cline/core";
export type { LogEntry } from "@cline/core";

/** Soft cap on entries held in the browser to stay memory safe. */
const MAX_CLIENT_ENTRIES = 200_000;
/** Flush incoming entries to React at most this often (batched rendering). */
const FLUSH_INTERVAL_MS = 120;

type Listener = () => void;

/**
 * Client-side store for developer logs.
 *
 * Subscribes to the hub server's `developer_logs_batch` stream, coalesces
 * inbound entries into a single per-frame flush (batched rendering), and
 * exposes snapshot + subscription APIs consumed by the React dashboard.
 */
class DeveloperLogStore {
	private entries: DeveloperLog[] = [];
	private readonly listeners = new Set<Listener>();
	private pending: DeveloperLog[] = [];
	private flushTimer: ReturnType<typeof setTimeout> | undefined;
	private connected = false;
	private paused = false;
	private seq = 0;
	private version = 0;

	constructor() {
		if (typeof window !== "undefined") {
			window.addEventListener("message", this.onMessage);
		}
	}

	private onMessage = (event: MessageEvent<WebviewOutboundMessage>) => {
		const message = event.data;
		if (!message || typeof message !== "object") return;
		if (message.type === "developer_logs_batch") {
			this.enqueue(message.entries);
		} else if (message.type === "developer_logs_state") {
			this.paused = !message.enabled;
			this.emit();
		}
	};

	private enqueue(entries: DeveloperLog[]) {
		if (entries.length === 0) return;
		this.pending.push(...entries);
		if (this.flushTimer) return;
		this.flushTimer = setTimeout(() => {
			this.flushTimer = undefined;
			this.flush();
		}, FLUSH_INTERVAL_MS);
	}

	private flush() {
		if (this.pending.length === 0) return;
		const incoming = this.pending;
		this.pending = [];
		this.entries.push(...incoming);
		if (this.entries.length > MAX_CLIENT_ENTRIES) {
			this.entries.splice(0, this.entries.length - MAX_CLIENT_ENTRIES);
		}
		this.version += 1;
		this.emit();
	}

	private emit() {
		for (const listener of this.listeners) {
			try {
				listener();
			} catch {
				// ignore
			}
		}
	}

	/** Open the subscription with the hub server. */
	connect() {
		if (this.connected) return;
		this.connected = true;
		postToHost({ type: "developer_logs", action: "subscribe" });
	}

	/** Tear down the subscription. */
	disconnect() {
		if (!this.connected) return;
		this.connected = false;
		postToHost({ type: "developer_logs", action: "unsubscribe" });
	}

	getVersion() {
		return this.version;
	}

	getEntries(): DeveloperLog[] {
		return this.entries;
	}

	isPaused() {
		return this.paused;
	}

	getCount() {
		return this.entries.length;
	}

	clear() {
		this.entries = [];
		this.pending = [];
		if (this.flushTimer) {
			clearTimeout(this.flushTimer);
			this.flushTimer = undefined;
		}
		this.version += 1;
		postToHost({ type: "developer_logs", action: "clear" });
		this.emit();
	}

	pause() {
		this.paused = true;
		postToHost({ type: "developer_logs", action: "pause" });
		this.emit();
	}

	resume() {
		this.paused = false;
		postToHost({ type: "developer_logs", action: "resume" });
		this.emit();
	}

	subscribe(listener: Listener): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}
}

export const developerLogStore = new DeveloperLogStore();
