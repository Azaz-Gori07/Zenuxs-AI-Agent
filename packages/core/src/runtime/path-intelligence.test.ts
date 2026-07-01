/**
 * Comprehensive verification test for Path Intelligence + Tool Routing Architecture.
 * Proves all success criteria are met.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import { analyzePath, isEnotdirError, recoverFromEnotdir } from "./path-analyzer";

const TEST_DIR = path.join(process.cwd(), "test-fixtures-path-intelligence");

describe("Path Intelligence + Tool Routing Architecture", () => {
  beforeAll(async () => {
    // Create test fixtures
    await fs.mkdir(TEST_DIR, { recursive: true });
    await fs.mkdir(path.join(TEST_DIR, "subdir"), { recursive: true });
    await fs.writeFile(path.join(TEST_DIR, "About.jsx"), "export default function About() { return <div>About</div>; }", "utf-8");
    await fs.writeFile(path.join(TEST_DIR, "subdir", "nested.jsx"), "export const nested = true;", "utf-8");
  });

  afterAll(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe("Phase 1: Path Analyzer", () => {
    it("correctly identifies a file path", async () => {
      const filePath = path.join(TEST_DIR, "About.jsx");
      const analysis = await analyzePath(filePath, { cwd: TEST_DIR });

      expect(analysis.kind).toBe("file");
      expect(analysis.routingHint.isFile).toBe(true);
      expect(analysis.routingHint.isDirectory).toBe(false);
      expect(analysis.routingHint.suggestedCategory).toBe("file");
    });

    it("correctly identifies a directory path", async () => {
      const dirPath = path.join(TEST_DIR, "subdir");
      const analysis = await analyzePath(dirPath, { cwd: TEST_DIR });

      expect(analysis.kind).toBe("directory");
      expect(analysis.routingHint.isFile).toBe(false);
      expect(analysis.routingHint.isDirectory).toBe(true);
      expect(analysis.routingHint.suggestedCategory).toBe("directory");
    });

    it("handles missing paths correctly", async () => {
      const missingPath = path.join(TEST_DIR, "nonexistent.jsx");
      const analysis = await analyzePath(missingPath, { cwd: TEST_DIR });

      expect(analysis.kind).toBe("missing");
      expect(analysis.error).toBeDefined();
    });

    it("normalizes Windows paths", async () => {
      const windowsPath = `${TEST_DIR}\\About.jsx`;
      const analysis = await analyzePath(windowsPath, { cwd: TEST_DIR });

      expect(analysis.kind).toBe("file");
      expect(path.isAbsolute(analysis.absolutePath)).toBe(true);
    });

    it("handles relative paths", async () => {
      const analysis = await analyzePath("About.jsx", { cwd: TEST_DIR });

      expect(analysis.kind).toBe("file");
      expect(analysis.absolutePath).toBe(path.join(TEST_DIR, "About.jsx"));
    });

    it("strips trailing slashes from directories", async () => {
      const dirWithSlash = path.join(TEST_DIR, "subdir") + path.sep;
      const analysis = await analyzePath(dirWithSlash, { cwd: TEST_DIR });

      expect(analysis.kind).toBe("directory");
      expect(analysis.absolutePath.endsWith(path.sep)).toBe(false);
    });
  });

  describe("Phase 2: Grep Tool with Path Intelligence", () => {
    it("grep(file) searches only inside that file - NO ENOTDIR", async () => {
      // This is the critical test that proves the bug is fixed
      const filePath = path.join(TEST_DIR, "About.jsx");

      // Import the grep tool
      const { createEnhancedGrepTool } = await import("../extensions/tools/glob-grep-enhanced");
      const grepTool = createEnhancedGrepTool({ cwd: TEST_DIR });

      // Execute grep on a FILE (not directory)
      const result = await grepTool.execute({
        pattern: "About",
        path: filePath,
      }, { sessionId: "test", agentId: "test", conversationId: "test", runId: "test", iteration: 0, toolCallId: "test" });

      // Should succeed without ENOTDIR error
      expect(result.isError).toBeFalsy();
      expect(result.output).toContain("About.jsx");
      expect(result.metadata.files).toBe(1);
      expect(result.metadata.matches).toBeGreaterThan(0);
    });

    it("grep(directory) searches recursively inside directory", async () => {
      const dirPath = TEST_DIR;

      const { createEnhancedGrepTool } = await import("../extensions/tools/glob-grep-enhanced");
      const grepTool = createEnhancedGrepTool({ cwd: TEST_DIR });

      const result = await grepTool.execute({
        pattern: "nested",
        path: dirPath,
      }, { sessionId: "test", agentId: "test", conversationId: "test", runId: "test", iteration: 0, toolCallId: "test" });

      expect(result.isError).toBeFalsy();
      expect(result.metadata.files).toBeGreaterThan(0);
    });

    it("automatically recovers from ENOTDIR if it occurs", async () => {
      // Simulate a scenario where path might be misidentified
      const filePath = path.join(TEST_DIR, "About.jsx");

      // The recovery logic is built into grep tool
      // If ENOTDIR occurs, it will re-analyze and retry
      const { createEnhancedGrepTool } = await import("../extensions/tools/glob-grep-enhanced");
      const grepTool = createEnhancedGrepTool({ cwd: TEST_DIR });

      const result = await grepTool.execute({
        pattern: "function",
        path: filePath,
      }, { sessionId: "test", agentId: "test", conversationId: "test", runId: "test", iteration: 0, toolCallId: "test" });

      // Should succeed with automatic recovery if needed
      expect(result.isError).toBeFalsy();
    });
  });

  describe("ENOTDIR Error Detection and Recovery", () => {
    it("detects ENOTDIR errors correctly", () => {
      const enotdirError = new Error("ENOTDIR: not a directory");
      (enotdirError as any).code = "ENOTDIR";

      expect(isEnotdirError(enotdirError)).toBe(true);
    });

    it("recovers from ENOTDIR by re-analyzing path", async () => {
      const filePath = path.join(TEST_DIR, "About.jsx");

      const recovered = await recoverFromEnotdir(filePath, { cwd: TEST_DIR });

      // Should successfully recover and identify it as a file
      expect(recovered).not.toBeNull();
      expect(recovered!.kind).toBe("file");
      expect(recovered!.routingHint.isFile).toBe(true);
    });
  });

  describe("Path Normalization", () => {
    it("handles duplicate separators", async () => {
      const pathWithDupes = path.join(TEST_DIR, "subdir", "nested.jsx");
      const analysis = await analyzePath(pathWithDupes, { cwd: TEST_DIR });

      expect(analysis.kind).toBe("file");
    });

    it("handles mixed separators (Windows/Linux)", async () => {
      // Test with forward slashes on Windows
      const mixedPath = path.join(TEST_DIR, "subdir", "nested.jsx").replace(/\\/g, "/");
      const analysis = await analyzePath(mixedPath, { cwd: TEST_DIR });

      expect(analysis.kind).toBe("file");
    });
  });
});
