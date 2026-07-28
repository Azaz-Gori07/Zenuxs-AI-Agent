import type { ToolDefinition, ToolExecutionContext, ToolExecutionResult } from "@zenuxs/schema"
import type { ToolHandler } from "../tool/registry"

export const definition: ToolDefinition = {
  id: "grep",
  description: "Search file contents using ripgrep (rg). Returns matching file paths and line numbers.",
  parameters: [
    { name: "pattern", description: "Search pattern (regex)", required: true, schema: { type: "string" } },
    { name: "path", description: "Search path (default: cwd)", required: false, schema: { type: "string" } },
    { name: "include", description: "File pattern to include", required: false, schema: { type: "string" } },
    { name: "maxResults", description: "Maximum results (default: 100)", required: false, schema: { type: "number" } },
  ],
  readOnly: true,
  retryable: true,
  maxRetries: 2,
}

export const handler: ToolHandler = {
  async execute(args, ctx): Promise<ToolExecutionResult> {
    const { pattern, path, include, maxResults } = args as { pattern: string; path?: string; include?: string; maxResults?: number }
    try {
      const child = await import("node:child_process")
      const rgArgs = ["--line-number", "--color", "never", "-U"]
      if (include) rgArgs.push("--glob", include)
      rgArgs.push(pattern, path ?? ".")
      return await new Promise((resolve) => {
        child.exec(`rg ${rgArgs.map((a) => `"${a}"`).join(" ")}`, { maxBuffer: 1024 * 1024 }, (error, stdout) => {
          const lines = stdout.split("\n").filter(Boolean)
          const limit = maxResults ?? 100
          const output = lines.slice(0, limit).join("\n")
          resolve({
            title: `Grep: ${pattern}`,
            output: output || "No matches found.",
            metadata: { pattern, total: lines.length, truncated: lines.length > limit },
          })
        })
      })
    } catch (err) {
      return { title: `Grep error`, output: `Search failed: ${(err as Error).message}`, metadata: { error: true }, error: (err as Error).message }
    }
  },
}

export * as Grep from "."