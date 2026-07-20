/**
 * Developer Logs — centralized logging system for the entire application.
 *
 * The {@link LoggerService} is the single funnel through which every module
 * (authentication, providers, LLM requests, API keys, storage, UI, agents,
 * tools, conversations, extensions, streaming, networking, performance,
 * telemetry) sends structured events. Each event is timestamped,
 * session-aware, categorized, and carries an explicit log level.
 *
 * The webview "Developer Logs" dashboard subscribes to this service and
 * renders entries in real time with filtering, search, detailed inspection,
 * and export. The service keeps an in-memory ring buffer (bounded so we can
 * hold millions of entries without running the process out of memory) and can
 * additionally persist a capped backlog to disk for local inspection.
 */

export enum LogLevel {
	TRACE = "TRACE",
	DEBUG = "DEBUG",
	INFO = "INFO",
	SUCCESS = "SUCCESS",
	WARNING = "WARNING",
	ERROR = "ERROR",
	CRITICAL = "CRITICAL",
}

export const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
	[LogLevel.TRACE]: 0,
	[LogLevel.DEBUG]: 1,
	[LogLevel.INFO]: 2,
	[LogLevel.SUCCESS]: 3,
	[LogLevel.WARNING]: 4,
	[LogLevel.ERROR]: 5,
	[LogLevel.CRITICAL]: 6,
};

export const ALL_LOG_LEVELS: LogLevel[] = [
	LogLevel.TRACE,
	LogLevel.DEBUG,
	LogLevel.INFO,
	LogLevel.SUCCESS,
	LogLevel.WARNING,
	LogLevel.ERROR,
	LogLevel.CRITICAL,
];

/** Every category of event the dashboard knows how to display. */
export enum LogCategory {
	AUTH = "auth",
	PROVIDER = "provider",
	MODEL = "model",
	API_REQUEST = "api_request",
	API_RESPONSE = "api_response",
	STREAMING = "streaming",
	TOOL = "tool",
	AGENT = "agent",
	CONVERSATION = "conversation",
	PROMPT = "prompt",
	MEMORY = "memory",
	API_KEY = "api_key",
	STORAGE = "storage",
	NETWORK = "network",
	PERFORMANCE = "performance",
	EXTENSION = "extension",
	UI = "ui",
	ERROR = "error",
	CONSOLE = "console",
	INSIGHTS = "insights",
}

export const ALL_LOG_CATEGORIES: LogCategory[] = Object.values(LogCategory);

export type LogSeverity =
	| "trace"
	| "debug"
	| "info"
	| "success"
	| "warning"
	| "error"
	| "critical";

/**
 * A single structured log entry. Everything optional beyond the required
 * identity fields is meant to support the detail inspector (request/response
 * bodies, headers, timing, stack trace, parent/child trace linkage).
 */
export interface LogEntry {
	/** Stable unique id for this entry. */
	id: string;
	/** Monotonic sequence number (useful for ordering / dedup). */
	seq: number;
	/** Epoch milliseconds. */
	timestamp: number;
	/** ISO timestamp snapshot (avoids Date reconstruction on the client). */
	iso: string;
	level: LogLevel;
	category: LogCategory;
	/** Short human readable message. */
	message: string;
	/** Free-form component / module that produced the entry. */
	source?: string;
	/** Correlation ids for end-to-end tracing. */
	requestId?: string;
	sessionId?: string;
	conversationId?: string;
	provider?: string;
	model?: string;
	/** Arbitrary structured metadata surfaced in the detail panel. */
	data?: Record<string, unknown>;
	/** Stack trace for error/console.error entries. */
	stack?: string;
	/** Parent request id when this entry is a child of another trace. */
	parentId?: string;
	/** Child request ids spawned from this entry. */
	childIds?: string[];
}

export interface LoggerServiceOptions {
	/** Max entries retained in the in-memory ring buffer. */
	maxEntries?: number;
	/** When true, newly created entries are forwarded to subscribers. */
	enabled?: boolean;
	/** Path used for the on-disk log backlog (optional). */
	persistencePath?: string;
	/** Max entries persisted to disk. */
	maxPersistedEntries?: number;
}

export interface LogSubscriber {
	(entry: LogEntry): void;
}

export const DEFAULT_MAX_ENTRIES = 50_000;
export const DEFAULT_MAX_PERSISTED_ENTRIES = 10_000;

