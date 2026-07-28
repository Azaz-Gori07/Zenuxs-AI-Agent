import type { ProviderConfig, ProviderRoute } from "@zenuxs/schema"
import type { ProviderHandler } from "../index"

export const openaiProvider: ProviderHandler = {
  id: "openai",
  name: "OpenAI",
  createRoute(config: ProviderConfig, modelId: string): ProviderRoute {
    return {
      providerId: "openai",
      modelId,
      protocol: "openai",
      endpoint: config.baseUrl ?? "https://api.openai.com/v1/chat/completions",
      auth: config.auth,
    }
  },
}

export * as OpenAI from "."