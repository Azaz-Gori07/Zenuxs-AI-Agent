import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type {
  GatewayProviderContext,
  GatewayResolvedProviderConfig,
} from "@cline/shared";
import { ensureFetch, resolveApiKey } from "../http";
import type { ProviderFactoryResult } from "./types";

export const CLOUDFLARE_AIG_ENV_VARS = ["CLOUDFLARE_API_TOKEN", "CF_AIG_TOKEN"] as const;
export const CLOUDFLARE_WORKERS_AI_ENV_VARS = ["CLOUDFLARE_API_KEY", "CLOUDFLARE_WORKERS_AI_TOKEN"] as const;

function buildCloudflareFetch(config: GatewayResolvedProviderConfig): typeof fetch | undefined {
  const delegate = config.fetch ?? globalThis.fetch;
  if (!delegate) return config.fetch;

  const gatewayApiKey = config.options?.gatewayApiKey as string | undefined;

  const cfFetch = (async (input, init) => {
    const headers = new Headers(init?.headers);

    if (gatewayApiKey) {
      headers.set("cf-aig-authorization", gatewayApiKey);
    }

    const apiKey = config.options?.apiKey as string | undefined;
    if (apiKey) {
      headers.set("Authorization", `Bearer ${apiKey}`);
    }

    return delegate(input, { ...init, headers });
  }) as typeof fetch;

  const delegateWithPreconnect = delegate as typeof fetch & { preconnect?: (...args: unknown[]) => unknown };
  if (typeof delegateWithPreconnect.preconnect === "function") {
    (cfFetch as typeof fetch & { preconnect?: (...args: unknown[]) => unknown }).preconnect =
      delegateWithPreconnect.preconnect.bind(delegate);
  }

  return cfFetch;
}

export async function createCloudflareAIGatewayProviderModule(
  config: GatewayResolvedProviderConfig,
  _context: GatewayProviderContext,
): Promise<ProviderFactoryResult> {
  const apiKey = await resolveApiKey(config);
  const cfFetch = buildCloudflareFetch(config);

  const provider = createOpenAICompatible({
    name: "cloudflare-ai-gateway",
    apiKey,
    baseURL: config.baseUrl,
    headers: config.headers,
    fetch: ensureFetch(cfFetch ?? config.fetch),
  } as never);

  return {
    model: (modelId) => provider(modelId),
  };
}

export async function createCloudflareWorkersAIProviderModule(
  config: GatewayResolvedProviderConfig,
  _context: GatewayProviderContext,
): Promise<ProviderFactoryResult> {
  let apiKey = await resolveApiKey(config);

  if (!apiKey) {
    for (const key of CLOUDFLARE_WORKERS_AI_ENV_VARS) {
      const val = process.env[key]?.trim();
      if (val) {
        apiKey = val;
        break;
      }
    }
  }

  const provider = createOpenAICompatible({
    name: "cloudflare-workers-ai",
    apiKey,
    baseURL: config.baseUrl,
    headers: config.headers,
    fetch: ensureFetch(config.fetch),
  } as never);

  return {
    model: (modelId) => provider(modelId),
  };
}
