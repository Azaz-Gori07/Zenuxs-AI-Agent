import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { createFileReadExecutor } from "./file-read";

const ctx = {
	agentId: "agent-audit",
	conversationId: "conv-audit",
	iteration: 1,
};

describe("file-read audit - T3 edge cases", () => {
	it("reads an empty file without crashing", async () => {
		const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agents-file-read-empty-"));
		const filePath = path.join(dir, "empty.txt");
		await fs.writeFile(filePath, "", "utf-8");

		try {
			const readFile = createFileReadExecutor({ cwd: dir });
			const result = await readFile({ path: filePath }, ctx);
			expect(typeof result).toBe("string");
			expect((result as string).length).toBe(0);
		} finally {
			await fs.rm(dir, { recursive: true, force: true });
		}
	});

	it("does not crash on a non-UTF8 file", async () => {
		const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agents-file-read-encoding-"));
		const filePath = path.join(dir, "latin1.txt");
		// Latin-1 "café" followed by an invalid standalone UTF-8 continuation byte.
		await fs.writeFile(filePath, Buffer.from([0x63, 0x61, 0x66, 0xe9, 0x80]));

		try {
			const readFile = createFileReadExecutor({ cwd: dir });
			const result = await readFile({ path: filePath }, ctx);
			expect(typeof result).toBe("string");
			// The invalid byte should be replaced, not throw.
			expect((result as string).length).toBeGreaterThan(0);
		} finally {
			await fs.rm(dir, { recursive: true, force: true });
		}
	});

	it("reads a symlink that points inside the workspace", async () => {
		// Symlinks on Windows often require elevated privileges; skip there.
		if (process.platform === "win32") {
			return;
		}

		const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agents-file-read-symlink-in-"));
		const targetPath = path.join(dir, "target.txt");
		const linkPath = path.join(dir, "link.txt");
		await fs.writeFile(targetPath, "symlink target content", "utf-8");
		await fs.symlink(targetPath, linkPath, "file");

		try {
			const readFile = createFileReadExecutor({ cwd: dir });
			const result = await readFile({ path: linkPath }, ctx);
			expect(result).toContain("symlink target content");
		} finally {
			await fs.rm(dir, { recursive: true, force: true });
		}
	});

	it("blocks a symlink that escapes the workspace", async () => {
		if (process.platform === "win32") {
			return;
		}

		const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "agents-file-read-symlink-ws-"));
		const outsideFile = await fs.mkdtemp(path.join(os.tmpdir(), "agents-file-read-outside-"));
		const outsideFilePath = path.join(outsideFile, "secret.txt");
		const linkPath = path.join(workspace, "escape.txt");
		await fs.writeFile(outsideFilePath, "secret", "utf-8");
		await fs.symlink(outsideFilePath, linkPath, "file");

		try {
			const readFile = createFileReadExecutor({ cwd: workspace });
			await expect(readFile({ path: linkPath }, ctx)).rejects.toThrow("Access denied");
		} finally {
			await fs.rm(workspace, { recursive: true, force: true });
			await fs.rm(outsideFile, { recursive: true, force: true });
		}
	});

	it("reports a clear error when asked to read a directory", async () => {
		const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agents-file-read-dir-"));

		try {
			const readFile = createFileReadExecutor({ cwd: dir });
			await expect(readFile({ path: dir }, ctx)).rejects.toThrow(/directory|list_directory/i);
		} finally {
			await fs.rm(dir, { recursive: true, force: true });
		}
	});

	it("returns a window and pagination notice for a 100k-line file", async () => {
		const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agents-file-read-huge-"));
		const filePath = path.join(dir, "huge.txt");
		const lines = Array.from({ length: 100_000 }, (_, i) => `line ${i + 1}`);
		await fs.writeFile(filePath, lines.join("\n"), "utf-8");

		try {
			const readFile = createFileReadExecutor({ cwd: dir });
			const result = await readFile({ path: filePath }, ctx);
			expect(result).toContain("1 | line 1");
			expect(result).toContain("2000 | line 2000");
			expect(result).not.toContain("line 2001");
			expect(result).toMatch(/\d+\+? lines/);
			expect(result).toContain("Use start_line/end_line");
		} finally {
			await fs.rm(dir, { recursive: true, force: true });
		}
	});
});
