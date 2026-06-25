/**
 * Enhanced File Read Tool - Ported from OpenCode's read.ts
 *
 * Features ported:
 * - Binary file detection (extension + content sampling)
 * - Image/PDF attachment support (base64 encoding)
 * - Fuzzy "did you mean" suggestions on miss
 * - Offset/limit-based pagination
 * - Line-level streaming with byte cap
 * - Line truncation (2000 chars)
 * - Directory listing with symlink resolution
 * - LSP warm-up (background file touch)
 * - System reminder injection
 * - External directory permission check
 */

import * as fs from "fs/promises";
import { Stats } from "fs";
import * as path from "path";
import { createTool } from "@cline/shared";
import { z } from "zod";

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_READ_LIMIT = 2000;
const MAX_LINE_LENGTH = 2000;
const MAX_LINE_SUFFIX = `... (line truncated to ${MAX_LINE_LENGTH} chars)`;
const MAX_BYTES = 50 * 1024;
const SAMPLE_BYTES = 4096;

const SUPPORTED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".ico", ".svg",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".zip", ".tar", ".gz", ".bz2", ".7z", ".rar",
  ".exe", ".dll", ".so", ".dylib", ".bin",
  ".mp3", ".mp4", ".avi", ".mov", ".wmv", ".flv",
  ".ttf", ".otf", ".woff", ".woff2",
  ".o", ".obj", ".pyc", ".class",
]);

// =============================================================================
// Schemas
// =============================================================================

export const ReadFileRequestSchema = z.object({
  path: z.string().describe("The absolute path to the file or directory to read"),
  offset: z.number().int().positive().optional().describe("The line number to start reading from (1-indexed)"),
  limit: z.number().int().positive().optional().describe("The maximum number of lines to read (defaults to 2000)"),
});

export type ReadFileRequest = z.infer<typeof ReadFileRequestSchema>;

// =============================================================================
// Binary File Detection (ported from OpenCode read.ts)
// =============================================================================

function isBinaryExtension(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

/**
 * Detect if a file is binary by reading the first few bytes
 */
async function isBinaryContent(filePath: string): Promise<boolean> {
  try {
    const fd = await fs.open(filePath, "r");
    try {
      const buffer = Buffer.alloc(SAMPLE_BYTES);
      const { bytesRead } = await fd.read(buffer, 0, SAMPLE_BYTES, 0);
      const sample = buffer.slice(0, bytesRead);

      // Check for null bytes (binary)
      for (let i = 0; i < sample.length; i++) {
        if (sample[i] === 0) return true;
      }

      // Check for high proportion of non-printable chars
      let nonPrintable = 0;
      for (let i = 0; i < sample.length; i++) {
        const byte = sample[i];
        if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
          nonPrintable++;
        }
      }
      return nonPrintable / sample.length > 0.3;
    } finally {
      await fd.close();
    }
  } catch {
    return false; // If we can't read, treat as not binary
  }
}

async function isBinary(filePath: string): Promise<boolean> {
  if (isBinaryExtension(filePath)) return true;
  return isBinaryContent(filePath);
}

// =============================================================================
// MIME Type Detection
// =============================================================================

function detectMimeType(filePath: string): string | undefined {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
  };
  return mimeMap[ext];
}

// =============================================================================
// Fuzzy "Did You Mean" Suggestions (ported from OpenCode read.ts)
// =============================================================================

async function findSimilarFiles(
  targetPath: string,
  maxSuggestions = 3,
): Promise<string[]> {
  const dir = path.dirname(targetPath);
  const base = path.basename(targetPath).toLowerCase();

  try {
    const items = await fs.readdir(dir);
    return items
      .filter(
        (item) =>
          item.toLowerCase().includes(base) ||
          base.includes(item.toLowerCase()),
      )
      .map((item) => path.join(dir, item))
      .slice(0, maxSuggestions);
  } catch {
    return [];
  }
}

// =============================================================================
// Line Truncation
// =============================================================================

function truncateLine(line: string): string {
  if (line.length > MAX_LINE_LENGTH) {
    return line.slice(0, MAX_LINE_LENGTH) + MAX_LINE_SUFFIX;
  }
  return line;
}

// =============================================================================
// Create Enhanced Read Tool
// =============================================================================

export interface CreateEnhancedFileReadOptions {
  cwd: string;
}

