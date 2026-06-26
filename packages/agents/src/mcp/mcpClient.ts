import { nanoid } from "nanoid";
import type {
	McpServerConfig,
	McpServerMeta,
	McpToolCall,
	McpDiscoveredTool,
	McpLayerConfig,
	DynamicLoadResult,
	McpCategory,
} from "./types";
import { BUILT_IN_MCP_SERVERS } from "./types";
import { CapabilityRegistry } from "./capabilityRegistry";
import { ConnectionManager } from "./connectionManager";
import { DiscoveryEngine } from "./discoveryEngine";
import { HealthMonitor } from "./healthMonitor";
import { PermissionManager } from "./permissionManager";
import { SessionManager } from "./sessionManager";
import { DynamicLoader } from "./dynamicLoader";
import { UserMcpManager } from "./userMcpManager";
import type { UserMcpCommand, UserMcpResult } from "./userMcpManager";

export class McpLayer {
	readonly registry: CapabilityRegistry;
	readonly connectionManager: ConnectionManager;
	readonly discoveryEngine: DiscoveryEngine;
	readonly healthMonitor: HealthMonitor;
	readonly permissionManager: PermissionManager;
	readonly sessionManager: SessionManager;
	readonly dynamicLoader: DynamicLoader;
	readonly userMcpManager: UserMcpManager;

	private workspaceRoot: string;
	private initialized = false;

	constructor(workspaceRoot: string, config?: McpLayerConfig) {
		this.workspaceRoot = workspaceRoot;

		this.registry = new CapabilityRegistry();
		this.connectionManager = new ConnectionManager();
		this.discoveryEngine = new DiscoveryEngine(config?.mcpDir);
		this.healthMonitor = new HealthMonitor(
			this.registry,
			this.connectionManager,
			config?.healthCheckIntervalMs ?? 30000,
		);
		this.permissionManager = new PermissionManager(this.registry);
		this.sessionManager = new SessionManager();
		this.dynamicLoader = new DynamicLoader(
			this.registry,
			this.connectionManager,
			this.discoveryEngine,
			workspaceRoot,
		);
		this.userMcpManager = new UserMcpManager(
			this.registry,
			this.connectionManager,
			this.discoveryEngine,
			this.dynamicLoader,
			workspaceRoot,
		);

		if (config?.connectionTimeoutMs) {
			// Timeout is configured on requests via AbortSignal.timeout elsewhere
		}
		if (config?.maxReconnectAttempts) {
			this.connectionManager.setMaxReconnectAttempts(
				config.maxReconnectAttempts,
			);
		}
	}

	async initialize(userMcpServers?: McpServerConfig[]): Promise<void> {
		if (this.initialized) return;

		this.discoveryEngine.setUserConfigs(userMcpServers ?? []);

		// 1. Discover all servers
		const discoveryResult = await this.discoveryEngine.discoverAll(
			this.workspaceRoot,
		);

		// 2. Register all discovered servers in the capability registry
		for (const server of discoveryResult.servers) {
			this.registry.register(server);
		}

		// 3. Register built-in defaults if not already discovered
		for (const builtIn of BUILT_IN_MCP_SERVERS) {
			if (!this.registry.getByName(builtIn.name)) {
				const meta = this.builtInConfigToMeta(builtIn);
				this.registry.register(meta);
			}
		}

		// 4. Auto-connect active servers
		const activeServers = this.registry.list().filter(
			(s) => s.status !== "inactive",
		);
		for (const server of activeServers) {
			const config = this.findConfig(server.name, userMcpServers);
			if (!config) continue;
			try {
				await this.connectionManager.connect(config);
				this.registry.updateStatus(server.id, "active");
			} catch (err) {
				this.registry.updateStatus(server.id, "error");
				console.warn(
					`[MCP] Failed to connect "${server.name}":`,
					err instanceof Error ? err.message : String(err),
				);
			}
		}

		// 5. Start health monitoring
		this.healthMonitor.start();

		this.initialized = true;
	}

	async shutdown(): Promise<void> {
		this.healthMonitor.stop();
		await this.connectionManager.disconnectAll();
		this.initialized = false;
	}

	async callTool(
		serverName: string,
		toolName: string,
		args: Record<string, unknown>,
	): Promise<unknown> {
		return this.connectionManager.callTool(serverName, toolName, args);
	}

	getTools(serverName: string): McpDiscoveredTool[] {
		return this.connectionManager.getTools(serverName);
	}

	getAllTools(): McpDiscoveredTool[] {
		return this.connectionManager.getAllTools();
	}

