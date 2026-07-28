import type { ToolDefinition, ToolExecutionContext, ToolExecutionResult } from "@zenuxs/schema"
import type { ToolHandler } from "../tool/registry"

export const definition: ToolDefinition = {
  id: "websearch",
  description: "Search the web for information. Returns relevant results from search engines.",
  parameters: [
    { name: "query", description: "Search query", required: true, schema: { type: "string" } },
    { name: "count", description: "Number of results", required: false, schema: { type: "number" } },
  ],
  readOnly: true,
  retryable: true,
  maxRetries: 2,
}

export const handler: ToolHandler = {
  async execute(args, ctx): Promise<ToolExecutionResult> {
    const { query, count } = args as { query: string; count?: number }
    try {
      const resp = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`, {
        signal: ctx.abort ? AbortSignal.timeout(15000) : undefined,
      })
      const data = await resp.json() as { AbstractText?: string; RelatedTopics?: Array<{ Text?: string; FirstURL?: string }> }
      const results = data.RelatedTopics?.slice(0, count ?? 8) ?? []
      const output = results.map((r: any) => `- ${r.Text ?? ""}`).join("\n")
      return { title: `Search: ${query}`, output: output || "No results.", metadata: { query, count: results.length } }
    } catch (err) {
      return { title: `Search error`, output: `Search failed: ${(err as Error).message}`, metadata: { error: true }, error: (err as Error).message }
    }
  },
}

export * as WebSearch from "."