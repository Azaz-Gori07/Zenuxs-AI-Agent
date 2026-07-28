import type { ToolDefinition, ToolExecutionResult, ToolExecutionContext } from "@zenuxs/schema"
import type { ToolHandler } from "@zenuxs/engine"

export interface PluginHook {
  name: string
  handler: (context: Record<string, unknown>, data: unknown) => unknown | Promise<unknown>
}

export interface PluginManifest {
  name: string
  version: string
  description?: string
  author?: string
  hooks?: PluginHook[]
  tools?: PluginToolDefinition[]
}

export interface PluginToolDefinition {
  id: string
  description: string
  parameters: ToolDefinition["parameters"]
  execute(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolExecutionResult>
}

export class Plugin {
  readonly manifest: PluginManifest
  private toolHandlers: Map<string, PluginToolDefinition> = new Map()
  private hooks: Map<string, PluginHook> = new Map()

  constructor(manifest: PluginManifest) {
    this.manifest = manifest
    for (const tool of manifest.tools ?? []) {
      this.toolHandlers.set(tool.id, tool)
    }
    for (const hook of manifest.hooks ?? []) {
      this.hooks.set(hook.name, hook)
    }
  }

  getTools(): PluginToolDefinition[] {
    return Array.from(this.toolHandlers.values())
  }

  getHooks(): PluginHook[] {
    return Array.from(this.hooks.values())
  }

  getTool(id: string): PluginToolDefinition | undefined {
    return this.toolHandlers.get(id)
  }

  getHook(name: string): PluginHook | undefined {
    return this.hooks.get(name)
  }

  toToolRegistryEntries(): Array<{ definition: ToolDefinition; handler: ToolHandler }> {
    return this.getTools().map((tool) => ({
      definition: {
        id: tool.id,
        description: tool.description,
        parameters: tool.parameters,
        readOnly: false,
        retryable: true,
        maxRetries: 2,
      },
      handler: {
        async execute(args, ctx): Promise<ToolExecutionResult> {
          return tool.execute(args, ctx)
        },
      },
    }))
  }
}

export class PluginRegistry {
  private plugins = new Map<string, Plugin>()

  register(plugin: Plugin): void {
    this.plugins.set(plugin.manifest.name, plugin)
  }

  unregister(name: string): boolean {
    return this.plugins.delete(name)
  }

  get(name: string): Plugin | undefined {
    return this.plugins.get(name)
  }

  list(): Plugin[] {
    return Array.from(this.plugins.values())
  }

  get allTools() {
    return this.plugins.values().flatMap((p) => p.getTools())
  }

  get allHooks() {
    return this.plugins.values().flatMap((p) => p.getHooks())
  }

  async triggerHook(name: string, context: Record<string, unknown>, data: unknown): Promise<unknown[]> {
    const results: unknown[] = []
    for (const plugin of this.plugins.values()) {
      const hook = plugin.getHook(name)
      if (hook) {
        results.push(await hook.handler(context, data))
      }
    }
    return results
  }
}

export const pluginRegistry = new PluginRegistry()

export function createPlugin(manifest: PluginManifest): Plugin {
  return new Plugin(manifest)
}

export * as Plugin from "."