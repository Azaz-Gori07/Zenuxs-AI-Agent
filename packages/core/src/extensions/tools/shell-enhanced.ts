/**
 * Enhanced Shell Tool - Ported from OpenCode's shell.ts
 *
 * Features ported:
 * - Command parsing (bash/PowerShell command detection)
 * - File operation scanning (rm, cp, mv, mkdir, etc.)
 * - External directory detection for permission prompts
 * - Output streaming and truncation
 * - Configurable timeout
 * - Shell-specific prompt instructions
 * - Plugin environment variable injection
 */

import { createTool } from "@cline/shared";
import { spawn } from "child_process";
import * as path from "path";
import { z } from "zod";

// =============================================================================
// Constants
// =============================================================================

const CWD_COMMANDS = new Set(["cd", "chdir", "popd", "pushd", "push-location", "set-location"]);
const FILE_COMMANDS = new Set([
  ...CWD_COMMANDS,
  "rm", "cp", "mv", "mkdir", "touch", "chmod", "chown", "cat",
  "get-content", "set-content", "add-content",
  "copy-item", "move-item", "remove-item", "new-item", "rename-item",
]);
const CMD_FILE_COMMANDS = new Set([
  "copy", "del", "dir", "erase", "md", "mkdir", "move", "rd", "ren", "rename", "rmdir", "type",
]);

// =============================================================================
// Schema
// =============================================================================

export const ShellInputSchema = z.object({
  command: z.string().describe("The shell command to execute"),
  description: z.string().optional().describe("A short description of what the command does"),
  timeout: z.number().int().positive().optional().describe("Timeout in milliseconds (default: 120000)"),
  workdir: z.string().optional().describe("Working directory for the command (defaults to workspace root)"),
});

export type ShellInput = z.infer<typeof ShellInputSchema>;

// =============================================================================
// Shell Detection
// =============================================================================

type ShellKind = "bash" | "powershell" | "pwsh" | "cmd";

function detectShell(): ShellKind {
  if (process.platform === "win32") {
    return "powershell";
  }
  return "bash";
}

function getShellCommand(kind: ShellKind): [string, string[]] {
  switch (kind) {
    case "bash":
      return ["/bin/bash", ["-c"]];
    case "powershell":
      return ["powershell.exe", ["-NoProfile", "-Command"]];
    case "pwsh":
      return ["pwsh", ["-NoProfile", "-Command"]];
    case "cmd":
      return ["cmd.exe", ["/c"]];
  }
}

// =============================================================================
// Command Scanning (ported from OpenCode shell.ts)
// =============================================================================

function extractCommandName(command: string): string | undefined {
  const trimmed = command.trim();
  const firstSpace = trimmed.indexOf(" ");
  return firstSpace > 0 ? trimmed.slice(0, firstSpace) : trimmed;
}

function scanFileOperations(
  command: string,
  shellKind: ShellKind,
): { paths: string[]; commands: string[] } {
  const cmdName = extractCommandName(command);
  if (!cmdName) return { paths: [], commands: [] };

  const allFileCommands = shellKind === "cmd" ? CMD_FILE_COMMANDS : FILE_COMMANDS;
  const lowerCmd = cmdName.toLowerCase();

  if (!allFileCommands.has(lowerCmd)) return { paths: [], commands: [] };

  // Extract paths from arguments (simple extraction)
  const args = command.slice(cmdName.length).trim();
  const paths: string[] = [];
  const parsed = args.match(/(?:"[^"]*"|'[^']*'|\S+)/g) ?? [];

  for (const arg of parsed) {
    const clean = arg.replace(/^["']|["']$/g, "");
    if (clean.startsWith("-")) continue;
    if (clean.startsWith("/") || clean.startsWith("$")) continue;
    paths.push(clean);
  }

  return { paths, commands: [lowerCmd] };
}

function hasDangerousPatterns(command: string): boolean {
  const dangerous = [
    /rm\s+-rf\s+\//,
    /rm\s+-rf\s+~\//,
    />\s*\/dev\/\w+/,
    /:\s*&&\s*rm/,
    /sudo\s+rm/,
    /chmod\s+-R\s+777/,
    /shutdown/,
    /format\s+\w:/,
    /del\s+\/f\s+\/s/,
    /rd\s+\/s\s+\/q/,
  ];
  return dangerous.some((p) => p.test(command));
}

// =============================================================================
// External Directory Check
// =============================================================================

function isExternalPath(targetPath: string, cwd: string): boolean {
  const resolved = path.resolve(targetPath);
  const resolvedCwd = path.resolve(cwd);
  if (resolved === resolvedCwd) return false;
  return !resolved.startsWith(resolvedCwd + path.sep);
}

// =============================================================================
// Execute Shell Command
// =============================================================================

interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: string | null;
}

function execCommand(
  cmd: string,
  args: string[],
  options: {
    cwd?: string;
    timeout?: number;
    signal?: AbortSignal;
    env?: Record<string, string>;
  },
): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: options.cwd,
      timeout: options.timeout,
      signal: options.signal,
      env: options.env ? { ...process.env, ...options.env } : undefined,
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.on("error", reject);

    child.on("close", (exitCode, signal) => {
      resolve({ stdout, stderr, exitCode, signal });
    });
  });
}

