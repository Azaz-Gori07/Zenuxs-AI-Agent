export type DeliveryMode = "steer" | "queue"

export interface QueuedInput {
  id: string
  sessionId: string
  content: string
  delivery: DeliveryMode
  promotedSeq?: number
  timestamp: Date
  processed: boolean
  metadata?: Record<string, unknown>
}

export interface InputQueueStats {
  total: number
  pending: number
  processed: number
  steerCount: number
  queueCount: number
}

export class SessionInputQueue {
  private inputs = new Map<string, QueuedInput[]>()
  private activeSessions = new Set<string>()
  private maxQueueSize = 100

  constructor(maxQueueSize?: number) {
    if (maxQueueSize) this.maxQueueSize = maxQueueSize
  }

  admit(input: Omit<QueuedInput, "id" | "timestamp" | "processed">): QueuedInput {
    const queued: QueuedInput = {
      id: crypto.randomUUID(),
      sessionId: input.sessionId,
      content: input.content,
      delivery: input.delivery,
      promotedSeq: input.promotedSeq,
      timestamp: new Date(),
      processed: false,
      metadata: input.metadata,
    }

    if (!this.inputs.has(input.sessionId)) {
      this.inputs.set(input.sessionId, [])
    }

    const sessionInputs = this.inputs.get(input.sessionId)!
    if (sessionInputs.length >= this.maxQueueSize) {
      throw new Error(`Input queue full for session ${input.sessionId} (max ${this.maxQueueSize})`)
    }

    sessionInputs.push(queued)
    return queued
  }

  hasPending(sessionId: string): boolean {
    return (this.inputs.get(sessionId) ?? []).some((i) => !i.processed)
  }

  next(sessionId: string): QueuedInput | null {
    const sessionInputs = this.inputs.get(sessionId)
    if (!sessionInputs) return null

    const steerInput = sessionInputs.find((i) => !i.processed && i.delivery === "steer")
    if (steerInput) return steerInput

    const queueInput = sessionInputs.find((i) => !i.processed && i.delivery === "queue")
    if (queueInput) return queueInput

    return null
  }

  nextAll(sessionId: string): QueuedInput[] {
    const sessionInputs = this.inputs.get(sessionId)
    if (!sessionInputs) return []

    const steer = sessionInputs.filter((i) => !i.processed && i.delivery === "steer")
    const queue = sessionInputs.filter((i) => !i.processed && i.delivery === "queue")

    return [...steer, ...queue]
  }

  markProcessed(id: string): boolean {
    for (const [, inputs] of this.inputs) {
      const input = inputs.find((i) => i.id === id)
      if (input) {
        input.processed = true
        return true
      }
    }
    return false
  }

  promoteToSteer(id: string): boolean {
    for (const [, inputs] of this.inputs) {
      const input = inputs.find((i) => i.id === id)
      if (input) {
        input.delivery = "steer"
        return true
      }
    }
    return false
  }

  drain(sessionId: string): QueuedInput[] {
    const inputs = this.inputs.get(sessionId) ?? []
    this.inputs.set(sessionId, [])
    return inputs
  }

  clear(sessionId: string): void {
    this.inputs.delete(sessionId)
    this.activeSessions.delete(sessionId)
  }

  startDrain(sessionId: string): boolean {
    if (this.activeSessions.has(sessionId)) return false
    this.activeSessions.add(sessionId)
    return true
  }

  endDrain(sessionId: string): void {
    this.activeSessions.delete(sessionId)
  }

  isDraining(sessionId: string): boolean {
    return this.activeSessions.has(sessionId)
  }

  getStats(sessionId?: string): InputQueueStats | Map<string, InputQueueStats> {
    if (sessionId) {
      const inputs = this.inputs.get(sessionId) ?? []
      return {
        total: inputs.length,
        pending: inputs.filter((i) => !i.processed).length,
        processed: inputs.filter((i) => i.processed).length,
        steerCount: inputs.filter((i) => i.delivery === "steer").length,
        queueCount: inputs.filter((i) => i.delivery === "queue").length,
      }
    }

    const stats = new Map<string, InputQueueStats>()
    for (const [sid, inputs] of this.inputs) {
      stats.set(sid, {
        total: inputs.length,
        pending: inputs.filter((i) => !i.processed).length,
        processed: inputs.filter((i) => i.processed).length,
        steerCount: inputs.filter((i) => i.delivery === "steer").length,
        queueCount: inputs.filter((i) => i.delivery === "queue").length,
      })
    }
    return stats
  }
}

export * as InputQueue from "."
