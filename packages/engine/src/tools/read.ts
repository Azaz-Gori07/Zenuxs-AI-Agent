import type { ToolDefinition, ToolExecutionContext, ToolExecutionResult } from "@zenuxs/schema"
import type { ToolHandler } from "../tool/registry"

export const definition: ToolDefinition = {
  id: "read",
  description: "Read files from the local filesystem. Supports reading with line offset/limit, directory listing, and image/PDF attachments.",
  parameters: [
    { name: "path", description: "Path to file or directory", required: true, schema: { type: "string" } },
    { name: "offset", description: "Starting line number (0-indexed)", required: false, schema: { type: "number" } },
    { name: "limit", description: "Maximum number of lines to read", required: false, schema: { type: "number" } },
  ],
  readOnly: true,
  retryable: true,
  maxRetries: 2,
}

export const handler: ToolHandler = {
  async execute(args, ctx): Promise<ToolExecutionResult> {
    const { path, offset, limit } = args as { path: string; offset?: number; limit?: number }
    try {
      const fs = await import("node:fs/promises")
      const stat = await fs.stat(path)
      if (stat.isDirectory()) {
        const entries = await fs.readdir(path)
        const output = entries.map((e: string) => {
          const childStat = fs.stat(`${path}/${e}`).catch(() => null)
          return `${childStat?.isDirectory() ? "[DIR]" : "[FILE]"} ${e}`
        }).join("\n")
        return { title: `Directory: ${path}`, output, metadata: { path, entries: entries.length } }
      }
      const content = await fs.readFile(path, "utf-8")
      const lines = content.split("\n")
      const start = offset ?? 0
      const end = limit ? start + limit : lines.length
      const sliced = lines.slice(start, end)
      const output = sliced.map((line: string, i: number) => `${start + i + 1}: ${line}`).join("\n")
      return {
        title: `File: ${path}`,
        output,
        metadata: { path, totalLines: lines.length, startLine: start, endLine: end },
      }
    } catch (err) {
      return { title: `Error reading: ${path}`, output: `Failed to read "${path}": ${(err as Error).message}`, metadata: { error: true }, error: (err as Error).message }
    }
  },
}

export * as Read from "."