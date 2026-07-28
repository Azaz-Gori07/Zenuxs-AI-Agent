import type { ToolDefinition, ToolExecutionContext, ToolExecutionResult } from "@zenuxs/schema"
import type { PermissionEvaluator } from "../permission/evaluator"

export interface ToolHandler {
  execute(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolExecutionResult>
}

export interface RegisteredTool {
  definition: ToolDefinition
  handler: ToolHandler
}

export interface ToolRegistryOptions {
  permissions: PermissionEvaluator
}

export class ToolRegistry {
  private tools = new Map<string, RegisteredTool>()
  readonly permissions: PermissionEvaluator

  constructor(options: ToolRegistryOptions) {
    this.permissions = options.permissions
  }

  register(tool: RegisteredTool): void {
    this.tools.set(tool.definition.id, tool)
  }

  registerAll(tools: RegisteredTool[]): void {
    for (const tool of tools) {
      this.register(tool)
    }
  }

  unregister(id: string): boolean {
    return this.tools.delete(id)
  }

  get(id: string): RegisteredTool | undefined {
    return this.tools.get(id)
  }

  list(): RegisteredTool[] {
    return Array.from(this.tools.values())
  }

  getIds(): string[] {
    return Array.from(this.tools.keys())
  }

  async execute(
    toolId: string,
    args: Record<string, unknown>,
    ctx: ToolExecutionContext,
  ): Promise<ToolExecutionResult> {
    const tool = this.tools.get(toolId)
    if (!tool) {
      return {
        title: `Unknown tool: ${toolId}`,
        output: `The tool "${toolId}" is not registered.`,
        metadata: { error: true },
        error: `Unknown tool: ${toolId}`,
      }
    }

    const permission = await this.permissions.evaluate({
      permission: toolId,
      pattern: toolId,
      metadata: { args },
    })

    if (permission.action === "deny") {
      return {
        title: `Permission denied: ${toolId}`,
        output: `Permission denied for tool "${toolId}".`,
        metadata: { error: true, permission: "deny" },
        error: "Permission denied",
      }
    }

    return tool.handler.execute(args, ctx)
  }

  filterByMode(mode: string, modes: Map<string, string[]>): RegisteredTool[] {
    const allowed = modes.get(mode)
    if (!allowed || allowed.includes("*")) {
      return this.list()
    }
    return this.list().filter((t) => allowed.includes(t.definition.id))
  }
}

export * as Tool from "."