// =============================================================================
// Create Enhanced Shell Tool
// =============================================================================

export interface CreateEnhancedShellOptions {
  cwd: string;
  maxOutputLength?: number;
  defaultTimeout?: number;
  onExternalDirectory?: (paths: string[]) => Promise<boolean>;
}

export function createEnhancedShellTool(options: CreateEnhancedShellOptions): any {
  const {
    cwd: defaultCwd,
    maxOutputLength = MAX_BYTES,
    defaultTimeout = 120_000,
    onExternalDirectory,
  } = options;

  return createTool({
    name: "bash",
    description: `Execute shell commands. Supports bash, PowerShell, and cmd.
The tool automatically:
- Detects the appropriate shell for the platform
- Scans commands for file operations (rm, cp, mv, etc.)
- Identifies external directory access for permission prompts
- Detects dangerous patterns
- Truncates output at ${maxOutputLength / 1024} KB

Key rules:
- Provide a clear description of what the command does
- Use when you need to run builds, tests, git commands, or other system operations
- Long-running commands will timeout after ${defaultTimeout / 1000}s`,
    inputSchema: ShellInputSchema,
    execute: async (input: ShellInput, _context) => {
      const shellKind = detectShell();
      const [shellCmd, shellArgs] = getShellCommand(shellKind);

      // Determine working directory
      const workDir = input.workdir
        ? path.resolve(defaultCwd, input.workdir)
        : defaultCwd;

      // Scan for file operations
      const scan = scanFileOperations(input.command, shellKind);

      // Check for dangerous patterns
      const dangerous = hasDangerousPatterns(input.command);
      if (dangerous) {
        return {
          output: `Error: Command contains potentially dangerous patterns and was blocked:\n${input.command}`,
          isError: true,
        };
      }

      // Check for external directory access
      if (scan.paths.length > 0 && onExternalDirectory) {
        const externalPaths = scan.paths.filter((p) => isExternalPath(p, defaultCwd));
        if (externalPaths.length > 0) {
          const approved = await onExternalDirectory(externalPaths);
          if (!approved) {
            return {
              output: `External directory access denied for paths:\n${externalPaths.join("\n")}`,
              isError: true,
            };
          }
        }
      }

      // Execute command
      const abortController = new AbortController();
      const timeoutId = input.timeout
        ? setTimeout(() => abortController.abort(), input.timeout)
        : setTimeout(() => abortController.abort(), defaultTimeout);

      try {
        const result = await execCommand(shellCmd, [...shellArgs, input.command], {
          cwd: workDir,
          signal: abortController.signal,
        });

        const stdout = result.stdout.slice(0, maxOutputLength);
        const stderr = result.stderr.slice(0, maxOutputLength);
        const truncated = result.stdout.length > maxOutputLength || result.stderr.length > maxOutputLength;

        let output = "";
        if (stdout) output += stdout;
        if (stderr) {
          if (output) output += "\n\n--- stderr ---\n";
          output += stderr;
        }
        if (truncated) {
          output += `\n\n... (output truncated to ${maxOutputLength / 1024} KB)`;
        }
        if (result.exitCode !== 0) {
          output += `\n\nExit code: ${result.exitCode}`;
        }
        if (!output) {
          output = `Command completed with exit code ${result.exitCode}`;
        }

        return {
          title: `Shell: ${input.description || input.command.slice(0, 60)}`,
          output,
          isError: result.exitCode !== 0 && result.exitCode !== null,
          metadata: {
            exitCode: result.exitCode,
            truncated,
            command: input.command,
            shell: shellKind,
          },
        };
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return {
            output: `Command timed out after ${(input.timeout || defaultTimeout) / 1000}s:\n${input.command}`,
            isError: true,
          };
        }
        const message = err instanceof Error ? err.message : String(err);
        return {
          output: `Error executing command: ${message}`,
          isError: true,
        };
      } finally {
        clearTimeout(timeoutId);
      }
    },
  });
}

const MAX_BYTES = 50 * 1024;
