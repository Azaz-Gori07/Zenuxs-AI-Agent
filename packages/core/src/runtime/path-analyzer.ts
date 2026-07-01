/**
 * Centralized Path Analyzer Service
 *
 * Ported from OpenCode's path handling architecture.
 * Provides unified path intelligence for all filesystem tools.
 *
 * Responsibilities:
 * - Normalize paths (Windows/Linux, absolute/relative, symlinks)
 * - Determine path type (file, directory, missing, other)
 * - Validate path existence and accessibility
 * - Provide routing hints to Tool Router
 * - Automatic recovery from ENOTDIR errors
 *
 * Design Principle:
 * No filesystem tool should execute without consulting the Path Analyzer first.
 */

import * as fs from "fs/promises";
import * as path from "path";
import type { Stats } from "fs";

// =============================================================================
// Types
// =============================================================================

export type PathKind = "file" | "directory" | "symlink" | "missing" | "other";

export interface PathAnalysis {
  /** Original input path */
  inputPath: string;
  /** Normalized absolute path */
  absolutePath: string;
  /** Resolved realpath (for symlinks) */
  resolvedPath?: string;
  /** File statistics */
  stats?: Stats;
  /** Determined path type */
  kind: PathKind;
  /** Whether path is readable */
  readable: boolean;
  /** Whether path is writable (for files) */
  writable?: boolean;
  /** Error message if analysis failed */
  error?: string;
  /** Routing hint for Tool Router */
  routingHint: {
    /** Should use file-mode tools */
    isFile: boolean;
    /** Should use directory-mode tools */
    isDirectory: boolean;
    /** Suggested tool category */
    suggestedCategory: "file" | "directory" | "search" | "unknown";
  };
}

export interface PathAnalyzerConfig {
  /** Working directory for relative path resolution */
  cwd: string;
  /** Follow symlinks (default: true) */
  followSymlinks?: boolean;
  /** Check readability (default: true) */
  checkReadability?: boolean;
  /** Check writability for files (default: false) */
  checkWritability?: boolean;
}

// =============================================================================
// Path Normalization
// =============================================================================

/**
 * Normalize a path for cross-platform compatibility.
 * Handles Windows paths, Linux paths, duplicate separators, trailing slashes.
 */
export function normalizePath(inputPath: string, cwd: string): string {
  // Handle empty input
  if (!inputPath || !inputPath.trim()) {
    return cwd;
  }

  let normalized = inputPath.trim();

  // Remove surrounding quotes (common in LLM outputs)
  if ((normalized.startsWith('"') && normalized.endsWith('"')) ||
      (normalized.startsWith("'") && normalized.endsWith("'"))) {
    normalized = normalized.slice(1, -1);
  }

  // Convert to absolute path if relative
  let absolutePath: string;
  if (path.isAbsolute(normalized)) {
    absolutePath = normalized;
  } else {
    absolutePath = path.resolve(cwd, normalized);
  }

  // Normalize separators and resolve . and ..
  absolutePath = path.normalize(absolutePath);

  // Remove trailing slash (except for root directories)
  if (absolutePath.length > 1 && (absolutePath.endsWith("/") || absolutePath.endsWith("\\"))) {
    absolutePath = absolutePath.slice(0, -1);
  }

  return absolutePath;
}

// =============================================================================
// Path Analysis
// =============================================================================

/**
 * Analyze a path to determine its type, existence, and routing hints.
 * This is the central entry point for all filesystem tools.
 */
export async function analyzePath(
  inputPath: string,
  config: PathAnalyzerConfig,
): Promise<PathAnalysis> {
  const {
    cwd,
    followSymlinks = true,
    checkReadability = true,
    checkWritability = false,
  } = config;

  // Step 1: Normalize path
  const absolutePath = normalizePath(inputPath, cwd);

  // Step 2: Check existence and type
  try {
    // Use lstat for symlinks, stat for regular paths
    const statFn = followSymlinks ? fs.stat : fs.lstat;
    const stats = await statFn(absolutePath);

    // Step 3: Determine path kind
    let kind: PathKind;
    let resolvedPath: string | undefined;

    if (stats.isSymbolicLink()) {
      kind = "symlink";
      if (followSymlinks) {
        try {
          resolvedPath = await fs.realpath(absolutePath);
        } catch {
          // Symlink target doesn't exist
        }
      }
    } else if (stats.isFile()) {
      kind = "file";
    } else if (stats.isDirectory()) {
      kind = "directory";
    } else {
      kind = "other";
    }

    // Step 4: Check readability
    let readable = true;
    if (checkReadability) {
      try {
        await fs.access(absolutePath, fs.constants.R_OK);
      } catch {
        readable = false;
      }
    }

    // Step 5: Check writability (for files)
    let writable: boolean | undefined;
    if (checkWritability && kind === "file") {
      try {
        await fs.access(absolutePath, fs.constants.W_OK);
        writable = true;
      } catch {
        writable = false;
      }
    }

    // Step 6: Generate routing hints
    const routingHint = generateRoutingHint(kind);

    return {
      inputPath,
      absolutePath,
      resolvedPath,
      stats,
      kind,
      readable,
      writable,
      routingHint,
    };
  } catch (error) {
    // Path doesn't exist or is inaccessible
    return {
      inputPath,
      absolutePath,
      kind: "missing",
      readable: false,
      error: error instanceof Error ? error.message : String(error),
      routingHint: {
        isFile: false,
        isDirectory: false,
        suggestedCategory: "unknown",
      },
    };
  }
}

