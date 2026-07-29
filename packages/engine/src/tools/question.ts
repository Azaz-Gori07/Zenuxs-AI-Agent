import type { ToolDefinition, ToolExecutionResult } from "@zenuxs/schema"
import type { ToolHandler } from "../tool/registry"

export interface QuestionResponse {
  answer: string
  metadata?: Record<string, unknown>
}

export type QuestionCallback = (
  question: string,
  options?: string[],
) => Promise<QuestionResponse> | QuestionResponse

let activeCallback: QuestionCallback | null = null

export function setQuestionCallback(cb: QuestionCallback | null): void {
  activeCallback = cb
}

const pendingResponses = new Map<string, {
  resolve: (value: QuestionResponse) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}>()

export function submitResponse(questionId: string, answer: string): boolean {
  const pending = pendingResponses.get(questionId)
  if (!pending) return false
  clearTimeout(pending.timeout)
  pending.resolve({ answer })
  pendingResponses.delete(questionId)
  return true
}

export function submitError(questionId: string, error: string): boolean {
  const pending = pendingResponses.get(questionId)
  if (!pending) return false
  clearTimeout(pending.timeout)
  pending.reject(new Error(error))
  pendingResponses.delete(questionId)
  return true
}

export const definition: ToolDefinition = {
  id: "question",
  description: "Ask the user a question and get their response. Supports yes/no, multiple choice, and free-form questions.",
  parameters: [
    { name: "question", description: "Question to ask the user", required: true, schema: { type: "string" } },
    { name: "options", description: "Multiple choice options (optional)", required: false, schema: { type: "array", items: { type: "string" } } },
    { name: "defaultValue", description: "Default value if user doesn't respond", required: false, schema: { type: "string" } },
    { name: "timeoutMs", description: "Timeout in ms to wait for response (default: 300000/5min)", required: false, schema: { type: "number" } },
    { name: "required", description: "Whether a response is required", required: false, schema: { type: "boolean" } },
  ],
  readOnly: true,
  retryable: false,
  maxRetries: 0,
}

export const handler: ToolHandler = {
  async execute(args, _ctx): Promise<ToolExecutionResult> {
    const { question, options, defaultValue, timeoutMs, required } = args as {
      question: string
      options?: string[]
      defaultValue?: string
      timeoutMs?: number
      required?: boolean
    }

    if (activeCallback) {
      try {
        const response = await activeCallback(question, options)
        return {
          title: "Question answered",
          output: `User response: ${response.answer}`,
          metadata: { question, answer: response.answer, ...response.metadata },
        }
      } catch (err) {
        return {
          title: "Question cancelled",
          output: `User did not answer: ${(err as Error).message}`,
          metadata: { question, error: (err as Error).message, cancelled: true },
          error: (err as Error).message,
        }
      }
    }

    return {
      title: "Question",
      output: `Question for user: ${question}${options ? `\nOptions: ${options.join(", ")}` : ""}${defaultValue ? `\nDefault: ${defaultValue}` : ""}`,
      metadata: { question, options, pending: true, defaultValue, timeoutMs: timeoutMs ?? 300_000, required: required ?? true },
    }
  },
}

export * as Question from "."
