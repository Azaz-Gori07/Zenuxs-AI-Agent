import type { Message } from "@zenuxs/schema"

export interface ContextEpochConfig {
  maxTokens?: number
  bufferTokens?: number
  keepMessages?: number
}

const DEFAULTS: Required<ContextEpochConfig> = {
  maxTokens: 128_000,
  bufferTokens: 20_000,
  keepMessages: 8,
}

export interface EpochBaseline {
  epochId: string
  baselineSeq: number
  summary: string
  createdAt: Date
  tokenCount: number
}

export class ContextEpoch {
  private epochs: EpochBaseline[] = []
  private config: Required<ContextEpochConfig>
  private currentBaselineSeq = 0

  constructor(config?: ContextEpochConfig) {
    this.config = { ...DEFAULTS, ...config }
  }

  get currentSeq(): number {
    return this.currentBaselineSeq
  }

  get latestEpoch(): EpochBaseline | undefined {
    return this.epochs[this.epochs.length - 1]
  }

  get availableTokens(): number {
    return this.config.maxTokens - this.config.bufferTokens
  }

  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
  }

  estimateMessageTokens(messages: Message[]): number {
    return messages.reduce((sum, m) => {
      let tokens = 0
      for (const part of m.parts) {
        if (part.type === "text") {
          tokens += this.estimateTokens(part.text)
        }
      }
      return sum + tokens
    }, 0)
  }

  wouldOverflow(messages: Message[]): boolean {
    const estimated = this.estimateMessageTokens(messages)
    return estimated > this.availableTokens
  }

  needsCompaction(messages: Message[], extraTokens?: number): boolean {
    const estimated = this.estimateMessageTokens(messages) + (extraTokens ?? 0)
    return estimated > this.availableTokens
  }

  createEpoch(summary: string, messageCount: number): EpochBaseline {
    const epoch: EpochBaseline = {
      epochId: crypto.randomUUID(),
      baselineSeq: this.currentBaselineSeq + messageCount,
      summary,
      createdAt: new Date(),
      tokenCount: this.estimateTokens(summary),
    }
    this.epochs.push(epoch)
    this.currentBaselineSeq = epoch.baselineSeq
    return epoch
  }

  /**
   * Get messages that should be included based on epoch baseline.
   * Messages before the latest epoch's baseline are excluded (already summarized).
   */
  selectForRunner(messages: Message[], baselineSeq?: number): Message[] {
    const seq = baselineSeq ?? this.currentBaselineSeq
    return messages.slice(seq)
  }

  /**
   * Get the compaction summary block to insert into the system prompt or context.
   */
  getCompactionContext(): string {
    if (this.epochs.length === 0) return ""
    const parts = this.epochs.map((e, i) => {
      return `<context_epoch_${i + 1}>\n${e.summary}\n</context_epoch_${i + 1}>`
    })
    return parts.join("\n\n")
  }

  getHistory(): EpochBaseline[] {
    return [...this.epochs]
  }

  getHistorySince(epochId: string): EpochBaseline[] {
    const idx = this.epochs.findIndex((e) => e.epochId === epochId)
    if (idx === -1) return []
    return this.epochs.slice(idx + 1)
  }

  reset(): void {
    this.epochs = []
    this.currentBaselineSeq = 0
  }

  updateLastEpoch(summary: string): void {
    if (this.epochs.length > 0) {
      const last = this.epochs[this.epochs.length - 1]
      last.summary = summary
      last.tokenCount = this.estimateTokens(summary)
      last.createdAt = new Date()
    }
  }
}

export * as ContextEpoch from "."
