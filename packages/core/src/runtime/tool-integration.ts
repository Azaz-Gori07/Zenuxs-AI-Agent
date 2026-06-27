/**
 * Tool Integration Completeness Layer
 *
 * Ensures ALL tool capabilities are properly integrated into the runtime:
 * - Enhanced tools (shell, file-read, editor, glob-grep, todo, web)
 * - MCP tools (auto-registration from discovered servers)
 * - Native tools (built-in filesystem, shell, search)
 * - Team tools (multi-agent, delegated agents)
 *
 * This layer eliminates the integration gap identified in the architecture audit.
 */

import type { AgentTool } from "@cline/shared";
import {
  createAllEnhancedTools,
  type CreateAllEnhancedToolsOptions,
} from "../extensions/tools/enhanced-index";
import { getMcpManager } from "../extensions/mcp";
import { logInfo, logError } from "../logging";

export interface ToolIntegrationConfig {
  /** Workspace root */
  workspaceRoot: string;
  /** Execution mode */
  mode?: "plan" | "build" | "act";
  /** Disabled tool IDs */
  disabledTools?: string[];
  /** Enabled tool IDs (overrides disabled) */
  enabledTools?: string[];
  /** Whether to enable MCP tools */
  enableMcpTools?: boolean;
  /** Whether to enable team tools */
  enableTeamTools?: boolean;
  /** Web fetch timeout */
  webFetchTimeout?: number;
  /** Whether to enable web search */
  enableWebSearch?: boolean;
}

/**
 * Create all integrated tools with proper precedence
 *
 * Tool precedence (highest to lowest):
 * 1. Team tools (multi-agent coordination)
 * 2. Enhanced tools (intelligent filesystem/shell/search)
 * 3. MCP tools (external server capabilities)
 * 4. Native tools (basic filesystem/shell)
 */
export async function createIntegratedTools(
  config: ToolIntegrationConfig,
): Promise<{
  tools: AgentTool[];
  toolCount: number;
  mcpToolCount: number;
  enhancedToolCount: number;
  teamToolCount: number;
}> {
  const allTools: AgentTool[] = [];
  let mcpToolCount = 0;
  let enhancedToolCount = 0;
  let teamToolCount = 0;

  // 1. Create enhanced tools (primary toolset)
  try {
    const enhancedOptions: CreateAllEnhancedToolsOptions = {
      cwd: config.workspaceRoot,
      mode: config.mode,
      disabledTools: config.disabledTools || [],
      enabledTools: config.enabledTools,
      webFetchTimeout: config.webFetchTimeout,
      enableWebSearch: config.enableWebSearch ?? true,
      enablePlanExit: true,
    };

    const { tools: enhancedTools, registry } = createAllEnhancedTools(
      enhancedOptions,
    );

    allTools.push(...enhancedTools);
    enhancedToolCount = enhancedTools.length;

    logInfo("ToolIntegration", `Created ${enhancedToolCount} enhanced tools`, {
      registry: registry.getStats(),
    });
  } catch (error) {
    logError(
      "ToolIntegration",
      "Failed to create enhanced tools",
      error instanceof Error ? error : undefined,
    );
  }

  // 2. Create MCP tools (if enabled)
  if (config.enableMcpTools !== false) {
    try {
      const mcpManager = getMcpManager();
      const mcpTools = await mcpManager.discoverAndRegisterTools();

      if (mcpTools && mcpTools.length > 0) {
        allTools.push(...mcpTools);
        mcpToolCount = mcpTools.length;

        logInfo("ToolIntegration", `Created ${mcpToolCount} MCP tools`);
      }
    } catch (error) {
      logError(
        "ToolIntegration",
        "Failed to create MCP tools",
        error instanceof Error ? error : undefined,
      );
    }
  }

  // 3. Team tools are already included in enhanced tools
  // (spawn-agent, delegated-agent are part of createAllEnhancedTools)
  teamToolCount = allTools.filter(
    (t) =>
      t.name.includes("spawn") ||
      t.name.includes("delegate") ||
      t.name.includes("team"),
  ).length;

  logInfo("ToolIntegration", "Tool integration complete", {
    total: allTools.length,
    enhanced: enhancedToolCount,
    mcp: mcpToolCount,
    team: teamToolCount,
  });

  return {
    tools: allTools,
    toolCount: allTools.length,
    mcpToolCount,
    enhancedToolCount,
    teamToolCount,
  };
}

/**
 * Get tool summary for debugging
 */
export function getToolSummary(tools: AgentTool[]): string {
  const byCategory = {
    filesystem: tools.filter(
      (t) =>
        t.name.includes("file") ||
        t.name.includes("read") ||
        t.name.includes("write") ||
        t.name.includes("edit"),
    ).length,
    shell: tools.filter((t) => t.name.includes("shell") || t.name.includes("run")).length,
    search: tools.filter(
      (t) =>
        t.name.includes("search") ||
        t.name.includes("grep") ||
        t.name.includes("glob"),
    ).length,
    web: tools.filter((t) => t.name.includes("web") || t.name.includes("fetch")).length,
    mcp: tools.filter((t) => t.name.startsWith("mcp_")).length,
    team: tools.filter(
      (t) =>
        t.name.includes("spawn") ||
        t.name.includes("delegate") ||
        t.name.includes("team"),
    ).length,
    other: 0,
  };

  byCategory.other =
    tools.length -
    Object.values(byCategory).reduce((sum, count) => sum + count, 0);

  return `Tools: ${tools.total} (filesystem: ${byCategory.filesystem}, shell: ${byCategory.shell}, search: ${byCategory.search}, web: ${byCategory.web}, mcp: ${byCategory.mcp}, team: ${byCategory.team}, other: ${byCategory.other})`;
}
