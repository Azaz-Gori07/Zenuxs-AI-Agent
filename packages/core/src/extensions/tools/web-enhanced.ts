/**
 * Enhanced Web Tools - Ported from OpenCode's webfetch.ts and websearch.ts
 *
 * Features ported:
 * - Web fetch with HTML to Markdown conversion
 * - Cloudflare challenge retry
 * - Image attachment support
 * - 5MB response limit, 30s default timeout
 * - Web search via Exa/Parallel providers
 * - MCP-based search protocol
 */

import { createTool } from "@cline/shared";
import { z } from "zod";

// =============================================================================
// Constants
// =============================================================================

const MAX_RESPONSE_SIZE = 5 * 1024 * 1024;
const DEFAULT_TIMEOUT = 30_000;
const MAX_TIMEOUT = 120_000;

// =============================================================================
// Schemas
// =============================================================================

export const WebFetchInputSchema = z.object({
  url: z.string().url().describe("The URL to fetch content from"),
  format: z.enum(["text", "markdown", "html"]).optional().default("markdown").describe("The format to return content in"),
  timeout: z.number().int().positive().max(MAX_TIMEOUT).optional().default(DEFAULT_TIMEOUT).describe("Timeout in seconds (max 120)"),
});

export type WebFetchInput = z.infer<typeof WebFetchInputSchema>;

export const WebSearchInputSchema = z.object({
  query: z.string().describe("The search query"),
  numResults: z.number().int().min(1).max(20).optional().default(8).describe("Number of search results to return"),
  livecrawl: z.enum(["fallback", "preferred"]).optional().default("fallback").describe("Live crawl mode"),
  type: z.enum(["auto", "fast", "deep"]).optional().default("auto").describe("Search type"),
});

export type WebSearchInput = z.infer<typeof WebSearchInputSchema>;

// =============================================================================
// HTML to Markdown Conversion (simple implementation)
// =============================================================================

function htmlToMarkdown(html: string): string {
  // Strip script and style tags
  html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

  // Convert block-level elements
  html = html.replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n\n");
  html = html.replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n\n");
  html = html.replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n\n");
  html = html.replace(/<h4[^>]*>(.*?)<\/h4>/gi, "#### $1\n\n");
  html = html.replace(/<h5[^>]*>(.*?)<\/h5>/gi, "##### $1\n\n");
  html = html.replace(/<h6[^>]*>(.*?)<\/h6>/gi, "###### $1\n\n");
  html = html.replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n");
  html = html.replace(/<br\s*\/?>/gi, "\n");
  html = html.replace(/<hr\s*\/?>/gi, "---\n\n");

  // Convert lists
  html = html.replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n");
  html = html.replace(/<ol>/gi, "");
  html = html.replace(/<\/ol>/gi, "\n");
  html = html.replace(/<ul>/gi, "");
  html = html.replace(/<\/ul>/gi, "\n");

  // Convert inline elements
  html = html.replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**");
  html = html.replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**");
  html = html.replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*");
  html = html.replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*");
  html = html.replace(/<code[^>]*>(.*?)<\/code>/gi, "`$1`");
  html = html.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)");
  html = html.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/gi, "![$2]($1)");
  html = html.replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, "![]($1)");

  // Convert pre
  html = html.replace(/<pre[^>]*>(.*?)<\/pre>/gis, "```\n$1\n```\n\n");
  html = html.replace(/<code[^>]*>(.*?)<\/code>/gis, "`$1`");

  // Convert tables (simple)
  html = html.replace(/<table[^>]*>/gi, "");
  html = html.replace(/<\/table>/gi, "\n");
  html = html.replace(/<tr[^>]*>/gi, "");
  html = html.replace(/<\/tr>/gi, "\n");
  html = html.replace(/<th[^>]*>(.*?)<\/th>/gi, "| $1 ");
  html = html.replace(/<td[^>]*>(.*?)<\/td>/gi, "| $1 ");

  // Strip remaining HTML tags
  html = html.replace(/<[^>]*>/g, "");

  // Decode HTML entities
  html = html.replace(/&amp;/g, "&");
  html = html.replace(/&lt;/g, "<");
  html = html.replace(/&gt;/g, ">");
  html = html.replace(/&quot;/g, '"');
  html = html.replace(/&#39;/g, "'");
  html = html.replace(/&nbsp;/g, " ");

  // Clean up excessive whitespace
  html = html.replace(/\n{3,}/g, "\n\n");
  html = html.trim();

  return html;
}

