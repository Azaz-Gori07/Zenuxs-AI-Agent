import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js"
import {
  ListRootsRequestSchema,
  LoggingMessageNotificationSchema,
  ToolListChangedNotificationSchema,
  type LoggingMessageNotification,
  type Tool as MCPToolDef,
} from "@modelcontextprotocol/sdk/types.js"
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"
import { spawn } from "node:child_process"
import { McpAuthStore, type McpAuthEntry } from "./auth-store"
import { McpOAuthProvider, McpOAuthPendingProvider, McpOAuthCallback, parseRedirectUri } from "./oauth-provider"
import * as McpOAuthCallback from "./oauth-callback"
import { McpBrowser } from "./browser"
import * as McpCatalog from "./catalog"

export const DEFAULT_TIMEOUT = 30_000

export type McpServerType = "local" | "remote"

export interface McpServerConfig {
  type: McpServerType
  command?: string[]
  url?: string
  cwd?: string
  environment?: Record<string, string>
  headers?: Record<string, string>
  oauth?: boolean | { clientId?: string; clientSecret?: string; scope?: string; callbackPort?: number; redirectUri?: string }
  timeout?: number
  enabled?: boolean
}

export type McpStatus =
  | { status: "connected" }
  | { status: "disabled" }
  | { status: "failed"; error: string }
  | { status: "needs_auth" }
  | { status: "needs_client_registration"; error: string }

export type AuthStatus = "authenticated" | "expired" | "not_authenticated"

export interface ServerInstructions {
  name: string
  instructions: string
  tools: string[]
}

export interface McpManagedTool {
  def: MCPToolDef
  client: Client
  timeout?: number
}

interface McpClientState {
  config: McpServerConfig
  status: McpStatus
  client?: Client
  tools: MCPToolDef[]
  instructions?: string
  transport?: Transport
  childPid?: number
}

type McpEventCallback = (type: string, data: unknown) => void

export class McpManager {
  private servers = new Map<string, McpClientState>()
  private authStore: McpAuthStore
  private dataDir: string
  private onEvent?: McpEventCallback
  private reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private shutdownInitiated = false
  private pendingOAuthTransports = new Map<string, { transport: StreamableHTTPClientTransport | SSEClientTransport; provider?: McpOAuthPendingProvider }>()

  constructor(dataDir: string, onEvent?: McpEventCallback) {
    this.dataDir = dataDir
    this.authStore = new McpAuthStore(dataDir + "/mcp-auth.json")
    this.onEvent = onEvent
  }

  async init(): Promise<void> {
    await this.authStore.init()
  }

  async loadConfig(configs: Record<string, McpServerConfig>): Promise<Record<string, McpStatus>> {
    const results: Record<string, McpStatus> = {}
    await Promise.all(
      Object.entries(configs).map(async ([name, config]) => {
        results[name] = await this.connectServer(name, config)
      }),
    )
    return results
  }

  async connectServer(name: string, config: McpServerConfig): Promise<McpStatus> {
    if (config.enabled === false) {
      this.servers.set(name, { config, status: { status: "disabled" }, tools: [] })
      return { status: "disabled" }
    }

    const status = config.type === "remote"
      ? await this.connectRemote(name, config)
      : await this.connectLocal(name, config)

    return status
  }

