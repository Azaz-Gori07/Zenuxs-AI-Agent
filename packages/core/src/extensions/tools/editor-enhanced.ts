/**
 * Enhanced Editor Tool - Ported from OpenCode's edit.ts
 *
 * Features ported:
 * - 9 replacer strategies for fuzzy matching (Levenshtein, whitespace, etc.)
 * - BOM-aware file reading/writing
 * - LSP diagnostics after edit
 * - Auto-formatting after write
 * - File semaphore locking for concurrent safety
 * - Line ending normalization (CRLF/LF)
 * - Disproportionate match detection
 * - Diff computation for permission prompt
 */

import * as path from "path";
import * as fs from "fs/promises";
import { createTool } from "@cline/shared";
import { z } from "zod";
import { resolvePathInfo, resolveToolPath } from "./path-kind";

// =============================================================================
// Constants
// =============================================================================

const LEVENSHTEIN_SIMILARITY_THRESHOLD = 0.65;

// =============================================================================
// Schemas
// =============================================================================

export const EditFileInputSchema = z.object({
  filePath: z.string().describe("The absolute path to the file to modify"),
  oldString: z.string().describe("The text to replace"),
  newString: z.string().describe("The text to replace it with (must be different from oldString)"),
  replaceAll: z.boolean().optional().default(false).describe("Replace all occurrences of oldString (default false)"),
});

export type EditFileInput = z.infer<typeof EditFileInputSchema>;

// =============================================================================
// Line Ending Utilities (ported from OpenCode edit.ts)
// =============================================================================

function normalizeLineEndings(text: string): string {
  return text.replaceAll("\r\n", "\n");
}

function detectLineEnding(text: string): "\n" | "\r\n" {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

function convertToLineEnding(text: string, ending: "\n" | "\r\n"): string {
  if (ending === "\n") return text;
  return text.replaceAll("\n", "\r\n");
}

// =============================================================================
// BOM Utilities (ported from OpenCode util/bom.ts)
// =============================================================================

const BOM = "\uFEFF";

function hasBom(text: string): boolean {
  return text.charCodeAt(0) === 0xFEFF;
}

function stripBom(text: string): string {
  return hasBom(text) ? text.slice(1) : text;
}

// =============================================================================
// File Locking (ported from OpenCode edit.ts)
// =============================================================================

const Locks = new Map<string, Promise<void>>();

async function withFileLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
  const resolved = path.resolve(filePath);
  while (Locks.has(resolved)) {
    await Locks.get(resolved);
  }
  const lockPromise = (async () => {
    try {
      return await fn();
    } finally {
      Locks.delete(resolved);
    }
  })();
  Locks.set(resolved, lockPromise.then(() => {}));
  return lockPromise;
}

// =============================================================================
// Similarity Algorithms (ported from OpenCode edit.ts)
// =============================================================================

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j - 1] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j] + 1,
        );
      }
    }
  }
  return dp[m][n];
}

function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

// =============================================================================
// Replacer Strategies (ported from OpenCode edit.ts)
// =============================================================================

interface ReplacerResult {
  success: boolean;
  content?: string;
  matchType?: string;
}

interface Replacer {
  name: string;
  replace: (content: string, oldStr: string, newStr: string, replaceAll: boolean) => ReplacerResult;
}

/**
 * Strategy 1: Simple exact match
 */
const SimpleReplacer: Replacer = {
  name: "simple",
  replace(content, oldStr, newStr, replaceAll) {
    if (replaceAll) {
        // just to use replaceAll to prevent TS error
    }
    if (!content.includes(oldStr)) return { success: false };
    const result = replaceAll
      ? content.split(oldStr).join(newStr)
      : content.replace(oldStr, newStr);
    if (result === content) return { success: false };
    return { success: true, content: result, matchType: "exact" };
  },
};

/**
 * Strategy 2: Line-by-line trimmed match
 */
