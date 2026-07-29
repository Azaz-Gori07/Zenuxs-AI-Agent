import type { ToolDefinition, ToolExecutionContext, ToolExecutionResult } from "@zenuxs/schema"
import type { PermissionEvaluator } from "../permission/evaluator"
import { boundToolOutput } from "./output-bound"

let nextIdentity = 0
function generateIdentity(): number {
  return ++nextIdentity
}

export interface ToolHandler {
  execute(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolExecutionResult>
}

export interface RegisteredTool {
  definition: ToolDefinition
  handler: ToolHandler
  /** Unique identity for stale-call detection. Changes on every register(). */
  readonly identity: number
}

export interface ToolScope {
  readonly id: string
  close(): void
}

export interface ToolMaterialization {
  tools: Map<string, RegisteredTool>
  settle(call: { toolId: string; args: Record<string, unknown>; ctx: ToolExecutionContext }): Promise<ToolExecutionResult>
  getTool(id: string): RegisteredTool | undefined
  hasTool(id: string): boolean
  listDefinitions(): ToolDefinition[]
}

export interface ToolRegistryOptions {
  permissions: PermissionEvaluator
}

export class ToolRegistry {
  private tools = new Map<string, RegisteredTool>()
  private scopes = new Map<string, Set<string>>()
  private permissionActions = new Map<string, string>()
  readonly permissions: PermissionEvaluator

  constructor(options: ToolRegistryOptions) {
    this.permissions = options.permissions
  }

  register(tool: RegisteredTool, scopeId?: string): void {
    const registered: RegisteredTool = {
      definition: tool.definition,
      handler: tool.handler,
      identity: generateIdentity(),
    }
    this.tools.set(tool.definition.id, registered)
    if (scopeId) {
      if (!this.scopes.has(scopeId)) {
        this.scopes.set(scopeId, new Set())
      }
      this.scopes.get(scopeId)!.add(tool.definition.id)
    }
  }

  registerAll(tools: RegisteredTool[], scopeId?: string): void {
    for (const tool of tools) {
      this.register(tool, scopeId)
    }
  }

  createScope(id: string): ToolScope {
    const scope: ToolScope = {
      id,
      close: () => {
        const toolIds = this.scopes.get(id)
        if (toolIds) {
          for (const toolId of toolIds) {
            this.tools.delete(toolId)
          }
          this.scopes.delete(id)
        }
      },
    }
    return scope
  }

  unregister(id: string): boolean {
    this.tools.delete(id)
    for (const [, toolIds] of this.scopes) {
      toolIds.delete(id)
    }
    return true
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

  materialize(context: { mode?: string; permissions?: PermissionEvaluator }): ToolMaterialization {
    const snapshot = new Map(this.tools)
    const effectivePermissions = context.permissions ?? this.permissions

    return {
      tools: new Map(snapshot),
      getTool(id: string) {
        return snapshot.get(id)
      },
      hasTool(id: string) {
        return snapshot.has(id)
      },
      listDefinitions() {
        return Array.from(snapshot.values()).map((t) => t.definition)
      },
      settle: async (call) => {
        const tool = snapshot.get(call.toolId)
        if (!tool) {
          return {
            title: `Unknown tool: ${call.toolId}`,
            output: `The tool "${call.toolId}" is not in the materialized snapshot.`,
            metadata: { error: true },
            error: `Unknown tool: ${call.toolId}`,
          }
        }

        if (context.mode && tool.definition.modeRestrictions) {
          if (!tool.definition.modeRestrictions.includes(context.mode)) {
            return {
              title: `Tool restricted: ${call.toolId}`,
              output: `The tool "${call.toolId}" is not allowed in mode "${context.mode}".`,
              metadata: { error: true, modeRestriction: context.mode },
              error: `Mode restriction: ${context.mode}`,
            }
          }
        }

        const permission = await effectivePermissions.evaluate({
          permission: call.toolId,
          pattern: call.toolId,
          metadata: { args: call.args },
        })

        if (permission.action === "deny") {
          return {
            title: `Permission denied: ${call.toolId}`,
            output: `Permission denied for tool "${call.toolId}".`,
            metadata: { error: true, permission: "deny" },
            error: "Permission denied",
          }
        }

        let result = await tool.handler.execute(call.args, call.ctx)
        result = boundToolOutput(result)
        return result
      },
    }
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
