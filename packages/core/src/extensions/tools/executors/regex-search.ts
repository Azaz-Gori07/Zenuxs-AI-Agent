/**
 * Regex Search Fallback Driver
 *
 * A safe, portable fallback used when ripgrep is not available. It:
 * - Skips binary files by detecting null bytes in the first read chunk.
 * - Respects include/exclude globs and a maximum directory depth.
 * - Uses platform-correct path helpers.
 * - Returns the same SearchMatch shape as ripgrep-search.ts.
 */

import type { Dirent } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { SearchMatch } from "../types";

export interface RegexSearchOptions {
	/** Regex pattern to search for */
	pattern: string;
	/** Directory (or file) to search in */
	cwd: string;
	/** Optional absolute path to a specific file or directory target */
	targetPath?: string;
	/** Maximum number of matches to return */
	maxResults?: number;
	/** Context lines before and after each match */
	contextLines?: number;
	/** Include globs (e.g. '*.ts') */
	include?: string[];
	/** Exclude globs (e.g. '*.test.ts') */
	exclude?: string[];
	/** Directories to exclude */
	excludeDirs?: string[];
	/** Maximum directory depth to traverse */
	maxDepth?: number;
	/** Abort signal */
	signal?: AbortSignal;
}

export interface RegexSearchResult {
	matches: SearchMatch[];
	filesSearched: number;
}

/**
 * Convert a glob pattern to a RegExp that can be tested against a POSIX-style
 * relative path. Supports `*`, `**`, `?`, and brace expansion `{a,b}`.
 */
export function matchesGlobs(relativePath: string, globs: string[]): boolean {
	if (globs.length === 0) return false;
	return globs.some((glob) => {
		if (!glob) return false;
		const regex = getCachedGlobRegex(glob);
		return regex.test(relativePath) || regex.test(path.basename(relativePath));
	});
}

export function globToRegex(pattern: string): RegExp {
	// Expand braces first.
	const expanded = expandBraces(pattern);
	const parts = expanded.map((p) => {
		let regex = p
			.replace(/\*\*/g, "||DOUBLESTAR||")
			.replace(/[.+^${}()|[\]\\]/g, "\\$&")
			.replace(/\*\|\\\|DOUBLESTAR\\\|/g, ".*")
			.replace(/\|\\\|DOUBLESTAR\\\|/g, ".*")
			.replace(/\*/g, "[^/]*")
			.replace(/\?/g, "[^/]");
		// If the pattern does not contain **, anchor to full path segments.
		if (!p.includes("**")) {
			regex = `(?:^|/)${regex}(?:$|/)`;
		} else {
			regex = `^${regex}$`;
		}
		return regex;
	});
	return new RegExp(parts.join("|"));
}

// Cache for compiled glob patterns to avoid recompilation on every file check.
const globRegexCache = new Map<string, RegExp>();
const GLOB_CACHE_MAX_SIZE = 256;

function getCachedGlobRegex(pattern: string): RegExp {
	let cached = globRegexCache.get(pattern);
	if (cached) return cached;
	cached = globToRegex(pattern);
	// Evict oldest entry if cache is full
	if (globRegexCache.size >= GLOB_CACHE_MAX_SIZE) {
		const firstKey = globRegexCache.keys().next().value;
		if (firstKey !== undefined) globRegexCache.delete(firstKey);
	}
	globRegexCache.set(pattern, cached);
	return cached;
}

/** Reset the glob cache (for testing). */
export function resetGlobRegexCache(): void {
	globRegexCache.clear();
}

function expandBraces(pattern: string): string[] {
	const match = pattern.match(/^(.*?)\{([^}]+)\}(.*)$/);
	if (!match) return [pattern];
	const [, prefix, options, suffix] = match;
	return options
		.split(",")
		.flatMap((option) => expandBraces(`${prefix}${option.trim()}${suffix}`));
}

function shouldIncludeFile(
	relativePath: string,
	include: string[],
	exclude: string[],
): boolean {
	if (exclude.length > 0 && matchesGlobs(relativePath, exclude)) {
		return false;
	}
	if (include.length > 0) {
		return matchesGlobs(relativePath, include);
	}
	return true;
}

export function shouldSkipDir(dirName: string, excludeDirs: string[]): boolean {
	if (dirName.startsWith(".")) return true;
	if (excludeDirs.includes(dirName)) return true;
	return false;
}

export async function isBinaryFile(filePath: string): Promise<boolean> {
	try {
		const fd = await fs.open(filePath, "r");
		try {
			const buffer = Buffer.alloc(1024);
			const { bytesRead } = await fd.read(buffer, 0, 1024, 0);
			for (let i = 0; i < bytesRead; i++) {
				if (buffer[i] === 0x00) {
					return true;
				}
			}
			return false;
		} finally {
			await fd.close();
		}
	} catch {
		return true;
	}
}

