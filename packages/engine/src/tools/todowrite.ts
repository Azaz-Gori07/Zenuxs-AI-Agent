import type { ToolDefinition, ToolExecutionContext, ToolExecutionResult } from "@zenuxs/schema"
import type { ToolHandler } from "../tool/registry"

export interface TodoItem {
  content: string
  status: "pending" | "in_progress" | "completed" | "cancelled"
  priority?: "high" | "medium" | "low"
}

const sessionTodos = new Map<string, TodoItem[]>()

export function getSessionTodos(sessionId: string): TodoItem[] {
  return sessionTodos.get(sessionId) ?? []
}

export function clearSessionTodos(sessionId: string): void {
  sessionTodos.delete(sessionId)
}

export const definition: ToolDefinition = {
  id: "todowrite",
  description: "Create, update, and track a structured task list for the current session.",
  parameters: [
    { name: "todos", description: "Array of todo items to set as the current task list", required: true, schema: { type: "array", items: { type: "object", properties: { content: { type: "string" }, status: { type: "string", enum: ["pending", "in_progress", "completed", "cancelled"] }, priority: { type: "string", enum: ["high", "medium", "low"] } } } } },
    { name: "mode", description: "Operation mode: 'update' to merge with existing, 'replace' to overwrite (default: replace)", required: false, schema: { type: "string", enum: ["update", "replace"] } },
  ],
  readOnly: false,
  retryable: true,
  maxRetries: 1,
}

export const handler: ToolHandler = {
  async execute(args, ctx): Promise<ToolExecutionResult> {
    const { todos, mode } = args as { todos: TodoItem[]; mode?: string }
    const sessionId = ctx.sessionId

    if (mode === "update") {
      const existing = sessionTodos.get(sessionId) ?? []
      const updated = [...existing]
      for (const todo of todos) {
        const idx = updated.findIndex((t) => t.content === todo.content)
        if (idx >= 0) {
          updated[idx] = { ...updated[idx], ...todo }
        } else {
          updated.push(todo)
        }
      }
      sessionTodos.set(sessionId, updated)
    } else {
      sessionTodos.set(sessionId, [...todos])
    }

    const current = sessionTodos.get(sessionId) ?? []
    const completed = current.filter((t) => t.status === "completed").length
    const pending = current.filter((t) => t.status === "pending" || t.status === "in_progress").length

    return {
      title: "Task list updated",
      output: `Task list updated: ${current.length} items (${completed} completed, ${pending} pending)\n\nCurrent tasks:\n${current.map((t, i) => `${i + 1}. [${t.status}] ${t.content}${t.priority ? ` (${t.priority})` : ""}`).join("\n")}`,
      metadata: { total: current.length, completed, pending, todos: current },
    }
  },
}

export * as TodoWrite from "."
