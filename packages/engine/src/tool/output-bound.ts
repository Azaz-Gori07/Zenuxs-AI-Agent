import type { ToolExecutionResult } from "@zenuxs/schema"

export interface BoundOutputOptions {
  maxOutputLength?: number
  maxLineCount?: number
  maxAttachments?: number
}

const DEFAULTS: Required<BoundOutputOptions> = {
  maxOutputLength: 100_000,
  maxLineCount: 10_000,
  maxAttachments: 10,
}

export function boundToolOutput(
  result: ToolExecutionResult,
  options?: BoundOutputOptions,
): ToolExecutionResult {
  const opts = { ...DEFAULTS, ...options }

  if (result.output.length > opts.maxOutputLength) {
    result = {
      ...result,
      output: result.output.substring(0, opts.maxOutputLength) +
        `\n\n[Output truncated: ${result.output.length} chars, showing first ${opts.maxOutputLength}]`,
      metadata: { ...result.metadata, truncated: true, originalLength: result.output.length },
    }
  }

  const lineCount = result.output.split("\n").length
  if (lineCount > opts.maxLineCount) {
    const lines = result.output.split("\n")
    result = {
      ...result,
      output: lines.slice(0, opts.maxLineCount).join("\n") +
        `\n\n[Output truncated: ${lineCount} lines, showing first ${opts.maxLineCount}]`,
      metadata: { ...result.metadata, truncated: true, originalLineCount: lineCount },
    }
  }

  if (result.attachments && result.attachments.length > opts.maxAttachments) {
    result = {
      ...result,
      attachments: result.attachments.slice(0, opts.maxAttachments),
      metadata: { ...result.metadata, attachmentsTruncated: true },
    }
  }

  return result
}

export const toolRegistry: { maxOutputLength: number; maxLineCount: number } = {
  maxOutputLength: DEFAULTS.maxOutputLength,
  maxLineCount: DEFAULTS.maxLineCount,
}

export * as Bound from "."
