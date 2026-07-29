import { createConnection } from "node:net"
import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { OAUTH_CALLBACK_PORT, OAUTH_CALLBACK_PATH, parseRedirectUri } from "./oauth-provider"

const OAUTH_CALLBACK_HOST = "127.0.0.1"
const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000

interface PendingAuth {
  resolve: (code: string) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

let currentPort = OAUTH_CALLBACK_PORT
let currentPath = OAUTH_CALLBACK_PATH
let server: ReturnType<typeof createServer> | undefined
const pendingAuths = new Map<string, PendingAuth>()
const mcpNameToState = new Map<string, string>()

function cleanupStateIndex(oauthState: string) {
  for (const [name, state] of mcpNameToState) {
    if (state === oauthState) {
      mcpNameToState.delete(name)
      break
    }
  }
}

function stopIfIdle() {
  if (pendingAuths.size > 0 || !server) return
  server.close()
  server.closeAllConnections?.()
  server = undefined
}

function handleRequest(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || "/", `http://localhost:${currentPort}`)

  if (url.pathname !== currentPath) {
    res.writeHead(404)
    res.end("Not found")
    return
  }

  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const error = url.searchParams.get("error")
  const errorDescription = url.searchParams.get("error_description")

  if (!state) {
    res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" })
    res.end(successPage("Missing state parameter"))
    return
  }

  if (error) {
    const errorMsg = errorDescription || error
    if (pendingAuths.has(state)) {
      const pending = pendingAuths.get(state)!
      clearTimeout(pending.timeout)
      pendingAuths.delete(state)
      cleanupStateIndex(state)
      pending.reject(new Error(errorMsg))
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
    res.end(successPage(`Authorization declined: ${errorMsg}`))
    stopIfIdle()
    return
  }

  if (!code) {
    res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" })
    res.end(successPage("No authorization code provided"))
    return
  }

  if (!pendingAuths.has(state)) {
    res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" })
    res.end(successPage("Invalid or expired state"))
    return
  }

  const pending = pendingAuths.get(state)!
  clearTimeout(pending.timeout)
  pendingAuths.delete(state)
  cleanupStateIndex(state)
  pending.resolve(code)

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
  res.end(successPage("MCP authorization complete! You may close this window."))
  stopIfIdle()
}

export async function ensureRunning(redirectUri?: string): Promise<void> {
  const { port, path } = parseRedirectUri(redirectUri)
  if (server && (currentPort !== port || currentPath !== path)) await stop()
  if (server) return

  const running = await isPortInUse(port)
  if (running) return

  currentPort = port
  currentPath = path
  server = createServer(handleRequest)
  await new Promise<void>((resolve, reject) => {
    server!.listen(currentPort, OAUTH_CALLBACK_HOST, () => resolve())
    server!.on("error", reject)
  })
}

export function waitForCallback(oauthState: string, mcpName?: string): Promise<string> {
  if (mcpName) mcpNameToState.set(mcpName, oauthState)
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (pendingAuths.has(oauthState)) {
        pendingAuths.delete(oauthState)
        if (mcpName) mcpNameToState.delete(mcpName)
        reject(new Error("OAuth callback timeout - authorization took too long"))
        stopIfIdle()
      }
    }, CALLBACK_TIMEOUT_MS)
    pendingAuths.set(oauthState, { resolve, reject, timeout })
  })
}

export function cancelPending(mcpName: string): void {
  const oauthState = mcpNameToState.get(mcpName)
  const key = oauthState ?? mcpName
  const pending = pendingAuths.get(key)
  if (pending) {
    clearTimeout(pending.timeout)
    pendingAuths.delete(key)
    mcpNameToState.delete(mcpName)
    pending.reject(new Error("Authorization cancelled"))
    stopIfIdle()
  }
}

export async function isPortInUse(port = OAUTH_CALLBACK_PORT): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection(port, "127.0.0.1")
    socket.on("connect", () => {
      socket.destroy()
      resolve(true)
    })
    socket.on("error", () => resolve(false))
  })
}

export async function stop(): Promise<void> {
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()))
    server.closeAllConnections?.()
    server = undefined
  }
  for (const [, pending] of pendingAuths) {
    clearTimeout(pending.timeout)
    pending.reject(new Error("OAuth callback server stopped"))
  }
  pendingAuths.clear()
  mcpNameToState.clear()
}

export function isRunning(): boolean {
  return server !== undefined
}

function successPage(message: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Zenuxs Code MCP Auth</title>
<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f5f5f5}
.card{background:#fff;border-radius:8px;padding:2rem;box-shadow:0 2px 8px rgba(0,0,0,.1);max-width:500px;text-align:center}
h1{color:#333;font-size:1.5rem}</style></head>
<body><div class="card"><h1>${message}</h1></div></body></html>`
}

export * as McpOAuthCallback from "./oauth-callback"
