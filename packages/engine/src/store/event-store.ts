import type { SessionEvent } from "@zenuxs/schema"

export interface EventStoreOptions {
  storage?: EventStorage
}

export interface EventStorage {
  append(event: SessionEvent): Promise<void>
  getEvents(sessionId: string): Promise<SessionEvent[]>
  getSequence(sessionId: string): Promise<number>
  replay(sessionId: string, fromSequence?: number): AsyncGenerator<SessionEvent>
}

export class InMemoryEventStorage implements EventStorage {
  private events = new Map<string, SessionEvent[]>()
  private sequences = new Map<string, number>()

  async append(event: SessionEvent): Promise<void> {
    const evts = this.events.get(event.sessionId) ?? []
    evts.push(event)
    this.events.set(event.sessionId, evts)
    this.sequences.set(event.sessionId, Math.max(this.sequences.get(event.sessionId) ?? 0, event.sequence))
  }

  async getEvents(sessionId: string): Promise<SessionEvent[]> {
    return this.events.get(sessionId) ?? []
  }

  async getSequence(sessionId: string): Promise<number> {
    return this.sequences.get(sessionId) ?? 0
  }

  async *replay(sessionId: string, fromSequence?: number): AsyncGenerator<SessionEvent> {
    const evts = this.events.get(sessionId) ?? []
    const start = fromSequence ?? 0
    for (const event of evts) {
      if (event.sequence >= start) {
        yield event
      }
    }
  }
}

export class EventStore {
  readonly storage: EventStorage

  constructor(options: EventStoreOptions = {}) {
    this.storage = options.storage ?? new InMemoryEventStorage()
  }

  async append(event: SessionEvent): Promise<void> {
    await this.storage.append(event)
  }

  async getEvents(sessionId: string): Promise<SessionEvent[]> {
    return this.storage.getEvents(sessionId)
  }

  async *replay(sessionId: string, fromSequence?: number): AsyncGenerator<SessionEvent> {
    yield* this.storage.replay(sessionId, fromSequence)
  }

  async getProjectedState<T>(
    sessionId: string,
    projector: (events: SessionEvent[]) => T,
  ): Promise<T> {
    const events = await this.getEvents(sessionId)
    return projector(events)
  }
}