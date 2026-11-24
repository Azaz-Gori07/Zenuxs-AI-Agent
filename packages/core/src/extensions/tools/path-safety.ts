/**
 * Centralised workspace path safety.
 *
 * Every filesystem-touching tool must resolve the *real* path (following
 * symlink chains) before checking the workspace boundary, and must operate on
 * the resolved path so a check-then-use race cannot swap a symlink in between.
 */

import * as fsSync from "node:fs"
import type { Dirent } from "node:fs"
import * as fsp from "node:fs/promises"
import * as path from "node:path"

export class WorkspaceBoundaryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "WorkspaceBoundaryError"
  }
}

export interface SafePathOptions {
  /** Reject hardlinks (nlink > 1), which can alias files outside the workspace. */
  rejectHardlinks?: boolean
  /** Permit paths outside the workspace (explicit opt-in only). */
  allowOutside?: boolean
}

export interface SafePath {
  /** Lexically normalised input path (for display). */
  inputPath: string
  /** Fully resolved real path - use this for all I/O. */
  realPath: string
  stats?: fsSync.Stats
}

const isNotFound = (error: unknown): boolean =>
  error instanceof Error &&
  "code" in error &&
  (error as NodeJS.ErrnoException).code === "ENOENT"

export function workspaceRealPath(cwd: string): string {
  return fsSync.realpathSync(path.resolve(cwd))
}

/** Resolve the nearest existing ancestor, then append the missing tail. */
async function resolveWithMissingTail(candidate: string): Promise<string> {
  let current = candidate
  const tail: string[] = []
  for (;;) {
    try {
      const real = await fsp.realpath(current)
      return tail.length === 0 ? real : path.join(real, ...tail.reverse())
    } catch (error) {
      if (!isNotFound(error)) throw error
      const parent = path.dirname(current)
      if (parent === current) return candidate
      tail.push(path.basename(current))
      current = parent
    }
  }
}

export function isInsideWorkspace(rootReal: string, candidateReal: string): boolean {
  const relative = path.relative(rootReal, candidateReal)
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
}

/**
 * Resolve and validate a tool-supplied path against the workspace boundary.
 * Follows symlink chains, rejects hardlinks, normalises `..`, and returns the
 * real path that callers must use for the actual I/O.
 */
export async function assertSafePath(
  cwd: string,
  targetPath: string,
  options: SafePathOptions = {},
): Promise<SafePath> {
  const allowOutside = options.allowOutside ?? process.env.ZENUXS_ALLOW_OUTSIDE_WORKSPACE === "1"
  const rootReal = workspaceRealPath(cwd)
  const lexical = path.isAbsolute(targetPath)
    ? path.resolve(targetPath)
    : path.resolve(rootReal, targetPath)
  const realPath = await resolveWithMissingTail(lexical)

  // Reject symlinks anywhere in the chain by comparing the lexical path to the
  // real path's containment; a symlink to inside is still disallowed so that a
  // link cannot be swapped for an outside target between check and use.
  let lexicalProbe = lexical
  for (;;) {
    let st: fsSync.Stats
    try { st = await fsp.lstat(lexicalProbe) } catch { break }
    if (st.isSymbolicLink()) {
      throw new WorkspaceBoundaryError(
        `Symlink paths are not allowed for filesystem tools: ${targetPath}`,
      )
    }
    const parent = path.dirname(lexicalProbe)
    if (parent === lexicalProbe) break
    lexicalProbe = parent
  }

  if (!allowOutside && !isInsideWorkspace(rootReal, realPath)) {
    throw new WorkspaceBoundaryError(
      `Path is outside the workspace: ${targetPath} (workspace: ${cwd})`,
    )
  }

  let stats: fsSync.Stats | undefined
  try { stats = await fsp.stat(realPath) } catch { /* missing target */ }
  if (stats && (options.rejectHardlinks ?? true) && stats.nlink > 1) {
    throw new WorkspaceBoundaryError(
      `Hardlinked paths are not allowed for filesystem tools: ${targetPath}`,
    )
  }

  return { inputPath: targetPath, realPath, ...(stats ? { stats } : {}) }
}

/**
 * Assert safety again immediately before/after opening a file. Returns the
 * already-open descriptor so callers can operate without re-resolving links.
 */
export async function openSafeFile(
  cwd: string,
  targetPath: string,
  flags: number,
  mode?: number,
  options: SafePathOptions = {},
): Promise<{ handle: fsp.FileHandle; realPath: string }> {
  const safe = await assertSafePath(cwd, targetPath, options)
  const flagsNoFollow = flags | (fsSync.constants as Record<string, number>).O_NOFOLLOW
  const handle = await fsp.open(safe.realPath, flagsNoFollow, mode)
  try {
    const [fdStat, pathStat] = await Promise.all([
      handle.stat(),
      fsp.stat(safe.realPath).catch(() => null),
    ])
    if (!pathStat || fdStat.dev !== pathStat.dev || fdStat.ino !== pathStat.ino) {
      throw new WorkspaceBoundaryError(
        `Path changed during validation (possible symlink race): ${targetPath}`,
      )
    }
  } catch (error) {
    await handle.close()
    throw error
  }
  return { handle, realPath: safe.realPath }
}

/** Skip symbolic links during recursive directory traversal. */
export async function readdirNoSymlinks(dir: string): Promise<Dirent[]> {
  const entries = await fsp.readdir(dir, { withFileTypes: true })
  return entries.filter((entry) => !entry.isSymbolicLink())
}
