export type StreamEventType =
  | "text_start"
  | "text_delta"
  | "text_end"
  | "reasoning_start"
  | "reasoning_delta"
  | "reasoning_end"
  | "tool_start"
  | "tool_delta"
  | "tool_end"
  | "tool_error"
  | "usage"
  | "error"
  | "warning"
  | "info"
  | "done"

export interface StreamEventBase {
  id: string
  sessionId: string
  timestamp: Date
}

export interface TextStartEvent extends StreamEventBase {
  type: "text_start"
  index: number
}

export interface TextDeltaEvent extends StreamEventBase {
  type: "text_delta"
  index: number
  delta: string
}

export interface TextEndEvent extends StreamEventBase {
  type: "text_end"
  index: number
  text: string
}

export interface ReasoningStartEvent extends StreamEventBase {
  type: "reasoning_start"
  index: number
  signature?: string
}

export interface ReasoningDeltaEvent extends StreamEventBase {
  type: "reasoning_delta"
  index: number
  delta: string
}

export interface ReasoningEndEvent extends StreamEventBase {
  type: "reasoning_end"
  index: number
}

export interface ToolStartEvent extends StreamEventBase {
  type: "tool_start"
  toolCallId: string
  toolName: string
  input: Record<string, unknown>
}

export interface ToolDeltaEvent extends StreamEventBase {
  type: "tool_delta"
  toolCallId: string
  delta: string
}

export interface ToolEndEvent extends StreamEventBase {
  type: "tool_end"
  toolCallId: string
  toolName: string
  result: Record<string, unknown>
  isError?: boolean
}

export interface ToolErrorEvent extends StreamEventBase {
  type: "tool_error"
  toolCallId: string
  toolName: string
  error: string
}

export interface UsageEvent extends StreamEventBase {
  type: "usage"
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  reasoningTokens?: number
  costUsd?: number
}

export interface StreamErrorEvent extends StreamEventBase {
  type: "error"
  code: string
  message: string
  recoverable?: boolean
}

export interface StreamWarningEvent extends StreamEventBase {
  type: "warning"
  message: string
}

export interface StreamInfoEvent extends StreamEventBase {
  type: "info"
  message: string
}

export interface StreamDoneEvent extends StreamEventBase {
  type: "done"
  finishReason: "completed" | "aborted" | "error" | "tool_use"
  usage?: UsageEvent
}

export type StreamEvent =
  | TextStartEvent
  | TextDeltaEvent
  | TextEndEvent
  | ReasoningStartEvent
  | ReasoningDeltaEvent
  | ReasoningEndEvent
  | ToolStartEvent
  | ToolDeltaEvent
  | ToolEndEvent
  | ToolErrorEvent
  | UsageEvent
  | StreamErrorEvent
  | StreamWarningEvent
  | StreamInfoEvent
  | StreamDoneEvent

export type StreamEventHandler = (event: StreamEvent) => void | Promise<void>

export class StreamEmitter {
  private handlers = new Set<StreamEventHandler>()
  private buffer: StreamEvent[] = []
  private flushed = false

  on(handler: StreamEventHandler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  emit(event: StreamEvent): void {
    this.buffer.push(event)
    if (this.flushed) {
      this.flush()
    }
  }

  flush(): void {
    const events = this.buffer.splice(0)
    for (const event of events) {
      for (const handler of this.handlers) {
        Promise.resolve(handler(event)).catch(() => {})
      }
    }
  }

  get pending(): number {
    return this.buffer.length
  }
}

export function createStreamEvent(
  sessionId: string,
  partial: Omit<StreamEvent, "id" | "sessionId" | "timestamp">,
): StreamEvent {
  return {
    id: crypto.randomUUID(),
    sessionId,
    timestamp: new Date(),
    ...partial,
  } as StreamEvent
}

export * as StreamEvents from "."
