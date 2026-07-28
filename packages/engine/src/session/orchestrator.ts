import type { Session, Message } from "@zenuxs/schema"
import type { AgentRuntime } from "../agent/runtime"
import type { ToolRegistry } from "../tool/registry"

export interface OrchestratorOptions {
  agent: AgentRuntime
  tools: ToolRegistry
}

export interface StartSessionInput {
  mode?: string
  modelId?: string
  providerId?: string
  prompt?: string
  systemPrompt?: string
  metadata?: Record<string, unknown>
  resumeSessionId?: string
}

export interface SendInput {
  sessionId: string
  message: string
  metadata?: Record<string, unknown>
}

export interface SessionOrchestratorEvents {
  onSessionCreated?: (session: Session) => void
  onMessageAdded?: (session: Session, message: Message) => void
  onSessionCompleted?: (session: Session) => void
  onError?: (sessionId: string, error: Error) => void
}

export class SessionOrchestrator {
  readonly agent: AgentRuntime
  readonly tools: ToolRegistry
  events?: SessionOrchestratorEvents

  constructor(options: OrchestratorOptions) {
    this.agent = options.agent
    this.tools = options.tools
  }

  async start(config: StartSessionInput): Promise<Session> {
    const mode = config.mode ?? "act"
    const session: Session = {
      id: crypto.randomUUID(),
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
      messageCount: 0,
      modelId: config.modelId ?? "",
      providerId: config.providerId ?? "",
      agentId: mode,
      mode,
      metadata: config.metadata,
    }

    this.events?.onSessionCreated?.(session)

    if (config.prompt) {
      const message: Message = {
        id: crypto.randomUUID(),
        role: "user",
        parts: [{ type: "text", text: config.prompt }],
        createdAt: new Date(),
        metadata: { sessionId: session.id },
      }
      this.events?.onMessageAdded?.(session, message)
    }

    return session
  }

  async send(input: SendInput): Promise<Message> {
    const message: Message = {
      id: crypto.randomUUID(),
      role: "user",
      parts: [{ type: "text", text: input.message }],
      createdAt: new Date(),
      metadata: { sessionId: input.sessionId, ...input.metadata },
    }
    return message
  }

  async abort(sessionId: string): Promise<void> {
    this.agent.abort(sessionId)
  }

  subscribe(events: SessionOrchestratorEvents): void {
    this.events = events
  }
}

export * as Session from "."