/**
 * Directory List Executor
 *
 * Safe directory listing for the search fallback chain.
 *
 * - Respects exclude dirs and dot-directory skipping.
 * - Returns entries with name, kind, and path.
 * - Bounded by maxResults and maxDepth.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { shouldSkipDir } from "./regex-search";

export interface DirectoryListOptions {
	/** Directory to list */
	targetPath: string;
	/** Maximum entries to return */
	maxResults?: number;
	/** Maximum depth to recurse (1 = target only) */
	maxDepth?: number;
	/** Directories to exclude */
	excludeDirs?: string[];
	/** Whether to include dot directories/files */
	includeHidden?: boolean;
}

export interface DirectoryEntry {
	name: string;
	kind: "file" | "directory" | "symlink" | "other";
	path: string;
}

async function walk(
	rootDir: string,
	dir: string,
	maxResults: number,
	maxDepth: number,
	currentDepth: number,
	excludeDirs: string[],
	includeHidden: boolean,
	results: DirectoryEntry[],
): Promise<void> {
	if (currentDepth > maxDepth) return;
	if (results.length >= maxResults) return;

	let entries: any[];
	try {
		entries = await fs.readdir(dir, { withFileTypes: true }) as any[];
	} catch {
		return;
	}

	for (const entry of entries) {
		if (results.length >= maxResults) return;
		if (!includeHidden && entry.name.startsWith(".")) continue;
		if (entry.isDirectory() && shouldSkipDir(entry.name, excludeDirs)) continue;

		const fullPath = path.join(dir, entry.name);
		const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, "/");

		let kind: DirectoryEntry["kind"] = "other";
		if (entry.isFile()) kind = "file";
		else if (entry.isDirectory()) kind = "directory";
		else if (entry.isSymbolicLink()) kind = "symlink";

		results.push({
			name: entry.name,
			kind,
			path: relativePath || entry.name,
		});

		if (entry.isDirectory()) {
			await walk(
				rootDir,
				fullPath,
				maxResults,
				maxDepth,
				currentDepth + 1,
				excludeDirs,
				includeHidden,
				results,
			);
		}
	}
}

export async function listDirectory(
	options: DirectoryListOptions,
): Promise<DirectoryEntry[]> {
	const {
		targetPath,
		maxResults = 100,
		maxDepth = 1,
		excludeDirs = ["node_modules", ".git"],
		includeHidden = false,
	} = options;

	const resolved = path.resolve(targetPath);
	const stat = await fs.stat(resolved).catch(() => null);
	if (!stat) {
		throw new Error(`Path not found: ${resolved}`);
	}
	if (!stat.isDirectory()) {
		throw new Error(`Path is not a directory: ${resolved}`);
	}

	const results: DirectoryEntry[] = [];
	await walk(
		resolved,
		resolved,
		maxResults,
		maxDepth,
		1,
		excludeDirs,
		includeHidden,
		results,
	);
	return results;
}

export interface DirectoryListExecutorOptions {
	maxResults?: number;
	maxDepth?: number;
	excludeDirs?: string[];
	includeHidden?: boolean;
}

export function createDirectoryListExecutor(
	options: DirectoryListExecutorOptions = {},
): (targetPath: string) => Promise<string> {
	const defaults = {
		maxResults: options.maxResults ?? 100,
		maxDepth: options.maxDepth ?? 1,
		excludeDirs: options.excludeDirs ?? ["node_modules", ".git"],
		includeHidden: options.includeHidden ?? false,
	};

	return async (targetPath: string): Promise<string> => {
		const entries = await listDirectory({ targetPath, ...defaults });
		if (entries.length === 0) {
			return `No entries found in: ${targetPath}`;
		}

		const lines = entries.map((entry) => {
			const marker =
				entry.kind === "directory"
					? "[dir]"
					: entry.kind === "symlink"
						? "[link]"
						: "[file]";
			return `${marker} ${entry.path}`;
		});

		return `Found ${entries.length} entr${entries.length === 1 ? "y" : "ies"} in ${targetPath}:\n${lines.join("\n")}`;
	};
}