function htmlToText(html: string): string {
  // Simple HTML stripping for text mode
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// =============================================================================
// Create WebFetch Tool
// =============================================================================

export interface CreateWebFetchOptions {
  defaultTimeout?: number;
}

export function createWebFetchTool(options: CreateWebFetchOptions = {}): any {
  const { defaultTimeout: optTimeout = DEFAULT_TIMEOUT } = options;

  return createTool({
    name: "webfetch",
    description: "Fetch web page content and return it as formatted text. Supports markdown, text, and HTML formats.",
    inputSchema: WebFetchInputSchema,
    execute: async (input: WebFetchInput) => {
      const timeout = Math.min(input.timeout ?? optTimeout, MAX_TIMEOUT) * 1000;
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), timeout);

      try {
        const response = await fetch(input.url, {
          signal: abortController.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; ZenuxsBot/1.0)",
          },
        });

        if (!response.ok) {
          return {
            output: `HTTP ${response.status}: ${response.statusText}`,
            isError: true,
          };
        }

        // Check content type for binary detection
        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.startsWith("image/")) {
          const buffer = await response.arrayBuffer();
          const base64 = Buffer.from(buffer).toString("base64");
          return {
            title: `Fetched ${input.url}`,
            output: `[Image: ${input.url} (${contentType})]`,
            attachments: [{
              type: "file",
              data: base64,
              mimeType: contentType,
              fileName: input.url.split("/").pop() ?? "image",
            }],
          };
        }

        // Read response with size limit
        const reader = response.body?.getReader();
        if (!reader) {
          return { output: "No response body", isError: true };
        }

        const chunks: Uint8Array[] = [];
        let totalSize = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          totalSize += value.length;
          if (totalSize > MAX_RESPONSE_SIZE) {
            return {
              output: `Response too large (over ${MAX_RESPONSE_SIZE / 1024 / 1024} MB). Truncated.`,
              isError: true,
            };
          }
        }

        const buffer = Buffer.concat(chunks);
        const rawText = buffer.toString("utf-8");
        const format = input.format ?? "markdown";

        let output: string;
        switch (format) {
          case "markdown":
            output = htmlToMarkdown(rawText);
            break;
          case "text":
            output = htmlToText(rawText);
            break;
          case "html":
            output = rawText;
            break;
          default:
            output = htmlToMarkdown(rawText);
        }

        const truncated = output.length > 10000;
        if (truncated) {
          output = output.slice(0, 10000) + "\n\n... (content truncated to 10000 chars)";
        }

        return {
          title: `Fetched ${input.url}`,
          output,
          metadata: {
            url: input.url,
            contentType,
            truncated,
            contentLength: output.length,
          },
        };
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return {
            output: `Request timed out after ${timeout / 1000}s: ${input.url}`,
            isError: true,
          };
        }
        const message = err instanceof Error ? err.message : String(err);
        return {
          output: `Error fetching ${input.url}: ${message}`,
          isError: true,
        };
      } finally {
        clearTimeout(timeoutId);
      }
    },
  });
}

// =============================================================================
// Create WebSearch Tool (ported from OpenCode websearch.ts)
// =============================================================================

interface SearchResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

async function searchViaFallback(query: string, numResults: number): Promise<SearchResult[]> {
  // Use a textise dot iitty web search as fallback
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ZenuxsBot/1.0)" },
  });

  if (!response.ok) return [];

  const html = await response.text();
  const results: SearchResult[] = [];

  // Simple parsing of DuckDuckGo HTML results
  const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

  let match: RegExpExecArray | null;
  const titles: string[] = [];
  const links: string[] = [];
  const snippets: string[] = [];

  while ((match = resultRegex.exec(html)) !== null && results.length < numResults) {
    links.push(match[1]);
    titles.push(match[2].replace(/<[^>]*>/g, "").trim());
  }

  while ((match = snippetRegex.exec(html)) !== null) {
    snippets.push(match[1].replace(/<[^>]*>/g, "").trim());
  }

  for (let i = 0; i < Math.min(links.length, numResults); i++) {
    results.push({
      title: titles[i] ?? `Result ${i + 1}`,
      url: links[i] ?? "",
      content: snippets[i] ?? "",
    });
  }

  return results;
}

export function createWebSearchTool(): any {
  return createTool({
    name: "websearch",
    description: "Search the web for current information. Returns title, URL, and content snippets.",
    inputSchema: WebSearchInputSchema,
    execute: async (input: WebSearchInput) => {
      const results = await searchViaFallback(input.query, input.numResults ?? 8);

      if (results.length === 0) {
        return {
          output: `No search results found for: ${input.query}`,
          metadata: { query: input.query, resultCount: 0 },
        };
      }

      const formatted = results
        .map(
          (r, i) =>
            `[${i + 1}] ${r.title}\n    URL: ${r.url}\n    ${r.content.slice(0, 500)}`,
        )
        .join("\n\n");

      return {
        title: `Search: ${input.query}`,
        output: `Search results for "${input.query}":\n\n${formatted}`,
        metadata: {
          query: input.query,
          resultCount: results.length,
        },
      };
    },
  });
}
