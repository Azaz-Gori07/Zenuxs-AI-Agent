import type { McpServerConfig, McpServerMeta, DynamicLoadResult } from "./types";
import type { CapabilityRegistry } from "./capabilityRegistry";
import type { ConnectionManager } from "./connectionManager";
import type { DiscoveryEngine } from "./discoveryEngine";
import type { DynamicLoader } from "./dynamicLoader";
import * as fs from "node:fs";
import * as path from "node:path";

export interface UserMcpCommand {
	action:
		| "list"
		| "install"
		| "remove"
		| "enable"
		| "disable"
		| "reload"
		| "update"
		| "check-health"
		| "logs"
		| "search"
		| "import";
	serverName?: string;
	serverPath?: string;
	config?: Partial<McpServerConfig>;
}

export interface UserMcpResult {
	success: boolean;
	message: string;
	servers?: McpServerMeta[];
	server?: McpServerMeta;
	error?: string;
}

export class UserMcpManager {
	private registry: CapabilityRegistry;
	private connectionManager: ConnectionManager;
	private discoveryEngine: DiscoveryEngine;
	private dynamicLoader: DynamicLoader;
	private workspaceRoot: string;
	private userConfigPath: string;

	constructor(
		registry: CapabilityRegistry,
		connectionManager: ConnectionManager,
		discoveryEngine: DiscoveryEngine,
		dynamicLoader: DynamicLoader,
		workspaceRoot: string,
	) {
		this.registry = registry;
		this.connectionManager = connectionManager;
		this.discoveryEngine = discoveryEngine;
		this.dynamicLoader = dynamicLoader;
		this.workspaceRoot = workspaceRoot;
		this.userConfigPath = path.join(workspaceRoot, ".zenuxs-user-config.json");
	}

	async execute(command: UserMcpCommand): Promise<UserMcpResult> {
		switch (command.action) {
			case "list":
				return this.listServers();
			case "install":
				return this.installServer(command.serverPath, command.serverName);
			case "remove":
				return this.removeServer(command.serverName);
			case "enable":
				return this.enableServer(command.serverName);
			case "disable":
				return this.disableServer(command.serverName);
			case "reload":
				return this.reloadServer(command.serverName);
			case "update":
				return this.updateServer(command.serverName, command.config);
			case "check-health":
				return this.checkHealth(command.serverName);
			case "search":
				return this.searchAvailable(command.serverName);
			case "import":
				return this.importExternal(command.serverPath);
			default:
				return {
					success: false,
					message: `Unknown action: ${command.action}`,
				};
		}
	}

	private async listServers(): Promise<UserMcpResult> {
		const servers = this.registry.list();
		return {
			success: true,
			message: `${servers.length} MCP server(s) registered`,
			servers,
		};
	}

	private async installServer(
		serverPath?: string,
		serverName?: string,
	): Promise<UserMcpResult> {
		if (!serverPath) {
			return { success: false, message: "Server path is required" };
		}

		const result = await this.dynamicLoader.install(serverPath);
		if (result.success) {
			// Save to user config
			await this.saveToUserConfig(result.serverName!);
			return {
				success: true,
				message: `MCP server "${result.serverName}" installed successfully`,
				server: result.serverName
					? this.registry.getByName(result.serverName)
					: undefined,
			};
		}

		return {
			success: false,
			message: `Installation failed: ${result.error}`,
			error: result.error,
		};
	}

	private async removeServer(serverName?: string): Promise<UserMcpResult> {
		if (!serverName) {
			return { success: false, message: "Server name is required" };
		}

		const result = await this.dynamicLoader.uninstall(serverName);
		if (result.success) {
			await this.removeFromUserConfig(serverName);
			return {
				success: true,
				message: `MCP server "${serverName}" removed`,
			};
		}

		return {
			success: false,
			message: `Removal failed: ${result.error}`,
			error: result.error,
		};
	}

	private async enableServer(serverName?: string): Promise<UserMcpResult> {
		if (!serverName) {
			return { success: false, message: "Server name is required" };
		}

		const result = await this.dynamicLoader.enable(serverName);
		return {
			success: result.success,
			message: result.success
				? `MCP server "${serverName}" enabled`
				: `Failed to enable: ${result.error}`,
			error: result.error,
		};
	}

