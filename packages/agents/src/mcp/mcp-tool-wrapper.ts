/**
 * MCP Tool Wrapper
 *
 * Converts MCP discovered tools to AgentTool format for integration with AgentRuntime.
 */

import { createTool } from "@cline/shared";
import type { AgentTool, AgentToolContext } from "@cline/shared";
import type { McpDiscoveredTool } from "./types";

/**
 * Create an AgentTool from a discovered MCP tool
 */
export function createMcpTool(
  discoveredTool: McpDiscoveredTool,
  callMcpTool: (input: unknown, context: AgentToolContext) => Promise<unknown>,
): AgentTool {
  return createTool({
    name: discoveredTool.name,
    description: discoveredTool.description ?? `MCP tool: ${discoveredTool.name}`,
    inputSchema: discoveredTool.inputSchema,
    execute: callMcpTool,
  }) as AgentTool;
}

/**
 * Convert MCP tool result to string output
 */
export function formatMcpToolResult(result: unknown): string {
  if (result === null || result === undefined) {
    return "";
  }
  if (typeof result === "string") {
    return result;
  }
  if (Array.isArray(result)) {
    return result
      .map((item) => {
        if (typeof item === "string") return item;
        if (item?.type === "text" && typeof item.text === "string") return item.text;
        return JSON.stringify(item);
      })
      .join("\n");
  }
  return JSON.stringify(result, null, 2);
}

/**
 * Create MCP tool wrapper with proper context handling
 */
export function createMcpToolHandler(
  serverName: string,
  toolName: string,
  callTool: (
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
  ) => Promise<unknown>,
) {
  return async (input: unknown, context: AgentToolContext): Promise<string> => {
    const args = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};

    const result = await callTool(serverName, toolName, args);
    return formatMcpToolResult(result);
  };
}

/**
 * Get all MCP tools as AgentTool array from McpToolRegistry
 */
export async function getMcpToolsAsAgentTools(
  getAllTools: () => McpDiscoveredTool[],
  callTool: (
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
  ) => Promise<unknown>,
): Promise<AgentTool[]> {
  const discoveredTools = getAllTools();
  const tools: AgentTool[] = [];

  for (const discovered of discoveredTools) {
    const resolved = await discoverMcpToolServer(discovered);
    const handler = createMcpToolHandler(
      resolved.serverName,
      discovered.name,
      callTool,
    );
    const tool = createMcpTool(discovered, handler);
    tools.push(tool);
  }

  return tools;
}

/**
 * Discover which server provides an MCP tool
 */
export async function discoverMcpToolServer(
  tool: McpDiscoveredTool,
): Promise<{ serverName: string; tool: McpDiscoveredTool }> {
  // The tool already has serverName from McpDiscoveredTool
  return {
    serverName: tool.serverName,
    tool,
  };
}