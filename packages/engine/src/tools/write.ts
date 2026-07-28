import type { ToolDefinition, ToolExecutionContext, ToolExecutionResult } from "@zenuxs/schema"
import type { ToolHandler } from "../tool/registry"

export const definition: ToolDefinition = {
  id: "write",
  description: "Write content to a file. Creates parent directories if they don't exist.",
  parameters: [
    { name: "path", description: "File path to write", required: true, schema: { type: "string" } },
    { name: "content", description: "Content to write", required: true, schema: { type: "string" } },
  ],
  readOnly: false,
  retryable: true,
  maxRetries: 2,
}

export const handler: ToolHandler = {
  async execute(args, ctx): Promise<ToolExecutionResult> {
    const { path, content } = args as { path: string; content: string }
    try {
      const fs = await import("node:fs/promises")
      const parent = path.substring(0, path.lastIndexOf("/"))
      if (parent) await fs.mkdir(parent, { recursive: true })
      await fs.writeFile(path, content, "utf-8")
      return {
        title: `Wrote: ${path}`,
        output: `Successfully wrote ${content.length} bytes to ${path}`,
        metadata: { path, bytes: content.length },
      }
    } catch (err) {
      return { title: `Error writing: ${path}`, output: `Failed to write "${path}": ${(err as Error).message}`, metadata: { error: true }, error: (err as Error).message }
    }
  },
}

export * as Write from "."