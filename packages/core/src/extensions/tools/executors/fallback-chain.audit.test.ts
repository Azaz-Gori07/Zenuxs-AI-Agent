/**
 * Fallback Chain Audit Tests (F1)
 *
 * Tests that each fallback chain in the goal-loop spec works correctly
 * when the primary driver is deliberately broken.
 *
 * | Layer      | Primary          | Fallback 1       | Fallback 2              |
 * |------------|------------------|-------------------|-------------------------|
 * | Search     | Semantic search  | Grep (ripgrep)    | Directory + manual read |
 * | Edit       | Structured edit  | Patch apply       | Full file rewrite       |
 * | Execute    | Full test suite  | Targeted test     | Single smoke command    |
 * | External   | MCP server       | Local script/API  | Manual prompt to user   |
 * | Verification | Unit tests     | Integration test  | Lint/typecheck only     |
 */

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createEditorExecutor } from "./editor";
import { createApplyPatchExecutor } from "./apply-patch";
import { parseTestOutput, detectScripts } from "./test-runner-helper";
import { parseGitStatus, parseDiffStat } from "./git-helper";

describe("F1 — Edit fallback chain", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "f1-edit-fallback-"));
	});

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true });
	});

	it("T4: structured edit succeeds for exact match", async () => {
		const filePath = path.join(tempDir, "test.txt");
		await fs.writeFile(filePath, "hello world", "utf-8");

		const editor = createEditorExecutor();
		const result = await editor(
			{ path: filePath, old_text: "hello", new_text: "goodbye" },
			tempDir,
			{ agentId: "a", conversationId: "c", iteration: 1 },
		);

		expect(result).toContain("Edited");
		await expect(fs.readFile(filePath, "utf-8")).resolves.toBe("goodbye world");
	});

	it("T4→T5: when structured edit fails (no match), apply_patch can be used as fallback", async () => {
		const filePath = path.join(tempDir, "test.txt");
		await fs.writeFile(filePath, "alpha\nbeta\ngamma", "utf-8");

		const editor = createEditorExecutor();

		// T4 fails: old_text not found
		await expect(
			editor(
				{ path: filePath, old_text: "nonexistent", new_text: "replacement" },
				tempDir,
				{ agentId: "a", conversationId: "c", iteration: 1 },
			),
		).rejects.toThrow("text not found");

		// T5 fallback: apply_patch succeeds
		const patchExecutor = createApplyPatchExecutor();
		const patchResult = await patchExecutor(
			{
				input: [
					"*** Update File: test.txt",
					"@@",
					" alpha",
					"-beta",
					"+delta",
					" gamma",
				].join("\n"),
			},
			tempDir,
			{} as never,
		);

		expect(patchResult).toContain("Successfully applied patch");
		await expect(fs.readFile(filePath, "utf-8")).resolves.toBe("alpha\ndelta\ngamma");
	});

	it("T5→T6: when patch fails (context mismatch), full rewrite with backup is the last resort", async () => {
		const filePath = path.join(tempDir, "test.txt");
		await fs.writeFile(filePath, "original content", "utf-8");

		const patchExecutor = createApplyPatchExecutor();

		// T5 fails: context mismatch
		await expect(
			patchExecutor(
				{
					input: [
						"*** Update File: test.txt",
						"@@",
						" wrong context",
						"-original",
						"+replacement",
					].join("\n"),
				},
				tempDir,
				{} as never,
			),
		).rejects.toThrow();

		// T6 fallback: full rewrite with backup
		const editorWithBackup = createEditorExecutor({ createBackupBeforeRewrite: true });
		const rewriteResult = await editorWithBackup(
			{ path: filePath, old_text: "original content", new_text: "completely new content" },
			tempDir,
			{ agentId: "a", conversationId: "c", iteration: 1 },
		);

		expect(rewriteResult).toContain("Edited");
		expect(rewriteResult).toContain("Backup saved at");
		await expect(fs.readFile(filePath, "utf-8")).resolves.toBe("completely new content");
		await expect(fs.readFile(`${filePath}.bak`, "utf-8")).resolves.toBe("original content");
	});
});

