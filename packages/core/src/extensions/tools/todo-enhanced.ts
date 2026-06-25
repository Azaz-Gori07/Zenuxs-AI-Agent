/**
 * TodoWrite Tool - Ported from OpenCode's todo.ts
 * PlanExit Tool - Ported from OpenCode's plan.ts
 *
 * Features ported:
 * - Todo list management with status and priority tracking
 * - Plan mode exit with user confirmation
 * - Session-level todo persistence
 */

import { createTool } from "@cline/shared";
import { z } from "zod";

// =============================================================================
// Todo Schemas
// =============================================================================

const TodoStatusSchema = z.enum(["pending", "in_progress", "completed", "cancelled"]);
const TodoPrioritySchema = z.enum(["high", "medium", "low"]);

export const TodoItemSchema = z.object({
  content: z.string().describe("Brief description of the task"),
  status: TodoStatusSchema.describe("Current status of the task"),
  priority: TodoPrioritySchema.describe("Priority level of the task"),
});

export const TodoWriteInputSchema = z.object({
  todos: z.array(TodoItemSchema).describe("List of tasks to track"),
});

export type TodoWriteInput = z.infer<typeof TodoWriteInputSchema>;
export type TodoItem = z.infer<typeof TodoItemSchema>;

// =============================================================================
// In-memory todo storage (per-session)
// =============================================================================

const sessionTodos = new Map<string, TodoItem[]>();

export interface TodoService {
  update: (sessionId: string, todos: TodoItem[]) => Promise<void>;
  get: (sessionId: string) => Promise<TodoItem[]>;
}

export function createDefaultTodoService(): TodoService {
  return {
    async update(sessionId: string, todos: TodoItem[]): Promise<void> {
      sessionTodos.set(sessionId, todos);
    },
    async get(sessionId: string): Promise<TodoItem[]> {
      return sessionTodos.get(sessionId) ?? [];
    },
  };
}

// =============================================================================
// Create TodoWrite Tool
// =============================================================================

export function createTodoWriteTool(todoService?: TodoService): any {
  const service = todoService ?? createDefaultTodoService();

  return createTool({
    name: "todowrite",
    description: "Update the session's todo list with current tasks, statuses, and priorities.",
    inputSchema: TodoWriteInputSchema,
    execute: async (input: TodoWriteInput, context) => {
      const sessionId = context.sessionId ?? "default";
      await service.update(sessionId, input.todos);

      const statusCounts = {
        pending: input.todos.filter((t) => t.status === "pending").length,
        in_progress: input.todos.filter((t) => t.status === "in_progress").length,
        completed: input.todos.filter((t) => t.status === "completed").length,
        cancelled: input.todos.filter((t) => t.status === "cancelled").length,
      };

      return {
        title: "Updated todo list",
        output: `Todo list updated: ${input.todos.length} items\n` +
          `  Pending: ${statusCounts.pending}\n` +
          `  In Progress: ${statusCounts.in_progress}\n` +
          `  Completed: ${statusCounts.completed}\n` +
          `  Cancelled: ${statusCounts.cancelled}`,
        metadata: { todos: input.todos, counts: statusCounts },
      };
    },
  });
}

// =============================================================================
// Create PlanExit Tool (ported from OpenCode plan.ts)
// =============================================================================

export function createPlanExitTool(): any {
  return createTool({
    name: "plan_exit",
    description: "Exit plan mode and switch to build agent. Requires user confirmation.",
    inputSchema: z.object({}),
    execute: async (_input: Record<string, never>, _context) => {
      return {
        title: "Plan mode exit",
        output: "To exit plan mode and switch to build mode, please use the UI to confirm.",
        metadata: { action: "plan_exit_requested" },
      };
    },
  });
}