  private async connectRemote(name: string, config: McpServerConfig): Promise<McpStatus> {
    const url = config.url ? new URL(config.url) : null
    if (!url) return { status: "failed", error: `Invalid MCP URL for "${name}"` }

    const oauthDisabled = config.oauth === false
    const oauthConfig = typeof config.oauth === "object" ? config.oauth : undefined
    let authProvider: McpOAuthProvider | undefined

    if (!oauthDisabled) {
      authProvider = new McpOAuthProvider(
        name,
        config.url,
        {
          clientId: oauthConfig?.clientId,
          clientSecret: oauthConfig?.clientSecret,
          scope: oauthConfig?.scope,
          callbackPort: oauthConfig?.callbackPort,
          redirectUri: oauthConfig?.redirectUri,
        },
        { onRedirect: async () => {} },
        this.authStore,
      )
    }

    const transports: Array<{ name: string; transport: StreamableHTTPClientTransport | SSEClientTransport }> = [
      {
        name: "StreamableHTTP",
        transport: new StreamableHTTPClientTransport(url, {
          authProvider,
          requestInit: config.headers ? { headers: config.headers } : undefined,
        }),
      },
      {
        name: "SSE",
        transport: new SSEClientTransport(url, {
          authProvider,
          requestInit: config.headers ? { headers: config.headers } : undefined,
        }),
      },
    ]

    const timeout = config.timeout ?? DEFAULT_TIMEOUT
    let lastStatus: McpStatus | undefined

    for (const { name: transportName, transport } of transports) {
      try {
        const client = await this.connectTransport(transport, timeout)
        const tools = await McpCatalog.listTools(client, timeout)
        this.storeClient(name, config, client, transport, tools)
        return { status: "connected" }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        const isAuthError = error instanceof UnauthorizedError || (authProvider && err.message.includes("OAuth"))

        if (isAuthError) {
          if (err.message.includes("registration") || err.message.includes("client_id")) {
            lastStatus = { status: "needs_client_registration", error: "Server does not support dynamic registration. Provide clientId in config." }
          } else {
            this.pendingOAuthTransports.set(name, { transport })
            lastStatus = { status: "needs_auth" }
          }
          break
        }

        lastStatus = { status: "failed", error: err.message }
      }
    }

    const finalStatus = lastStatus ?? { status: "failed", error: "Unknown connection error" }
    this.servers.set(name, { config, status: finalStatus, tools: [] })
    return finalStatus
  }

  private async connectLocal(name: string, config: McpServerConfig): Promise<McpStatus> {
    const [cmd, ...args] = config.command ?? []
    if (!cmd) return { status: "failed", error: `No command configured for "${name}"` }

    const transport = new StdioClientTransport({
      command: cmd,
      args,
      cwd: config.cwd ?? this.dataDir,
      env: {
        ...process.env,
        ...config.environment,
      },
    })

    const timeout = config.timeout ?? DEFAULT_TIMEOUT
    try {
      const client = await this.connectTransport(transport, timeout)
      const tools = await McpCatalog.listTools(client, timeout)
      this.storeClient(name, config, client, transport, tools)
      return { status: "connected" }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      const status: McpStatus = { status: "failed", error: msg }
      this.servers.set(name, { config, status, tools: [] })
      return status
    }
  }

  private async connectTransport(transport: Transport, timeout: number): Promise<Client> {
    const client = new Client(
      { name: "zenuxs-code", version: "0.1.0" },
      { capabilities: { roots: {} } },
    )
    client.setRequestHandler(ListRootsRequestSchema, () =>
      Promise.resolve({ roots: [{ uri: `file://${this.dataDir}` }] }),
    )
    await this.withTimeout(client.connect(transport), timeout)
    return client
  }

  private storeClient(name: string, config: McpServerConfig, client: Client, transport: Transport, tools: MCPToolDef[]): void {
    const pid = transport instanceof StdioClientTransport ? transport.pid : undefined
    const state: McpClientState = {
      config,
      status: { status: "connected" },
      client,
      transport,
      tools,
      instructions: client.getInstructions()?.trim(),
      childPid: pid,
    }
    this.servers.set(name, state)
    this.watchClient(name, state)
  }

  private watchClient(name: string, state: McpClientState): void {
    if (!state.client) return

    state.client.onclose = () => {
      if (this.shutdownInitiated) return
      if (this.servers.get(name)?.client !== state.client) return
      this.servers.delete(name)
      this.emit("tools_changed", { server: name })
      this.scheduleReconnect(name, state.config)
    }

    state.client.setNotificationHandler(LoggingMessageNotificationSchema, (notification) => {
      this.handleServerLog(name, notification.params)
    })

    if (!state.client.getServerCapabilities()?.tools) return
    state.client.setNotificationHandler(ToolListChangedNotificationSchema, async () => {
      if (this.servers.get(name)?.client !== state.client) return
      if (this.servers.get(name)?.status.status !== "connected") return
      const tools = await McpCatalog.listTools(state.client!, state.config.timeout)
      const s = this.servers.get(name)
      if (s) s.tools = tools
      this.emit("tools_changed", { server: name })
    })
  }