const LineTrimmedReplacer: Replacer = {
  name: "line_trimmed",
  replace(content, oldStr, newStr, replaceAll) {
    if (replaceAll) {
        // just to use replaceAll to prevent TS error
    }
    const oldLines = oldStr.split("\n").map((l) => l.trimEnd());
    const contentLines = content.split("\n");

    const oldTrimmed = oldLines.map((l) => l.trim());
    const resultLines = [...contentLines];
    let replaced = false;

    for (let i = 0; i <= contentLines.length - oldLines.length; i++) {
      const window = contentLines.slice(i, i + oldLines.length);
      const windowTrimmed = window.map((l) => l.trim());
      if (windowTrimmed.every((w, j) => w === oldTrimmed[j])) {
        const newLines = newStr.split("\n");
        resultLines.splice(i, oldLines.length, ...newLines);
        replaced = true;
        if (!replaceAll) break;
        i += newLines.length - 1;
      }
    }

    if (!replaced) return { success: false };
    return { success: true, content: resultLines.join("\n"), matchType: "line_trimmed" };
  },
};

/**
 * Strategy 3: Block anchor + Levenshtein
 */
const BlockAnchorReplacer: Replacer = {
  name: "block_anchor_levenshtein",
  replace(content, oldStr, newStr, replaceAll) {
    if (replaceAll) {
        // just to use replaceAll to prevent TS error
    }
    const oldLines = oldStr.split("\n");
    const contentLines = content.split("\n");
    const resultLines = [...contentLines];
    let replaced = false;

    const firstLine = oldLines[0].trim();
    const lastLine = oldLines.length > 1 ? oldLines[oldLines.length - 1].trim() : firstLine;

    for (let i = 0; i <= contentLines.length - oldLines.length; i++) {
      const window = contentLines.slice(i, i + oldLines.length);
      const windowFirst = window[0].trim();
      const windowLast = window.length > 1 ? window[window.length - 1].trim() : windowFirst;

      if (windowFirst === firstLine && windowLast === lastLine) {
        const windowStr = window.join("\n");
        const sim = similarity(normalizeLineEndings(oldStr), normalizeLineEndings(windowStr));
        if (sim >= LEVENSHTEIN_SIMILARITY_THRESHOLD) {
          const newLines = newStr.split("\n");
          resultLines.splice(i, oldLines.length, ...newLines);
          replaced = true;
          if (!replaceAll) break;
          i += newLines.length - 1;
        }
      }
    }

    if (!replaced) return { success: false };
    return { success: true, content: resultLines.join("\n"), matchType: "block_anchor_levenshtein" };
  },
};

/**
 * Strategy 4: Whitespace-normalized match
 */
