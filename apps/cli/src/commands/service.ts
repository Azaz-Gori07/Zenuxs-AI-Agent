import { EOL } from "node:os"
import type { DaemonManager } from "../services/daemon"

export interface ServiceOptions {
  action: "start" | "stop" | "status" | "password"
  password?: string
  daemon: DaemonManager
}

export async function runServiceCommand(options: ServiceOptions): Promise<number> {
  switch (options.action) {
    case "start": {
      try {
        const url = await options.daemon.start()
        process.stdout.write(`Server started at ${url}${EOL}`)
        return 0
      } catch (err) {
        process.stderr.write(`Failed to start server: ${(err as Error).message}${EOL}`)
        return 1
      }
    }

    case "stop": {
      await options.daemon.stop()
      process.stdout.write("Server stopped" + EOL)
      return 0
    }

    case "status": {
      const url = await options.daemon.status()
      if (url) {
        process.stdout.write(`Server is running at ${url}${EOL}`)
        return 0
      }
      process.stdout.write("Server is stopped" + EOL)
      return 1
    }

    case "password": {
      const status = await options.daemon.status()
      if (status && options.password) {
        process.stderr.write("Error: cannot change password while server is running" + EOL)
        return 1
      }
      const pw = await options.daemon.password(options.password)
      process.stdout.write(`${pw}${EOL}`)
      return 0
    }
  }
}

export * as Service from "./service"
