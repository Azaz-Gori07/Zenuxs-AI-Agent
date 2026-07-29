import { EOL } from "node:os"
import type { DaemonManager } from "../services/daemon"

const HTTP_METHODS = new Set(["delete", "get", "head", "options", "patch", "post", "put"])

interface Operation {
  operationId?: string
}

interface OpenApiSpec {
  paths?: Record<string, Record<string, Operation>>
}

export interface ApiOptions {
  request: string[]
  data?: string
  header: string[]
  param: Record<string, string>
  daemon: DaemonManager
}

export async function runApiCommand(options: ApiOptions): Promise<number> {
  const transport = await options.daemon.getTransport()
  const headers = new Headers(transport.headers)

  for (const h of options.header) {
    const idx = h.indexOf(":")
    if (idx < 1) {
      process.stderr.write(`Invalid header format: ${h}\n`)
      return 1
    }
    headers.set(h.slice(0, idx).trim(), h.slice(idx + 1).trim())
  }

  const body = options.data
  if (body !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json")
  }

  const resolved = await resolveRequest(transport.url, options.request, options.param, headers)
  if (!resolved) {
    process.stderr.write("Expected an operation name or an HTTP method and path\n")
    return 1
  }

  try {
    const response = await fetch(new URL(resolved.path, transport.url), {
      method: resolved.method,
      headers,
      body,
    })
    const output = await response.text()
    if (output) process.stdout.write(output + (output.endsWith(EOL) ? "" : EOL))
    return response.ok ? 0 : 1
  } catch (err) {
    process.stderr.write(`Request failed: ${(err as Error).message}\n`)
    return 1
  }
}

function rawRequest(input: readonly string[]): { method: string; path: string } | undefined {
  if (input.length !== 2) return undefined
  const method = input[0]?.toLowerCase()
  const path = input[1]
  if (!method || !HTTP_METHODS.has(method) || !path?.startsWith("/")) return undefined
  return { method: method.toUpperCase(), path }
}

function resolveOperation(spec: OpenApiSpec, operationId: string, params: Record<string, string>): { method: string; path: string } {
  for (const [path, operations] of Object.entries(spec.paths ?? {})) {
    for (const [method, operation] of Object.entries(operations)) {
      if (!HTTP_METHODS.has(method) || operation.operationId !== operationId) continue
      return { method: method.toUpperCase(), path: interpolate(path, params) }
    }
  }
  throw new Error(`Operation not found: ${operationId}`)
}

async function resolveRequest(baseUrl: string, input: readonly string[], params: Record<string, string>, headers: Headers): Promise<{ method: string; path: string } | undefined> {
  const raw = rawRequest(input)
  if (raw) return raw

  if (input.length !== 1) return undefined

  const response = await fetch(new URL("/openapi.json", baseUrl), { headers })
  if (!response.ok) throw new Error(`Failed to load OpenAPI document: HTTP ${response.status}`)
  return resolveOperation(await response.json() as OpenApiSpec, input[0]!, params)
}

function interpolate(path: string, params: Record<string, string>): string {
  const used = new Set<string>()
  const pathname = path.replaceAll(/\{([^}]+)\}/g, (_, name: string) => {
    const value = params[name]
    if (value === undefined) throw new Error(`Missing path parameter: ${name}`)
    used.add(name)
    return encodeURIComponent(value)
  })
  const query = new URLSearchParams(Object.entries(params).filter(([name]) => !used.has(name))).toString()
  return query ? `${pathname}?${query}` : pathname
}

export * as Api from "./api"
