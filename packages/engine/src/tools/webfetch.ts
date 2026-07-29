import type { ToolDefinition, ToolExecutionContext, ToolExecutionResult } from "@zenuxs/schema"
import type { ToolHandler } from "../tool/registry"
import { boundToolOutput } from "../tool/output-bound"

function htmlToMarkdown(html: string): string {
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")

  text = text
    .replace(/<h1[^>]*>/gi, "\n# ")
    .replace(/<\/h1>/gi, "\n")
    .replace(/<h2[^>]*>/gi, "\n## ")
    .replace(/<\/h2>/gi, "\n")
    .replace(/<h3[^>]*>/gi, "\n### ")
    .replace(/<\/h3>/gi, "\n")
    .replace(/<h4[^>]*>/gi, "\n#### ")
    .replace(/<\/h4>/gi, "\n")
    .replace(/<h5[^>]*>/gi, "\n##### ")
    .replace(/<\/h5>/gi, "\n")
    .replace(/<h6[^>]*>/gi, "\n###### ")
    .replace(/<\/h6>/gi, "\n")
    .replace(/<strong[^>]*>/gi, "**")
    .replace(/<\/strong>/gi, "**")
    .replace(/<b[^>]*>/gi, "**")
    .replace(/<\/b>/gi, "**")
    .replace(/<em[^>]*>/gi, "*")
    .replace(/<\/em>/gi, "*")
    .replace(/<i[^>]*>/gi, "*")
    .replace(/<\/i>/gi, "*")
    .replace(/<code[^>]*>/gi, "`")
    .replace(/<\/code>/gi, "`")
    .replace(/<pre[^>]*>/gi, "\n```\n")
    .replace(/<\/pre>/gi, "\n```\n")
    .replace(/<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)")
    .replace(/<img\s+(?:[^>]*?\s+)?src="([^"]*)"[^>]*>/gi, "![image]($1)")
    .replace(/<ul[^>]*>/gi, "\n")
    .replace(/<\/ul>/gi, "\n")
    .replace(/<ol[^>]*>/gi, "\n")
    .replace(/<\/ol>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<p[^>]*>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  return text
}

export const definition: ToolDefinition = {
  id: "webfetch",
  description: "Fetch content from a URL. Supports text, markdown, and HTML output formats with automatic conversion.",
  parameters: [
    { name: "url", description: "URL to fetch", required: true, schema: { type: "string", format: "uri" } },
    { name: "format", description: "Output format: text (plain), markdown (converted, default), html (raw)", required: false, schema: { type: "string", enum: ["text", "markdown", "html"] } },
    { name: "timeout", description: "Request timeout in ms (default: 15000)", required: false, schema: { type: "number" } },
    { name: "headers", description: "Custom HTTP headers as JSON object", required: false, schema: { type: "object", additionalProperties: { type: "string" } } },
  ],
  readOnly: true,
  retryable: true,
  maxRetries: 2,
}

const MAX_RESPONSE_SIZE = 200_000

export const handler: ToolHandler = {
  async execute(args, ctx): Promise<ToolExecutionResult> {
    const { url, format, timeout, headers } = args as {
      url: string
      format?: string
      timeout?: number
      headers?: Record<string, string>
    }

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeout ?? 15000)
      if (ctx.abort) {
        const signal = (args as any).abortSignal as AbortSignal | undefined
        signal?.addEventListener("abort", () => controller.abort(), { once: true })
      }

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "ZenuxsCode/1.0", ...headers },
      })
      clearTimeout(timer)

      if (!response.ok) {
        return boundToolOutput({
          title: `HTTP ${response.status}: ${url}`,
          output: `Request failed with status ${response.status} ${response.statusText}`,
          metadata: { url, status: response.status, error: true },
          error: `HTTP ${response.status}: ${response.statusText}`,
        })
      }

      const contentType = response.headers.get("content-type") ?? ""
      const isHtml = contentType.includes("text/html") || contentType.includes("application/xhtml")
      const raw = await response.text()
      const truncated = raw.length > MAX_RESPONSE_SIZE
      const body = truncated ? raw.substring(0, MAX_RESPONSE_SIZE) : raw

      let output: string
      const fmt = format ?? (isHtml ? "markdown" : "text")

      if (fmt === "html") {
        output = body
      } else if (fmt === "markdown" && isHtml) {
        output = htmlToMarkdown(body)
      } else {
        output = body.replace(/<[^>]+>/g, "").trim()
      }

      return boundToolOutput({
        title: `Web: ${url}`,
        output,
        metadata: {
          url,
          contentType,
          originalSize: raw.length,
          truncated,
          format: fmt,
        },
      })
    } catch (err) {
      const message = (err as Error).message
      if (message.includes("abort") || message.includes("timeout")) {
        return {
          title: `Fetch timeout: ${url}`,
          output: `Request timed out after ${timeout ?? 15000}ms`,
          metadata: { url, timeout: true, error: true },
          error: message,
        }
      }
      return {
        title: `Fetch error`,
        output: `Failed to fetch "${url}": ${message}`,
        metadata: { url, error: true },
        error: message,
      }
    }
  },
}

export * as WebFetch from "."
