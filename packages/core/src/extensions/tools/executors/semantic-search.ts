/**
 * Semantic Search Driver
 *
 * Lightweight AST-based symbol search for TypeScript/JavaScript files.
 *
 * - Parses supported source files with the TypeScript compiler API.
 * - Extracts declarations (functions, classes, interfaces, types, variables,
 *   imports, exports) and matches them against a query string.
 * - Falls back to the ripgrep driver for non-AST files.
 * - Returns the same SearchMatch shape used by ripgrep-search.ts so it can be
 *   dropped into the search fallback chain.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as ts from "typescript";
import type { SearchMatch } from "../types";
import {
	isBinaryFile,
	matchesGlobs,
	shouldSkipDir,
} from "./regex-search";
import { searchWithRipgrep } from "./ripgrep-search";

export interface SemanticSearchOptions {
	/** Symbol or identifier to search for */
	pattern: string;
	/** Directory (or file) to search in */
	cwd: string;
	/** Optional absolute path to a specific file or directory target */
	targetPath?: string;
	/** Maximum number of matches to return */
	maxResults?: number;
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

const AST_EXTENSIONS = new Set([
	".ts",
	".tsx",
	".js",
	".jsx",
	".mjs",
	".cjs",
]);

function getScriptKind(filePath: string): ts.ScriptKind {
	const ext = path.extname(filePath).toLowerCase();
	switch (ext) {
		case ".tsx":
			return ts.ScriptKind.TSX;
		case ".jsx":
			return ts.ScriptKind.JSX;
		case ".js":
			return ts.ScriptKind.JS;
		case ".mjs":
			return ts.ScriptKind.JS;
		case ".cjs":
			return ts.ScriptKind.JS;
		case ".ts":
		default:
			return ts.ScriptKind.TS;
	}
}

