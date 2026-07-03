import type { GatewayProviderSettings, BasicLogger } from "@cline/shared";

const DEFAULT_STREAM_REQUEST_TIMEOUT_MS = 5 * 60_000;

/**
 * Creates a custom undici Agent with connection management settings
 * that reduce stale-connection errors ("socket connection was closed
 * unexpectedly"). Uses a short keepAliveTimeout so idle connections
 * are cleaned up before the server can close them.
 */
let _agent: unknown = undefined;
async function getOrCreateAgent(): Promise<unknown> {
	if (_agent) return _agent;
	try {
		// @ts-ignore - undici dynamically imported, fallback handled in catch
		const { Agent } = await import("undici");
		_agent = new Agent({
			pipelining: 1,
			keepAliveTimeout: 10_000,
			keepAliveMaxTimeout: 10_000,
			connections: 128,
		});
	} catch {
		_agent = null;
	}
	return _agent;
}

/**
 * Wraps `fetch` to pass a custom undici Agent as the `dispatcher`,
 * preventing connection-reuse failures with servers that close idle
 * connections aggressively (e.g. free-tier model endpoints).
 *
 * Falls back to the original fetch if undici is unavailable or if a
 * custom fetch implementation (non-native) is provided — the
 * `dispatcher` option is only meaningful for undici-based fetch.
 */
export function wrapFetchWithAgent(baseFetch?: typeof fetch): typeof fetch {
	const delegate = baseFetch ?? globalThis.fetch;
	if (!delegate || delegate !== globalThis.fetch) return (baseFetch ?? delegate) as typeof fetch;

	const wrapped = (async (input: any, init?: any) => {
		const agent = await getOrCreateAgent();
		if (!agent) return delegate(input, init);
		return delegate(input, { ...init, dispatcher: agent as any });
	}) as typeof fetch;

	return wrapped;
}

export function ensureFetch(fetchImpl?: typeof fetch): typeof fetch {
	const resolved = fetchImpl ?? globalThis.fetch;
	if (!resolved) {
		throw new Error(
			"No fetch implementation is available. Pass one in the gateway or provider config.",
		);
	}
	return resolved;
}

export async function resolveApiKey(
	settings: GatewayProviderSettings,
): Promise<string | undefined> {
	const explicitApiKey = settings.apiKey?.trim();
	if (explicitApiKey) {
		return explicitApiKey;
	}

	const resolvedApiKey = await settings.apiKeyResolver?.();
	const trimmedResolvedApiKey = resolvedApiKey?.trim();
	if (trimmedResolvedApiKey) {
		return trimmedResolvedApiKey;
	}

	for (const key of settings.apiKeyEnv ?? []) {
		const value = readEnv(key);
		if (value) {
			return value;
		}
	}

	return undefined;
}

export async function fetchJson(
	url: string,
	init: any,
	options: {
		fetch: typeof fetch;
		timeoutMs?: number;
		signal?: AbortSignal;
	},
): Promise<unknown> {
	const controller = new AbortController();
	const signal = mergeSignals(options.signal, controller.signal);
	const timeoutMs = options.timeoutMs ?? 30_000;
	const timeout =
		timeoutMs > 0
			? setTimeout(
					() => controller.abort(new Error("Request timed out")),
					timeoutMs,
				)
			: undefined;

	try {
		const response = await options.fetch(url, { ...init, signal });
		const text = await response.text();
		const payload = text ? (JSON.parse(text) as unknown) : undefined;

		if (!response.ok) {
			const message =
				typeof payload === "object" && payload && "error" in payload
					? JSON.stringify((payload as { error: unknown }).error)
					: text || `${response.status} ${response.statusText}`;
			throw new Error(`Gateway request failed: ${message}`);
		}

		return payload;
	} finally {
		if (timeout) {
			clearTimeout(timeout);
		}
	}
}

function mergeSignals(
	first: AbortSignal | undefined,
	second: AbortSignal,
): AbortSignal {
	if (!first) {
		return second;
	}

	if (first.aborted) {
		second.throwIfAborted?.();
		return first;
	}

	const controller = new AbortController();
	const abort = (event?: Event) => {
		const target = event?.target as AbortSignal | null;
		controller.abort(target?.reason);
	};

	first.addEventListener("abort", abort, { once: true });
	second.addEventListener("abort", abort, { once: true });
	return controller.signal;
}

export function compactObject<T extends Record<string, unknown>>(value: T): T {
	return Object.fromEntries(
		Object.entries(value).filter(([, entry]) => entry !== undefined),
	) as T;
}