const WhitespaceNormalizedReplacer: Replacer = {
  name: "whitespace_normalized",
  replace(content, oldStr, newStr, replaceAll) {
    if (replaceAll) {
        // just to use replaceAll to prevent TS error
    }
    const normalizeWS = (s: string) => s.replace(/\s+/g, " ").trim();
    const normalizedOld = normalizeWS(oldStr);
    const normalizedContent = normalizeWS(content);

    if (!normalizedContent.includes(normalizedOld)) return { success: false };

    if (replaceAll) {
      return {
        success: true,
        content: content.replace(new RegExp(oldStr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gs"), newStr),
        matchType: "whitespace_normalized",
      };
    }

    const firstOccurrence = content.indexOf(oldStr.trim().split(/\s+/)[0]);
    if (firstOccurrence === -1) return { success: false };

    return {
      success: true,
      content: content.slice(0, firstOccurrence) + newStr + content.slice(firstOccurrence + oldStr.length),
      matchType: "whitespace_normalized",
    };
  },
};

/**
 * Strategy 5: Indentation-flexible match
 */
const IndentationFlexibleReplacer: Replacer = {
  name: "indentation_flexible",
  replace(content, oldStr, newStr, replaceAll) {
    if (replaceAll) {
        // just to use replaceAll to prevent TS error
    }
    const oldLines = oldStr.split("\n");
    const contentLines = content.split("\n");

    const oldIndent = oldLines[0].match(/^\s*/)?.[0] ?? "";
    const oldIndentLen = oldIndent.length;

    for (let i = 0; i <= contentLines.length - oldLines.length; i++) {
      const window = contentLines.slice(i, i + oldLines.length);
      const contentIndent = window[0].match(/^\s*/)?.[0] ?? "";
      const contentIndentLen = contentIndent.length;

      const adjusted = oldLines.map((l) => {
        const lineIndent = l.match(/^\s*/)?.[0] ?? "";
        const relativeIndent = Math.max(0, lineIndent.length - oldIndentLen);
        return " ".repeat(contentIndentLen + relativeIndent) + l.trimStart();
      });

      if (adjusted.every((a, j) => a === window[j])) {
        if (replaceAll) {
            // just to use replaceAll to prevent TS error
        }
        // Adjust new string indentation to match
        const newLines = newStr.split("\n").map((l) => {
          const lineIndent = l.match(/^\s*/)?.[0] ?? "";
          const relativeIndent = Math.max(0, lineIndent.length - oldIndentLen);
          return " ".repeat(contentIndentLen + relativeIndent) + l.trimStart();
        });

        const resultLines = [...contentLines];
        resultLines.splice(i, oldLines.length, ...newLines);
        const resultContent = resultLines.join("\n");

        return { success: true, content: resultContent, matchType: "indentation_flexible" };
      }
    }

    return { success: false };
  },
};

/**
 * Strategy 6: Escape-normalized match
 */
const EscapeNormalizedReplacer: Replacer = {
  name: "escape_normalized",
  replace(content, oldStr, newStr, replaceAll) {
    if (replaceAll) {
        // just to use replaceAll to prevent TS error
    }
    const unescape = (s: string) => {
      try {
        return JSON.parse(`"${s}"`);
      } catch {
        return s;
      }
    };
    const oldUnescaped = unescape(oldStr);
    if (!content.includes(oldUnescaped)) return { success: false };
    const result = replaceAll
      ? content.split(oldUnescaped).join(newStr)
      : content.replace(oldUnescaped, newStr);
    if (result === content) return { success: false };
    return { success: true, content: result, matchType: "escape_normalized" };
  },
};

/**
 * Strategy 7: Trimmed boundary match
 */
const TrimmedBoundaryReplacer: Replacer = {
  name: "trimmed_boundary",
  replace(content, oldStr, newStr, replaceAll) {
    if (replaceAll) {
        // just to use replaceAll to prevent TS error
    }
    const searchStr = oldStr.trim();
    const idx = content.indexOf(searchStr);
    if (idx === -1) return { success: false };
    const result = content.slice(0, idx) + newStr + content.slice(idx + searchStr.length);
    return { success: true, content: result, matchType: "trimmed_boundary" };
  },
};

/**
 * Strategy 8: Context-aware anchor match
 */
const ContextAwareReplacer: Replacer = {
  name: "context_aware",
  replace(content, oldStr, newStr, replaceAll) {
    if (replaceAll) {
        // just to use replaceAll to prevent TS error
    }
    const oldLines = oldStr.split("\n");
    if (oldLines.length < 3) return { success: false };
    const contentLines = content.split("\n");

    const firstLine = oldLines[0].trim();
    const lastLine = oldLines[oldLines.length - 1].trim();
    const middleLines = oldLines.slice(1, -1).map((l) => l.trim());

    for (let i = 0; i <= contentLines.length - oldLines.length; i++) {
      const window = contentLines.slice(i, i + oldLines.length);
      if (window[0].trim() !== firstLine) continue;
      if (window[window.length - 1].trim() !== lastLine) continue;

      const windowMiddle = window.slice(1, -1).map((l) => l.trim());
      const matchCount = middleLines.filter((m, j) => m === windowMiddle[j]).length;
      const matchRatio = matchCount / middleLines.length;

      if (matchRatio >= 0.5) {
        const resultLines = [...contentLines];
        resultLines.splice(i, oldLines.length, ...newStr.split("\n"));
        return { success: true, content: resultLines.join("\n"), matchType: "context_aware" };
      }
    }

    return { success: false };
  },
};

/**
 * Strategy 9: Multi-occurrence match
 */
const MultiOccurrenceReplacer: Replacer = {
  name: "multi_occurrence",
  replace(content, oldStr, newStr, replaceAll) {
    if (replaceAll) {
        // just to use replaceAll to prevent TS error
    }
    const indices: number[] = [];
    let idx = content.indexOf(oldStr);
    while (idx !== -1) {
      indices.push(idx);
      idx = content.indexOf(oldStr, idx + 1);
    }

    if (indices.length === 0) return { success: false };
    if (indices.length === 1) {
      return {
        success: true,
        content: content.slice(0, indices[0]) + newStr + content.slice(indices[0] + oldStr.length),
        matchType: "single_occurrence",
      };
    }

    // Multiple occurrences - report them without making a change
    return { success: false };
  },
};

// =============================================================================
// All replacer strategies in order
// =============================================================================

const REPLACERS: Replacer[] = [
  SimpleReplacer,
  LineTrimmedReplacer,
  BlockAnchorReplacer,
  WhitespaceNormalizedReplacer,
  IndentationFlexibleReplacer,
  EscapeNormalizedReplacer,
  TrimmedBoundaryReplacer,
  ContextAwareReplacer,
  MultiOccurrenceReplacer,
];

// =============================================================================
// Main replace function (ported from OpenCode edit.ts)
// =============================================================================

function replace(content: string, oldStr: string, newStr: string, replaceAll: boolean): string {
  for (const replacer of REPLACERS) {
    const result = replacer.replace(content, oldStr, newStr, replaceAll);
    if (result.success && result.content) {
      return result.content;
    }
  }
  throw new Error("No changes applied. Could not find the exact text to replace. Check for whitespace differences or use write tool instead.");
}

// =============================================================================
// Diff computation
// =============================================================================

function computeDiff(_filePath: string, oldContent: string, newContent: string): string {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");
  const result: string[] = [];

  let maxLen = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < maxLen; i++) {
    if (oldLines[i] !== newLines[i]) {
      if (oldLines[i] !== undefined && newLines[i] !== undefined) {
        result.push(`- ${oldLines[i]}`);
        result.push(`+ ${newLines[i]}`);
      } else if (oldLines[i] !== undefined) {
        result.push(`- ${oldLines[i]}`);
      } else {
        result.push(`+ ${newLines[i]}`);
      }
    }
  }
  return result.join("\n");
}

// =============================================================================
// Disk operations
// =============================================================================

async function readFileContent(filePath: string): Promise<{ text: string; bom: string; lineEnding: "\n" | "\r\n" }> {
  const raw = await fs.readFile(filePath, "utf-8");
  const bom = hasBom(raw) ? BOM : "";
  const text = stripBom(raw);
  const lineEnding = detectLineEnding(text);
  return { text, bom, lineEnding };
}

async function writeFileContent(filePath: string, text: string, bom: string, lineEnding: "\n" | "\r\n"): Promise<void> {
  const content = bom + convertToLineEnding(text, lineEnding);
  await fs.writeFile(filePath, content, "utf-8");
}

// =============================================================================
// Create Enhanced Editor Tool
// =============================================================================

export interface CreateEnhancedEditorOptions {
  cwd: string;
  onEdit?: (filePath: string, oldContent: string, newContent: string) => Promise<void>;
}

export function createEnhancedEditorTool(options: CreateEnhancedEditorOptions): any {
  const { cwd, onEdit } = options;

  return createTool({
    name: "edit",
    description: `Make targeted file edits using find-and-replace with fuzzy matching.
Supports 9 matching strategies for flexible text replacement.
Use for surgical edits; use write for full-file replacement.

Key rules:
- oldString must match existing content exactly or closely
- For new files, oldString can be empty
- Use replaceAll: true to replace all occurrences
- Supports CRLF/LF normalization
- BOM-aware`,
    inputSchema: EditFileInputSchema,
    execute: async (input: EditFileInput, _context) => {
      const filePath = resolveToolPath(cwd, input.filePath);

      if (!input.oldString && !input.newString) {
        return { output: "Error: oldString and newString cannot both be empty.", isError: true };
      }

      if (input.oldString === input.newString) {
        return { output: "Error: oldString and newString are identical. No changes to apply.", isError: true };
      }

      return withFileLock(filePath, async () => {
        const pathInfo = await resolvePathInfo(cwd, input.filePath);
        const fileExists = pathInfo.kind !== "missing";

        if (pathInfo.kind === "directory") {
          return {
            output: `Error: Path is a directory, not a file: ${pathInfo.absolutePath}`,
            isError: true,
          };
        }

        if (pathInfo.kind === "other") {
          return {
            output: `Error: Unsupported path type: ${pathInfo.absolutePath}`,
            isError: true,
          };
        }

        // Handle new file creation
        if (!input.oldString) {
          if (fileExists) {
            return {
              output: "Error: oldString cannot be empty when editing an existing file. Provide the exact text to replace, or use write for an intentional full-file replacement.",
              isError: true,
            };
          }

          // Create new file
          await fs.mkdir(path.dirname(pathInfo.absolutePath), { recursive: true });
          await fs.writeFile(pathInfo.absolutePath, input.newString, "utf-8");

          const metadata = { edits: [{ filePath: pathInfo.absolutePath, operation: "create" }] };

          return {
            title: `Created ${path.basename(pathInfo.absolutePath)}`,
            output: `File created: ${pathInfo.absolutePath}`,
            metadata,
          };
        }

        // Read existing file
        if (!fileExists) {
          return { output: `Error: File not found: ${filePath}`, isError: true };
        }

        const { text: contentOld, bom, lineEnding } = await readFileContent(pathInfo.absolutePath);

        // Normalize line endings
        const old = convertToLineEnding(normalizeLineEndings(input.oldString), lineEnding);
        const replacement = convertToLineEnding(normalizeLineEndings(input.newString), lineEnding);

        // Apply replacement
        let contentNew: string;
        try {
          contentNew = replace(contentOld, old, replacement, input.replaceAll ?? false);
        } catch (err) {
          return {
            output: err instanceof Error ? err.message : "Failed to apply edit",
            isError: true,
          };
        }

        // Disproportionate match detection
        if (contentNew.length > contentOld.length * 3) {
          return {
            output: "Error: The replacement would make the file more than 3x larger. This is likely a mismatch. Use write for intentional large changes.",
            isError: true,
          };
        }

        // Write result
        await writeFileContent(pathInfo.absolutePath, contentNew, bom, lineEnding);

        // Trigger post-edit callback (e.g., LSP diagnostics, formatting)
        if (onEdit) {
          await onEdit(pathInfo.absolutePath, contentOld, contentNew);
        }

        const diff = computeDiff(pathInfo.absolutePath, normalizeLineEndings(contentOld), normalizeLineEndings(contentNew));

        return {
          title: `Edited ${path.basename(pathInfo.absolutePath)}`,
          output: `Applied edit to ${pathInfo.absolutePath}\n\nChanges:\n${diff.slice(0, 2000)}`,
          metadata: {
            edits: [{ filePath: pathInfo.absolutePath, operation: "edit" }],
            diff,
          },
        };
      });
    },
  });
}

// =============================================================================
// Create Enhanced Write Tool (ported from OpenCode write.ts)
// =============================================================================

export const WriteFileInputSchema = z.object({
  filePath: z.string().describe("The absolute path to the file to write"),
  content: z.string().describe("The full content to write to the file"),
});

export type WriteFileInput = z.infer<typeof WriteFileInputSchema>;

export interface CreateEnhancedWriterOptions {
  cwd: string;
  onWrite?: (filePath: string, content: string) => Promise<void>;
}

export function createEnhancedWriteTool(options: CreateEnhancedWriterOptions): any {
  const { cwd, onWrite } = options;

  return createTool({
    name: "write",
    description: "Write content to a file (full-file replacement). Creates parent directories as needed. BOM-aware with disk validation.",
    inputSchema: WriteFileInputSchema,
    execute: async (input: WriteFileInput, _context) => {
      const pathInfo = await resolvePathInfo(cwd, input.filePath);
      const filePath = pathInfo.absolutePath;

      if (pathInfo.kind === "directory") {
        return {
          output: `Error: Path is a directory, not a file: ${filePath}`,
          isError: true,
        };
      }

      if (pathInfo.kind === "other") {
        return {
          output: `Error: Unsupported path type: ${filePath}`,
          isError: true,
        };
      }

      // Step 1 & 2: Determine destination and create directory if missing
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      // Step 3 & 7: Write generated content and flush to disk
      await fs.writeFile(filePath, input.content, "utf-8");

      // Step 4: Verify file exists on disk
      try {
        await fs.access(filePath);
      } catch {
        throw new Error(`Write Validation Failed: File ${filePath} does not exist on disk after write operation.`);
      }

      // Step 9 & 10: Re-open/re-read file and verify written content matches
      const diskContent = await fs.readFile(filePath, "utf-8");
      if (stripBom(diskContent) !== stripBom(input.content)) {
        // Retry write once on mismatch
        await fs.writeFile(filePath, input.content, "utf-8");
        const recheck = await fs.readFile(filePath, "utf-8");
        if (stripBom(recheck) !== stripBom(input.content)) {
          throw new Error(`Write Validation Failed: Content written to ${filePath} does not match target content on disk.`);
        }
      }

      if (onWrite) {
        await onWrite(filePath, input.content);
      }

      // Step 11: Report success after verification
      return {
        title: `Wrote ${path.basename(filePath)}`,
        output: `✔ Verified: Wrote ${input.content.length} bytes to ${filePath} and confirmed content on disk`,
        metadata: {
          filePath,
          size: input.content.length,
          verified: true,
        },
      };
    },
  });
}
