import type { ToolDefinition, ToolExecutionContext, ToolExecutionResult } from "@zenuxs/schema"
import type { ToolHandler } from "../tool/registry"

export const definition: ToolDefinition = {
  id: "shell",
  description: "Execute shell commands. Cross-platform support for PowerShell, cmd, and bash.",
  parameters: [
    { name: "command", description: "Shell command to execute", required: true, schema: { type: "string" } },
    { name: "cwd", description: "Working directory", required: false, schema: { type: "string" } },
    { name: "timeout", description: "Timeout in milliseconds", required: false, schema: { type: "number" } },
  ],
  readOnly: false,
  retryable: true,
  maxRetries: 2,
}

export const handler: ToolHandler = {
  async execute(args, ctx): Promise<ToolExecutionResult> {
    const { command, cwd, timeout } = args as { command: string; cwd?: string; timeout?: number }
    try {
      const child = await import("node:child_process")
      return await new Promise((resolve) => {
        const proc = child.exec(command, { cwd, timeout: timeout ?? 30000 }, (error, stdout, stderr) => {
          const output = stdout || stderr || ""
          if (error && !stdout) {
            resolve({ title: `Shell: ${command.substring(0, 60)}`, output: `Error: ${error.message}\n${stderr}`, metadata: { exitCode: error.code ?? 1, error: true }, error: error.message })
          } else {
            resolve({ title: `Shell: ${command.substring(0, 60)}`, output, metadata: { exitCode: 0, truncated: output.length > 10000 } })
          }
        })
        if (ctx.abort) {
          const signal = (args as any).abortSignal as AbortSignal | undefined
          signal?.addEventListener("abort", () => proc.kill())
        }
      })
    } catch (err) {
      return { title: "Shell error", output: `Failed to execute command: ${(err as Error).message}`, metadata: { error: true }, error: (err as Error).message }
    }
  },
}

export * as Shell from "."