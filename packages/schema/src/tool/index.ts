import { z } from "zod"
import { ToolCallIDSchema } from "../types"

export const ToolParameterSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  required: z.boolean().default(false),
  schema: z.record(z.unknown()),
})

export type ToolParameter = z.infer<typeof ToolParameterSchema>

export const ToolDefinitionSchema = z.object({
  id: z.string(),
  description: z.string(),
  parameters: z.array(ToolParameterSchema),
  handler: z.string().optional(),
  timeoutMs: z.number().int().positive().optional(),
  retryable: z.boolean().default(true),
  maxRetries: z.number().int().nonnegative().default(3),
  confirmation: z
    .object({
      title: z.string().optional(),
      message: z.string().optional(),
    })
    .optional(),
  readOnly: z.boolean().default(false),
  modeRestrictions: z.array(z.string()).optional(),
})

export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>

export const ToolExecutionContextSchema = z.object({
  sessionId: z.string(),
  messageId: z.string(),
  toolCallId: ToolCallIDSchema,
  agent: z.string(),
  abort: z.boolean().default(false),
  metadata: z.record(z.unknown()).optional(),
})

export type ToolExecutionContext = z.infer<typeof ToolExecutionContextSchema>

export const ToolExecutionResultSchema = z.object({
  title: z.string(),
  output: z.string(),
  metadata: z.record(z.unknown()),
  attachments: z
    .array(
      z.object({
        type: z.literal("file"),
        mime: z.string(),
        url: z.string(),
        filename: z.string().optional(),
      }),
    )
    .optional(),
  error: z.string().optional(),
})

export type ToolExecutionResult = z.infer<typeof ToolExecutionResultSchema>

export * as Tool from "."