let seqCounter = 0;

function nextSeq(): number {
	seqCounter += 1;
	if (seqCounter > Number.MAX_SAFE_INTEGER - 1) seqCounter = 1;
	return seqCounter;
}

/**
 * Recursively mask secrets in arbitrary values. API keys and tokens are
 * replaced with a masked form (`sk-********************abcd`) so the dashboard
 * never renders raw credentials. Non-secret strings pass through unchanged.
 */
export function maskSecret(value: unknown): unknown {
	if (value === null || value === undefined) return value;
	if (Array.isArray(value)) {
		return value.map((item) => maskSecret(item));
	}
	if (typeof value === "object") {
		const out: Record<string, unknown> = {};
		for (const [key, val] of Object.entries(value)) {
			if (isSecretKey(key)) {
				out[key] = maskSecretString(String(val));
			} else if (typeof val === "object" && val !== null) {
				out[key] = maskSecret(val);
			} else {
				out[key] = val;
			}
		}
		return out;
	}
	return value;
}

const SECRET_KEY_PATTERNS = [
	/key/i,
	/token/i,
	/secret/i,
	/password/i,
	/passwd/i,
	/credential/i,
	/authorization/i,
	/bearer/i,
	/apikey/i,
	/auth/i,
];

function isSecretKey(key: string): boolean {
	return SECRET_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

/** Mask a single secret string, preserving a short visible suffix. */
export function maskSecretString(value: string): string {
	if (!value) return value;
	const trimmed = value.trim();
	if (trimmed.length <= 8) {
		return "****************";
	}
	// Detect a recognizable prefix (sk-, pk-, ak-, bearer, etc).
	const match = trimmed.match(/^([A-Za-z]+-)(.*)$/);
	if (match) {
		const prefix = match[1];
		const rest = match[2];
		if (rest.length <= 4) {
			return `${prefix}${"*".repeat(rest.length)}`;
		}
		const suffix = rest.slice(-4);
		return `${prefix}${"*".repeat(Math.min(20, rest.length - 4))}${suffix}`;
	}
	const suffix = trimmed.slice(-4);
	return `${"*".repeat(Math.min(20, trimmed.length - 4))}${suffix}`;
}

export class LoggerService {
	private readonly entries: LogEntry[] = [];
	private readonly subscribers = new Set<LogSubscriber>();
	private maxEntries: number;
	private enabled: boolean;
	private persistencePath?: string;
	private maxPersistedEntries: number;
	private persistenceBuffer: LogEntry[] = [];
	private persistenceTimer: ReturnType<typeof setTimeout> | undefined;

	constructor(options: LoggerServiceOptions = {}) {
		this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
		this.enabled = options.enabled ?? true;
		this.persistencePath = options.persistencePath;
		this.maxPersistedEntries =
			options.maxPersistedEntries ?? DEFAULT_MAX_PERSISTED_ENTRIES;
	}

	get bufferSize(): number {
		return this.entries.length;
	}

	isEnabled(): boolean {
		return this.enabled;
	}

	setEnabled(enabled: boolean): void {
		this.enabled = enabled;
	}

	/**
	 * Build a log entry from the provided input, append it to the ring buffer,
	 * and notify subscribers. Returns the created entry (or null when disabled).
	 */
	log(
		input: Partial<LogEntry> & {
			level: LogLevel;
			category: LogCategory;
			message: string;
		},
	): LogEntry | null {
		if (!this.enabled) return null;

		const now = Date.now();
		const seq = input.seq ?? nextSeq();
		const entry: LogEntry = {
			id: input.id ?? `${now}-${seq}`,
			seq,
			timestamp: input.timestamp ?? now,
			iso: input.iso ?? new Date(now).toISOString(),
			level: input.level,
			category: input.category,
			message: input.message,
			source: input.source,
			requestId: input.requestId,
			sessionId: input.sessionId,
			conversationId: input.conversationId,
			provider: input.provider,
			model: input.model,
			data: input.data ? (maskSecret(input.data) as Record<string, unknown>) : undefined,
			stack: input.stack,
			parentId: input.parentId,
			childIds: input.childIds,
		};

		this.entries.push(entry);
		if (this.entries.length > this.maxEntries) {
			this.entries.splice(0, this.entries.length - this.maxEntries);
		}

		this.queueForPersistence(entry);
		for (const subscriber of this.subscribers) {
			try {
				subscriber(entry);
			} catch {
				// A faulty subscriber must not break logging.
			}
		}
		return entry;
	}

	/** Convenience helpers keyed by level. */
	trace(
		category: LogCategory,
		message: string,
		input?: Partial<LogEntry>,
	): LogEntry | null {
		return this.log({ ...input, level: LogLevel.TRACE, category, message });
	}

	debug(
		category: LogCategory,
		message: string,
		input?: Partial<LogEntry>,
	): LogEntry | null {
		return this.log({ ...input, level: LogLevel.DEBUG, category, message });
	}

	info(
		category: LogCategory,
		message: string,
		input?: Partial<LogEntry>,
	): LogEntry | null {
		return this.log({ ...input, level: LogLevel.INFO, category, message });
	}

	success(
		category: LogCategory,
		message: string,
		input?: Partial<LogEntry>,
	): LogEntry | null {
		return this.log({ ...input, level: LogLevel.SUCCESS, category, message });
	}

	warn(
		category: LogCategory,
		message: string,
		input?: Partial<LogEntry>,
	): LogEntry | null {
		return this.log({ ...input, level: LogLevel.WARNING, category, message });
	}

	error(
		category: LogCategory,
		message: string,
		input?: Partial<LogEntry>,
	): LogEntry | null {
		return this.log({ ...input, level: LogLevel.ERROR, category, message });
	}

	critical(
		category: LogCategory,
		message: string,
		input?: Partial<LogEntry>,
	): LogEntry | null {
		return this.log({ ...input, level: LogLevel.CRITICAL, category, message });
	}

	/**
	 * Subscribe to live entries. The callback fires for every new entry after
	 * the subscription is registered. Returns an unsubscribe function.
	 */
	subscribe(subscriber: LogSubscriber): () => void {
		this.subscribers.add(subscriber);
		return () => {
			this.subscribers.delete(subscriber);
		};
	}

	/** Return buffered entries, optionally filtered. */
	getEntries(predicate?: (entry: LogEntry) => boolean): LogEntry[] {
		if (!predicate) return [...this.entries];
		return this.entries.filter(predicate);
	}

	/** Replay the buffered backlog to a subscriber (used on dashboard mount). */
	replay(subscriber: LogSubscriber): void {
		for (const entry of this.entries) {
			try {
				subscriber(entry);
			} catch {
				// ignore
			}
		}
	}

	/** Drop all buffered and persisted logs. */
	clear(): void {
		this.entries.length = 0;
		this.persistenceBuffer.length = 0;
		if (this.persistencePath) {
			void this.writePersistence(true);
		}
	}

	// ---------------------------------------------------------------- persistence

	private queueForPersistence(entry: LogEntry): void {
		if (!this.persistencePath) return;
		this.persistenceBuffer.push(entry);
		if (this.persistenceBuffer.length > this.maxPersistedEntries) {
			this.persistenceBuffer.splice(
				0,
				this.persistenceBuffer.length - this.maxPersistedEntries,
			);
		}
		if (this.persistenceTimer) return;
		this.persistenceTimer = setTimeout(() => {
			this.persistenceTimer = undefined;
			void this.writePersistence(false);
		}, 750);
	}

	private async writePersistence(truncate: boolean): Promise<void> {
		if (!this.persistencePath) return;
		try {
			const { writeFile, mkdir, readFile } = await import("node:fs/promises");
			const { dirname } = await import("node:path");
			await mkdir(dirname(this.persistencePath), { recursive: true });
			let buffer = this.persistenceBuffer;
			if (!truncate) {
				try {
					const existing = await readFile(this.persistencePath, "utf8");
					const parsed = JSON.parse(existing) as LogEntry[];
					if (Array.isArray(parsed)) {
						buffer = [...parsed, ...this.persistenceBuffer].slice(
							-(this.maxPersistedEntries * 2),
						);
					}
				} catch {
					// No prior file; start fresh.
				}
			}
			if (truncate) buffer = [];
			await writeFile(this.persistencePath, JSON.stringify(buffer), "utf8");
			if (truncate) this.persistenceBuffer = [];
		} catch {
			// Persistence is best-effort.
		}
	}
}

/** Shared singleton used across the entire application. */
export const loggerService = new LoggerService();
