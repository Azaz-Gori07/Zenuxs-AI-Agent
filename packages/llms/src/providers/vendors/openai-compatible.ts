import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModelV3 } from "@ai-sdk/provider";
import type {
	GatewayProviderContext,
	GatewayResolvedProviderConfig,
} from "@cline/shared";
import { wrapLanguageModel } from "ai";
import { ensureFetch, resolveApiKey } from "../http";
import { splitToolImagesMiddleware } from "../middleware/split-tool-images";
import type { ProviderFactoryResult } from "./types";

type FetchInput = Parameters<typeof fetch>[0];
type FetchWithOptionalPreconnect = typeof fetch & {
	preconnect?: (...args: unknown[]) => unknown;
};

function createAuthFetch(
	config: GatewayResolvedProviderConfig,
): typeof fetch | undefined {
	const resolver = config.apiKeyResolver;
	if (!resolver) return undefined;
	const delegate = config.fetch ?? globalThis.fetch;
	if (!delegate) return undefined;
	const providerId = config.providerId;
	const authFetch = (async (input, init) => {
		let lastResponse: Response | undefined;
		for (let attempt = 0; attempt < 10; attempt++) {
			const key = await resolver();
			const headers = new Headers(init?.headers);
			if (key) {
				headers.set("Authorization", `Bearer ${key}`);
			}
			const response = await delegate(input, { ...init, headers });
			if (
				response.status === 429 ||
				response.status === 503 ||
				response.status === 502
			) {
				lastResponse = response;
				await new Promise((r) => setTimeout(r, 1000));
				continue;
			}
			return response;
		}
		// All keys exhausted — wrap the last response body with the
		// selected provider name so the error is attributed correctly.
		try {
			const body = await lastResponse!.clone().text();
			const wrapped = body.includes(`[${providerId}]`)
				? body
				: `[${providerId}] ${body}`;
			return new Response(wrapped, {
				status: lastResponse!.status,
				statusText: lastResponse!.statusText,
				headers: lastResponse!.headers,
			});
		} catch {
			return lastResponse!;
		}
	}) as typeof fetch;
	const delegateWithPreconnect = delegate as FetchWithOptionalPreconnect;
	(authFetch as FetchWithOptionalPreconnect).preconnect =
		typeof delegateWithPreconnect.preconnect === "function"
			? delegateWithPreconnect.preconnect.bind(delegate)
			: () => undefined;
	return authFetch;
}

function readAzureApiVersion(
	config: GatewayResolvedProviderConfig,
): string | undefined {
	const apiVersion = config.options?.apiVersion;
	if (typeof apiVersion !== "string") {
		return undefined;
	}
	const trimmed = apiVersion.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function shouldAddAzureApiVersion(url: URL): boolean {
	return (
		url.pathname.startsWith("/openai/deployments/") &&
		!url.searchParams.has("api-version")
	);
}

function withAzureApiVersion(
	input: FetchInput,
	apiVersion: string,
): FetchInput {
	let url: URL;
	try {
		url = new URL(input instanceof Request ? input.url : input.toString());
	} catch {
		return input;
	}
	if (!shouldAddAzureApiVersion(url)) {
		return input;
	}
	url.searchParams.set("api-version", apiVersion);
	if (input instanceof Request) {
		return new Request(url.toString(), input);
	}
	return (typeof input === "string" ? url.toString() : url) as FetchInput;
}

function createAzureApiVersionFetch(
	config: GatewayResolvedProviderConfig,
): typeof fetch | undefined {
	const apiVersion = readAzureApiVersion(config);
	if (!apiVersion) {
		return config.fetch;
	}
	const baseFetch = config.fetch ?? globalThis.fetch;
	if (!baseFetch) {
		return config.fetch;
	}
	const azureFetch = ((input, init) =>
		baseFetch(withAzureApiVersion(input, apiVersion), init)) as typeof fetch;
	const baseFetchWithPreconnect = baseFetch as FetchWithOptionalPreconnect;
	(azureFetch as FetchWithOptionalPreconnect).preconnect =
		typeof baseFetchWithPreconnect.preconnect === "function"
			? baseFetchWithPreconnect.preconnect.bind(baseFetch)
			: () => undefined;
	return azureFetch;
}

type ResponseErrorHandler = (response: Response) => Promise<void> | void;

function readResponseErrorHandler(
	config: GatewayResolvedProviderConfig,
): ResponseErrorHandler | undefined {
	const handler = config.options?.onResponseError;
	return typeof handler === "function"
		? (handler as ResponseErrorHandler)
		: undefined;
}

function createResponseErrorFetch(input: {
	fetch: typeof fetch;
	onResponseError: ResponseErrorHandler;
}): typeof fetch {
	const responseErrorFetch = (async (requestInput, init) => {
		const response = await input.fetch(requestInput, init);

		await input.onResponseError(response);

		return response;
	}) as typeof fetch;

	const baseFetchWithPreconnect = input.fetch as FetchWithOptionalPreconnect;
	(responseErrorFetch as FetchWithOptionalPreconnect).preconnect =
		typeof baseFetchWithPreconnect.preconnect === "function"
			? baseFetchWithPreconnect.preconnect.bind(input.fetch)
			: () => undefined;
	return responseErrorFetch;
}

export async function createOpenAICompatibleProviderModule(
	config: GatewayResolvedProviderConfig,
	context: GatewayProviderContext,
): Promise<ProviderFactoryResult> {
	// When apiKeyResolver is set, resolve the key per-request via a custom
	// fetch wrapper instead of once at provider creation time. This ensures
	// round-robin/rotation works across requests (the gateway caches the
	// created provider, so a single resolution would be stuck forever).
	const { resolvedApiKey, authFetch } = config.apiKeyResolver
		? { resolvedApiKey: undefined, authFetch: createAuthFetch(config) }
		: { resolvedApiKey: await resolveApiKey(config), authFetch: undefined };
	const fetch = createAzureApiVersionFetch({ ...config, fetch: authFetch ?? config.fetch });
	const onResponseError = readResponseErrorHandler(config);
	const providerFetch = onResponseError
		? createResponseErrorFetch({
				fetch: ensureFetch(fetch),
				onResponseError,
			})
		: fetch;
	const provider = createOpenAICompatible({
		name: context.provider.id,
		apiKey: resolvedApiKey,
		...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
		...(config.headers ? { headers: config.headers } : {}),
		...(providerFetch ? { fetch: providerFetch } : {}),
		includeUsage: true,
	} as never);
	return {
		// Wrap each constructed model with `splitToolImagesMiddleware` so
		// `role:"tool"` messages whose `output.type === 'content'` carries
		// image-data parts get split into a placeholder text + a synthetic
		// `role:"user"` message carrying the images. The OpenAI Chat
		// Completions wire format does NOT support multimodal tool messages
		// (the `@ai-sdk/openai-compatible` chat-messages converter
		// `JSON.stringify`s the parts array, losing image bytes). The
		// middleware operates on the typed `LanguageModelV3Prompt` BEFORE
		// the converter runs, so the converter sees only text-only tool
		// messages with adjacent multimodal user messages — the wire
		// pattern that classic Cline used in production for years (see
		// `convertToOpenAiMessages` in `src/core/api/transform/openai-format.ts`
		// on origin/main).
		model: (modelId) =>
			wrapLanguageModel({
				model: provider(modelId) as LanguageModelV3,
				middleware: splitToolImagesMiddleware,
			}),
	};
}
