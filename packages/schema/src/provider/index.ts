import { z } from "zod"

export const ProviderAuthSchema = z.object({
  type: z.enum(["apiKey", "oauth", "none"]),
  apiKey: z.string().optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  expiresAt: z.date().optional(),
  accountId: z.string().optional(),
})

export type ProviderAuth = z.infer<typeof ProviderAuthSchema>

export const ProviderModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  maxTokens: z.number().int().positive().optional(),
  supportsVision: z.boolean().default(false),
  supportsReasoning: z.boolean().default(false),
  supportsTools: z.boolean().default(true),
  supportsStreaming: z.boolean().default(true),
  costPer1MInput: z.number().nonnegative().optional(),
  costPer1MOutput: z.number().nonnegative().optional(),
  contextWindow: z.number().int().positive().optional(),
})

export type ProviderModel = z.infer<typeof ProviderModelSchema>

export const ProviderConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  baseUrl: z.string().url().optional(),
  auth: ProviderAuthSchema,
  models: z.array(ProviderModelSchema),
  defaultModelId: z.string().optional(),
  headers: z.record(z.string()).optional(),
  timeoutMs: z.number().int().positive().default(60000),
})

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>

export const ProviderRouteSchema = z.object({
  providerId: z.string(),
  modelId: z.string(),
  protocol: z.enum(["openai", "anthropic", "bedrock", "gemini", "custom"]),
  endpoint: z.string().url(),
  auth: ProviderAuthSchema,
  framing: z.record(z.unknown()).optional(),
})

export type ProviderRoute = z.infer<typeof ProviderRouteSchema>

export * as Provider from "."