  private handleServerLog(name: string, params: LoggingMessageNotification["params"]): void {
    this.emit("server_log", { server: name, logger: params.logger, level: params.level, data: params.data })
  }

  private scheduleReconnect(name: string, config: McpServerConfig): void {
    const existing = this.reconnectTimers.get(name)
    if (existing) clearTimeout(existing)
    if (this.shutdownInitiated) return

    const timer = setTimeout(async () => {
      this.reconnectTimers.delete(name)
      if (this.shutdownInitiated) return
      const status = await this.connectServer(name, config)
      this.emit("reconnect", { server: name, status })
    }, 2000)
    this.reconnectTimers.set(name, timer)
  }

  async reconnect(name: string): Promise<McpStatus> {
    const existing = this.reconnectTimers.get(name)
    if (existing) {
      clearTimeout(existing)
      this.reconnectTimers.delete(name)
    }
    const state = this.servers.get(name)
    if (!state) return { status: "failed", error: `Server "${name}" not found` }
    return this.connectServer(name, state.config)
  }

  async disconnect(name: string): Promise<void> {
    const timer = this.reconnectTimers.get(name)
    if (timer) {
      clearTimeout(timer)
      this.reconnectTimers.delete(name)
    }
    await this.closeServer(name)
    const state = this.servers.get(name)
    if (state) {
      state.status = { status: "disabled" }
      state.client = undefined
      state.transport = undefined
      state.tools = []
    }
  }

  async addServer(name: string, config: McpServerConfig): Promise<McpStatus> {
    return this.connectServer(name, config)
  }

  getStatus(name?: string): Record<string, McpStatus> | McpStatus {
    if (name) return this.servers.get(name)?.status ?? { status: "disabled" }
    const result: Record<string, McpStatus> = {}
    for (const [key, state] of this.servers) result[key] = state.status
    return result
  }

  getTools(): Record<string, McpManagedTool> {
    const result: Record<string, McpManagedTool> = {}
    for (const [name, state] of this.servers) {
      if (state.status.status !== "connected" || !state.client) continue
      for (const def of state.tools) {
        result[McpCatalog.toolName(name, def.name)] = { def, client: state.client, timeout: state.config.timeout }
      }
    }
    return result
  }

  getInstructions(): ServerInstructions[] {
    return Array.from(this.servers.entries())
      .filter(([, s]) => s.status.status === "connected" && s.instructions)
      .map(([name, s]) => ({
        name,
        instructions: s.instructions ?? "",
        tools: s.tools.map((t) => McpCatalog.toolName(name, t.name)),
      }))
  }

  getClient(name: string): Client | undefined {
    return this.servers.get(name)?.client
  }

