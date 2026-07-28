import type { ToolDefinition, ToolExecutionContext, ToolExecutionResult } from "@zenuxs/schema"
import type { ToolHandler } from "../tool/registry"
import { findBestStrategy, type EditOperation } from "./edit-strategies"

export const definition: ToolDefinition = {
  id: "edit",
  description: "Edit a file using search-and-replace. Uses 9 intelligent strategies to find and replace the exact block of code you want to change.",
  parameters: [
    { name: "path", description: "File path to edit", required: true, schema: { type: "string" } },
    { name: "oldText", description: "Text to find (must match exactly or be close)", required: true, schema: { type: "string" } },
    { name: "newText", description: "Replacement text", required: true, schema: { type: "string" } },
    { name: "strategy", description: "Edit strategy to use (auto, simple, lineTrimmed, blockAnchor, whitespaceNormalized, indentationFlexible, escapeNormalized, trimmedBoundary, contextAware, multiOccurrence)", required: false, schema: { type: "string" } },
  ],
  readOnly: false,
  retryable: true,
  maxRetries: 3,
}

export const handler: ToolHandler = {
  async execute(args, ctx): Promise<ToolExecutionResult> {
    const { path, oldText, newText, strategy } = args as { path: string; oldText: string; newText: string; strategy?: string }
    try {
      const fs = await import("node:fs/promises")
      const content = await fs.readFile(path, "utf-8")
      const op: EditOperation = { oldText, newText, path }

      let result: string
      let usedStrategy: string = strategy ?? "auto"

      if (strategy && strategy !== "auto") {
        const strategies = await import("./edit-strategies")
        const found = strategies.EDIT_STRATEGIES.find((s: any) => s.name === strategy)
        if (!found) return { title: "Edit error", output: `Unknown strategy: ${strategy}`, metadata: { error: true }, error: `Unknown strategy: ${strategy}` }
        const check = found.apply(content, op)
        if (!check.success) return { title: "Edit error", output: `Strategy "${strategy}" could not match. ${check.error}`, metadata: { error: true }, error: check.error }
        result = found.execute(content, op)
        usedStrategy = strategy
      } else {
        const best = findBestStrategy(content, op)
        if (!best.result.success) return { title: "Edit failed", output: `Could not find matching text in ${path}. Tried 9 strategies.`, metadata: { error: true, triedStrategies: 9 }, error: best.result.error }
        result = best.strategy.execute(content, op)
        usedStrategy = best.strategy.name
      }

      await fs.writeFile(path, result, "utf-8")
      return {
        title: `Edited: ${path}`,
        output: `Successfully edited ${path} using ${usedStrategy} strategy.`,
        metadata: { path, strategy: usedStrategy, bytes: result.length },
      }
    } catch (err) {
      return { title: `Edit error`, output: `Failed to edit "${path}": ${(err as Error).message}`, metadata: { error: true }, error: (err as Error).message }
    }
  },
}

export * as Edit from "."