describe("F1 — Test output parsing (T8)", () => {
	it("parses vitest output format", () => {
		const output = `
 ✓ src/foo.test.ts (3 tests) 12ms
 ✓ src/bar.test.ts (2 tests) 8ms

 Test Files  2 passed (2)
      Tests  5 passed (5)
   Start at  17:00:00
   Duration  200ms
`;
		const result = parseTestOutput(output);
		expect(result.framework).toBe("vitest");
		expect(result.passed).toBe(5);
	});

	it("parses jest output format", () => {
		const output = `
PASS src/foo.test.js
  ✓ does something (5ms)

Tests: 3 passed, 1 failed, 2 skipped, 6 total
`;
		const result = parseTestOutput(output);
		expect(result.framework).toBe("jest");
		expect(result.passed).toBe(3);
		expect(result.failed).toBe(1);
		expect(result.skipped).toBe(2);
	});

	it("parses pytest output format", () => {
		const output = `
========= 5 passed, 1 failed, 2 skipped in 0.42s =========
`;
		const result = parseTestOutput(output);
		expect(result.framework).toBe("pytest");
		expect(result.passed).toBe(5);
		expect(result.failed).toBe(1);
		expect(result.skipped).toBe(2);
	});

	it("returns nulls for unparseable output", () => {
		const result = parseTestOutput("some random output");
		expect(result.framework).toBeNull();
		expect(result.passed).toBeNull();
		expect(result.failed).toBeNull();
	});
});

describe("F1 — Git status parsing (T9)", () => {
	it("parses clean working tree", () => {
		const raw = "";
		const result = parseGitStatus(raw);
		expect(result.isDirty).toBe(false);
		expect(result.hasConflicts).toBe(false);
		expect(result.stagedCount).toBe(0);
		expect(result.unstagedCount).toBe(0);
		expect(result.untrackedCount).toBe(0);
	});

	it("parses dirty working tree with staged and unstaged changes", () => {
		const raw = "M  staged.txt\n M unstaged.txt\n?? untracked.txt";
		const result = parseGitStatus(raw);
		expect(result.isDirty).toBe(true);
		expect(result.stagedCount).toBe(1);
		expect(result.unstagedCount).toBe(1);
		expect(result.untrackedCount).toBe(1);
	});

	it("detects merge conflicts", () => {
		const raw = "UU conflicted.txt";
		const result = parseGitStatus(raw);
		expect(result.hasConflicts).toBe(true);
		expect(result.isDirty).toBe(true);
	});

	it("parses diff stat output", () => {
		const stat = " 3 files changed, 10 insertions(+), 5 deletions(-)";
		const result = parseDiffStat(stat);
		expect(result.filesChanged).toBe(3);
		expect(result.insertions).toBe(10);
		expect(result.deletions).toBe(5);
	});
});

describe("F1 — Execute fallback chain", () => {
	it("parses go-test output format", () => {
		const output = `
=== RUN   TestFoo
--- PASS: TestFoo (0.00s)
=== RUN   TestBar
--- FAIL: TestBar (0.01s)
ok  	pkg/foo	0.123s
FAIL	pkg/bar	0.456s
`;
		const result = parseTestOutput(output);
		expect(result.framework).toBe("go-test");
		expect(result.passed).toBe(1);
		expect(result.failed).toBe(1);
	});

	it("detects scripts with npm/yarn/pnpm workspaces", async () => {
		const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "f1-workspace-"));
		try {
			await fs.writeFile(
				path.join(tempDir, "package.json"),
				JSON.stringify({
					scripts: {
						test: "jest",
						lint: "prettier --check .",
					},
				}),
				"utf-8",
			);
			const scripts = await detectScripts(tempDir);
			expect(scripts.test).toBe("jest");
			expect(scripts.lint).toBe("prettier --check .");
		} finally {
			await fs.rm(tempDir, { recursive: true, force: true });
		}
	});
});

describe("F1 — External fallback chain (web-fetch protocol validation)", () => {
	it("rejects non-http/https protocols", async () => {
		const { createWebFetchExecutor } = await import("./web-fetch");
		const fetcher = createWebFetchExecutor();
		const ctx = { agentId: "a", conversationId: "c", iteration: 1 };
		await expect(
			fetcher("ftp://example.com/file", "test", ctx),
		).rejects.toThrow(/protocol/i);
	});

	it("rejects file:// protocol", async () => {
		const { createWebFetchExecutor } = await import("./web-fetch");
		const fetcher = createWebFetchExecutor();
		const ctx = { agentId: "a", conversationId: "c", iteration: 1 };
		await expect(
			fetcher("file:///etc/passwd", "test", ctx),
		).rejects.toThrow(/protocol/i);
	});
});

