import { z } from "zod"
import { SessionIDSchema, MessageIDSchema, EventIDSchema } from "../types"

export const SessionEventSchema = z.object({
  id: EventIDSchema,
  sessionId: SessionIDSchema,
  sequence: z.number().int(),
  type: z.enum([
    "session_created",
    "session_resumed",
    "message_added",
    "tool_requested",
    "tool_completed",
    "tool_failed",
    "compaction_started",
    "compaction_completed",
    "session_paused",
    "session_resumed_event",
    "session_completed",
    "session_aborted",
  ]),
  payload: z.record(z.unknown()),
  timestamp: z.date(),
})

export type SessionEvent = z.infer<typeof SessionEventSchema>

export const SessionStatusSchema = z.enum([
  "active",
  "paused",
  "completed",
  "aborted",
  "error",
])
export type SessionStatus = z.infer<typeof SessionStatusSchema>

export const SessionSchema = z.object({
  id: SessionIDSchema,
  title: z.string().optional(),
  status: SessionStatusSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
  completedAt: z.date().optional(),
  lastMessageId: MessageIDSchema.optional(),
  messageCount: z.number().int().nonnegative(),
  modelId: z.string(),
  providerId: z.string(),
  agentId: z.string(),
  mode: z.string(),
  metadata: z.record(z.unknown()).optional(),
})

export type Session = z.infer<typeof SessionSchema>

export * as Session from "."
