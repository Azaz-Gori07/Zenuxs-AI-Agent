import { SessionOrchestrator } from "./session/orchestrator"
import { AgentRuntime } from "./agent/runtime"
import { ToolRegistry } from "./tool/registry"
import { PermissionEvaluator } from "./permission/evaluator"
import type { ModeBehavior } from "./agent/runtime"

export interface EngineConfig {
  workspaceRoot?: string
  cwd?: string
  dataDir?: string
  verbose?: boolean
}

export interface EngineOptions {
  config: EngineConfig
  modeBehaviors?: Map<string, ModeBehavior>
}

export class ZenuxsEngine {
  readonly config: EngineConfig
  readonly orchestrator: SessionOrchestrator
  readonly agent: AgentRuntime
  readonly tools: ToolRegistry
  readonly permissions: PermissionEvaluator

  constructor(options: EngineOptions) {
    this.config = options.config
    this.permissions = new PermissionEvaluator()
    this.tools = new ToolRegistry({ permissions: this.permissions })
    this.agent = new AgentRuntime({
      tools: this.tools,
      permissions: this.permissions,
      modeBehaviors: options.modeBehaviors,
    })
    this.orchestrator = new SessionOrchestrator({
      agent: this.agent,
      tools: this.tools,
    })
  }

  static create(config: EngineConfig): ZenuxsEngine {
    return new ZenuxsEngine({ config })
  }
}

export * as Engine from "."