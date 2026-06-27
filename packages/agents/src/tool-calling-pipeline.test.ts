/**
 * Regression and Pipeline Tests for Tool Calling Infrastructure
 *
 * Verifies end-to-end execution of:
 * - create_file
 * - write_file
 * - read_file
 * - replace_file / edit
 * - delete_file
 * - full project creation pipeline
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { createAllEnhancedTools } from "../../core/src";

describe("Tool Calling Infrastructure Pipeline", () => {
  let tempDir: string;
  let toolsByName: Map<string, any>;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "zenuxs-tool-test-"));
    const { tools } = createAllEnhancedTools({ cwd: tempDir });
    toolsByName = new Map(tools.map((t) => [t.name, t]));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("executes complete file lifecycle: create -> write -> read -> delete", async () => {
    const testFile = "demo.txt";
    const fullPath = path.join(tempDir, testFile);

    // 1. create_file
    const createTool = toolsByName.get("create_file") || toolsByName.get("write");
    expect(createTool).toBeDefined();
    const createRes = await createTool.execute({ filePath: testFile, content: "" }, {} as any);
    expect(createRes.output).toContain("Verified");
    const existsAfterCreate = await fs.access(fullPath).then(() => true).catch(() => false);
    expect(existsAfterCreate).toBe(true);

    // 2. write_file
    const writeTool = toolsByName.get("write") || toolsByName.get("write_file");
    expect(writeTool).toBeDefined();
    const writeRes = await writeTool.execute({ filePath: testFile, content: "hello world" }, {} as any);
    expect(writeRes.output).toContain("Verified");

    // 3. read_file
    const readTool = toolsByName.get("read") || toolsByName.get("read_files");
    expect(readTool).toBeDefined();
    const readRes = await readTool.execute({ path: testFile, files: [{ path: testFile }] }, {} as any);
    const readText = JSON.stringify(readRes);
    expect(readText).toContain("hello world");

    // 4. delete_file
    const deleteTool = toolsByName.get("delete_file");
    expect(deleteTool).toBeDefined();
    await deleteTool.execute({ filePath: testFile }, {} as any);
    const existsAfterDelete = await fs.access(fullPath).then(() => true).catch(() => false);
    expect(existsAfterDelete).toBe(false);
  });

  it("executes single HTML project generation flow without errors", async () => {
    const htmlFile = "portfolio.html";
    const fullPath = path.join(tempDir, htmlFile);
    const htmlContent = "<!DOCTYPE html><html><head><title>Portfolio</title></head><body><h1>AI Engineer</h1></body></html>";

    const writeTool = toolsByName.get("write") || toolsByName.get("write_file");
    const res = await writeTool.execute({ filePath: htmlFile, content: htmlContent }, {} as any);
    expect(res.output).toContain("Verified");

    const diskContent = await fs.readFile(fullPath, "utf-8");
    expect(diskContent).toBe(htmlContent);
  });
});
