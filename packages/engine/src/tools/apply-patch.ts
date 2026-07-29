import type { ToolDefinition, ToolExecutionContext, ToolExecutionResult } from "@zenuxs/schema"
import type { ToolHandler } from "../tool/registry"
import { boundToolOutput } from "../tool/output-bound"

export interface PatchOperation {
  oldText: string
  newText: string
}

export interface PatchFile {
  path: string
  operations: PatchOperation[]
}

export const definition: ToolDefinition = {
  id: "apply_patch",
  description: "Apply a structured patch to files. Each patch contains multiple search-and-replace operations applied in sequence to a single file.",
  parameters: [
    { name: "path", description: "File path to patch", required: true, schema: { type: "string" } },
    { name: "operations", description: "Array of search-and-replace operations", required: true, schema: { type: "array", items: { type: "object", properties: { oldText: { type: "string" }, newText: { type: "string" } }, required: ["oldText", "newText"] } } },
    { name: "dryRun", description: "If true, show what would change without applying", required: false, schema: { type: "boolean" } },
  ],
  readOnly: false,
  retryable: true,
  maxRetries: 2,
}

export const handler: ToolHandler = {
  async execute(args, ctx): Promise<ToolExecutionResult> {
    const { path, operations, dryRun } = args as { path: string; operations: PatchOperation[]; dryRun?: boolean }
    try {
      const fs = await import("node:fs/promises")
      const original = await fs.readFile(path, "utf-8")
      let content = original
      const applied: { operation: number; success: boolean; error?: string }[] = []

      for (let i = 0; i < operations.length; i++) {
        const op = operations[i]
        const idx = content.indexOf(op.oldText)
        if (idx === -1) {
          applied.push({ operation: i + 1, success: false, error: "oldText not found in file" })
          continue
        }
        content = content.substring(0, idx) + op.newText + content.substring(idx + op.oldText.length)
        applied.push({ operation: i + 1, success: true })
      }

      const succeeded = applied.filter((a) => a.success).length
      const failed = applied.filter((a) => !a.success).length
      const linesAdded = operations
        .filter((_, i) => applied[i]?.success)
        .reduce((sum, op) => sum + op.newText.split("\n").length - op.oldText.split("\n").length, 0)

      if (!dryRun) {
        await fs.writeFile(path, content, "utf-8")
      }

      const summary = dryRun
        ? `[DRY RUN] Would apply ${operations.length} operations to ${path}`
        : `Applied ${operations.length} operations to ${path}`

      return boundToolOutput({
        title: dryRun ? `Preview patch: ${path}` : `Patched: ${path}`,
        output: `${summary}\n- Succeeded: ${succeeded}\n- Failed: ${failed}\n- Net lines: ${linesAdded >= 0 ? "+" : ""}${linesAdded}\n\nDetails:\n${applied.map((a) => `  Op ${a.operation}: ${a.success ? "✓" : "✗"}${a.error ? ` - ${a.error}` : ""}`).join("\n")}`,
        metadata: {
          path,
          totalOperations: operations.length,
          succeeded,
          failed,
          linesAdded,
          dryRun: !!dryRun,
          originalSize: original.length,
          newSize: content.length,
        },
      })
    } catch (err) {
      return {
        title: `Patch error: ${path}`,
        output: `Failed to patch "${path}": ${(err as Error).message}`,
        metadata: { path, error: true },
        error: (err as Error).message,
      }
    }
  },
}

export * as ApplyPatch from "."
