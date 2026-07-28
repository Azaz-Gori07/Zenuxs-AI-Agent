import type { ToolDefinition, ToolExecutionContext, ToolExecutionResult } from "@zenuxs/schema"
import type { ToolHandler } from "../tool/registry"

export const definition: ToolDefinition = {
  id: "webfetch",
  description: "Fetch content from a URL and convert HTML to markdown.",
  parameters: [
    { name: "url", description: "URL to fetch", required: true, schema: { type: "string" } },
    { name: "format", description: "Output format (text, markdown, html)", required: false, schema: { type: "string", enum: ["text", "markdown", "html"] } },
  ],
  readOnly: true,
  retryable: true,
  maxRetries: 2,
}

export const handler: ToolHandler = {
  async execute(args, ctx): Promise<ToolExecutionResult> {
    const { url, format } = args as { url: string; format?: string }
    try {
      const response = await fetch(url, { signal: ctx.abort ? AbortSignal.timeout(30000) : undefined })
      const text = await response.text()
      if (format === "html") {
        return { title: `Web: ${url}`, output: text, metadata: { url, size: text.length } }
      }
      const output = text.replace(/<[^>]+>/g, "").substring(0, 50000)
      return { title: `Web: ${url}`, output, metadata: { url, size: text.length, truncated: text.length > 50000 } }
    } catch (err) {
      return { title: `Fetch error`, output: `Failed to fetch "${url}": ${(err as Error).message}`, metadata: { error: true }, error: (err as Error).message }
    }
  },
}

export * as WebFetch from "."