import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import {
  CallToolResultSchema,
  ListToolsResultSchema,
  ToolSchema,
  type Tool as MCPToolDef,
} from "@modelcontextprotocol/sdk/types.js"

const DEFAULT_TIMEOUT = 30_000
const MAX_LIST_PAGES = 1_000

const TolerantListToolsResultSchema = ListToolsResultSchema.extend({
  tools: ToolSchema.omit({ outputSchema: true }).array(),
})

export async function paginate<T, R extends { nextCursor?: string }>(
  list: (cursor?: string) => Promise<R>,
  items: (result: R) => T[],
): Promise<T[]> {
  const result: T[] = []
  const cursors = new Set<string>()
  let cursor: string | undefined

  for (let page = 0; page < MAX_LIST_PAGES; page++) {
    const p = await list(cursor)
    result.push(...items(p))
    if (p.nextCursor === undefined) return result
    if (cursors.has(p.nextCursor)) throw new Error(`MCP list returned duplicate cursor: ${p.nextCursor}`)
    cursors.add(p.nextCursor)
    cursor = p.nextCursor
  }
  throw new Error(`MCP list exceeded ${MAX_LIST_PAGES} pages`)
}

export async function listTools(client: Client, timeout?: number): Promise<MCPToolDef[]> {
  const t = timeout ?? DEFAULT_TIMEOUT
  try {
    return await paginate(
      async (cursor) => {
        const params = cursor === undefined ? undefined : { cursor }
        try {
          return await client.listTools(params, { timeout: t })
        } catch (error) {
          if (!(error instanceof Error) || !isOutputSchemaValidationError(error)) throw error
          return client.request({ method: "tools/list", params }, TolerantListToolsResultSchema, { timeout: t })
        }
      },
      (result) => result.tools,
    )
  } catch {
    return []
  }
}

export function isOutputSchemaValidationError(error: Error): boolean {
  return /can't resolve reference|resolves to more than one schema|outputSchema|schema.*reference|reference.*schema/i.test(error.message)
}

export function sanitize(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_")
}

export function toolName(clientName: string, name: string): string {
  return sanitize(clientName) + "_" + sanitize(name)
}

export async function mcpPrompts(client: Client, timeout?: number) {
  if (!client.getServerCapabilities()?.prompts) return []
  return paginate(
    (cursor) => client.listPrompts(cursor === undefined ? undefined : { cursor }, { timeout }),
    (result) => result.prompts,
  )
}

export async function mcpResources(client: Client, timeout?: number) {
  if (!client.getServerCapabilities()?.resources) return []
  return paginate(
    (cursor) => client.listResources(cursor === undefined ? undefined : { cursor }, { timeout }),
    (result) => result.resources,
  )
}

export async function mcpResourceTemplates(client: Client, timeout?: number) {
  if (!client.getServerCapabilities()?.resources) return []
  return paginate(
    (cursor) => client.listResourceTemplates(cursor === undefined ? undefined : { cursor }, { timeout }),
    (result) => result.resourceTemplates,
  )
}

export async function collectResources(
  clientName: string,
  client: Client,
  timeout?: number,
): Promise<Record<string, unknown>> {
  const items = await mcpResources(client, timeout)
  const resourceClient = clientName.replaceAll("%", "%25").replaceAll(":", "%3A")
  const result: Record<string, unknown> = {}
  for (const item of items) {
    const key = resourceClient + ":" + item.uri
    result[key] = { ...item, client: clientName }
  }
  return result
}

export async function collectPrompts(
  clientName: string,
  client: Client,
  timeout?: number,
): Promise<Record<string, unknown>> {
  const items = await mcpPrompts(client, timeout)
  const resourceClient = clientName.replaceAll("%", "%25").replaceAll(":", "%3A")
  const result: Record<string, unknown> = {}
  for (const item of items) {
    const key = resourceClient + ":" + sanitize(item.name)
    result[key] = { ...item, client: clientName }
  }
  return result
}

export function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown>,
  timeout?: number,
  signal?: AbortSignal,
) {
  return client.callTool(
    { name, arguments: args },
    CallToolResultSchema,
    { resetTimeoutOnProgress: true, signal, timeout, onprogress: () => {} },
  )
}

export * as McpCatalog from "./catalog"
