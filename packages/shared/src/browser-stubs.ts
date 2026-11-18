// Browser-safe stand-ins for Node-only helpers re-exported by @cline/core.
// Webviews never execute Node commands or profiling; these keep the browser
// bundle's import graph complete without pulling in node: modules.

export function augmentNodeCommandForDebug(command: string): string {
  return command
}

export function withResolvedZenuxsBuildEnv<T>(value: T): T {
  return value
}

export const profiler = {
  markTimeline(): void {},
  start(): string {
    return ""
  },
  end(): void {},
  async finish(): Promise<void> {},
}
