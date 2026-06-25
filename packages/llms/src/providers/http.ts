import type { GatewayProviderSettings, BasicLogger } from "@cline/shared";

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
	init: RequestInit,
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

			// Enforce custom timeoutMs or a default of 60 seconds to prevent permanent hangs.
			const timeoutMs = requestTimeoutMs && requestTimeoutMs > 0 ? requestTimeoutMs : 60_000;
			const timeoutId = setTimeout(() => {
				controller.abort(new Error("Upstream idle timeout exceeded"));
			}, timeoutMs);

			try {
				const requestInput = input instanceof Request ? input.clone() : input;
				const response = await delegate(requestInput, { ...init, signal });
				clearTimeout(timeoutId);

				if (response.status >= 500 || retryableStatus(response.status)) {
					const isRateLimit = response.status === 429;
					const effectiveMaxRetries = isRateLimit ? Math.max(maxRetries, 15) : maxRetries;
					if (attempt >= effectiveMaxRetries) {
						return response;
					}

					const defaultMaxDelay = isRateLimit ? 30000 : maxDelayMs;
					const delay = parseRetryAfterMs(response.headers) ?? 
						Math.round(
							Math.min(baseDelayMs * Math.pow(2, attempt) * (0.8 + Math.random() * 0.4), defaultMaxDelay)
						);

					if (logger) {
						const urlStr = input instanceof Request ? input.url : String(input);
						logger.log(`[HTTP ${response.status}] Request to ${urlStr} failed. Retrying in ${delay}ms (attempt ${attempt + 1}/${effectiveMaxRetries})...`, {
							severity: "warn",
						});
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

				if (logger) {
					const urlStr = input instanceof Request ? input.url : String(input);
					logger.log(`[Network/Timeout Error] Request to ${urlStr} failed: ${error.message}. Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`, {
						severity: "warn",
					});
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
