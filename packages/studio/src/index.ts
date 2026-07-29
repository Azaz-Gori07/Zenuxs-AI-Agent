import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { compress } from "hono/compress"
import type { ZenuxsEngine } from "@zenuxs/engine"
import { createServer, type Server } from "node:http"

export interface StudioConfig {
  host?: string
  port?: number
  engine: ZenuxsEngine
}

export class Studio {
  readonly app: Hono
  readonly config: StudioConfig
  readonly engine: ZenuxsEngine
  private httpServer?: Server

  constructor(config: StudioConfig) {
    this.config = config
    this.engine = config.engine
    this.app = new Hono()
    this.setupMiddleware()
    this.setupRoutes()
  }

  private setupMiddleware(): void {
    this.app.use("*", cors({ origin: "*", credentials: true }))
    this.app.use("*", compress())
    this.app.use("*", logger())
  }

  private setupRoutes(): void {
    this.app.get("/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }))

    this.app.get("/api/v1/sessions", async (c) => {
      const sessions = await this.engine.orchestrator.list() ?? []
      return c.json({ sessions })
    })

    this.app.post("/api/v1/sessions", async (c) => {
      const body = await c.req.json()
      const session = await this.engine.orchestrator.start({
        mode: body.mode,
        modelId: body.modelId,
        providerId: body.providerId,
        prompt: body.prompt,
        metadata: body.metadata,
      })
      return c.json({ session }, 201)
    })

    this.app.post("/api/v1/sessions/:id/send", async (c) => {
      const id = c.req.param("id")
      const body = await c.req.json()
      const message = await this.engine.orchestrator.send({
        sessionId: id,
        message: body.message,
        metadata: body.metadata,
      })
      return c.json({ message })
    })

    this.app.get("/api/v1/tools", (c) => {
      const tools = this.engine.tools.list().map((t) => t.definition)
      return c.json({ tools })
    })

    this.app.get("/api/v1/providers", async (c) => {
      const { providerManager } = await import("@zenuxs/providers")
      return c.json({ providers: providerManager.list().map((p) => ({ id: p.id, name: p.name })) })
    })

    this.app.get("/api/v1/config", (c) => c.json({ config: this.engine.config }))
  }

  async start(): Promise<void> {
    const port = this.config.port ?? 3000
    const host = this.config.host ?? "0.0.0.0"
    return new Promise((resolve, reject) => {
      const server = createServer(this.app.fetch)
      server.listen(port, host, () => {
        this.httpServer = server
        resolve()
      })
      server.on("error", reject)
    })
  }

  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.httpServer) {
        this.httpServer.close((err) => {
          if (err) reject(err)
          else { this.httpServer = undefined; resolve() }
        })
      } else resolve()
    })
  }
}

export * as Studio from "."