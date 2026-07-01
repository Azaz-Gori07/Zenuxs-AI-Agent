/**
 * Enhanced File Operations Tools
 *
 * Provides dedicated tools and aliases for filesystem operations:
 * - create_file
 * - delete_file / remove_file
 * - move_file / rename_file
 * - copy_file
 * - replace_file
 * - patch_file
 */

import * as path from "path";
import * as fs from "fs/promises";
import { createTool } from "@cline/shared";
import { z } from "zod";
import { resolvePathInfo } from "./path-kind";

// =============================================================================
// Schemas
// =============================================================================

export const CreateFileInputSchema = z.object({
  filePath: z.string().optional().describe("The path of the file to create"),
  path: z.string().optional().describe("The path of the file to create"),
  file: z.string().optional().describe("The path of the file to create"),
  content: z.string().optional().default("").describe("Initial content for the file"),
});

export const DeleteFileInputSchema = z.object({
  filePath: z.string().optional().describe("The path of the file to delete"),
  path: z.string().optional().describe("The path of the file to delete"),
  file: z.string().optional().describe("The path of the file to delete"),
});

export const MoveFileInputSchema = z.object({
  source: z.string().optional(),
  src: z.string().optional(),
  from: z.string().optional(),
  destination: z.string().optional(),
  dest: z.string().optional(),
  to: z.string().optional(),
});

export const CopyFileInputSchema = z.object({
  source: z.string().optional(),
  src: z.string().optional(),
  from: z.string().optional(),
  destination: z.string().optional(),
  dest: z.string().optional(),
  to: z.string().optional(),
});

// =============================================================================
// Helpers
// =============================================================================

// =============================================================================
// Tool Creators
// =============================================================================

export function createCreateFileTool(options: { cwd: string }): any {
  const { cwd } = options;
  return createTool({
    name: "create_file",
    description: "Create a new empty or initial file at the specified path. Creates parent directories as needed.",
    inputSchema: CreateFileInputSchema,
    execute: async (input: any, _context) => {
      let targetPath = typeof input === "string" ? input : (input.filePath || input.path || input.file);
      let content = typeof input === "object" && input.content ? input.content : "";
      if (!targetPath) {
        throw new Error("Invalid create_file input: file path is required.");
      }
      const pathInfo = await resolvePathInfo(cwd, targetPath);
      const fullPath = pathInfo.absolutePath;
      if (pathInfo.kind === "directory") {
        return {
          output: `Error: Path is a directory, not a file: ${fullPath}`,
          isError: true,
        };
      }
      if (pathInfo.kind === "other") {
        return {
          output: `Error: Unsupported path type: ${fullPath}`,
          isError: true,
        };
      }
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, "utf-8");

      // Verify file exists
      await fs.access(fullPath);

      return {
        title: `Created ${path.basename(fullPath)}`,
        output: `✔ Verified: Created file at ${fullPath}`,
        metadata: { filePath: fullPath, size: content.length, verified: true },
      };
    },
  });
}

export function createDeleteFileTool(options: { cwd: string }): any {
  const { cwd } = options;
  return createTool({
    name: "delete_file",
    description: "Delete a file or directory at the specified path.",
    inputSchema: DeleteFileInputSchema,
    execute: async (input: any, _context) => {
      let targetPath = typeof input === "string" ? input : (input.filePath || input.path || input.file);
      if (!targetPath) {
        throw new Error("Invalid delete_file input: file path is required.");
      }
      const pathInfo = await resolvePathInfo(cwd, targetPath);
      if (pathInfo.kind === "missing") {
        return {
          title: `Deleted ${path.basename(pathInfo.absolutePath)}`,
          output: `Path not found: ${pathInfo.absolutePath}`,
          isError: true,
          metadata: { filePath: pathInfo.absolutePath, deleted: false },
        };
      }
      if (pathInfo.kind === "other") {
        return {
          title: `Deleted ${path.basename(pathInfo.absolutePath)}`,
          output: `Unsupported path type: ${pathInfo.absolutePath}`,
          isError: true,
          metadata: { filePath: pathInfo.absolutePath, deleted: false },
        };
      }
      const fullPath = pathInfo.absolutePath;
      if (pathInfo.kind === "directory") {
        await fs.rm(fullPath, { recursive: true, force: true });
      } else {
        await fs.unlink(fullPath);
      }

      return {
        title: `Deleted ${path.basename(fullPath)}`,
        output: `✔ Deleted ${fullPath}`,
        metadata: { filePath: fullPath, deleted: true },
      };
    },
  });
}

