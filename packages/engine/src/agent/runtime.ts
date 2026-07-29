import type { AgentMode } from "@zenuxs/schema"
import type { ToolRegistry, RegisteredTool } from "../tool/registry"
import type { PermissionEvaluator } from "../permission/evaluator"

export interface ModeBehavior {
  mode: AgentMode
  allowedTools: string[]
  blockedTools: string[]
  executionStrategy: "sequential" | "parallel" | "single"
  requiresApproval: boolean
  canEditFiles: boolean
  canRunCommands: boolean
  canSpawnSubagents: boolean
  canUseWebSearch: boolean
  canUseWebFetch: boolean
  autoApproveTools: string[]
}

const defaultModeBehaviors: Record<string, ModeBehavior> = {
  act: {
    mode: "act",
    allowedTools: ["*"],
    blockedTools: [],
    executionStrategy: "sequential",
    requiresApproval: true,
    canEditFiles: true,
    canRunCommands: true,
    canSpawnSubagents: true,
    canUseWebSearch: true,
    canUseWebFetch: true,
    autoApproveTools: ["read", "glob", "grep", "webfetch"],
  },
  plan: {
    mode: "plan",
    allowedTools: ["*"],
    blockedTools: ["write", "edit", "apply_patch", "shell"],
    executionStrategy: "sequential",
    requiresApproval: true,
    canEditFiles: false,
    canRunCommands: false,
    canSpawnSubagents: false,
    canUseWebSearch: true,
    canUseWebFetch: true,
    autoApproveTools: ["read", "glob", "grep", "webfetch", "question"],
  },
  yolo: {
    mode: "yolo",
    allowedTools: ["*"],
    blockedTools: [],
    executionStrategy: "sequential",
    requiresApproval: false,
    canEditFiles: true,
    canRunCommands: true,
    canSpawnSubagents: true,
    canUseWebSearch: true,
    canUseWebFetch: true,
    autoApproveTools: ["*"],
  },
  zen: {
    mode: "zen",
    allowedTools: ["*"],
    blockedTools: [],
    executionStrategy: "sequential",
    requiresApproval: false,
    canEditFiles: true,
    canRunCommands: true,
    canSpawnSubagents: true,
    canUseWebSearch: true,
    canUseWebFetch: true,
    autoApproveTools: ["*"],
  },
  ask: {
    mode: "ask",
    allowedTools: ["read", "grep", "glob", "webfetch", "websearch", "question"],
    blockedTools: ["write", "edit", "apply_patch", "shell", "task"],
    executionStrategy: "single",
    requiresApproval: false,
    canEditFiles: false,
    canRunCommands: false,
    canSpawnSubagents: false,
    canUseWebSearch: true,
    canUseWebFetch: true,
    autoApproveTools: ["*"],
  },
  debug: {
    mode: "debug",
    allowedTools: ["read", "grep", "glob", "shell", "lsp", "webfetch"],
    blockedTools: ["write", "edit", "apply_patch"],
    executionStrategy: "sequential",
    requiresApproval: true,
    canEditFiles: false,
    canRunCommands: true,
    canSpawnSubagents: false,
    canUseWebSearch: false,
    canUseWebFetch: false,
    autoApproveTools: ["read", "grep", "glob", "shell"],
  },
  god: {
    mode: "god",
    allowedTools: ["*"],
    blockedTools: [],
    executionStrategy: "sequential",
    requiresApproval: false,
    canEditFiles: true,
    canRunCommands: true,
    canSpawnSubagents: true,
    canUseWebSearch: true,
    canUseWebFetch: true,
    autoApproveTools: ["*"],
  },
}

export function createModeBehavior(mode: AgentMode, overrides?: Partial<ModeBehavior>): ModeBehavior {
  const base = defaultModeBehaviors[mode]
  if (!base) throw new Error(`Unknown mode: ${mode}`)
  return { ...base, ...overrides }
}

export function getModeBehavior(mode: string): ModeBehavior {
  return defaultModeBehaviors[mode] ?? defaultModeBehaviors["act"]!
}

export interface AgentRuntimeOptions {
  tools: ToolRegistry
  permissions: PermissionEvaluator
  modeBehaviors?: Map<string, ModeBehavior>
}

export class AgentRuntime {
  readonly tools: ToolRegistry
  readonly permissions: PermissionEvaluator
  readonly modeBehaviors: Map<string, ModeBehavior>
  private abortControllers = new Map<string, AbortController>()

  constructor(options: AgentRuntimeOptions) {
    this.tools = options.tools
    this.permissions = options.permissions
    this.modeBehaviors = options.modeBehaviors ?? new Map()
  }

  private getEffectiveMode(mode: string): ModeBehavior {
    return this.modeBehaviors.get(mode) ?? getModeBehavior(mode)
  }

  getToolsForMode(mode: string, registry: ToolRegistry): RegisteredTool[] {
    const behavior = this.getEffectiveMode(mode)
    const all = registry.list()
    return all.filter((tool) => {
      if (behavior.allowedTools.includes("*")) {
        return !behavior.blockedTools.includes(tool.definition.id)
      }
      return behavior.allowedTools.includes(tool.definition.id)
    })
  }

  shouldAutoApprove(mode: string, toolId: string): boolean {
    const behavior = this.getEffectiveMode(mode)
    if (behavior.autoApproveTools.includes("*")) return true
    return behavior.autoApproveTools.includes(toolId)
  }

  requiresApproval(mode: string): boolean {
    return this.getEffectiveMode(mode).requiresApproval
  }

  canEditFiles(mode: string): boolean {
    return this.getEffectiveMode(mode).canEditFiles
  }

  canRunCommands(mode: string): boolean {
    return this.getEffectiveMode(mode).canRunCommands
  }

  abort(sessionId: string): void {
    this.abortControllers.get(sessionId)?.abort()
  }

  getAbortSignal(sessionId: string): AbortSignal {
    if (!this.abortControllers.has(sessionId)) {
      this.abortControllers.set(sessionId, new AbortController())
    }
    return this.abortControllers.get(sessionId)!.signal
  }
}

export * as Agent from "."