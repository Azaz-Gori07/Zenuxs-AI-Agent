import type { Message } from "@zenuxs/schema"
import { ContextEpoch, type ContextEpochConfig } from "./context-epoch"

export type CompactionStrategy = "basic" | "agentic" | "off"

export interface CompactionConfig {
  strategy: CompactionStrategy
  auto: boolean
  buffer: number
  tokens: number
  maxEpochs?: number
}

export interface CompactionInput {
  messages: Message[]
  mode?: string
  provider?: string
  model?: string
  systemPrompt?: string
}

export interface CompactionResult {
  compacted: boolean
  epochId?: string
  summary?: string
  preservedMessages: Message[]
  baselineSeq: number
  tokenSavings: number
}

export type CompactionCallback = (input: {
  messages: Message[]
  systemPrompt?: string
}) => Promise<{ summary: string; recent: Message[] }>

const DEFAULT_CONFIG: Required<CompactionConfig> = {
  strategy: "agentic",
  auto: true,
  buffer: 20_000,
  tokens: 128_000,
  maxEpochs: 10,
}

export class CompactionEngine {
  private config: Required<CompactionConfig>
  private contextEpoch: ContextEpoch
  private compactionFn: CompactionCallback | null = null
  private consecutiveSkips = 0

  constructor(config?: Partial<CompactionConfig>, epochConfig?: ContextEpochConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.contextEpoch = new ContextEpoch({
      maxTokens: this.config.tokens,
      bufferTokens: this.config.buffer,
      keepMessages: 8,
      ...epochConfig,
    })
  }

  setCompactionCallback(fn: CompactionCallback): void {
    this.compactionFn = fn
  }

  updateConfig(config: Partial<CompactionConfig>): void {
    this.config = { ...this.config, ...config }
    if (config.tokens || config.buffer) {
      this.contextEpoch = new ContextEpoch({
        maxTokens: this.config.tokens,
        bufferTokens: this.config.buffer,
      })
    }
  }

  get status(): { config: Required<CompactionConfig>; epochs: number; currentSeq: number } {
    return {
      config: this.config,
      epochs: this.contextEpoch.getHistory().length,
      currentSeq: this.contextEpoch.currentSeq,
    }
  }

  async compactIfNeeded(input: CompactionInput): Promise<CompactionResult> {
    if (this.config.strategy === "off") {
      return { compacted: false, preservedMessages: input.messages, baselineSeq: 0, tokenSavings: 0 }
    }

    if (this.contextEpoch.getHistory().length >= (this.config.maxEpochs ?? 10)) {
      return { compacted: false, preservedMessages: input.messages, baselineSeq: this.contextEpoch.currentSeq, tokenSavings: 0 }
    }

    if (!this.contextEpoch.needsCompaction(input.messages)) {
      this.consecutiveSkips++
      return { compacted: false, preservedMessages: input.messages, baselineSeq: this.contextEpoch.currentSeq, tokenSavings: 0 }
    }

    this.consecutiveSkips = 0

    if (this.config.strategy === "basic") {
      return this.compactBasic(input)
    }

    if (this.config.strategy === "agentic") {
      return this.compactAgentic(input)
    }

    return { compacted: false, preservedMessages: input.messages, baselineSeq: this.contextEpoch.currentSeq, tokenSavings: 0 }
  }

  private async compactBasic(input: CompactionInput): Promise<CompactionResult> {
    const snapshot = input.messages
    const recentMessages = snapshot.slice(-this.config.buffer)
    const summary = this.generateBasicSummary(input.messages)

    const epoch = this.contextEpoch.createEpoch(summary, snapshot.length - recentMessages.length)

    return {
      compacted: true,
      epochId: epoch.epochId,
      summary,
      preservedMessages: recentMessages,
      baselineSeq: this.contextEpoch.currentSeq,
      tokenSavings: this.contextEpoch.estimateMessageTokens(snapshot),
    }
  }

  private async compactAgentic(input: CompactionInput): Promise<CompactionResult> {
    if (!this.compactionFn) {
      return this.compactBasic(input)
    }

    const snapshot = input.messages
    const recentMessages = snapshot.slice(-this.config.buffer)

    try {
      const result = await this.compactionFn({
        messages: snapshot.slice(0, -this.config.buffer),
        systemPrompt: input.systemPrompt,
      })

      const epoch = this.contextEpoch.createEpoch(result.summary, snapshot.length - recentMessages.length)
      return {
        compacted: true,
        epochId: epoch.epochId,
        summary: result.summary,
        preservedMessages: result.recent ?? recentMessages,
        baselineSeq: this.contextEpoch.currentSeq,
        tokenSavings: this.contextEpoch.estimateMessageTokens(snapshot),
      }
    } catch {
      return this.compactBasic(input)
    }
  }

  private generateBasicSummary(messages: Message[]): string {
    const userMessages = messages.filter((m) => m.role === "user")
    const assistantMessages = messages.filter((m) => m.role === "assistant")
    const totalTokens = this.contextEpoch.estimateMessageTokens(messages)

    const parts: string[] = [
      `## Conversation Summary`,
      `- Total messages: ${messages.length}`,
      `- User messages: ${userMessages.length}`,
      `- Assistant messages: ${assistantMessages.length}`,
      `- Estimated tokens: ${totalTokens}`,
    ]

    if (userMessages.length > 0) {
      const lastUser = userMessages[userMessages.length - 1]
      const lastUserText = lastUser.parts
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text.substring(0, 200))
        .join(" ")
      parts.push(`- Last user request: ${lastUserText}`)
    }

    if (this.contextEpoch.latestEpoch) {
      parts.push(`\nPrevious context was summarized at epoch ${this.contextEpoch.latestEpoch.epochId}.`)
    }

    return parts.join("\n")
  }

  async recoverFromOverflow(input: CompactionInput): Promise<CompactionResult> {
    this.config.buffer = Math.max(this.config.buffer / 2, 1000)
    return this.compactIfNeeded(input)
  }
}

export * as Compaction from "."