export function createMoveFileTool(options: { cwd: string }): any {
  const { cwd } = options;
  return createTool({
    name: "move_file",
    description: "Move or rename a file or directory from source to destination.",
    inputSchema: MoveFileInputSchema,
    execute: async (input: any, _context) => {
      const srcPath = input.source || input.src || input.from;
      const destPath = input.destination || input.dest || input.to;
      if (!srcPath || !destPath) {
        throw new Error("Invalid move_file input: both source and destination are required.");
      }
      const srcInfo = await resolvePathInfo(cwd, srcPath);
      if (srcInfo.kind === "missing") {
        return {
          output: `Source path not found: ${srcInfo.absolutePath}`,
          isError: true,
          metadata: { source: srcInfo.absolutePath, moved: false },
        };
      }
      if (srcInfo.kind === "other") {
        return {
          output: `Unsupported source path type: ${srcInfo.absolutePath}`,
          isError: true,
          metadata: { source: srcInfo.absolutePath, moved: false },
        };
      }
      const destInfo = await resolvePathInfo(cwd, destPath);
      if (destInfo.kind === "other") {
        return {
          output: `Unsupported destination path type: ${destInfo.absolutePath}`,
          isError: true,
          metadata: { source: srcInfo.absolutePath, destination: destInfo.absolutePath },
        };
      }
      const fullSrc = srcInfo.absolutePath;
      const fullDest = destInfo.kind === "directory"
        ? path.join(destInfo.absolutePath, path.basename(fullSrc))
        : destInfo.absolutePath;

      await fs.mkdir(path.dirname(fullDest), { recursive: true });
      await fs.rename(fullSrc, fullDest);

      return {
        title: `Moved ${path.basename(fullSrc)} to ${path.basename(fullDest)}`,
        output: `✔ Moved ${fullSrc} -> ${fullDest}`,
        metadata: { source: fullSrc, destination: fullDest },
      };
    },
  });
}

export function createCopyFileTool(options: { cwd: string }): any {
  const { cwd } = options;
  return createTool({
    name: "copy_file",
    description: "Copy a file from source to destination.",
    inputSchema: CopyFileInputSchema,
    execute: async (input: any, _context) => {
      const srcPath = input.source || input.src || input.from;
      const destPath = input.destination || input.dest || input.to;
      if (!srcPath || !destPath) {
        throw new Error("Invalid copy_file input: both source and destination are required.");
      }
      const srcInfo = await resolvePathInfo(cwd, srcPath);
      if (srcInfo.kind === "missing") {
        return {
          output: `Source path not found: ${srcInfo.absolutePath}`,
          isError: true,
          metadata: { source: srcInfo.absolutePath, copied: false },
        };
      }
      if (srcInfo.kind === "other") {
        return {
          output: `Unsupported source path type: ${srcInfo.absolutePath}`,
          isError: true,
          metadata: { source: srcInfo.absolutePath, copied: false },
        };
      }
      const destInfo = await resolvePathInfo(cwd, destPath);
      if (destInfo.kind === "other") {
        return {
          output: `Unsupported destination path type: ${destInfo.absolutePath}`,
          isError: true,
          metadata: { source: srcInfo.absolutePath, destination: destInfo.absolutePath },
        };
      }
      const fullSrc = srcInfo.absolutePath;
      const fullDest = destInfo.kind === "directory"
        ? path.join(destInfo.absolutePath, path.basename(fullSrc))
        : destInfo.absolutePath;

      await fs.mkdir(path.dirname(fullDest), { recursive: true });
      if (srcInfo.kind === "directory") {
        await fs.cp(fullSrc, fullDest, { recursive: true });
      } else {
        await fs.copyFile(fullSrc, fullDest);
      }

      return {
        title: `Copied ${path.basename(fullSrc)} to ${path.basename(fullDest)}`,
        output: `✔ Copied ${fullSrc} -> ${fullDest}`,
        metadata: { source: fullSrc, destination: fullDest },
      };
    },
  });
}
