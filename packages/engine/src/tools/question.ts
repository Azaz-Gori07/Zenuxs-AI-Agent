import type { ToolDefinition, ToolExecutionContext, ToolExecutionResult } from "@zenuxs/schema"
import type { ToolHandler } from "../tool/registry"

export const definition: ToolDefinition = {
  id: "question",
  description: "Ask the user a question and get their response.",
  parameters: [
    { name: "question", description: "Question to ask", required: true, schema: { type: "string" } },
    { name: "options", description: "Multiple choice options", required: false, schema: { type: "array", items: { type: "string" } } },
  ],
  readOnly: true,
  retryable: false,
  maxRetries: 0,
}
export * as Question from "."