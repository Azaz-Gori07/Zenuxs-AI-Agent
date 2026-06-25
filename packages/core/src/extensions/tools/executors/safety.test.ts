import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { assertPathSafe, getRealPath, isPathProtected } from "./safety";

describe("safety helpers", () => {
	describe("getRealPath", () => {
		it("resolves existing paths", async () => {
			const tempDir = await fs.realpath(os.tmpdir());
			const resolved = await getRealPath(tempDir);
			expect(resolved.toLowerCase()).toBe(tempDir.toLowerCase());
		});

		it("resolves non-existing paths via existing ancestors", async () => {
			const tempDir = await fs.realpath(os.tmpdir());
			const nonExisting = path.join(tempDir, "non-existent-sub-folder", "file.txt");
			const resolved = await getRealPath(nonExisting);
			expect(resolved.toLowerCase()).toBe(nonExisting.toLowerCase());
		});
	});

	describe("isPathProtected", () => {
		it("identifies protected folders in home directory", () => {
			const home = os.homedir();
			const desktop = path.join(home, "Desktop");
			const appData = path.join(home, "AppData");
			
			// Workspace is outside home directory (like D:\project)
			const externalWorkspace = process.platform === "win32" ? "D:\\project" : "/var/project";
			
			if (process.platform === "win32") {
				expect(isPathProtected(appData, externalWorkspace)).toBe(true);
				expect(isPathProtected(desktop, externalWorkspace)).toBe(true);
			} else if (process.platform === "darwin") {
				const library = path.join(home, "Library");
				expect(isPathProtected(library, externalWorkspace)).toBe(true);
				expect(isPathProtected(desktop, externalWorkspace)).toBe(true);
			}
		});

		it("allows access to subfolders if workspace itself is inside the protected folder", () => {
			const home = os.homedir();
			const documents = path.join(home, "Documents");
			const projectInDocs = path.join(documents, "my-project");
			const fileInProject = path.join(projectInDocs, "src", "index.ts");

			// Workspace is inside Documents
			expect(isPathProtected(fileInProject, projectInDocs)).toBe(false);

			// But accessing a sibling in Documents from inside the project should be blocked (if it escapes CWD - though isPathSafe checks that first)
			// If workspace is home directory, documents subfolder should be blocked
			expect(isPathProtected(documents, home)).toBe(true);
		});
	});

	describe("assertPathSafe", () => {
		it("allows safe paths inside workspace root", async () => {
			const tempDir = await fs.realpath(os.tmpdir());
			const workspace = await fs.mkdtemp(path.join(tempDir, "safe-ws-"));
			const file = path.join(workspace, "src", "index.ts");

			try {
				const resolved = await assertPathSafe(file, workspace);
				expect(resolved.toLowerCase()).toBe(file.toLowerCase());
			} finally {
				await fs.rm(workspace, { recursive: true, force: true });
			}
		});

		it("rejects path traversal escaping workspace root", async () => {
			const tempDir = await fs.realpath(os.tmpdir());
			const workspace = await fs.mkdtemp(path.join(tempDir, "escape-ws-"));
			const outsideFile = path.join(tempDir, "outside-file.txt");

			try {
				await expect(assertPathSafe(outsideFile, workspace)).rejects.toThrow(
					"Access denied: path escapes the workspace root",
				);
			} finally {
				await fs.rm(workspace, { recursive: true, force: true });
			}
		});
	});
});
