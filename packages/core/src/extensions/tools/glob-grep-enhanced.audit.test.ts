import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { createEnhancedGrepTool } from "./glob-grep-enhanced";

const toolContext = {
	sessionId: "audit",
	agentId: "audit",
	conversationId: "audit",
	runId: "audit",
	iteration: 0,
	toolCallId: "audit",
};

async function makeTempDir(prefix: string): Promise<string> {
	return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

describe("enhanced grep audit - fixed behavior", () => {
	describe("Issue 4: invalid regex returns a structured error", () => {
		it("returns isError instead of throwing for invalid regex", async () => {
			const dir = await makeTempDir("agents-grep-regex-");
			await fs.writeFile(
				path.join(dir, "file.ts"),
				"const x = 1;\n",
				"utf-8",
			);

			try {
				const grepTool = createEnhancedGrepTool({ cwd: dir });

				// This pattern is invalid JavaScript regex (unclosed group).
				const result = await grepTool.execute(
					{ pattern: "(?<!unclosed" },
					toolContext,
				);

				console.log("Issue 4 result:", JSON.stringify(result, null, 2));
				expect(result.isError).toBe(true);
				expect(result.output).toContain("Invalid regex pattern");
			} finally {
				await fs.rm(dir, { recursive: true, force: true });
			}
		});
	});
});
