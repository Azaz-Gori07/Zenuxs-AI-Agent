import { spawn, type ChildProcess } from "node:child_process"
import { createConnection, type Connection } from "vscode-languageserver-protocol"

export interface LSPDiagnostic {
  file: string
  line: number
  column: number
  message: string
  severity: "error" | "warning" | "info"
  code?: string
}

export interface LanguageServerConfig {
  language: string
  command: string
  args: string[]
  fileExtensions: string[]
}

const LANGUAGE_SERVERS: LanguageServerConfig[] = [
  { language: "typescript", command: "typescript-language-server", args: ["--stdio"], fileExtensions: [".ts", ".tsx", ".js", ".jsx"] },
  { language: "python", command: "pyright-langserver", args: ["--stdio"], fileExtensions: [".py"] },
  { language: "rust", command: "rust-analyzer", args: [], fileExtensions: [".rs"] },
  { language: "go", command: "gopls", args: [], fileExtensions: [".go"] },
]

export class LSPClient {
  readonly language: string
  readonly config: LanguageServerConfig
  private process: ChildProcess | null = null
  private connection: Connection | null = null

  constructor(config: LanguageServerConfig) {
    this.config = config
    this.language = config.language
  }

  async start(workspaceUri: string): Promise<void> {
    this.process = spawn(this.config.command, this.config.args, { stdio: ["pipe", "pipe", "pipe"] })
    if (!this.process.stdin || !this.process.stdout) throw new Error("Failed to spawn LSP server")
    this.connection = createConnection(this.process.stdout, this.process.stdin)
    this.connection.listen()
    this.connection.initialize({
      processId: process.pid,
      rootUri: workspaceUri,
      capabilities: {
        textDocument: {
          diagnostic: { dynamicRegistration: true },
          completion: { dynamicRegistration: true },
          hover: { dynamicRegistration: true },
        },
      },
    })
  }

  async getDiagnostics(uri: string, content: string): Promise<LSPDiagnostic[]> {
    if (!this.connection) return []
    try {
      this.connection.sendNotification("textDocument/didOpen", {
        textDocument: { uri, languageId: this.language, version: 1, text: content },
      })
      const diagnostics = await new Promise<LSPDiagnostic[]>((resolve) => {
        const timer = setTimeout(() => resolve([]), 5000)
        const handler = (params: { uri: string; diagnostics: Array<{ range: { start: { line: number; character: number } }; message: string; severity?: number; code?: string }> }) => {
          if (params.uri === uri) {
            clearTimeout(timer)
            resolve(params.diagnostics.map((d) => ({
              file: uri,
              line: d.range.start.line,
              column: d.range.start.character,
              message: d.message,
              severity: d.severity === 1 ? "error" : d.severity === 2 ? "warning" : "info",
              code: d.code,
            })))
          }
        }
        this.connection!.onNotification("textDocument/publishDiagnostics", handler)
      })
      this.connection.sendNotification("textDocument/didClose", { textDocument: { uri } })
      return diagnostics
    } catch {
      return []
    }
  }

  async stop(): Promise<void> {
    this.connection?.dispose()
    this.process?.kill()
  }

  static forFile(filePath: string): LSPClient | null {
    const ext = filePath.substring(filePath.lastIndexOf("."))
    const config = LANGUAGE_SERVERS.find((l) => l.fileExtensions.includes(ext))
    if (!config) return null
    return new LSPClient(config)
  }
}

export class LSPManager {
  private clients = new Map<string, LSPClient>()

  getClient(language: string): LSPClient | undefined {
    return this.clients.get(language)
  }

  async startForFile(filePath: string, workspaceUri: string): Promise<LSPClient | null> {
    const client = LSPClient.forFile(filePath)
    if (!client) return null
    const key = client.language
    if (this.clients.has(key)) return this.clients.get(key)!
    await client.start(workspaceUri)
    this.clients.set(key, client)
    return client
  }

  async stopAll(): Promise<void> {
    for (const client of this.clients.values()) {
      await client.stop()
    }
    this.clients.clear()
  }
}

export * as LSP from "."