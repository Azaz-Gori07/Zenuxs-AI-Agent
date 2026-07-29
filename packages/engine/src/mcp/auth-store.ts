import { z } from "zod"

const TokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  expiresAt: z.number().optional(),
  scope: z.string().optional(),
})

const ClientInfoSchema = z.object({
  clientId: z.string(),
  clientSecret: z.string().optional(),
  clientIdIssuedAt: z.number().optional(),
  clientSecretExpiresAt: z.number().optional(),
})

const EntrySchema = z.object({
  tokens: TokensSchema.optional(),
  clientInfo: ClientInfoSchema.optional(),
  codeVerifier: z.string().optional(),
  oauthState: z.string().optional(),
  serverUrl: z.string().optional(),
})

export type Tokens = z.infer<typeof TokensSchema>
export type ClientInfo = z.infer<typeof ClientInfoSchema>
export type McpAuthEntry = z.infer<typeof EntrySchema>
export type AuthData = Record<string, McpAuthEntry>

export class McpAuthStore {
  private data: AuthData = {}
  private filePath: string
  private locked = false
  private pendingOps: Array<() => Promise<void>> = []
  private dirtyCount = 0

  constructor(filePath: string) {
    this.filePath = filePath
  }

  async init(): Promise<void> {
    try {
      const fs = await import("node:fs/promises")
      const content = await fs.readFile(this.filePath, "utf-8")
      const parsed = JSON.parse(content)
      this.data = EntrySchema.shape.record(z.string(), EntrySchema).parse(parsed)
    } catch {
      this.data = {}
    }
  }

  private async flush(): Promise<void> {
    if (this.dirtyCount === 0) return
    const fs = await import("node:fs/promises")
    await fs.writeFile(this.filePath, JSON.stringify(this.data, null, 2), { mode: 0o600 })
    this.dirtyCount = 0
  }

  private async lockedWrite(fn: () => Promise<void>): Promise<void> {
    if (this.locked) {
      return new Promise((resolve, reject) => {
        this.pendingOps.push(async () => {
          try {
            await fn()
            resolve()
          } catch (e) {
            reject(e)
          }
        })
      })
    }
    this.locked = true
    try {
      await fn()
      this.dirtyCount++
      if (this.dirtyCount >= 10) await this.flush()
    } finally {
      this.locked = false
      const next = this.pendingOps.shift()
      if (next) await this.lockedWrite(next)
    }
  }

  async flushNow(): Promise<void> {
    await this.lockedWrite(async () => {
      await this.flush()
    })
  }

  async getAll(): Promise<AuthData> {
    return { ...this.data }
  }

  async get(mcpName: string): Promise<McpAuthEntry | undefined> {
    return this.data[mcpName]
  }

  async getForUrl(mcpName: string, serverUrl: string): Promise<McpAuthEntry | undefined> {
    const entry = this.data[mcpName]
    if (!entry?.serverUrl || entry.serverUrl !== serverUrl) return undefined
    return entry
  }

  async set(mcpName: string, entry: McpAuthEntry, serverUrl?: string): Promise<void> {
    await this.lockedWrite(async () => {
      this.data[mcpName] = serverUrl ? { ...entry, serverUrl } : entry
    })
  }

  async remove(mcpName: string): Promise<void> {
    await this.lockedWrite(async () => {
      const next = { ...this.data }
      delete next[mcpName]
      this.data = next
    })
  }

  async updateTokens(mcpName: string, tokens: Tokens, serverUrl?: string): Promise<void> {
    await this.lockedWrite(async () => {
      const entry = this.data[mcpName] ?? {}
      entry.tokens = tokens
      if (serverUrl) entry.serverUrl = serverUrl
      this.data[mcpName] = entry
    })
  }

  async updateClientInfo(mcpName: string, info: ClientInfo, serverUrl?: string): Promise<void> {
    await this.lockedWrite(async () => {
      const entry = this.data[mcpName] ?? {}
      entry.clientInfo = info
      if (serverUrl) entry.serverUrl = serverUrl
      this.data[mcpName] = entry
    })
  }

  async updateCodeVerifier(mcpName: string, codeVerifier: string): Promise<void> {
    await this.lockedWrite(async () => {
      const entry = this.data[mcpName] ?? {}
      entry.codeVerifier = codeVerifier
      this.data[mcpName] = entry
    })
  }

  async updateOAuthState(mcpName: string, oauthState: string): Promise<void> {
    await this.lockedWrite(async () => {
      const entry = this.data[mcpName] ?? {}
      entry.oauthState = oauthState
      this.data[mcpName] = entry
    })
  }

  async getOAuthState(mcpName: string): Promise<string | undefined> {
    return this.data[mcpName]?.oauthState
  }

  async clearCodeVerifier(mcpName: string): Promise<void> {
    await this.lockedWrite(async () => {
      const entry = this.data[mcpName]
      if (entry) delete entry.codeVerifier
    })
  }

  async clearOAuthState(mcpName: string): Promise<void> {
    await this.lockedWrite(async () => {
      const entry = this.data[mcpName]
      if (entry) delete entry.oauthState
    })
  }

  async tokensExpired(mcpName: string): Promise<boolean> {
    const entry = this.data[mcpName]
    if (!entry?.tokens?.expiresAt) return false
    return entry.tokens.expiresAt < Date.now() / 1000
  }

  async hasTokens(mcpName: string): Promise<boolean> {
    return !!this.data[mcpName]?.tokens
  }
}

export * as McpAuthStore from "./auth-store"
