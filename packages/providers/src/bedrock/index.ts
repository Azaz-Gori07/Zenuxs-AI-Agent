import type { ProviderConfig, ProviderRoute } from "@zenuxs/schema"
import type { ProviderHandler } from "../index"

export const bedrockProvider: ProviderHandler = {
  id: "bedrock",
  name: "AWS Bedrock",
  createRoute(config: ProviderConfig, modelId: string): ProviderRoute {
    return {
      providerId: "bedrock",
      modelId,
      protocol: "bedrock",
      endpoint: `https://bedrock-runtime.${config.headers?.["aws-region"] ?? "us-east-1"}.amazonaws.com/model/${modelId}/invoke`,
      auth: config.auth,
    }
  },
}

export * as Bedrock from "."