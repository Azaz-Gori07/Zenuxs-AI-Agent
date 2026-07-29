import type { Session, Message, SessionEvent } from "@zenuxs/schema"
import type { AgentRuntime } from "../agent/runtime"
import type { ToolRegistry } from "../tool/registry"
import { SessionManager, type SessionStore } from "./manager"
import { StreamEmitter, type StreamEvent, type StreamEventHandler, createStreamEvent } from "../stream/events"

export interface OrchestratorOptions {
  agent: AgentRuntime
  tools: ToolRegistry
  store?: SessionStore
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

export interface OrchestratorStatus {
  sessions: number
  active: number
  completed: number
  uptime: number
}

export class SessionOrchestrator {
  readonly agent: AgentRuntime
  readonly tools: ToolRegistry
  readonly sessionManager: SessionManager
  readonly streamEmitter: StreamEmitter
  private startedAt = Date.now()

  private sessionEventListeners = new Map<string, Set<StreamEventHandler>>()

  constructor(options: OrchestratorOptions) {
    this.agent = options.agent
    this.tools = options.tools
    this.sessionManager = new SessionManager({ store: options.store })
    this.streamEmitter = new StreamEmitter()
  }

  onStreamEvent(sessionId: string, handler: StreamEventHandler): () => void {
    if (!this.sessionEventListeners.has(sessionId)) {
      this.sessionEventListeners.set(sessionId, new Set())
    }
    this.sessionEventListeners.get(sessionId)!.add(handler)

    const globalUnsub = this.streamEmitter.on((event) => {
      if (event.sessionId === sessionId) {
        Promise.resolve(handler(event)).catch(() => {})
      }
    })

    return () => {
      this.sessionEventListeners.get(sessionId)?.delete(handler)
      globalUnsub()
    }
  }

  private emitStream(sessionId: string, partial: Record<string, unknown> & { type: string }): void {
    const event = {
      id: crypto.randomUUID(),
      sessionId,
      timestamp: new Date(),
      ...partial,
    } as unknown as StreamEvent
    this.streamEmitter.emit(event)
  }

  async start(config: StartSessionInput): Promise<Session> {
    const mode = config.mode ?? "act"
    const session = await this.sessionManager.create({
      modelId: config.modelId ?? "",
      providerId: config.providerId ?? "",
      agentId: mode,
      mode,
      metadata: {
        ...config.metadata,
        systemPrompt: config.systemPrompt,
        ...(config.resumeSessionId ? { parentSessionId: config.resumeSessionId } : {}),
      },
    })

    if (config.prompt) {
      const message: Message = {
        id: crypto.randomUUID(),
        role: "user",
        parts: [{ type: "text", text: config.prompt }],
        createdAt: new Date(),
        metadata: { sessionId: session.id },
      }
      await this.sessionManager.addMessage(session.id, message)
    }

    this.emitStream(session.id, {
      type: "info",
      message: `Session started (mode: ${mode})`,
    })

    return session
  }

  async send(input: SendInput): Promise<Message> {
    const session = await this.sessionManager.store.get(input.sessionId)
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`)
    }

    const message: Message = {
      id: crypto.randomUUID(),
      role: "user",
      parts: [{ type: "text", text: input.message }],
      createdAt: new Date(),
      metadata: { sessionId: input.sessionId, ...input.metadata },
    }

    await this.sessionManager.addMessage(input.sessionId, message)

    this.emitStream(input.sessionId, {
      type: "info",
      message: "User message received",
    })

    return message
  }

  async list(filter?: { status?: string; limit?: number; offset?: number }): Promise<Session[]> {
    return this.sessionManager.store.list({
      status: filter?.status as any,
      limit: filter?.limit,
      offset: filter?.offset,
    })
  }

  async getSession(sessionId: string): Promise<Session | null> {
    return this.sessionManager.store.get(sessionId)
  }

  async getMessages(sessionId: string): Promise<Message[]> {
    return this.sessionManager.getMessages(sessionId)
  }

  async getEvents(sessionId: string): Promise<SessionEvent[]> {
    return this.sessionManager.getEvents(sessionId)
  }

  async abort(sessionId: string): Promise<void> {
    this.sessionManager.abort(sessionId)
    this.agent.abort(sessionId)

    this.emitStream(sessionId, {
      type: "done",
      finishReason: "aborted",
    })

    await this.sessionManager.store.update({
      id: sessionId,
      status: "aborted",
      updatedAt: new Date(),
    })
  }

  async complete(sessionId: string): Promise<void> {
    await this.sessionManager.complete(sessionId)

    this.emitStream(sessionId, {
      type: "done",
      finishReason: "completed",
    })
  }

  async pause(sessionId: string): Promise<void> {
    const session = await this.sessionManager.store.get(sessionId)
    if (!session) throw new Error(`Session not found: ${sessionId}`)
    await this.sessionManager.store.update({ id: sessionId, status: "paused", updatedAt: new Date() })
  }

  async resume(sessionId: string): Promise<Session | null> {
    const session = await this.sessionManager.resume(sessionId)
    if (session) {
      this.emitStream(sessionId, {
        type: "info",
        message: "Session resumed",
      })
    }
    return session
  }

  async delete(sessionId: string): Promise<void> {
    this.sessionEventListeners.delete(sessionId)
    await this.sessionManager.store.delete(sessionId)
  }

  close(): void {
    this.sessionManager.close()
    this.streamEmitter.close()
    this.sessionEventListeners.clear()
  }

  getStatus(): OrchestratorStatus {
    return {
      sessions: this.sessionManager.store.list().then(s => s.length) as unknown as number,
      active: 0,
      completed: 0,
      uptime: Date.now() - this.startedAt,
    }
  }
}
