import * as fs from "fs/promises";
import * as path from "path";
import type { Stats } from "fs";
import { resolveExistingFilePath } from "@cline/shared/storage";
import { assertSafePath, type SafePathOptions } from "./path-safety";

export type ExistingPathKind = "file" | "directory" | "other";

export interface ResolvedPathInfo {
  inputPath: string;
  absolutePath: string;
  stats?: Stats;
  kind: ExistingPathKind | "missing";
}

export function resolveToolPath(cwd: string, targetPath: string): string {
  return path.isAbsolute(targetPath)
    ? path.normalize(targetPath)
    : path.resolve(cwd, targetPath);
}

export async function resolvePathInfo(
  cwd: string,
  targetPath: string,
  options: SafePathOptions = {},
): Promise<ResolvedPathInfo> {
  const initialPath = resolveToolPath(cwd, targetPath);
  const existingPath = resolveExistingFilePath(initialPath) ?? initialPath;

  // Resolve symlinks and enforce the workspace boundary before returning any
  // path for I/O. The returned absolutePath is the real path, so a symlink
  // swapped in after this check cannot redirect the operation.
  const safe = await assertSafePath(cwd, existingPath, options);
  const absolutePath = safe.realPath;

  try {
    const stats = await fs.stat(absolutePath);
    const kind: ExistingPathKind = stats.isFile()
      ? "file"
      : stats.isDirectory()
        ? "directory"
        : "other";

    return {
      inputPath: targetPath,
      absolutePath,
      stats,
      kind,
    };
  } catch (error) {
    if (isNotFoundError(error)) {
      return {
        inputPath: targetPath,
        absolutePath,
        kind: "missing",
      };
    }
    throw error;
  }
}

export function isEnotdirError(error: unknown): boolean {
  return isNodeErrorCode(error, "ENOTDIR");
}

export function isNotFoundError(error: unknown): boolean {
  return isNodeErrorCode(error, "ENOENT") || isNodeErrorCode(error, "ENOTDIR");
}

function isNodeErrorCode(error: unknown, code: string): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === code
  );
}
