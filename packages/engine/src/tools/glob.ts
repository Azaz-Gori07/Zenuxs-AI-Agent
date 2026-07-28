import type { ToolDefinition, ToolExecutionContext, ToolExecutionResult } from "@zenuxs/schema"
import type { ToolHandler } from "../tool/registry"

export const definition: ToolDefinition = {
  id: "glob",
  description: "Find files matching a glob pattern using ripgrep.",
  parameters: [
    { name: "pattern", description: "Glob pattern (e.g., **/*.ts)", required: true, schema: { type: "string" } },
    { name: "path", description: "Search path (default: cwd)", required: false, schema: { type: "string" } },
    { name: "maxResults", description: "Maximum results (default: 100)", required: false, schema: { type: "number" } },
  ],
  readOnly: true,
  retryable: true,
  maxRetries: 2,
}

export const handler: ToolHandler = {
  async execute(args, ctx): Promise<ToolExecutionResult> {
    const { pattern, path, maxResults } = args as { pattern: string; path?: string; maxResults?: number }
    try {
      const glob = await import("glob")
      const files = await glob.glob(pattern, { cwd: path ?? process.cwd(), nodir: true })
      const limit = maxResults ?? 100
      const output = files.slice(0, limit).join("\n")
      return {
        title: `Glob: ${pattern}`,
        output: output || "No files matched.",
        metadata: { pattern, total: files.length, truncated: files.length > limit },
      }
    } catch (err) {
      return { title: `Glob error`, output: `Glob failed: ${(err as Error).message}`, metadata: { error: true }, error: (err as Error).message }
    }
  },
}

export * as Glob from "."