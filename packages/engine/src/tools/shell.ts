import { spawn } from "node:child_process"
import type { ToolDefinition, ToolExecutionResult } from "@zenuxs/schema"
import type { ToolHandler } from "../tool/registry"
import { boundToolOutput } from "../tool/output-bound"

export const definition: ToolDefinition = {
  id: "shell",
  description: "Execute shell commands with proper timeout, output bounding, and cross-platform support.",
  parameters: [
    { name: "command", description: "Shell command to execute", required: true, schema: { type: "string" } },
    { name: "cwd", description: "Working directory (default: current process cwd)", required: false, schema: { type: "string" } },
    { name: "timeout", description: "Timeout in milliseconds (default: 30000)", required: false, schema: { type: "number" } },
    { name: "shell", description: "Shell to use (auto-detected if not specified)", required: false, schema: { type: "string" } },
    { name: "env", description: "Additional environment variables", required: false, schema: { type: "object", additionalProperties: { type: "string" } } },
  ],
  readOnly: false,
  retryable: true,
  maxRetries: 2,
}

function detectShell(): string {
  if (process.platform === "win32") {
    return process.env.COMSPEC ?? "cmd.exe"
  }
  return process.env.SHELL ?? "/bin/bash"
}

function getShellArgs(shell: string, command: string): string[] {
  if (shell.endsWith("cmd.exe") || shell === "cmd") {
    return ["/d", "/c", command]
  }
  if (shell.endsWith("powershell.exe") || shell === "powershell") {
    return ["-NoProfile", "-Command", command]
  }
  if (shell.endsWith("pwsh.exe") || shell === "pwsh") {
    return ["-NoProfile", "-Command", command]
  }
  return ["-c", command]
}

export const handler: ToolHandler = {
  async execute(args, _ctx): Promise<ToolExecutionResult> {
    const { command, cwd, timeout, shell: shellOverride, env: extraEnv } = args as {
      command: string
      cwd?: string
      timeout?: number
      shell?: string
      env?: Record<string, string>
    }

    const shell = shellOverride ?? detectShell()
    const shellArgs = getShellArgs(shell, command)
    const timeoutMs = timeout ?? 30000

    return new Promise((resolve) => {
      const child = spawn(shell, shellArgs, {
        cwd: cwd ?? process.cwd(),
        env: extraEnv ? { ...process.env, ...extraEnv } : process.env,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      })
      child.unref()

      let stdout = ""
      let stderr = ""
      let timedOut = false

      const timer = setTimeout(() => {
        timedOut = true
        child.kill("SIGTERM")
        setTimeout(() => {
          try { child.kill("SIGKILL") } catch {}
        }, 2000)
      }, timeoutMs)

      child.stdout?.on("data", (data: Buffer) => {
        stdout += data.toString()
      })

      child.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString()
      })

      child.on("error", (err) => {
        clearTimeout(timer)
        const output = stderr || err.message
        resolve(boundToolOutput({
          title: `Shell: ${command.substring(0, 60)}${command.length > 60 ? "..." : ""}`,
          output: `Failed to spawn process: ${err.message}\n${stderr}`,
          metadata: { exitCode: -1, error: true, command: command.substring(0, 200) },
          error: err.message,
        }))
      })

      child.on("close", (exitCode) => {
        clearTimeout(timer)

        if (timedOut) {
          resolve(boundToolOutput({
            title: `Shell timed out: ${command.substring(0, 60)}...`,
            output: `Command timed out after ${timeoutMs}ms.\n${stdout.substring(0, 5000)}${stderr ? `\nStderr:\n${stderr.substring(0, 5000)}` : ""}`,
            metadata: { exitCode: null, timedOut: true, timeout: timeoutMs, command: command.substring(0, 200) },
            error: `Command timed out after ${timeoutMs}ms`,
          }))
          return
        }

        const combined = stdout + (stderr ? `\nStderr:\n${stderr}` : "")
        const isError = exitCode !== 0 && exitCode !== null

        resolve(boundToolOutput({
          title: `Shell: ${command.substring(0, 60)}${command.length > 60 ? "..." : ""}`,
          output: combined || "(no output)",
          metadata: {
            exitCode,
            command: command.substring(0, 200),
            pid: child.pid,
            ...(isError ? { error: true } : {}),
          },
          ...(isError ? { error: `Exit code ${exitCode}${stderr ? `: ${stderr.substring(0, 200)}` : ""}` } : {}),
        }))
      })
    })
  },
}

export * as Shell from "."
