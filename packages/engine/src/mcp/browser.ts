import { spawn } from "node:child_process"

export class McpBrowser {
  async open(url: string): Promise<void> {
    const cmd = process.platform === "win32" ? "start" :
      process.platform === "darwin" ? "open" : "xdg-open"
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, [url], { stdio: "ignore", shell: true })
      child.on("error", (err) => reject(new Error(`Failed to open browser: ${err.message}`)))
      child.on("exit", (code) => {
        if (code !== null && code !== 0) reject(new Error(`Browser exited with code ${code}`))
        else resolve()
      })
      setTimeout(() => resolve(), 3000)
    })
  }

  async openBackground(url: string): Promise<void> {
    const cmd = process.platform === "win32" ? "start" :
      process.platform === "darwin" ? "open" : "xdg-open"
    spawn(cmd, [url], { stdio: "ignore", shell: true, detached: true }).unref()
  }
}

export * as McpBrowser from "./browser"