  async listResources(clientName?: string): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {}
    for (const [name, state] of this.servers) {
      if (state.status.status !== "connected" || !state.client) continue
      if (clientName && name !== clientName) continue
      const resources = await McpCatalog.collectResources(name, state.client, state.config.timeout)
      Object.assign(result, resources)
    }
    return result
  }

  async listPrompts(clientName?: string): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {}
    for (const [name, state] of this.servers) {
      if (state.status.status !== "connected" || !state.client) continue
      if (clientName && name !== clientName) continue
      const prompts = await McpCatalog.collectPrompts(name, state.client, state.config.timeout)
      Object.assign(result, prompts)
    }
    return result
  }

  async getPrompt(clientName: string, promptName: string, args?: Record<string, string>) {
    const client = this.servers.get(clientName)?.client
    if (!client) return undefined
    try {
      return await client.getPrompt({ name: promptName, arguments: args }, { timeout: DEFAULT_TIMEOUT })
    } catch {
      return undefined
    }
  }

  async readResource(clientName: string, resourceUri: string) {
    const client = this.servers.get(clientName)?.client
    if (!client) return undefined
    try {
      return await client.readResource({ uri: resourceUri }, { timeout: DEFAULT_TIMEOUT })
    } catch {
      return undefined
    }
  }

  getAuthStore(): McpAuthStore {
    return this.authStore
  }

  async startAuth(mcpName: string): Promise<{ authorizationUrl: string; oauthState: string }> {
    const state = this.servers.get(mcpName)
    if (!state) throw new Error(`MCP server "${mcpName}" not found`)
    if (state.config.type !== "remote") throw new Error(`MCP server "${mcpName}" is not a remote server`)
    if (state.config.oauth === false) throw new Error(`MCP server "${mcpName}" has OAuth disabled`)

    const config = state.config
    const oauthConfig = typeof config.oauth === "object" ? config.oauth : undefined
    const effectiveRedirectUri = oauthConfig?.redirectUri ??
      (oauthConfig?.callbackPort ? `http://127.0.0.1:${oauthConfig.callbackPort}/mcp/oauth/callback` : undefined)

    const url = config.url ? new URL(config.url) : null
    if (!url) throw new Error(`Invalid MCP URL for "${mcpName}"`)

    McpOAuthCallback.ensureRunning(effectiveRedirectUri)

    const oauthState = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
    await this.authStore.updateOAuthState(mcpName, oauthState)

    let capturedUrl: URL | undefined
    const authProvider = new McpOAuthPendingProvider(
      mcpName,
      config.url!,
      {
        clientId: oauthConfig?.clientId,
        clientSecret: oauthConfig?.clientSecret,
        scope: oauthConfig?.scope,
        redirectUri: effectiveRedirectUri,
      },
      { onRedirect: (u) => { capturedUrl = u } },
      this.authStore,
    )

    const transport = new StreamableHTTPClientTransport(url, {
      authProvider,
      requestInit: config.headers ? { headers: config.headers } : undefined,
    })

    try {
      const client = new Client(
        { name: "zenuxs-code", version: "0.1.0" },
        { capabilities: { roots: {} } },
      )
      client.setRequestHandler(ListRootsRequestSchema, () =>
        Promise.resolve({ roots: [{ uri: `file://${this.dataDir}` }] }),
      )
      await this.withTimeout(client.connect(transport), DEFAULT_TIMEOUT)
      await authProvider.commit()
      const tools = await McpCatalog.listTools(client, config.timeout)
      this.storeClient(mcpName, config, client, transport, tools)
      return { authorizationUrl: "", oauthState }
    } catch (error) {
      if (error instanceof UnauthorizedError && capturedUrl) {
        this.pendingOAuthTransports.set(mcpName, { transport, provider: authProvider })
        return { authorizationUrl: capturedUrl.toString(), oauthState }
      }
      throw error
    }
  }

  async authenticate(mcpName: string, onAuthorization?: (url: string) => void): Promise<McpStatus> {
    const state = this.servers.get(mcpName)
    if (!state) return { status: "failed", error: `Server "${mcpName}" not found` }

    const result = await this.startAuth(mcpName)
    if (!result.authorizationUrl) return { status: "connected" }

    const callbackPromise = McpOAuthCallback.waitForCallback(result.oauthState, mcpName)
    onAuthorization?.(result.authorizationUrl)

    const browser = new McpBrowser()
    try {
      await browser.openBackground(result.authorizationUrl)
    } catch {
      this.emit("browser_open_failed", { mcpName, url: result.authorizationUrl })
    }

    const code = await callbackPromise
    const storedState = await this.authStore.getOAuthState(mcpName)
    if (storedState !== result.oauthState) {
      await this.authStore.clearOAuthState(mcpName)
      return { status: "failed", error: "OAuth state mismatch - possible CSRF attack" }
    }
    await this.authStore.clearOAuthState(mcpName)
    return this.finishAuth(mcpName, code)
  }

  async finishAuth(mcpName: string, authorizationCode: string): Promise<McpStatus> {
    const pending = this.pendingOAuthTransports.get(mcpName)
    if (!pending) return { status: "failed", error: `No pending OAuth flow for "${mcpName}"` }

    try {
      await pending.transport.finishAuth(authorizationCode)
    } catch (error) {
      return { status: "failed", error: `OAuth completion failed: ${(error as Error).message}` }
    }

    await pending.provider?.commit()
    await this.authStore.clearCodeVerifier(mcpName)
    this.pendingOAuthTransports.delete(mcpName)

    const state = this.servers.get(mcpName)
    if (!state) return { status: "failed", error: `Server "${mcpName}" not found` }
    return this.connectServer(mcpName, state.config)
  }

  async removeAuth(mcpName: string): Promise<void> {
    await this.authStore.remove(mcpName)
    McpOAuthCallback.cancelPending(mcpName)
    this.pendingOAuthTransports.delete(mcpName)
  }

  supportsOAuth(mcpName: string): boolean {
    const state = this.servers.get(mcpName)
    return state?.config.type === "remote" && state.config.oauth !== false
  }

  async hasStoredTokens(mcpName: string): Promise<boolean> {
    return this.authStore.hasTokens(mcpName)
  }

  async getAuthStatus(mcpName: string): Promise<AuthStatus> {
    const state = this.servers.get(mcpName)
    if (!state || state.config.type !== "remote") return "not_authenticated"
    const entry = state.config.url
      ? await this.authStore.getForUrl(mcpName, state.config.url)
      : undefined
    if (!entry?.tokens) return "not_authenticated"
    if (entry.tokens.expiresAt && entry.tokens.expiresAt < Date.now() / 1000) return "expired"
    return "authenticated"
  }

  async shutdown(): Promise<void> {
    this.shutdownInitiated = true
    for (const [name, timer] of this.reconnectTimers) {
      clearTimeout(timer)
      this.reconnectTimers.delete(name)
    }

    const clientList = Array.from(this.servers.entries())
      .filter(([, s]) => s.client)
      .map(([name, state]) => ({ name, client: state.client!, transport: state.transport, childPid: state.childPid }))

    this.servers.clear()
    this.pendingOAuthTransports.clear()

    await Promise.all(
      clientList.map(async ({ name: _name, client, transport, childPid }) => {
        if (childPid !== undefined) {
          try {
            const descendants = await this.findDescendants(childPid)
            for (const dpid of descendants) {
              try { process.kill(dpid, "SIGTERM") } catch {}
            }
          } catch {}
        }
        try {
          await client.close()
        } catch {}
      }),
    )

    if (McpOAuthCallback.isRunning()) {
      McpOAuthCallback.stop()
    }
    await this.authStore.flushNow()
  }

  private async findDescendants(pid: number): Promise<number[]> {
    if (process.platform === "win32") return []
    const pids: number[] = []
    const queue = [pid]

    for (let i = 0; i < queue.length; i++) {
      try {
        const text = await this.execPgrep(queue[i]!)
        for (const tok of text.split("\n")) {
          const cpid = parseInt(tok, 10)
          if (!isNaN(cpid) && !pids.includes(cpid)) {
            pids.push(cpid)
            queue.push(cpid)
          }
        }
      } catch {}
    }
    return pids
  }

  private async execPgrep(pid: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn("pgrep", ["-P", String(pid)], { stdio: ["ignore", "pipe", "pipe"] })
      let stdout = ""
      child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString() })
      child.on("error", reject)
      child.on("exit", () => resolve(stdout))
    })
  }

  private async closeServer(name: string): Promise<void> {
    const state = this.servers.get(name)
    if (!state) return
    if (state.client) {
      try { await state.client.close() } catch {}
    }
    state.client = undefined
    state.transport = undefined
    state.tools = []
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`MCP connection timed out after ${ms}ms`)), ms)
      promise.then(
        (val) => { clearTimeout(timer); resolve(val) },
        (err) => { clearTimeout(timer); reject(err) },
      )
    })
  }

  private emit(type: string, data: unknown): void {
    this.onEvent?.(type, data)
  }
}

export * as McpManager from "./mcpmgr"