function readEnv(key: string): string | undefined {
	const env = globalThis.process?.env;
	if (!env) {
		return undefined;
	}

	const value = env[key];
	if (typeof value !== "string") {
		return undefined;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

export function wrapFetchWithRetry(
	baseFetch?: typeof fetch,
	logger?: BasicLogger,
	maxRetries = 5,
	requestTimeoutMs?: number,
): typeof fetch {
	const delegate = baseFetch ?? globalThis.fetch;
	if (!delegate || maxRetries <= 0) {
		return baseFetch as typeof fetch;
	}

	const retryFetch = (async (input, init) => {
		const baseDelayMs = 500;
		const maxDelayMs = 10000;

		const retryableStatus = (status: number) =>
			status === 408 || status === 429 || status === 503 || status === 504 || status === 529;

		const getHeaderValue = (headers: any, name: string): string | null => {
			if (!headers) return null;
			if (typeof headers.get === "function") {
				return headers.get(name);
			}
			if (typeof headers === "object") {
				const lowerName = name.toLowerCase();
				for (const [key, val] of Object.entries(headers)) {
					if (key.toLowerCase() === lowerName) {
						return String(val);
					}
				}
			}
			return null;
		};

		const parseRetryAfterMs = (headers: any): number | undefined => {
			const rawMs = getHeaderValue(headers, "retry-after-ms");
			if (rawMs) {
				const ms = Number(rawMs);
				if (Number.isFinite(ms)) return Math.max(0, ms);
			}

			const rawSec = getHeaderValue(headers, "retry-after");
			if (!rawSec) return undefined;

			const seconds = Number(rawSec);
			if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

			const date = Date.parse(rawSec);
			if (!Number.isNaN(date)) return Math.max(0, date - Date.now());

			return undefined;
		};

		const sleep = (ms: number, signal?: AbortSignal | null) =>
			new Promise<void>((resolve, reject) => {
				if (signal?.aborted) {
					reject(signal.reason ?? new Error("Aborted"));
					return;
				}
				const onAbort = () => {
					clearTimeout(timeout);
					reject(signal?.reason ?? new Error("Aborted"));
				};
				const timeout = setTimeout(() => {
					signal?.removeEventListener("abort", onAbort);
					resolve();
				}, ms);
				signal?.addEventListener("abort", onAbort);
			});

		let attempt = 0;
		while (true) {
			const controller = new AbortController();
			const signal = init?.signal ? mergeSignals(init.signal, controller.signal) : controller.signal;

			// Long reasoning/tool streams can legitimately take more than a minute
			// before the first bytes arrive, especially through router providers.
			// Hosts can still set timeoutMs to tune this per provider.
			const timeoutMs =
				requestTimeoutMs && requestTimeoutMs > 0
					? requestTimeoutMs
					: DEFAULT_STREAM_REQUEST_TIMEOUT_MS;
			const timeoutId = setTimeout(() => {
				controller.abort(new Error("Upstream idle timeout exceeded"));
			}, timeoutMs);

			try {
				const requestInput = input instanceof Request ? input.clone() : input;
				const response = await delegate(requestInput, { ...init, signal });
				clearTimeout(timeoutId);

				if (response.status >= 500 || retryableStatus(response.status)) {
					const isRateLimit = response.status === 429;
					const effectiveMaxRetries = isRateLimit ? Math.min(maxRetries, 3) : maxRetries;
					if (attempt >= effectiveMaxRetries) {
						return response;
					}

					const defaultMaxDelay = isRateLimit ? 30000 : maxDelayMs;
					const delay = parseRetryAfterMs(response.headers) ?? 
						Math.round(
							Math.min(baseDelayMs * Math.pow(2, attempt) * (0.8 + Math.random() * 0.4), defaultMaxDelay)
						);

					const urlStr = input instanceof Request ? input.url : String(input);
					const statusText = isRateLimit ? "Rate Limited" : `HTTP ${response.status}`;
					const msg = `\n[${statusText}] Request to ${urlStr} failed. Retrying in ${(delay / 1000).toFixed(1)}s (attempt ${attempt + 1}/${effectiveMaxRetries})...\n`;

					if (logger) {
						logger.log(msg, { severity: "warn" });
					}
					if (typeof process !== "undefined" && process.stderr && process.env.NODE_ENV !== "test") {
						process.stderr.write(msg);
					}

					await sleep(delay, init?.signal);
					attempt++;
					continue;
				}
				return response;
			} catch (error: any) {
				clearTimeout(timeoutId);

				const isAbortError = error instanceof Error && error.name === "AbortError";
				const isUserAborted = init?.signal?.aborted;
				if (isAbortError && isUserAborted) {
					throw error;
				}

				if (attempt >= maxRetries) {
					throw error;
				}

				const delay = Math.round(
					Math.min(baseDelayMs * Math.pow(2, attempt) * (0.8 + Math.random() * 0.4), maxDelayMs)
				);

				const urlStr = input instanceof Request ? input.url : String(input);
				const msg = `\n[Network/Timeout Error] Request to ${urlStr} failed: ${error.message}. Retrying in ${(delay / 1000).toFixed(1)}s (attempt ${attempt + 1}/${maxRetries})...\n`;

				if (logger) {
					logger.log(msg, { severity: "warn" });
				}
				if (typeof process !== "undefined" && process.stderr && process.env.NODE_ENV !== "test") {
					process.stderr.write(msg);
				}

				await sleep(delay, init?.signal);
				attempt++;
				continue;
			}
		}
	}) as typeof fetch;

	const delegateWithPreconnect = delegate as typeof fetch & {
		preconnect?: (...args: unknown[]) => unknown;
	};
	if (typeof delegateWithPreconnect.preconnect === "function") {
		(
			retryFetch as typeof fetch & {
				preconnect?: (...args: unknown[]) => unknown;
			}
		).preconnect = delegateWithPreconnect.preconnect.bind(delegate);
	}

	return retryFetch;
}
