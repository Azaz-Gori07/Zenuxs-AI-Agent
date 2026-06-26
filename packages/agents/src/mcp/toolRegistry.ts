import type { McpLayer } from "./mcpClient";
import type { McpDiscoveredTool } from "./types";

export class McpToolRegistry {
	private layer: McpLayer;

	constructor(layer: McpLayer) {
		this.layer = layer;
	}

	getAllTools(): McpDiscoveredTool[] {
		return this.layer.getAllTools();
	}

	getTool(name: string): McpDiscoveredTool | undefined {
		return this.layer.getAllTools().find((t) => t.name === name);
	}

	resolveToolCall(
		toolName: string,
	): { serverName: string; tool: McpDiscoveredTool } | undefined {
		const serverName = this.layer.getServerForTool(toolName);
		if (!serverName) return undefined;
		const tool = this.getTool(toolName);
		if (!tool) return undefined;
		return { serverName, tool };
	}

	isMcpTool(toolName: string): boolean {
		return this.layer.getServerForTool(toolName) !== undefined;
	}

	getToolDescriptions(): string {
		const tools = this.getAllTools();
		if (tools.length === 0) return "";
		return tools
			.map(
				(t) =>
					`- ${t.name} (via ${t.serverName}): ${t.description || "No description"}`,
			)
			.join("\n");
	}
}
