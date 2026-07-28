import type { ProviderConfig, ProviderRoute } from "@zenuxs/schema"
import type { ProviderHandler } from "../index"

export const googleProvider: ProviderHandler = {
  id: "google",
  name: "Google Gemini",
  createRoute(config: ProviderConfig, modelId: string): ProviderRoute {
    return {
      providerId: "google",
      modelId,
      protocol: "gemini",
      endpoint: config.baseUrl ?? `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`,
      auth: config.auth,
    }
  },
}

export * as Google from "."