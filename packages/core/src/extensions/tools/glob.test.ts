import { describe, expect, it, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { createEnhancedGlobTool } from "./glob-grep-enhanced";

describe("glob tool integration", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "zenuxs-glob-test-"));
		await fs.mkdir(path.join(tempDir, "src", "nested"), { recursive: true });
		await fs.writeFile(path.join(tempDir, "src", "index.ts"), "console.log('index');");
		await fs.writeFile(path.join(tempDir, "src", "nested", "app.ts"), "console.log('app');");
		await fs.writeFile(path.join(tempDir, "README.md"), "# Hello World");
	});

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true });
	});

	it("matches files with glob pattern **/*.ts", async () => {
		const globTool = createEnhancedGlobTool({ cwd: tempDir });
		const result = await globTool.execute({ pattern: "**/*.ts" });

		expect(result.isError).toBeFalsy();
		expect(result.metadata.matches).toBe(2);
		expect(result.output).toContain("index.ts");
		expect(result.output).toContain("app.ts");
	});

	it("respects custom search path argument", async () => {
		const globTool = createEnhancedGlobTool({ cwd: tempDir });
		const result = await globTool.execute({
			pattern: "*.ts",
			path: path.join(tempDir, "src"),
		});

		expect(result.isError).toBeFalsy();
		expect(result.metadata.matches).toBe(1);
		expect(result.output).toContain("index.ts");
	});

	it("returns error structured output for non-existent path", async () => {
		const globTool = createEnhancedGlobTool({ cwd: tempDir });
		const result = await globTool.execute({
			pattern: "*.ts",
			path: path.join(tempDir, "does-not-exist"),
		});

		expect(result.isError).toBe(true);
		expect(result.output).toContain("Path not found");
	});
});
