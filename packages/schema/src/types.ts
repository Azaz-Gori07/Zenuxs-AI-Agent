import { z } from "zod"

export const SessionIDSchema = z.string().uuid()
export const MessageIDSchema = z.string().uuid()
export const ToolCallIDSchema = z.string().uuid()
export const EventIDSchema = z.string().uuid()
export const AgentIDSchema = z.string().min(1)

export type SessionID = z.infer<typeof SessionIDSchema>
export type MessageID = z.infer<typeof MessageIDSchema>
export type ToolCallID = z.infer<typeof ToolCallIDSchema>
export type EventID = z.infer<typeof EventIDSchema>
export type AgentID = z.infer<typeof AgentIDSchema>

export const ToolResultSchema = z.object({
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
})

export type ToolResult = z.infer<typeof ToolResultSchema>

export const MessageRoleSchema = z.enum(["user", "assistant", "tool", "system"])
export type MessageRole = z.infer<typeof MessageRoleSchema>

export const MessagePartSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string() }),
  z.object({
    type: z.literal("tool_use"),
    tool_use: z.object({
      id: ToolCallIDSchema,
      name: z.string(),
      input: z.record(z.unknown()),
    }),
  }),
  z.object({
    type: z.literal("tool_result"),
    tool_result: z.object({
      id: ToolCallIDSchema,
      result: ToolResultSchema,
    }),
  }),
  z.object({ type: z.literal("reasoning"), text: z.string() }),
])

export type MessagePart = z.infer<typeof MessagePartSchema>

export const MessageSchema = z.object({
  id: MessageIDSchema,
  role: MessageRoleSchema,
  parts: z.array(MessagePartSchema),
  createdAt: z.date(),
  metadata: z.record(z.unknown()).optional(),
})

export type Message = z.infer<typeof MessageSchema>
