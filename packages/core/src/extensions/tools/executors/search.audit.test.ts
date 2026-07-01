import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { type AgentToolContext } from "@cline/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ctx: AgentToolContext = {
	agentId: "agent-audit",
	conversationId: "conv-audit",
	iteration: 1,
};

async function makeTempDir(prefix: string): Promise<string> {
	return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

let lastSearchSpawnArgs: string[] | undefined;

/**
 * Build a minimal fake ChildProcess that emits data/close events.
 */
function createFakeChildProcess(
	stdoutLines: string[],
	exitCode: number | null,
): ReturnType<typeof import("node:child_process").spawn> {
	const { EventEmitter } = require("node:events");
	const child = new EventEmitter();
	const stdout = new EventEmitter();
	const stderr = new EventEmitter();
	(child as any).stdout = stdout;
	(child as any).stderr = stderr;
	(child as any).pid = 12345;
	(child as any).killed = false;
	(child as any).kill = () => {
		(child as any).killed = true;
	};

	process.nextTick(() => {
		for (const line of stdoutLines) {
			stdout.emit("data", Buffer.from(`${line}\n`, "utf-8"));
		}
		child.emit("close", exitCode);
	});

	return child as any;
}

/**
 * Search actual files under `cwd` for the query and return ripgrep JSON match
 * lines. Honors `--max-count=1` when `honorMaxCount` is true so we can
 * reproduce the old bug and verify the fix.
 */
function fakeRipgrepSearch(
	args: string[],
	cwd: string,
	honorMaxCount: boolean,
): { output: Promise<string[]>; exitCode: number } {
	if (!args.includes("--version")) {
		lastSearchSpawnArgs = args;
	}

	if (args.includes("--version")) {
		return { output: Promise.resolve(["ripgrep 13.0.0"]), exitCode: 0 };
	}

	const dashIdx = args.indexOf("--");
	if (dashIdx === -1 || dashIdx + 1 >= args.length) {
		return {
			output: Promise.resolve([
				"error: Found argument '-version' which wasn't expected, or isn't valid in this context",
			]),
			exitCode: 2,
		};
	}

	const query = args[dashIdx + 1];
	const target = args[dashIdx + 2] ? path.resolve(cwd, args[dashIdx + 2]) : cwd;
	const maxCountPerFile = honorMaxCount && args.includes("--max-count=1") ? 1 : Number.POSITIVE_INFINITY;

	const output = (async (): Promise<string[]> => {
		const lines: string[] = [];

		async function searchFile(filePath: string): Promise<void> {
			const content = await fs.readFile(filePath, "utf-8");
			const fileLines = content.split("\n");
			let emitted = 0;
			for (let i = 0; i < fileLines.length && emitted < maxCountPerFile; i++) {
				const line = fileLines[i];
				const idx = line.indexOf(query);
				if (idx !== -1) {
					lines.push(
						JSON.stringify({
							type: "match",
							data: {
								path: { text: path.relative(cwd, filePath) },
								line_number: i + 1,
								lines: { text: line },
								submatches: [
									{
										start: idx,
										end: idx + query.length,
										match: { text: query },
									},
								],
							},
						}),
					);
					emitted++;
				}
			}
		}

		async function walk(dir: string): Promise<void> {
			let entries: fs.Dirent[];
			try {
				entries = await fs.readdir(dir, { withFileTypes: true });
			} catch {
				return;
			}
			for (const entry of entries) {
				const fullPath = path.join(dir, entry.name);
				if (entry.isDirectory()) {
					if (entry.name === "node_modules" || entry.name === ".git") continue;
					await walk(fullPath);
				} else if (entry.isFile()) {
					await searchFile(fullPath);
				}
			}
		}

		const stat = await fs.stat(target).catch(() => null);
		if (stat?.isFile()) {
			await searchFile(target);
		} else if (stat?.isDirectory()) {
			await walk(target);
		}

		return lines;
	})();

	return { output, exitCode: 0 };
}

/**
 * Install a fake ripgrep that reads real files and only enforces a per-file
 * cap when the caller passes `--max-count=1`.
 */
function installRipgrepMock(honorMaxCount = false): void {
	vi.doMock("node:child_process", async () => {
		const actual = await vi.importActual<typeof import("node:child_process")>(
			"node:child_process",
		);
		return {
			...actual,
			spawn: vi.fn((command: string, args: string[], options?: any) => {
				if (command !== "rg") {
					return actual.spawn(command, args as any, options);
				}

				const cwd = options?.cwd ?? process.cwd();
				const { output, exitCode } = fakeRipgrepSearch(args, cwd, honorMaxCount);
				const child = createFakeChildProcess([], exitCode);
				// Emit output asynchronously so listeners can attach.
				output.then((lines) => {
					for (const line of lines) {
						(child as any).stdout.emit("data", Buffer.from(`${line}\n`, "utf-8"));
					}
					child.emit("close", exitCode);
				});
				return child;
			}),
		};
	});
}

describe("search_codebase audit - fixed behavior", () => {
	beforeEach(() => {
		lastSearchSpawnArgs = undefined;
	});

	afterEach(() => {
		vi.resetModules();
		vi.doUnmock("node:child_process");
	});

	describe("Issue 1: flag injection via raw rg query", () => {
		it("finds patterns that start with a dash", async () => {
			const dir = await makeTempDir("agents-search-flag-");
			await fs.writeFile(
				path.join(dir, "flags.ts"),
				"const x = -version;\n",
				"utf-8",
			);

			installRipgrepMock(false);
			vi.resetModules();

			try {
				const { createSearchExecutor } = await import("./search");
				const search = createSearchExecutor({ contextLines: 0 });
				const result = await search("-version", dir, ctx);

				console.log("Issue 1 result:", result);
				expect(lastSearchSpawnArgs).toContain("--");
				const dashIdx = lastSearchSpawnArgs?.indexOf("--") ?? -1;
				expect(lastSearchSpawnArgs?.[dashIdx + 1]).toBe("-version");
				expect(result).toContain("flags.ts:1:");
				expect(result).toContain("-version");
			} finally {
				await fs.rm(dir, { recursive: true, force: true });
			}
		});
	});

	describe("Issue 2: hardcoded --max-count=1", () => {
		it("returns all matches per file", async () => {
			const dir = await makeTempDir("agents-search-count-");
			await fs.writeFile(
				path.join(dir, "multi.ts"),
				"const a = needle;\nconst b = needle;\n",
				"utf-8",
			);

			installRipgrepMock(true);
			vi.resetModules();

			try {
				const { createSearchExecutor } = await import("./search");
				const search = createSearchExecutor({ contextLines: 0 });
				const result = await search("needle", dir, ctx);

				console.log("Issue 2 result:", result);
				expect(lastSearchSpawnArgs).not.toContain("--max-count=1");
				expect(result).toContain("Found 2 results");
				expect(result).not.toContain("Found 1 result");
			} finally {
				await fs.rm(dir, { recursive: true, force: true });
			}
		});
	});

	describe("Issue 3: regex fallback binary skip", () => {
		let originalPath: string | undefined;

		beforeEach(() => {
			originalPath = process.env.PATH;
			// Force ripgrep to be unavailable so the executor falls back to the
			// internal regex traversal.
			process.env.PATH = "";
			vi.resetModules();
		});

		afterEach(() => {
			if (originalPath !== undefined) {
				process.env.PATH = originalPath;
			}
		});

		it("skips binary files in the regex fallback", async () => {
			const dir = await makeTempDir("agents-search-fallback-");
			await fs.writeFile(path.join(dir, "text.ts"), "needle in text\n", "utf-8");
			// A TypeScript file with binary content containing "needle".
			await fs.writeFile(
				path.join(dir, "binary.ts"),
				Buffer.from([0x00, 0x01, ...Buffer.from("needle", "utf-8"), 0x00]),
			);

			try {
				const { createSearchExecutor } = await import("./search");
				const search = createSearchExecutor({ contextLines: 0 });
				const result = await search("needle", dir, ctx);

				console.log("Issue 3 result:", result);
				expect(result).not.toContain("binary.ts");
				expect(result).toContain("text.ts");
				expect(result).toContain("Found 1 result");
			} finally {
				await fs.rm(dir, { recursive: true, force: true });
			}
		});
	});
});
