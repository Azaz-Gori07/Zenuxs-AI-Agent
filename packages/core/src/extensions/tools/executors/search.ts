/**
 * Search Executor
 *
 * Built-in implementation for searching the codebase. Uses ripgrep when
 * available and falls back to a safe regex traversal otherwise.
 */

import type { AgentToolContext } from "@cline/shared";
import type { SearchMatch } from "../types";
import { MAX_SEARCH_OUTPUT_CHARS } from "./output-limits";
import { searchWithRegex, type RegexSearchOptions } from "./regex-search";
import {
	isRipgrepAvailable,
	searchWithRipgrep,
	type RipgrepSearchOptions,
} from "./ripgrep-search";
import { searchWithSemantic, type SemanticSearchOptions } from "./semantic-search";

/**
 * Options for the search executor
 */
export interface SearchExecutorOptions {
	/**
	 * File extensions to include in search (without dot)
	 * @default common code extensions
	 */
	includeExtensions?: string[];

	/**
	 * Directories to exclude from search
	 * @default ["node_modules", ".git", "dist", "build", ".next", "coverage"]
	 */
	excludeDirs?: string[];

	/**
	 * Maximum number of results to return
	 * @default 100
	 */
	maxResults?: number;

	/**
	 * Number of context lines before and after match
	 * @default 2
	 */
	contextLines?: number;

	/**
	 * Maximum depth to traverse
	 * @default 20
	 */
	maxDepth?: number;
}

const DEFAULT_INCLUDE_EXTENSIONS = [
	"ts",
	"tsx",
	"js",
	"jsx",
	"mjs",
	"cjs",
	"json",
	"md",
	"mdx",
	"txt",
	"yaml",
	"yml",
	"toml",
	"py",
	"rb",
	"go",
	"rs",
	"java",
	"kt",
	"swift",
	"c",
	"cpp",
	"h",
	"hpp",
	"css",
	"scss",
	"less",
	"html",
	"vue",
	"svelte",
	"sql",
	"sh",
	"bash",
	"zsh",
	"fish",
	"ps1",
	"env",
	"gitignore",
	"dockerignore",
	"editorconfig",
];

const DEFAULT_EXCLUDE_DIRS = [
	"node_modules",
	".git",
	"dist",
	"build",
	".next",
	"coverage",
	"__pycache__",
	".venv",
	"venv",
	".cache",
	".turbo",
	".output",
	"out",
	"target",
	"bin",
	"obj",
];

function buildIncludeGlobs(extensions: string[]): string[] {
	if (extensions.length === 0) return [];
	return extensions.map((ext) => `*.${ext}`);
}

function formatSearchResult(
	query: string,
	matches: SearchMatch[],
	filesSearched: number,
	maxResults: number,
): string {
	const resultLines: string[] = [
		`Found ${matches.length} result${matches.length === 1 ? "" : "s"} for pattern: ${query}`,
		`Searched ${filesSearched} files.`,
		"",
	];

	for (const match of matches) {
		resultLines.push(`${match.file}:${match.line}:${match.column}`);
		resultLines.push(...match.context);
		resultLines.push("");
	}

	if (matches.length >= maxResults) {
		resultLines.push(
			`(Showing first ${maxResults} results. Refine your search for more specific results.)`,
		);
	}

	return capSearchOutput(resultLines.join("\n"));
}

/**
 * Middle-truncate oversized search output. Matches with long context lines
 * can blow past the per-query cap even within the maxResults bound; the
 * head (earliest matches plus the result count) and tail (the refine hint)
 * are preserved and the middle is elided with a notice teaching the model
 * to narrow the pattern instead of retrying.
 */
function capSearchOutput(text: string): string {
	if (text.length <= MAX_SEARCH_OUTPUT_CHARS) {
		return text;
	}
	const headLimit = Math.ceil(MAX_SEARCH_OUTPUT_CHARS / 2);
	const tailLimit = Math.max(1, MAX_SEARCH_OUTPUT_CHARS - headLimit);
	return (
		`${text.slice(0, headLimit)}\n` +
		`[... search output truncated: ${text.length} chars total. ` +
		"Narrow the pattern or scope to view the elided matches ...]\n" +
		text.slice(-tailLimit)
	);
}

/**
 * Create a search executor using ripgrep (if available) or a safe regex fallback.
 *
 * @example
 * ```typescript
 * const search = createSearchExecutor({
 *   maxResults: 50,
 *   contextLines: 3,
 * })
 *
 * const results = await search("function\\s+handleClick", "/path/to/project", context)
 * ```
 */
export function createSearchExecutor(
	options: SearchExecutorOptions = {},
): (
	query: string,
	cwd: string,
	context: AgentToolContext,
) => Promise<string> {
	const {
		includeExtensions = DEFAULT_INCLUDE_EXTENSIONS,
		excludeDirs = DEFAULT_EXCLUDE_DIRS,
		maxResults = 100,
		contextLines = 2,
		maxDepth = 20,
	} = options;

	const includeGlobs = buildIncludeGlobs(includeExtensions);

	return async (
		query: string,
		cwd: string,
		context: AgentToolContext,
	): Promise<string> => {
		if (context.signal?.aborted) {
			throw new Error("Search operation aborted");
		}

		const commonOptions = {
			pattern: query,
			cwd,
			maxResults,
			contextLines,
			include: includeGlobs,
			signal: context.signal,
		};

		// Try semantic (AST) search first for symbol-like queries
		const semanticOptions: SemanticSearchOptions = {
			...commonOptions,
			exclude: excludeDirs,
			maxDepth,
		};
		const semanticMatches = await searchWithSemantic(semanticOptions);
		if (semanticMatches.length > 0) {
			const filesSearched = new Set(semanticMatches.map((m) => m.file)).size;
			return formatSearchResult(query, semanticMatches, filesSearched, maxResults);
		}

		// Try ripgrep next
		const rgAvailable = await isRipgrepAvailable();
		if (rgAvailable) {
			const rgOptions: RipgrepSearchOptions = {
				...commonOptions,
				exclude: excludeDirs.map((dir) => `**/${dir}/**`),
				timeoutMs: 5000,
			};
			const rgMatches = await searchWithRipgrep(rgOptions);
			if (rgMatches && rgMatches.length > 0) {
				const filesSearched = new Set(rgMatches.map((m) => m.file)).size;
				return formatSearchResult(query, rgMatches, filesSearched, maxResults);
			}
		}

		// Regex fallback.
		const regexOptions: RegexSearchOptions = {
			...commonOptions,
			excludeDirs,
			maxDepth,
		};
		const { matches, filesSearched } = await searchWithRegex(regexOptions);

		if (matches.length === 0) {
			return `No results found for pattern: ${query}\nSearched ${filesSearched} files.`;
		}

		return formatSearchResult(query, matches, filesSearched, maxResults);
	};
}
