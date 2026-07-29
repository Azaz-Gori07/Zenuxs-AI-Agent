import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import type { DaemonManager } from "../services/daemon"

export interface ServeOptions {
  hostname: string
  port?: number
  register: boolean
  daemon: DaemonManager
}

export async function runServeCommand(options: ServeOptions): Promise<number> {
  const pw = await options.daemon.password()
  const hostname = options.hostname

  return new Promise((resolve) => {
    const tryPort = (port: number) => {
      const server = createServer((req: IncomingMessage, res: ServerResponse) => {
        const auth = req.headers.authorization
        if (!auth || auth !== `Bearer ${pw}`) {
          res.writeHead(401)
          res.end('{"error":"Unauthorized"}')
          return
        }

        if (req.url === "/health" && req.method === "GET") {
          res.writeHead(200, { "Content-Type": "application/json" })
          res.end(JSON.stringify({ healthy: true, version: "0.1.0" }))
          return
        }

        if (req.url === "/openapi.json" && req.method === "GET") {
          res.writeHead(200, { "Content-Type": "application/json" })
          res.end(JSON.stringify({
            openapi: "3.1.0",
            info: { title: "Zenuxs Code API", version: "0.1.0" },
            paths: {
              "/health": { get: { operationId: "health", summary: "Health check" } },
              "/agents": { get: { operationId: "listAgents", summary: "List agents" } },
            },
          }))
          return
        }

        if (req.url === "/agents" && req.method === "GET") {
          res.writeHead(200, { "Content-Type": "application/json" })
          res.end(JSON.stringify({ data: [] }))
          return
        }

        res.writeHead(404)
        res.end('{"error":"Not found"}')
      })

      server.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE" && options.port === undefined && port < 65535) {
          tryPort(port + 1)
          return
        }
        console.error(`Failed to listen on port ${port}: ${err.message}`)
        resolve(1)
      })

      server.listen(port, hostname, async () => {
        if (options.register) {
          await options.daemon.register({ hostname, port })
        }
        console.log(`server listening on http://${hostname}:${port}`)
      })
    }

    tryPort(options.port ?? 4096)
  })
}

export * as Serve from "./serve"
