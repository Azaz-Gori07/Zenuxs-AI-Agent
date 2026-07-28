import type { Session, Message, SessionEvent, SessionStatus } from "@zenuxs/schema"

export interface SessionManagerOptions {
  store?: SessionStore
}

export interface SessionStore {
  create(session: Session): Promise<void>
  get(id: string): Promise<Session | null>
  update(session: Partial<Session> & { id: string }): Promise<void>
  delete(id: string): Promise<void>
  list(filter?: { status?: SessionStatus; limit?: number; offset?: number }): Promise<Session[]>
  addMessage(sessionId: string, message: Message): Promise<void>
  getMessages(sessionId: string): Promise<Message[]>
  addEvent(event: SessionEvent): Promise<void>
  getEvents(sessionId: string): Promise<SessionEvent[]>
}

export class InMemoryStore implements SessionStore {
  private sessions = new Map<string, Session>()
  private messages = new Map<string, Message[]>()
  private events = new Map<string, SessionEvent[]>()

  async create(session: Session): Promise<void> {
    this.sessions.set(session.id, session)
    this.messages.set(session.id, [])
    this.events.set(session.id, [])
  }

  async get(id: string): Promise<Session | null> {
    return this.sessions.get(id) ?? null
  }

  async update(update: Partial<Session> & { id: string }): Promise<void> {
    const existing = this.sessions.get(update.id)
    if (existing) {
      this.sessions.set(update.id, { ...existing, ...update })
    }
  }

  async delete(id: string): Promise<void> {
    this.sessions.delete(id)
    this.messages.delete(id)
    this.events.delete(id)
  }

  async list(filter?: { status?: SessionStatus; limit?: number; offset?: number }): Promise<Session[]> {
    let result = Array.from(this.sessions.values())
    if (filter?.status) {
      result = result.filter((s) => s.status === filter.status)
    }
    const offset = filter?.offset ?? 0
    const limit = filter?.limit ?? result.length
    return result.slice(offset, offset + limit)
  }

  async addMessage(sessionId: string, message: Message): Promise<void> {
    const msgs = this.messages.get(sessionId) ?? []
    msgs.push(message)
    this.messages.set(sessionId, msgs)
  }

  async getMessages(sessionId: string): Promise<Message[]> {
    return this.messages.get(sessionId) ?? []
  }

  async addEvent(event: SessionEvent): Promise<void> {
    const evts = this.events.get(event.sessionId) ?? []
    evts.push(event)
    this.events.set(event.sessionId, evts)
  }

  async getEvents(sessionId: string): Promise<SessionEvent[]> {
    return this.events.get(sessionId) ?? []
  }
}

export class SessionManager {
  readonly store: SessionStore
  private abortControllers = new Map<string, AbortController>()

  constructor(options: SessionManagerOptions = {}) {
    this.store = options.store ?? new InMemoryStore()
  }

  async create(config: {
    modelId: string
    providerId: string
    agentId: string
    mode: string
    metadata?: Record<string, unknown>
  }): Promise<Session> {
    const session: Session = {
      id: crypto.randomUUID(),
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
      messageCount: 0,
      modelId: config.modelId,
      providerId: config.providerId,
      agentId: config.agentId,
      mode: config.mode,
      metadata: config.metadata,
    }
    await this.store.create(session)
    await this.store.addEvent({
      id: crypto.randomUUID(),
      sessionId: session.id,
      sequence: 0,
      type: "session_created",
      payload: { mode: config.mode, agentId: config.agentId },
      timestamp: new Date(),
    })
    this.abortControllers.set(session.id, new AbortController())
    return session
  }

  async resume(sessionId: string): Promise<Session | null> {
    const session = await this.store.get(sessionId)
    if (!session) return null
    if (session.status === "active") {
      await this.store.update({ id: sessionId, status: "active", updatedAt: new Date() })
      await this.store.addEvent({
        id: crypto.randomUUID(),
        sessionId,
        sequence: Date.now(),
        type: "session_resumed",
        payload: {},
        timestamp: new Date(),
      })
      this.abortControllers.set(sessionId, new AbortController())
    }
    return session
  }

  async addMessage(sessionId: string, message: Message): Promise<void> {
    await this.store.addMessage(sessionId, message)
    await this.store.update({ id: sessionId, lastMessageId: message.id, messageCount: (await this.store.getMessages(sessionId)).length, updatedAt: new Date() })
  }

  async addEvent(session: SessionEvent): Promise<void> {
    await this.store.addEvent(session)
  }

  async getMessages(sessionId: string): Promise<Message[]> {
    return this.store.getMessages(sessionId)
  }

  async getEvents(sessionId: string): Promise<SessionEvent[]> {
    return this.store.getEvents(sessionId)
  }

  getAbortSignal(sessionId: string): AbortSignal | undefined {
    return this.abortControllers.get(sessionId)?.signal
  }

  abort(sessionId: string): void {
    this.abortControllers.get(sessionId)?.abort()
  }

  async complete(sessionId: string): Promise<void> {
    await this.store.update({ id: sessionId, status: "completed", completedAt: new Date() })
    await this.store.addEvent({
      id: crypto.randomUUID(),
      sessionId,
      sequence: Date.now(),
      type: "session_completed",
      payload: {},
      timestamp: new Date(),
    })
    this.abortControllers.delete(sessionId)
  }
}

export * as SessionManager from "."