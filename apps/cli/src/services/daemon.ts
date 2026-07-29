import { spawn } from "node:child_process"
import { randomBytes, randomUUID } from "node:crypto"
import { readFile, writeFile, mkdir, rename, unlink } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"

interface Registration {
  id: string
  version: string
  url: string
  pid: number
}

export class DaemonManager {
  private stateDir: string
  private serverFile: string
  private passwordFile: string
  private version: string

  constructor(version: string, stateDir?: string) {
    this.version = version
    this.stateDir = stateDir ?? join(homedir(), ".zenuxs", "state")
    this.serverFile = join(this.stateDir, "server.json")
    this.passwordFile = join(this.stateDir, "password")
  }

  async password(value?: string): Promise<string> {
    try {
      const existing = await readFile(this.passwordFile, "utf-8")
      if (value === undefined) return existing.trim()
    } catch {}

    const pw = value ?? randomBytes(32).toString("base64url")
    await mkdir(this.stateDir, { recursive: true })
    const temp = this.passwordFile + ".tmp"
    await writeFile(temp, pw, { mode: 0o600 })
    await rename(temp, this.passwordFile)
    return pw
  }

  private async readRegistration(): Promise<Registration | undefined> {
    try {
      return JSON.parse(await readFile(this.serverFile, "utf-8"))
    } catch {
      return undefined
    }
  }

  async isHealthy(): Promise<Registration | undefined> {
    const info = await this.readRegistration()
    if (!info) return undefined
    try {
      const pw = await this.password()
      const response = await fetch(`${info.url}/health`, {
        headers: { Authorization: `Bearer ${pw}` },
        signal: AbortSignal.timeout(2000),
      })
      if (response.ok) return info
    } catch {}
    return undefined
  }

  async start(): Promise<string> {
    const existing = await this.isHealthy()
    if (existing?.version === this.version) return existing.url

    if (existing) await this.stopProcess(existing)

    const entrypoint = process.argv[1]
    spawn(process.execPath, [entrypoint, "serve", "--register"], {
      detached: true,
      stdio: "ignore",
    }).unref()

    for (let i = 0; i < 100; i++) {
      await new Promise((r) => setTimeout(r, 50))
      const healthy = await this.isHealthy()
      if (healthy && healthy.version === this.version) return healthy.url
    }
    throw new Error("Failed to start server")
  }

  async stop(): Promise<void> {
    const existing = await this.readRegistration()
    if (!existing) {
      try { await unlink(this.serverFile) } catch {}
      return
    }
    await this.stopProcess(existing)
    try { await unlink(this.serverFile) } catch {}
  }

  private async stopProcess(info: Registration): Promise<void> {
    await signalProcess(info.pid, "SIGTERM")
    for (let i = 0; i < 100; i++) {
      await new Promise((r) => setTimeout(r, 50))
      if (!await this.isHealthy()) return
    }
    await signalProcess(info.pid, "SIGKILL")
    for (let i = 0; i < 100; i++) {
      await new Promise((r) => setTimeout(r, 50))
      if (!await this.isHealthy()) return
    }
  }

  async status(): Promise<string | undefined> {
    const healthy = await this.isHealthy()
    if (healthy && healthy.version === this.version) return healthy.url
    if (healthy) return undefined
    try { await unlink(this.serverFile) } catch {}
    return undefined
  }

  async register(address: { hostname: string; port: number }): Promise<void> {
    const url = `http://${address.hostname}:${address.port}`
    const id = randomUUID()
    const info: Registration = { id, version: this.version, url, pid: process.pid }

    await mkdir(this.stateDir, { recursive: true })
    const temp = this.serverFile + "." + id + ".tmp"
    await writeFile(temp, JSON.stringify(info), { mode: 0o600 })
    await rename(temp, this.serverFile)
  }

  async getTransport(): Promise<{ url: string; headers: Record<string, string> }> {
    const url = await this.start()
    const pw = await this.password()
    return { url, headers: { Authorization: `Bearer ${pw}`, "Content-Type": "application/json" } }
  }
}

function signalProcess(pid: number, signal: NodeJS.Signals): Promise<void> {
  try {
    process.kill(pid, signal)
  } catch {}
  return Promise.resolve()
}


