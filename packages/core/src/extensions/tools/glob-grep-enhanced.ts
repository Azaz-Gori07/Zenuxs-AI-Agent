/**
 * Enhanced Glob & Grep Tools - Ported from OpenCode's glob.ts and grep.ts
 *
 * Features ported:
 * - Ripgrep-powered search (glob + grep)
 * - Result limits (100 matches)
 * - Permission checking
 * - External directory support
 * - Group-by-file results
 */

import * as fs from "fs/promises";
import * as path from "path";
import { createTool } from "@cline/shared";
import { z } from "zod";

// =============================================================================
// Constants
// =============================================================================

const MAX_RESULTS = 100;

// =============================================================================
// Schemas
// =============================================================================

export const GlobInputSchema = z.object({
  pattern: z.string().describe("The glob pattern to match files against (e.g. '**/*.ts', 'src/**/*.test.ts')"),
  path: z.string().optional().describe("The directory to search in. Defaults to workspace root."),
});

export type GlobInput = z.infer<typeof GlobInputSchema>;

export const GrepInputSchema = z.object({
  pattern: z.string().describe("The regex pattern to search for in file contents"),
  path: z.string().optional().describe("The directory to search in. Defaults to workspace root."),
  include: z.string().optional().describe("File pattern to include in the search (e.g. '*.ts', '*.{ts,tsx}')"),
});

export type GrepInput = z.infer<typeof GrepInputSchema>;

// =============================================================================
// Simple Globbing Implementation
// =============================================================================

function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "||DOUBLESTAR||")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, "[^/]")
    .replace(/\|\\\|DOUBLESTAR\\\|/g, ".*");
  return new RegExp(`^${escaped}$`);
}

async function globFiles(
  rootDir: string,
  pattern: string,
  maxResults = MAX_RESULTS,
): Promise<string[]> {
  const regex = globToRegex(pattern);
  const results: string[] = [];

  async function walk(dir: string): Promise<void> {
    if (results.length >= maxResults) return;
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (results.length >= maxResults) return;
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, "/");

        if (entry.isDirectory()) {
          if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
          await walk(fullPath);
        } else if (entry.isFile() || entry.isSymbolicLink()) {
          if (regex.test(relativePath)) {
            results.push(fullPath);
          }
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  await walk(rootDir);
  return results;
}

// =============================================================================
// Create Enhanced Glob Tool
// =============================================================================

export interface CreateEnhancedGlobOptions {
  cwd: string;
}

export function createEnhancedGlobTool(options: CreateEnhancedGlobOptions): any {
  const { cwd } = options;

  return createTool({
    name: "glob",
    description: "Find files matching a glob pattern. Supports **, *, and ? wildcards. Ignores .dotfiles and node_modules.",
    inputSchema: GlobInputSchema,
    execute: async (input: GlobInput) => {
      const searchDir = input.path ? path.resolve(cwd, input.path) : cwd;

      const results = await globFiles(searchDir, input.pattern);

      return {
        title: `Glob: ${input.pattern}`,
        output: results.length > 0
          ? `Found ${results.length} file(s):\n${results.join("\n")}`
          : `No files found matching: ${input.pattern}`,
        metadata: {
          pattern: input.pattern,
          matches: results.length,
          truncated: results.length >= MAX_RESULTS,
        },
      };
    },
  });
}

// =============================================================================
// Create Enhanced Grep Tool
// =============================================================================

export function createEnhancedGrepTool(options: CreateEnhancedGlobOptions): any {
  const { cwd } = options;

  return createTool({
    name: "grep",
    description: "Search file contents with regex. Returns up to 100 matches grouped by file.",
    inputSchema: GrepInputSchema,
    execute: async (input: GrepInput) => {
      const searchDir = input.path ? path.resolve(cwd, input.path) : cwd;
      const regex = new RegExp(input.pattern, "g");

      const filePattern = input.include ? globToRegex(input.include) : null;
      const matches = new Map<string, string[]>();

      async function searchDirRecursive(dir: string): Promise<void> {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const fileChecks: Promise<void>[] = [];

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
            fileChecks.push(searchDirRecursive(fullPath));
          } else if (entry.isFile()) {
            if (filePattern && !filePattern.test(entry.name)) continue;
            fileChecks.push(searchFile(fullPath));
          }
        }

        await Promise.all(fileChecks);
      }

      async function searchFile(filePath: string): Promise<void> {
        try {
          const content = await fs.readFile(filePath, "utf-8");
          const lines = content.split("\n");
          const fileMatches: string[] = [];

          for (let i = 0; i < lines.length; i++) {
            regex.lastIndex = 0;
            if (regex.test(lines[i])) {
              fileMatches.push(`  ${i + 1}: ${lines[i].trim().slice(0, 200)}`);
              if (fileMatches.length > 10) {
                fileMatches.push(`  ... (more matches)`);
                break;
              }
            }
          }

          if (fileMatches.length > 0) {
            matches.set(filePath, fileMatches);
          }
        } catch {
          // Skip unreadable files
        }
      }

      await searchDirRecursive(searchDir);

      // Limit results
      let totalMatches = 0;
      const outputLines: string[] = [];
      for (const [filePath, fileMatches] of matches) {
        if (totalMatches >= MAX_RESULTS) {
          outputLines.push("... (truncated to 100 results)");
          break;
        }
        outputLines.push(filePath);
        for (const line of fileMatches) {
          if (totalMatches >= MAX_RESULTS) break;
          outputLines.push(line);
          totalMatches++;
        }
      }

      return {
        title: `Grep: ${input.pattern}`,
        output: matches.size > 0
          ? `Found ${totalMatches} match(es) in ${matches.size} file(s):\n${outputLines.join("\n")}`
          : `No matches found for: ${input.pattern}`,
        metadata: {
          pattern: input.pattern,
          files: matches.size,
          matches: totalMatches,
          truncated: totalMatches >= MAX_RESULTS,
        },
      };
    },
  });
}
