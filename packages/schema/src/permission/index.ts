import { z } from "zod"

export const PermissionActionSchema = z.enum(["allow", "ask", "deny"])
export type PermissionAction = z.infer<typeof PermissionActionSchema>

export const PermissionRuleSchema = z.object({
  permission: z.string(),
  pattern: z.string(),
  action: PermissionActionSchema,
})

export type PermissionRule = z.infer<typeof PermissionRuleSchema>

export const PermissionRulesetSchema = z.array(PermissionRuleSchema)
export type PermissionRuleset = z.infer<typeof PermissionRulesetSchema>

export const PermissionRequestSchema = z.object({
  permission: z.string(),
  pattern: z.string(),
  metadata: z.record(z.unknown()).optional(),
  always: z.array(z.string()).optional(),
})

export type PermissionRequest = z.infer<typeof PermissionRequestSchema>

export const PermissionDecisionSchema = z.object({
  action: PermissionActionSchema,
  rule: PermissionRuleSchema.optional(),
  reason: z.string().optional(),
})

export type PermissionDecision = z.infer<typeof PermissionDecisionSchema>

export const ToolPermissionSchema = z.object({
  tool: z.string(),
  patterns: z.array(z.string()),
  action: PermissionActionSchema,
})

export type ToolPermission = z.infer<typeof ToolPermissionSchema>

export const PermissionContextSchema = z.object({
  sessionId: z.string(),
  toolCallId: z.string().optional(),
  agent: z.string(),
  mode: z.string(),
  ruleset: PermissionRulesetSchema.optional(),
})

export type PermissionContext = z.infer<typeof PermissionContextSchema>

export * as Permission from "."