	getServerForTool(toolName: string): string | undefined {
		return this.connectionManager.getServerForTool(toolName);
	}

	getConnectedServers(): string[] {
		return this.connectionManager.getConnectedServers();
	}

	// ── Planner Integration ──

	getCapabilitiesForTask(taskDescription: string): McpServerMeta[] {
		const task = taskDescription.toLowerCase();

		// Map task keywords to capability needs
		const needs: { category?: McpCategory; tags: string[] } = {
			tags: [],
		};

		if (
			task.includes("browse") || task.includes("website") ||
			task.includes("web page") || task.includes("url") ||
			task.includes("html") || task.includes("css") ||
			task.includes("dom") || task.includes("click") ||
			task.includes("form") || task.includes("navigate")
		) {
			needs.tags.push("browser");
		}

		if (
			task.includes("debug") || task.includes("console") ||
			task.includes("network") || task.includes("performance") ||
			task.includes("error")
		) {
			needs.tags.push("debugging");
		}

		if (
			task.includes("error tracking") || task.includes("sentry") ||
			task.includes("monitor") || task.includes("alert")
		) {
			needs.tags.push("monitoring");
		}

		if (
			task.includes("documentation") || task.includes("docs") ||
			task.includes("context") || task.includes("reference") ||
			task.includes("api spec")
		) {
			needs.tags.push("documentation");
		}

		if (
			task.includes("github") || task.includes("git") ||
			task.includes("pr") || task.includes("pull request") ||
			task.includes("issue") || task.includes("commit") ||
			task.includes("repository")
		) {
			needs.tags.push("source_control");
		}

		if (
			task.includes("file") || task.includes("read") ||
			task.includes("write") || task.includes("filesystem") ||
			task.includes("create") || task.includes("modify")
		) {
			needs.tags.push("development");
		}

		if (
			task.includes("search") || task.includes("research") ||
			task.includes("find") || task.includes("lookup")
		) {
			needs.tags.push("research");
		}

		if (
			task.includes("remember") || task.includes("memory") ||
			task.includes("recall") || task.includes("previous")
		) {
			needs.tags.push("memory");
		}

		if (
			task.includes("terminal") || task.includes("command") ||
			task.includes("shell") || task.includes("run") ||
			task.includes("execute")
		) {
			needs.tags.push("development");
		}

		if (
			task.includes("docker") || task.includes("container") ||
			task.includes("image") || task.includes("compose")
		) {
			needs.tags.push("development");
		}

		if (
			task.includes("ci") || task.includes("cd") ||
			task.includes("pipeline") || task.includes("deploy")
		) {
			needs.tags.push("development");
		}

		// Find servers matching the needs
		const candidates = this.registry.listActive().filter((server) => {
			if (needs.tags.length === 0) return true; // no specific needs — return all
			return needs.tags.some((tag) => server.tags.includes(tag));
		});

		// Sort by priority (lower = more preferred)
		return candidates.sort((a, b) => a.priority - b.priority);
	}

	async executeUserCommand(command: UserMcpCommand): Promise<UserMcpResult> {
		return this.userMcpManager.execute(command);
	}

	// ── Helpers ──

	private builtInConfigToMeta(config: McpServerConfig): McpServerMeta {
		return {
			id: `mcp_${nanoid(8)}`,
			name: config.name,
			version: config.version || "0.0.0",
			category: config.category ?? "development",
			author: config.author || "zenuxs",
			status: "loading",
			priority: config.priority ?? 50,
			entryPoint: config.transport.command || config.transport.url || config.name,
			description: config.description || "",
			tags: config.tags ?? [],
			supportsStreaming: config.supportsStreaming ?? false,
			supportsParallelCalls: config.supportsParallelCalls ?? false,
			permissions: config.permissions ?? [],
			health: { status: "unknown", lastCheck: 0, latency: 0 },
			createdAt: Date.now(),
			updatedAt: Date.now(),
			isBuiltIn: true,
			isUserInstalled: false,
		};
	}

	private findConfig(
		serverName: string,
		userConfigs?: McpServerConfig[],
	): McpServerConfig | undefined {
		// Check user configs first
		const userConfig = userConfigs?.find((c) => c.name === serverName);
		if (userConfig) return userConfig;

		// Check built-in defaults
		return BUILT_IN_MCP_SERVERS.find((c) => c.name === serverName);
	}
}

// Re-export the ToolRegistry wrapper for backward compatibility
export { McpToolRegistry } from "./toolRegistry";