async function searchFile(
	filePath: string,
	relativePath: string,
	regex: RegExp,
	contextLines: number,
	maxResults: number,
	matches: SearchMatch[],
	signal?: AbortSignal,
): Promise<void> {
	if (signal?.aborted) return;

	if (await isBinaryFile(filePath)) {
		return;
	}

	let content: string;
	try {
		content = await fs.readFile(filePath, "utf-8");
	} catch {
		return;
	}

	const lines = content.split("\n");
	for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
		if (matches.length >= maxResults) break;
		if (signal?.aborted) return;

		const line = lines[lineIdx] ?? "";
		regex.lastIndex = 0;
		let match = regex.exec(line);
		while (match !== null && matches.length < maxResults) {
			const contextStart = Math.max(0, lineIdx - contextLines);
			const contextEnd = Math.min(lines.length - 1, lineIdx + contextLines);
			const context: string[] = [];

			for (let i = contextStart; i <= contextEnd; i++) {
				const prefix = i === lineIdx ? ">" : " ";
				context.push(`${prefix} ${i + 1}: ${lines[i]}`);
			}

			matches.push({
				file: relativePath.replace(/\\/g, "/"),
				line: lineIdx + 1,
				column: match.index + 1,
				match: match[0],
				context,
			});

			if (match.index === regex.lastIndex) {
				regex.lastIndex++;
			}
			match = regex.exec(line);
		}
	}
}

async function walkDirectory(
	rootDir: string,
	dir: string,
	regex: RegExp,
	contextLines: number,
	maxResults: number,
	matches: SearchMatch[],
	filesSearched: { count: number },
	include: string[],
	exclude: string[],
	excludeDirs: string[],
	maxDepth: number,
	currentDepth: number,
	signal?: AbortSignal,
): Promise<void> {
	if (currentDepth > maxDepth) return;
	if (signal?.aborted) return;

	let entries: Dirent[];
	try {
		entries = await fs.readdir(dir, { withFileTypes: true });
	} catch {
		return;
	}

	for (const entry of entries) {
		if (matches.length >= maxResults) break;
		if (signal?.aborted) return;

		const fullPath = path.join(dir, entry.name);
		const relativePath = path.relative(rootDir, fullPath);

		if (entry.isDirectory()) {
			if (shouldSkipDir(entry.name, excludeDirs)) continue;
			await walkDirectory(
				rootDir,
				fullPath,
				regex,
				contextLines,
				maxResults,
				matches,
				filesSearched,
				include,
				exclude,
				excludeDirs,
				maxDepth,
				currentDepth + 1,
				signal,
			);
		} else if (entry.isFile()) {
			if (!shouldIncludeFile(relativePath, include, exclude)) continue;
			filesSearched.count++;
			await searchFile(
				fullPath,
				relativePath,
				regex,
				contextLines,
				maxResults,
				matches,
				signal,
			);
		}
	}
}

export async function searchWithRegex(
	options: RegexSearchOptions,
): Promise<RegexSearchResult> {
	const {
		pattern,
		cwd,
		targetPath,
		maxResults = 100,
		contextLines = 2,
		include = [],
		exclude = [],
		excludeDirs = ["node_modules", ".git"],
		maxDepth = 20,
		signal,
	} = options;

	let regex: RegExp;
	try {
		regex = new RegExp(pattern, "gim");
	} catch (error) {
		throw new Error(
			`Invalid regex pattern: ${pattern}. ${error instanceof Error ? error.message : ""}`,
		);
	}

	const matches: SearchMatch[] = [];
	const filesSearched = { count: 0 };

	const effectiveTarget = targetPath ? path.resolve(targetPath) : path.resolve(cwd);
	const stat = await fs.stat(effectiveTarget).catch(() => null);

	if (stat?.isFile()) {
		const relativePath = path.relative(cwd, effectiveTarget);
		if (shouldIncludeFile(relativePath, include, exclude)) {
			filesSearched.count++;
			await searchFile(
				effectiveTarget,
				relativePath,
				regex,
				contextLines,
				maxResults,
				matches,
				signal,
			);
		}
	} else if (stat?.isDirectory()) {
		await walkDirectory(
			effectiveTarget,
			effectiveTarget,
			regex,
			contextLines,
			maxResults,
			matches,
			filesSearched,
			include,
			exclude,
			excludeDirs,
			maxDepth,
			1,
			signal,
		);
	} else {
		throw new Error(`Path not found: ${effectiveTarget}`);
	}

	return { matches, filesSearched: filesSearched.count };
}
