export { McpLayer } from "./mcpClient";
export { McpToolRegistry } from "./toolRegistry";
export { CapabilityRegistry } from "./capabilityRegistry";
export { ConnectionManager } from "./connectionManager";
export { DiscoveryEngine } from "./discoveryEngine";
export { HealthMonitor } from "./healthMonitor";
export { PermissionManager } from "./permissionManager";
export { SessionManager } from "./sessionManager";
export { DynamicLoader } from "./dynamicLoader";
export { UserMcpManager } from "./userMcpManager";

// MCP tool wrapper for AgentTool integration
export { createMcpTool, formatMcpToolResult, getMcpToolsAsAgentTools } from "./mcp-tool-wrapper";

export type {
	McpServerConfig,
	McpServerTransportConfig,
	McpDiscoveredTool,
	McpToolCall,
	McpServerMeta,
	McpCategory,
	McpStatus,
	McpHealth,
	HealthStatus,
	McpPermission,
	McpSession,
	McpLayerConfig,
	DynamicLoadResult,
} from "./types";

export { BUILT_IN_MCP_SERVERS, DEFAULT_MCP_DIR } from "./types";