// =============================================================================
// Routing Hints
// =============================================================================

/**
 * Generate routing hints based on path kind.
 * Used by Tool Router to select appropriate tools.
 */
function generateRoutingHint(kind: PathKind): PathAnalysis["routingHint"] {
  switch (kind) {
    case "file":
      return {
        isFile: true,
        isDirectory: false,
        suggestedCategory: "file",
      };
    case "directory":
      return {
        isFile: false,
        isDirectory: true,
        suggestedCategory: "directory",
      };
    case "symlink":
      // Symlinks could point to files or directories
      return {
        isFile: false,
        isDirectory: false,
        suggestedCategory: "search",
      };
    case "missing":
      return {
        isFile: false,
        isDirectory: false,
        suggestedCategory: "unknown",
      };
    default:
      return {
        isFile: false,
        isDirectory: false,
        suggestedCategory: "unknown",
      };
  }
}

// =============================================================================
// Error Classification
// =============================================================================

/**
 * Check if an error is ENOTDIR (not a directory).
 * This occurs when trying to use a file as a directory.
 */
export function isEnotdirError(error: unknown): boolean {
  return isNodeErrorCode(error, "ENOTDIR");
}

/**
 * Check if an error is ENOENT (no such file or directory).
 */
export function isEnoentError(error: unknown): boolean {
  return isNodeErrorCode(error, "ENOENT");
}

/**
 * Check if an error is EACCES (permission denied).
 */
export function isEaccesError(error: unknown): boolean {
  return isNodeErrorCode(error, "EACCES");
}

/**
 * Check if an error is recoverable.
 * Recoverable errors can trigger automatic recovery flow.
 */
export function isRecoverableError(error: unknown): boolean {
  return (
    isEnotdirError(error) || // File treated as directory - recoverable
    isEnoentError(error) ||  // Path not found - may be recoverable with different path
    isEaccesError(error)     // Permission denied - may be recoverable with different tool
  );
}

/**
 * Generic Node.js error code checker.
 */
function isNodeErrorCode(error: unknown, code: string): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === code
  );
}

// =============================================================================
// Path Recovery
// =============================================================================

/**
 * Attempt to recover from ENOTDIR error.
 * If a path was treated as directory but is actually a file,
 * return the correct path analysis for file mode.
 */
export async function recoverFromEnotdir(
  inputPath: string,
  config: PathAnalyzerConfig,
): Promise<PathAnalysis | null> {
  // Re-analyze the path - it's likely a file
  const analysis = await analyzePath(inputPath, config);

  // If it's a file, we can recover by using file-mode tools
  if (analysis.kind === "file") {
    return analysis;
  }

  // If it's still not a file, recovery failed
  return null;
}

// =============================================================================
// Batch Path Analysis
// =============================================================================

/**
 * Analyze multiple paths in parallel.
 * Useful for tools that need to check multiple paths.
 */
export async function analyzePaths(
  paths: string[],
  config: PathAnalyzerConfig,
): Promise<PathAnalysis[]> {
  return Promise.all(
    paths.map((p) => analyzePath(p, config))
  );
}

// =============================================================================
// Path Analyzer Service (Singleton)
// =============================================================================

/**
 * Path Analyzer Service instance.
 * Provides a centralized service for path analysis across all tools.
 */
export class PathAnalyzerService {
  private defaultConfig: PathAnalyzerConfig;

  constructor(config: PathAnalyzerConfig) {
    this.defaultConfig = config;
  }

  /**
   * Analyze a single path.
   */
  async analyze(inputPath: string, config?: Partial<PathAnalyzerConfig>): Promise<PathAnalysis> {
    const mergedConfig = { ...this.defaultConfig, ...config };
    return analyzePath(inputPath, mergedConfig);
  }

  /**
   * Analyze multiple paths.
   */
  async analyzeMany(paths: string[], config?: Partial<PathAnalyzerConfig>): Promise<PathAnalysis[]> {
    const mergedConfig = { ...this.defaultConfig, ...config };
    return analyzePaths(paths, mergedConfig);
  }

  /**
   * Recover from ENOTDIR error.
   */
  async recoverEnotdir(inputPath: string, config?: Partial<PathAnalyzerConfig>): Promise<PathAnalysis | null> {
    const mergedConfig = { ...this.defaultConfig, ...config };
    return recoverFromEnotdir(inputPath, mergedConfig);
  }

  /**
   * Update default configuration.
   */
  updateConfig(config: Partial<PathAnalyzerConfig>): void {
    this.defaultConfig = { ...this.defaultConfig, ...config };
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a Path Analyzer Service instance.
 */
export function createPathAnalyzer(config: PathAnalyzerConfig): PathAnalyzerService {
  return new PathAnalyzerService(config);
}
