import type { ProviderConfig, ProviderRoute } from "@zenuxs/schema"
import type { ProviderHandler } from "../index"

export const anthropicProvider: ProviderHandler = {
  id: "anthropic",
  name: "Anthropic",
  createRoute(config: ProviderConfig, modelId: string): ProviderRoute {
    return {
      providerId: "anthropic",
      modelId,
      protocol: "anthropic",
      endpoint: config.baseUrl ?? "https://api.anthropic.com/v1/messages",
      auth: config.auth,
    }
  },
}

export * as Anthropic from "."