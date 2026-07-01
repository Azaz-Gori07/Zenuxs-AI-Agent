/**
 * Enhanced Glob & Grep Tools
 *
 * These tools integrate with the Path Analyzer for file-vs-directory routing
 * and reuse the shared ripgrep / regex search drivers instead of maintaining
 * a separate, weaker regex implementation.
 */

import * as fs from "fs/promises";
import * as path from "path";
import { createTool } from "@cline/shared";
import { z } from "zod";
import { analyzePath, isEnotdirError } from "../../runtime/path-analyzer";
import type { SearchMatch } from "./types";
import { searchWithRegex } from "./executors/regex-search";
import { searchWithRipgrep } from "./executors/ripgrep-search";

// =============================================================================
// Constants
// =============================================================================

const MAX_RESULTS = 100;
const DEFAULT_EXCLUDE_DIRS = ["node_modules", ".git"];

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

// Cache for compiled glob patterns in the glob tool.
const globToolRegexCache = new Map<string, RegExp>();
const GLOB_TOOL_CACHE_MAX = 128;

function getCachedGlobRegex(pattern: string): RegExp {
	let cached = globToolRegexCache.get(pattern);
	if (cached) return cached;
	cached = globToRegex(pattern);
	if (globToolRegexCache.size >= GLOB_TOOL_CACHE_MAX) {
		const firstKey = globToolRegexCache.keys().next().value;
		if (firstKey !== undefined) globToolRegexCache.delete(firstKey);
	}
	globToolRegexCache.set(pattern, cached);
	return cached;
}

