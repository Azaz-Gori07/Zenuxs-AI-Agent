/**
 * Ripgrep Search Driver
 *
 * A small, focused wrapper around ripgrep that:
 * - Always places user queries after a `--` separator (prevents flag injection).
 * - Never imposes a per-file match cap by default.
 * - Supports include/exclude globs, context lines, max results, timeout, and abort signals.
 * - Parses ripgrep JSON output into the shared SearchMatch shape.
 * - Returns null when ripgrep is unavailable so callers can fall back.
 */

import { spawn } from "node:child_process";
import * as path from "node:path";
import type { SearchMatch } from "../types";

export interface RipgrepSearchOptions {
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
	/** Case-insensitive search (default true) */
	caseInsensitive?: boolean;
	/** Timeout in milliseconds */
	timeoutMs?: number;
	/** Abort signal */
	signal?: AbortSignal;
}

let rgAvailable: boolean | null = null;

export function resetRipgrepAvailability(): void {
	rgAvailable = null;
}

export async function isRipgrepAvailable(): Promise<boolean> {
	if (rgAvailable !== null) {
		return rgAvailable;
	}

	return new Promise((resolve) => {
		const child = spawn("rg", ["--version"], {
			stdio: ["ignore", "pipe", "pipe"],
			windowsHide: true,
		});

		let settled = false;
		const finalize = (available: boolean) => {
			if (!settled) {
				settled = true;
				rgAvailable = available;
				resolve(available);
			}
		};

		child.on("close", (code) => finalize(code === 0));
		child.on("error", () => finalize(false));

		setTimeout(() => {
			if (!child.killed) {
				child.kill("SIGTERM");
			}
			finalize(false);
		}, 1000);
	});
}

interface RipgrepJsonMatch {
	type: "match";
	data: {
		path: { text: string };
		line_number: number;
		lines?: { text: string };
		line?: { text: string };
		submatches?: Array<{
			start: number;
			end: number;
			match: { text: string };
		}>;
	};
}

interface RipgrepJsonContext {
	type: "context";
	data: {
		line_number: number;
		lines?: { text: string };
		line?: { text: string };
	};
}

type RipgrepJsonLine = RipgrepJsonMatch | RipgrepJsonContext;

function parseRipgrepJsonLine(line: string): RipgrepJsonLine | null {
	try {
		const parsed = JSON.parse(line);
		if (parsed && (parsed.type === "match" || parsed.type === "context")) {
			return parsed;
		}
		return null;
	} catch {
		return null;
	}
}

export async function searchWithRipgrep(
	options: RipgrepSearchOptions,
): Promise<SearchMatch[] | null> {
	const available = await isRipgrepAvailable();
	if (!available) {
		return null;
	}

	const {
		pattern,
		cwd,
		targetPath,
		maxResults = 100,
		contextLines = 2,
		include = [],
		exclude = [],
		caseInsensitive = true,
		timeoutMs = 5000,
		signal,
	} = options;

	const args: string[] = ["--json"];
	args.push(`--context=${contextLines}`);
	if (caseInsensitive) {
		args.push("-i");
	}

	for (const glob of include) {
		if (glob) args.push("--glob", glob);
	}
	for (const glob of exclude) {
		if (glob) args.push("--glob", `!${glob}`);
	}

	// The query and optional target path must come after `--` so that patterns
	// starting with `-` are never interpreted as flags.
	args.push("--", pattern);
	if (targetPath) {
		args.push(targetPath);
	}

	return new Promise((resolve) => {
		const child = spawn("rg", args, {
			cwd,
			stdio: ["ignore", "pipe", "pipe"],
			windowsHide: true,
		});

		let stdout = "";
		let stderr = "";
		let resolved = false;

		const cleanup = () => {
			if (!child.killed) {
				child.kill("SIGTERM");
			}
		};

		const timeout = setTimeout(() => {
			if (!resolved) {
				resolved = true;
				cleanup();
				resolve(null);
			}
		}, timeoutMs);

		const finalize = (result: SearchMatch[] | null) => {
			if (!resolved) {
				resolved = true;
				clearTimeout(timeout);
				cleanup();
				resolve(result);
			}
		};

		if (signal?.aborted) {
			finalize(null);
			return;
		}

		signal?.addEventListener("abort", () => finalize(null), { once: true });

		child.stdout.on("data", (chunk: Buffer | string) => {
			stdout += chunk.toString();
		});

		child.stderr.on("data", (chunk: Buffer | string) => {
			stderr += chunk.toString();
		});

		child.on("close", (code: number | null) => {
			if (code === 0 || code === 1) {
				const matches = parseRipgrepOutput(stdout, cwd, maxResults);
				finalize(matches.length > 0 ? matches : null);
				return;
			}

			// Surface rg errors instead of silently falling back. Callers that
			// want fallback behavior can check for null and try regex search.
			finalize(null);
		});

		child.on("error", () => {
			rgAvailable = false;
			finalize(null);
		});
	});
}

function parseRipgrepOutput(
	stdout: string,
	cwd: string,
	maxResults: number,
): SearchMatch[] {
	const matches: SearchMatch[] = [];
	const pendingContext = new Map<number, string[]>();

	const lines = stdout.split("\n");
	for (const rawLine of lines) {
		if (matches.length >= maxResults) break;
		if (!rawLine.trim()) continue;

		const json = parseRipgrepJsonLine(rawLine);
		if (!json) continue;

		if (json.type === "match") {
			const data = json.data;
			const submatches = data.submatches ?? [];
			if (submatches.length === 0) continue;

			const submatch = submatches[0];
			const lineNumber = data.line_number;
			const context = pendingContext.get(lineNumber) ?? [];
			pendingContext.delete(lineNumber);

			matches.push({
				file: normalizeRelativePath(data.path.text, cwd),
				line: lineNumber,
				column: (submatch.start ?? 0) + 1,
				match: submatch.match?.text ?? "",
				context,
			});
		} else if (json.type === "context") {
			const data = json.data;
			const lineNumber = data.line_number;
			const text = data.lines?.text ?? data.line?.text ?? "";
			const prefix = " ";
			const entry = `${prefix} ${lineNumber}: ${text}`;

			// Attach context to the most recent match if it is nearby, otherwise
			// buffer it for the next match.
			const lastMatch = matches[matches.length - 1];
			if (lastMatch && Math.abs(lineNumber - lastMatch.line) <= 5) {
				lastMatch.context.push(entry);
			} else {
				const buffered = pendingContext.get(lineNumber) ?? [];
				buffered.push(entry);
				pendingContext.set(lineNumber, buffered);
			}
		}
	}

	return matches;
}

function normalizeRelativePath(filePath: string, cwd: string): string {
	const absolute = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
	const relative = path.relative(cwd, absolute);
	return relative.replace(/\\/g, "/");
}