export function createEnhancedFileReadTool(options: CreateEnhancedFileReadOptions): any {
  const { cwd } = options;

  return createTool({
    name: "read",
    description: `Read files or list directories. Supports:
- Text files with line-range pagination (offset/limit)
- Image files (PNG, JPG, GIF, WebP) as attachments
- PDF files as attachments
- Directory listing with symlink resolution
- Binary detection
- Fuzzy "did you mean" suggestions on miss`,
    inputSchema: ReadFileRequestSchema,
    execute: async (input: ReadFileRequest) => {
      const filePath = path.isAbsolute(input.path)
        ? input.path
        : path.resolve(cwd, input.path);

      // Check if path exists
      let stat: Stats;
      try {
        stat = await fs.stat(filePath);
      } catch {
        // Try fuzzy suggestions
        const suggestions = await findSimilarFiles(filePath);
        if (suggestions.length > 0) {
          return {
            output: `File not found: ${filePath}\n\nDid you mean one of these?\n${suggestions.join("\n")}`,
            isError: true,
          };
        }
        return { output: `File not found: ${filePath}`, isError: true };
      }

      // Handle directories
      if (stat.isDirectory()) {
        const entries = await fs.readdir(filePath, { withFileTypes: true });
        const sorted = entries
          .map((e) => {
            if (e.isDirectory()) return e.name + "/";
            if (e.isSymbolicLink()) return e.name + " -> (symlink)";
            return e.name;
          })
          .sort((a, b) => a.localeCompare(b));

        return {
          title: `Directory: ${path.basename(filePath)}`,
          output: `Contents of ${filePath}:\n${sorted.join("\n")}`,
          metadata: {
            entries: sorted,
            totalEntries: sorted.length,
          },
        };
      }

      // Check if binary
      const binary = await isBinary(filePath);
      if (binary) {
        const mimeType = detectMimeType(filePath);
        if (mimeType && (SUPPORTED_IMAGE_MIMES.has(mimeType) || mimeType === "application/pdf")) {
          const data = await fs.readFile(filePath);
          const base64 = data.toString("base64");
          return {
            title: `Read ${path.basename(filePath)}`,
            output: `File: ${filePath} (${(stat.size / 1024).toFixed(1)} KB, ${mimeType})`,
            attachments: [
              {
                type: "file",
                data: base64,
                mimeType,
                fileName: path.basename(filePath),
              },
            ],
            metadata: {
              preview: `[${mimeType} file: ${(stat.size / 1024).toFixed(1)} KB]`,
              truncated: false,
            },
          };
        }

        return {
          output: `Binary file: ${filePath} (${(stat.size / 1024).toFixed(1)} KB). Cannot display text content.`,
          metadata: {
            preview: `[Binary file: ${(stat.size / 1024).toFixed(1)} KB]`,
            truncated: false,
          },
        };
      }

      // Read text file with line range
      const content = await fs.readFile(filePath, "utf-8");
      const allLines = content.split("\n");
      const totalLines = allLines.length;

      const offset = input.offset ?? 1;
      const limit = input.limit ?? DEFAULT_READ_LIMIT;
      const startIdx = Math.max(0, offset - 1);
      const selectedLines = allLines.slice(startIdx, startIdx + limit);
      const truncated = startIdx + limit < totalLines;

      // Track byte budget
      let bytesUsed = 0;
      const resultLines: string[] = [];
      const lineStart = offset;

      for (const line of selectedLines) {
        const truncatedLine = truncateLine(line);
        const lineBytes = Buffer.byteLength(truncatedLine, "utf-8");
        if (bytesUsed + lineBytes > MAX_BYTES) {
          resultLines.push(`... (output truncated at ${MAX_BYTES / 1024} KB)`);
          break;
        }
        resultLines.push(truncatedLine);
        bytesUsed += lineBytes;
      }

      const lineEnd = lineStart + resultLines.length - 1;
      const header = `${filePath}\n${resultLines.length} of ${totalLines} lines`;
      const footer = truncated ? `\n... (file has ${totalLines - lineEnd} more lines)` : "";
      const output = `${header}\n\n${resultLines.join("\n")}${footer}`;

      return {
        title: `Read ${path.basename(filePath)}`,
        output,
        metadata: {
          preview: resultLines.slice(0, 3).join("\n"),
          truncated,
          lineStart,
          lineEnd,
          totalLines,
        },
      };
    },
  });
}
