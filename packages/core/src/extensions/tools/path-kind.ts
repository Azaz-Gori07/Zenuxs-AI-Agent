import * as fs from "fs/promises";
import * as path from "path";
import type { Stats } from "fs";
import { resolveExistingFilePath } from "@cline/shared/storage";

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
): Promise<ResolvedPathInfo> {
  const initialPath = resolveToolPath(cwd, targetPath);
  const absolutePath = resolveExistingFilePath(initialPath) ?? initialPath;

  // Workspace boundary: filesystem tools must not silently escape the active
  // workspace. Explicitly opt in via the environment when a caller truly needs
  // cross-workspace access (e.g. tooling that manages other checkouts).
  if (process.env.ZENUXS_ALLOW_OUTSIDE_WORKSPACE !== "1") {
    const relative = path.relative(cwd, absolutePath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(
        `Path is outside the workspace: ${targetPath} (workspace: ${cwd})`,
      );
    }
  }

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
