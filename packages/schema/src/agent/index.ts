import { z } from "zod"

export const AgentModeSchema = z.enum([
  "act",
  "plan",
  "yolo",
  "zen",
  "ask",
  "debug",
  "god",
])
export type AgentMode = z.infer<typeof AgentModeSchema>

export const AgentConfigSchema = z.object({
  mode: AgentModeSchema,
  modelId: z.string().optional(),
  providerId: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  maxTokens: z.number().int().positive().optional(),
  reasoningEffort: z.enum(["low", "medium", "high"]).optional(),
  maxSteps: z.number().int().positive().default(100),
  toolAutoApprove: z.boolean().default(false),
  disabledTools: z.array(z.string()).optional(),
  enabledTools: z.array(z.string()).optional(),
  systemPrompt: z.string().optional(),
  extraTools: z.array(z.string()).optional(),
  instructions: z.array(z.string()).optional(),
})

export type AgentConfig = z.infer<typeof AgentConfigSchema>

export const AgentModeBehaviorSchema = z.object({
  mode: AgentModeSchema,
  allowedTools: z.array(z.string()),
  blockedTools: z.array(z.string()),
  executionStrategy: z.enum(["sequential", "parallel", "single"]).default("sequential"),
  requiresApproval: z.boolean().default(true),
  canEditFiles: z.boolean().default(true),
  canRunCommands: z.boolean().default(true),
  canSpawnSubagents: z.boolean().default(true),
  canUseWebSearch: z.boolean().default(true),
  canUseWebFetch: z.boolean().default(true),
})

export type AgentModeBehavior = z.infer<typeof AgentModeBehaviorSchema>

export const AgentEventSchema = z.object({
  type: z.enum([
    "start",
    "stop",
    "message_start",
    "message_delta",
    "message_end",
    "tool_start",
    "tool_delta",
    "tool_end",
    "tool_error",
    "reasoning",
    "error",
    "warning",
    "info",
    "mode_change",
    "session_complete",
    "usage",
  ]),
  data: z.record(z.unknown()),
  timestamp: z.date(),
})

export type AgentEvent = z.infer<typeof AgentEventSchema>

export const AgentResultSchema = z.object({
  status: z.enum(["completed", "error", "aborted"]),
  usage: z
    .object({
      inputTokens: z.number().int().nonnegative(),
      outputTokens: z.number().int().nonnegative(),
      cacheReadTokens: z.number().int().nonnegative().optional(),
      cacheWriteTokens: z.number().int().nonnegative().optional(),
      reasoningTokens: z.number().int().nonnegative().optional(),
      costUsd: z.number().nonnegative().optional(),
    })
    .optional(),
  error: z.string().optional(),
  durationMs: z.number().int().nonnegative().optional(),
})

export type AgentResult = z.infer<typeof AgentResultSchema>

export * as Agent from "."