async function globFiles(
	rootDir: string,
	pattern: string,
	maxResults = MAX_RESULTS,
): Promise<string[]> {
	const regex = getCachedGlobRegex(pattern);
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
					if (entry.name.startsWith(".") || DEFAULT_EXCLUDE_DIRS.includes(entry.name)) continue;
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

function includePatternMatches(filePath: string, rootDir: string, pattern: string): boolean {
	const regex = getCachedGlobRegex(pattern);
	const relativePath = path.relative(rootDir, filePath).replace(/\\/g, "/");
	return regex.test(relativePath) || regex.test(path.basename(filePath));
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
			const target = await analyzePath(input.path ?? cwd, { cwd });

			if (target.kind === "missing") {
				return {
					title: `Glob: ${input.pattern}`,
					output: `Path not found: ${target.absolutePath}`,
					isError: true,
					metadata: {
						pattern: input.pattern,
						path: target.absolutePath,
						matches: 0,
						truncated: false,
					},
				};
			}

			if (target.kind === "other") {
				return {
					title: `Glob: ${input.pattern}`,
					output: `Unsupported path type: ${target.absolutePath}`,
					isError: true,
					metadata: {
						pattern: input.pattern,
						path: target.absolutePath,
						matches: 0,
						truncated: false,
					},
				};
			}

			const results = target.kind === "file"
				? includePatternMatches(target.absolutePath, cwd, input.pattern)
					? [target.absolutePath]
					: []
				: await globFiles(target.absolutePath, input.pattern);

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
// Grep result formatting
// =============================================================================

function formatGrepResult(
	pattern: string,
	matches: SearchMatch[],
	maxResults: number,
): { output: string; files: number; matches: number; truncated: boolean } {
	const files = new Map<string, string[]>();
	let totalMatches = 0;

	for (const match of matches) {
		if (totalMatches >= maxResults) break;
		const existing = files.get(match.file) ?? [];
		existing.push(`  ${match.line}:${match.column}: ${match.context.join(" | ").slice(0, 200)}`);
		files.set(match.file, existing);
		totalMatches++;
	}

	const outputLines: string[] = [];
	let count = 0;
	for (const [filePath, fileMatches] of files) {
		if (count >= maxResults) {
			outputLines.push("... (truncated to 100 results)");
			break;
		}
		outputLines.push(filePath);
		for (const line of fileMatches) {
			if (count >= maxResults) break;
			outputLines.push(line);
			count++;
		}
	}

	const truncated = totalMatches >= maxResults;
	const output = files.size > 0
		? `Found ${totalMatches} match(es) in ${files.size} file(s):\n${outputLines.join("\n")}`
		: `No matches found for: ${pattern}`;

	return { output, files: files.size, matches: totalMatches, truncated };
}

// =============================================================================
// Create Enhanced Grep Tool
// =============================================================================

export function createEnhancedGrepTool(options: CreateEnhancedGlobOptions): any {
	const { cwd } = options;

	return createTool({
		name: "grep",
		description: "Search file contents with regex. Automatically detects if target is a file or directory and routes accordingly.",
		inputSchema: GrepInputSchema,
		execute: async (input: GrepInput, _context) => {
			// Validate regex before doing any filesystem work.
			try {
				new RegExp(input.pattern);
			} catch (error) {
				return {
					title: `Grep: ${input.pattern}`,
					output: `Invalid regex pattern: ${input.pattern}. ${error instanceof Error ? error.message : ""}`,
					isError: true,
					metadata: {
						pattern: input.pattern,
						path: input.path ?? cwd,
						files: 0,
						matches: 0,
						truncated: false,
					},
				};
			}

			const targetPath = input.path ?? cwd;
			const pathAnalysis = await analyzePath(targetPath, { cwd });

			if (pathAnalysis.kind === "missing") {
				return {
					title: `Grep: ${input.pattern}`,
					output: `Path not found: ${pathAnalysis.absolutePath}`,
					isError: true,
					metadata: {
						pattern: input.pattern,
						path: pathAnalysis.absolutePath,
						files: 0,
						matches: 0,
						truncated: false,
					},
				};
			}

			if (pathAnalysis.kind === "other") {
				return {
					title: `Grep: ${input.pattern}`,
					output: `Unsupported path type: ${pathAnalysis.absolutePath}`,
					isError: true,
					metadata: {
						pattern: input.pattern,
						path: pathAnalysis.absolutePath,
						files: 0,
						matches: 0,
						truncated: false,
					},
				};
			}

			const include = input.include ? [input.include] : [];
			const searchOptions = {
				pattern: input.pattern,
				cwd,
				targetPath: pathAnalysis.absolutePath,
				maxResults: MAX_RESULTS,
				contextLines: 0,
				include,
				exclude: DEFAULT_EXCLUDE_DIRS.map((dir) => `**/${dir}/**`),
			};

			try {
				let matches: SearchMatch[] | null = await searchWithRipgrep(searchOptions);
				if (!matches) {
					const result = await searchWithRegex({
						...searchOptions,
						excludeDirs: DEFAULT_EXCLUDE_DIRS,
						maxDepth: 20,
					});
					matches = result.matches;
				}

				const formatted = formatGrepResult(input.pattern, matches, MAX_RESULTS);
				return {
					title: `Grep: ${input.pattern}`,
					output: formatted.output,
					metadata: {
						pattern: input.pattern,
						path: pathAnalysis.absolutePath,
						files: formatted.files,
						matches: formatted.matches,
						truncated: formatted.truncated,
					},
				};
			} catch (error) {
				// Automatic recovery from ENOTDIR (safety net)
				if (isEnotdirError(error)) {
					const recoveredAnalysis = await analyzePath(targetPath, { cwd });
					if (recoveredAnalysis.kind === "file") {
						const result = await searchWithRegex({
							pattern: input.pattern,
							cwd,
							targetPath: recoveredAnalysis.absolutePath,
							maxResults: MAX_RESULTS,
							contextLines: 0,
							include,
							excludeDirs: DEFAULT_EXCLUDE_DIRS,
							maxDepth: 20,
						});
						const formatted = formatGrepResult(input.pattern, result.matches, MAX_RESULTS);
						return {
							title: `Grep: ${input.pattern}`,
							output: formatted.output,
							metadata: {
								pattern: input.pattern,
								path: recoveredAnalysis.absolutePath,
								files: formatted.files,
								matches: formatted.matches,
								truncated: formatted.truncated,
							},
						};
					}
				}
				throw error;
			}
		},
	});
}