	private async disableServer(serverName?: string): Promise<UserMcpResult> {
		if (!serverName) {
			return { success: false, message: "Server name is required" };
		}

		const result = await this.dynamicLoader.disable(serverName);
		return {
			success: result.success,
			message: result.success
				? `MCP server "${serverName}" disabled`
				: `Failed to disable: ${result.error}`,
			error: result.error,
		};
	}

	private async reloadServer(serverName?: string): Promise<UserMcpResult> {
		if (!serverName) {
			return { success: false, message: "Server name is required" };
		}

		const result = await this.dynamicLoader.reload(serverName);
		return {
			success: result.success,
			message: result.success
				? `MCP server "${serverName}" reloaded`
				: `Failed to reload: ${result.error}`,
			error: result.error,
		};
	}

	private async updateServer(
		serverName?: string,
		config?: Partial<McpServerConfig>,
	): Promise<UserMcpResult> {
		if (!serverName) {
			return { success: false, message: "Server name is required" };
		}

		const meta = this.registry.getByName(serverName);
		if (!meta) {
			return { success: false, message: `Server "${serverName}" not found` };
		}

		const result = await this.dynamicLoader.update(serverName);
		return {
			success: result.success,
			message: result.success
				? `MCP server "${serverName}" updated`
				: `Failed to update: ${result.error}`,
			error: result.error,
		};
	}

	private async checkHealth(serverName?: string): Promise<UserMcpResult> {
		if (serverName) {
			const meta = this.registry.getByName(serverName);
			if (!meta) {
				return {
					success: false,
					message: `Server "${serverName}" not found`,
				};
			}
			return {
				success: true,
				message: `Health of "${serverName}": ${meta.health.status} (latency: ${meta.health.latency}ms)`,
				server: meta,
			};
		}

		const servers = this.registry.list();
		const statuses = servers.map(
			(s) => `${s.name}: ${s.health.status} (${s.health.latency}ms)`,
		);
		return {
			success: true,
			message: `Health status:\n${statuses.join("\n")}`,
			servers,
		};
	}

	private async searchAvailable(query?: string): Promise<UserMcpResult> {
		if (!query) {
			return { success: false, message: "Search query is required" };
		}

		const results = this.registry.search(query);
		return {
			success: true,
			message: `Found ${results.length} server(s) matching "${query}"`,
			servers: results,
		};
	}

	private async importExternal(serverPath?: string): Promise<UserMcpResult> {
		if (!serverPath) {
			return { success: false, message: "Server path is required" };
		}

		return this.installServer(serverPath);
	}

	private async saveToUserConfig(serverName: string): Promise<void> {
		try {
			const meta = this.registry.getByName(serverName);
			if (!meta) return;

			const config: McpServerConfig = {
				name: meta.name,
				transport: { type: "stdio", command: meta.entryPoint, args: [] },
				category: meta.category,
				description: meta.description,
				tags: meta.tags,
				author: meta.author,
				version: meta.version,
				priority: meta.priority,
				isUserInstalled: true,
			};

			let existing: { mcpServers?: McpServerConfig[] } = {};
			try {
				if (fs.existsSync(this.userConfigPath)) {
					existing = JSON.parse(
						fs.readFileSync(this.userConfigPath, "utf-8"),
					);
				}
			} catch {
				// start fresh
			}

			const servers = existing.mcpServers ?? [];
			servers.push(config);
			existing.mcpServers = servers;

			fs.writeFileSync(
				this.userConfigPath,
				JSON.stringify(existing, null, 2),
				"utf-8",
			);
		} catch {
			// silent - best effort persistence
		}
	}

	private async removeFromUserConfig(serverName: string): Promise<void> {
		try {
			if (!fs.existsSync(this.userConfigPath)) return;

			const existing = JSON.parse(
				fs.readFileSync(this.userConfigPath, "utf-8"),
			);
			const servers = (existing.mcpServers ?? []).filter(
				(s: McpServerConfig) => s.name !== serverName,
			);
			existing.mcpServers = servers;

			fs.writeFileSync(
				this.userConfigPath,
				JSON.stringify(existing, null, 2),
				"utf-8",
			);
		} catch {
			// silent
		}
	}
}