describe("F1 — Verification fallback chain (test-runner-helper integration)", () => {
	it("createTestRunnerHelper returns structured result on bash failure", async () => {
		const { createTestRunnerHelper } = await import("./test-runner-helper");
		// Mock bash executor that simulates test failure
		const mockBash = async (_cmd: string, _cwd: string, _ctx: any): Promise<string> => {
			return "Tests: 2 passed, 1 failed, 3 total\n";
		};
		const helper = createTestRunnerHelper(mockBash as any);
		const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "f1-verify-"));
		try {
			await fs.writeFile(
				path.join(tempDir, "package.json"),
				JSON.stringify({ scripts: { test: "vitest run" } }),
				"utf-8",
			);
			const result = await helper("test", tempDir, { agentId: "a", conversationId: "c", iteration: 1 });
			expect(result.success).toBe(true);
			expect(result.framework).toBe("jest");
			expect(result.passed).toBe(2);
			expect(result.failed).toBe(1);
			expect(result.command).toBe("vitest run");
		} finally {
			await fs.rm(tempDir, { recursive: true, force: true });
		}
	});

	it("createTestRunnerHelper captures failure output when bash throws", async () => {
		const { createTestRunnerHelper } = await import("./test-runner-helper");
		const mockBash = async (): Promise<string> => {
			throw new Error("Tests: 0 passed, 3 failed, 3 total\nexit status 1");
		};
		const helper = createTestRunnerHelper(mockBash as any);
		const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "f1-verify-fail-"));
		try {
			await fs.writeFile(
				path.join(tempDir, "package.json"),
				JSON.stringify({ scripts: { test: "pytest" } }),
				"utf-8",
			);
			const result = await helper("test", tempDir, { agentId: "a", conversationId: "c", iteration: 1 });
			expect(result.success).toBe(false);
			expect(result.framework).toBe("jest");
			expect(result.failed).toBe(3);
		} finally {
			await fs.rm(tempDir, { recursive: true, force: true });
		}
	});
});

describe("F1 — T2 grep edge cases (search executor)", () => {
	it("handles special regex characters in search pattern", async () => {
		const { createSearchExecutor } = await import("./search");
		const search = createSearchExecutor({ contextLines: 0 });
		const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "f1-grep-special-"));
		try {
			await fs.writeFile(
				path.join(tempDir, "code.ts"),
				"const x = foo.bar[0];\nconst y = foo(baz);\n",
				"utf-8",
			);
			// Search for a literal dot — should not crash
			const result = await search("foo.bar", tempDir, { agentId: "a", conversationId: "c", iteration: 1 });
			expect(result).toContain("code.ts");
		} finally {
			await fs.rm(tempDir, { recursive: true, force: true });
		}
	});

	it("handles empty search directory gracefully", async () => {
		const { createSearchExecutor } = await import("./search");
		const search = createSearchExecutor({ contextLines: 0 });
		const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "f1-grep-empty-"));
		try {
			const result = await search("anything", tempDir, { agentId: "a", conversationId: "c", iteration: 1 });
			// Empty dir should not crash — either "No results" or "Found 0"
			expect(result).toMatch(/No results|Found 0/);
		} finally {
			await fs.rm(tempDir, { recursive: true, force: true });
		}
	});
});

describe("F1 — Script detection (T8)", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "f1-script-detect-"));
	});

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true });
	});

	it("detects test/lint/typecheck scripts from package.json", async () => {
		await fs.writeFile(
			path.join(tempDir, "package.json"),
			JSON.stringify({
				scripts: {
					test: "vitest run",
					lint: "eslint .",
					typecheck: "tsc --noEmit",
				},
			}),
			"utf-8",
		);

		const scripts = await detectScripts(tempDir);
		expect(scripts.test).toBe("vitest run");
		expect(scripts.lint).toBe("eslint .");
		expect(scripts.typecheck).toBe("tsc --noEmit");
	});

	it("returns nulls when package.json is missing", async () => {
		const scripts = await detectScripts(tempDir);
		expect(scripts.test).toBeNull();
		expect(scripts.lint).toBeNull();
		expect(scripts.typecheck).toBeNull();
	});

	it("returns nulls when package.json is malformed", async () => {
		await fs.writeFile(path.join(tempDir, "package.json"), "not json", "utf-8");
		const scripts = await detectScripts(tempDir);
		expect(scripts.test).toBeNull();
	});
});
