import { accessSync, constants } from "node:fs"
import { resolve, relative } from "node:path"

export interface ExternalDirConfig {
  workspaceRoot?: string
  allowedDirectories?: string[]
  denyDirectories?: string[]
  defaultAction: "allow" | "ask" | "deny"
}

const DEFAULT_CONFIG: Required<Pick<ExternalDirConfig, "defaultAction">> = {
  defaultAction: "ask",
}

export class ExternalDirectoryChecker {
  private config: ExternalDirConfig

  constructor(config: ExternalDirConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  updateConfig(config: Partial<ExternalDirConfig>): void {
    this.config = { ...this.config, ...config }
  }

  isExternal(filePath: string): boolean {
    if (!this.config.workspaceRoot) return false
    const resolved = resolve(filePath)
    const rel = relative(this.config.workspaceRoot, resolved)
    return rel.startsWith("..") || rel === resolved
  }

  isAllowed(path: string): { allowed: boolean; reason: string } {
    const resolved = resolve(path)

    if (this.config.denyDirectories) {
      for (const denied of this.config.denyDirectories) {
        const deniedPath = resolve(denied)
        if (resolved.startsWith(deniedPath) || deniedPath.startsWith(resolved)) {
          return { allowed: false, reason: `Path is in a denied directory: ${denied}` }
        }
      }
    }

    if (this.config.allowedDirectories) {
      for (const allowed of this.config.allowedDirectories) {
        const allowedPath = resolve(allowed)
        if (resolved.startsWith(allowedPath)) {
          return { allowed: true, reason: "Path is in an allowed directory" }
        }
      }
    }

    if (!this.isExternal(resolved)) {
      return { allowed: true, reason: "Path is within workspace" }
    }

    if (this.config.defaultAction === "allow") {
      return { allowed: true, reason: "External path allowed by default configuration" }
    }
    if (this.config.defaultAction === "deny") {
      return { allowed: false, reason: "External path denied by default configuration" }
    }

    return { allowed: false, reason: "External path requires user approval" }
  }

  async checkPath(path: string): Promise<{ allowed: boolean; reason: string; external: boolean }> {
    const resolved = resolve(path)
    const external = this.isExternal(resolved)
    const { allowed, reason } = this.isAllowed(resolved)

    try {
      accessSync(resolved, constants.F_OK)
    } catch {
      const parent = resolve(resolved, "..")
      try {
        accessSync(parent, constants.F_OK)
      } catch {
        return { allowed: false, reason: `Parent directory does not exist: ${parent}`, external }
      }
    }

    return { allowed, reason, external }
  }

  resolvePath(workspaceRoot: string, givenPath: string): string {
    if (resolve(givenPath) === givenPath) {
      return givenPath
    }
    return resolve(workspaceRoot, givenPath)
  }
}

export * as ExternalDir from "."