function isAstFile(filePath: string): boolean {
	return AST_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function normalizeName(name: string | undefined): string | undefined {
	if (!name) return undefined;
	return name;
}

function isMatch(name: string | undefined, query: string): boolean {
	if (!name) return false;
	return name.toLowerCase().includes(query.toLowerCase());
}

interface SymbolMatch {
	name: string;
	kind: string;
	file: string;
	line: number;
	column: number;
	container?: string;
	text: string;
}

function extractSymbols(
	sourceFile: ts.SourceFile,
	_filePath: string,
	relativePath: string,
): SymbolMatch[] {
	const symbols: SymbolMatch[] = [];
	const stack: string[] = [];

	function location(node: ts.Node): { line: number; column: number } {
		const { line, character } = ts.getLineAndCharacterOfPosition(
			sourceFile,
			node.getStart(sourceFile),
		);
		return { line: line + 1, column: character + 1 };
	}

	function lineText(node: ts.Node): string {
		const { line } = ts.getLineAndCharacterOfPosition(
			sourceFile,
			node.getStart(sourceFile),
		);
		return sourceFile.getFullText().split("\n")[line] ?? "";
	}

	function record(name: string, kind: string, node: ts.Node, container?: string) {
		const { line, column } = location(node);
		symbols.push({
			name,
			kind,
			file: relativePath.replace(/\\/g, "/"),
			line,
			column,
			container,
			text: lineText(node),
		});
	}

	function visit(node: ts.Node) {
		let containerPushed = false;

		if (ts.isFunctionDeclaration(node)) {
			const name = normalizeName(node.name?.text);
			if (name) record(name, "function", node, stack[stack.length - 1]);
		} else if (ts.isClassDeclaration(node)) {
			const name = normalizeName(node.name?.text);
			if (name) {
				record(name, "class", node, stack[stack.length - 1]);
				stack.push(name);
				containerPushed = true;
			}
		} else if (ts.isInterfaceDeclaration(node)) {
			const name = normalizeName(node.name?.text);
			if (name) {
				record(name, "interface", node, stack[stack.length - 1]);
				stack.push(name);
				containerPushed = true;
			}
		} else if (ts.isTypeAliasDeclaration(node)) {
			const name = normalizeName(node.name?.text);
			if (name) record(name, "type", node, stack[stack.length - 1]);
		} else if (ts.isEnumDeclaration(node)) {
			const name = normalizeName(node.name?.text);
			if (name) record(name, "enum", node, stack[stack.length - 1]);
		} else if (ts.isVariableDeclaration(node)) {
			const name = normalizeName(node.name.getText(sourceFile));
			if (name) record(name, "variable", node, stack[stack.length - 1]);
		} else if (ts.isMethodDeclaration(node)) {
			const name = normalizeName(node.name?.getText(sourceFile));
			if (name) record(name, "method", node, stack[stack.length - 1]);
		} else if (ts.isPropertyDeclaration(node)) {
			const name = normalizeName(node.name?.getText(sourceFile));
			if (name) record(name, "property", node, stack[stack.length - 1]);
		} else if (ts.isImportSpecifier(node)) {
			const name = normalizeName(node.name.text);
			if (name) record(name, "import", node, stack[stack.length - 1]);
		} else if (ts.isExportSpecifier(node)) {
			const name = normalizeName(node.name.text);
			if (name) record(name, "export", node, stack[stack.length - 1]);
		} else if (ts.isModuleDeclaration(node)) {
			const name = normalizeName(node.name.getText(sourceFile));
			if (name) {
				record(name, "namespace", node, stack[stack.length - 1]);
				stack.push(name);
				containerPushed = true;
			}
		}

		ts.forEachChild(node, visit);

		if (containerPushed) {
			stack.pop();
		}
	}

	visit(sourceFile);
	return symbols;
}

async function scanFile(
	filePath: string,
	relativePath: string,
	query: string,
	matches: SymbolMatch[],
	signal?: AbortSignal,
): Promise<void> {
	if (signal?.aborted) return;
	if (!isAstFile(filePath)) return;
	if (await isBinaryFile(filePath)) return;

	let content: string;
	try {
		content = await fs.readFile(filePath, "utf-8");
	} catch {
		return;
	}

	const sourceFile = ts.createSourceFile(
		filePath,
		content,
		ts.ScriptTarget.Latest,
		true,
		getScriptKind(filePath),
	);

	const symbols = extractSymbols(sourceFile, filePath, relativePath);
	for (const symbol of symbols) {
		if (isMatch(symbol.name, query)) {
			matches.push(symbol);
		}
	}
}

async function walkDirectory(
	rootDir: string,
	dir: string,
	query: string,
	matches: SymbolMatch[],
	include: string[],
	exclude: string[],
	excludeDirs: string[],
	maxDepth: number,
	currentDepth: number,
	signal?: AbortSignal,
): Promise<void> {
	if (currentDepth > maxDepth) return;
	if (signal?.aborted) return;

	let entries: any[];
	try {
		entries = await fs.readdir(dir, { withFileTypes: true }) as any[];
	} catch {
		return;
	}

	for (const entry of entries) {
		if (signal?.aborted) return;

		const fullPath = path.join(dir, entry.name);
		const relativePath = path.relative(rootDir, fullPath);

		if (entry.isDirectory()) {
			if (shouldSkipDir(entry.name, excludeDirs)) continue;
			await walkDirectory(
				rootDir,
				fullPath,
				query,
				matches,
				include,
				exclude,
				excludeDirs,
				maxDepth,
				currentDepth + 1,
				signal,
			);
		} else if (entry.isFile()) {
			if (exclude.length > 0 && matchesGlobs(relativePath, exclude)) continue;
			if (include.length > 0 && !matchesGlobs(relativePath, include)) continue;
			await scanFile(fullPath, relativePath, query, matches, signal);
		}
	}
}

function toSearchMatch(symbol: SymbolMatch): SearchMatch {
	const contextLines = symbol.text.trim();
	const prefix = `(${symbol.kind}${symbol.container ? ` in ${symbol.container}` : ""})`;
	return {
		file: symbol.file,
		line: symbol.line,
		column: symbol.column,
		match: symbol.name,
		context: [`${prefix} ${symbol.line}: ${contextLines}`],
	};
}

function toIncludeGlobs(extensions: Set<string>): string[] {
	return Array.from(extensions).map((ext) => `*${ext}`);
}

export async function searchWithSemantic(
	options: SemanticSearchOptions,
): Promise<SearchMatch[]> {
	const {
		pattern,
		cwd,
		targetPath,
		maxResults = 100,
		include = [],
		exclude = [],
		excludeDirs = ["node_modules", ".git"],
		maxDepth = 20,
		signal,
	} = options;

	const matches: SymbolMatch[] = [];
	const effectiveTarget = targetPath ? path.resolve(targetPath) : path.resolve(cwd);
	const stat = await fs.stat(effectiveTarget).catch(() => null);

	if (stat?.isFile()) {
		const relativePath = path.relative(cwd, effectiveTarget);
		await scanFile(effectiveTarget, relativePath, pattern, matches, signal);
	} else if (stat?.isDirectory()) {
		await walkDirectory(
			effectiveTarget,
			effectiveTarget,
			pattern,
			matches,
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

	if (matches.length === 0) {
		// No AST matches: try ripgrep on the remaining file kinds so symbol-like
		// queries still get broader text hits.
		return (
			(await searchWithRipgrep({
				pattern,
				cwd,
				targetPath: effectiveTarget,
				maxResults,
				include: include.length > 0 ? include : toIncludeGlobs(AST_EXTENSIONS),
				exclude,
				signal,
			})) ?? []
		);
	}

	return matches
		.slice(0, maxResults)
		.map(toSearchMatch);
}
