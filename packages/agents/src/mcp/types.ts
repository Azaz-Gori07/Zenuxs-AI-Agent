export type McpCategory =
	| "browser"
	| "debugging"
	| "monitoring"
	| "documentation"
	| "source_control"
	| "development"
	| "research"
	| "memory"
	| "user_installed";

export type McpStatus = "active" | "inactive" | "error" | "loading";

export type McpHealth = "healthy" | "degraded" | "unhealthy" | "unknown";

export interface HealthStatus {
	status: McpHealth;
	lastCheck: number;
	latency: number;
	error?: string;
}

export interface McpPermission {
	toolName: string;
	autoApprove: boolean;
	requiresApproval: boolean;
}

export interface McpServerMeta {
	id: string;
	name: string;
	version: string;
	category: McpCategory;
	author: string;
	status: McpStatus;
	priority: number;
	entryPoint: string;
	description: string;
	tags: string[];
	supportsStreaming: boolean;
	supportsParallelCalls: boolean;
	permissions: McpPermission[];
	health: HealthStatus;
	createdAt: number;
	updatedAt: number;
	isBuiltIn: boolean;
	isUserInstalled: boolean;
}

export interface McpServerTransportConfig {
	type: "stdio" | "sse";
	command?: string;
	args?: string[];
	url?: string;
	env?: Record<string, string>;
}

export interface McpServerConfig {
	name: string;
	transport: McpServerTransportConfig;
	category?: McpCategory;
	description?: string;
	tags?: string[];
	author?: string;
	version?: string;
	priority?: number;
	supportsStreaming?: boolean;
	supportsParallelCalls?: boolean;
	permissions?: McpPermission[];
	isBuiltIn?: boolean;
	isUserInstalled?: boolean;
}

export interface McpDiscoveredTool {
	serverName: string;
	name: string;
	description?: string;
	inputSchema: Record<string, unknown>;
}

export interface McpToolCall {
	serverName: string;
	toolName: string;
	toolCallId: string;
	args: Record<string, unknown>;
}

export interface McpSession {
	sessionId: string;
	serverName: string;
	createdAt: number;
	lastActivity: number;
	toolCallCount: number;
	status: "active" | "idle" | "closed";
}

export interface DynamicLoadResult {
	success: boolean;
	serverName?: string;
	error?: string;
}

export interface McpLayerConfig {
	mcpDir?: string;
	autoDiscover?: boolean;
	healthCheckIntervalMs?: number;
	connectionTimeoutMs?: number;
	maxReconnectAttempts?: number;
	defaultServers?: McpServerConfig[];
}

export const DEFAULT_MCP_DIR = "mcp";

export const BUILT_IN_MCP_SERVERS: McpServerConfig[] = [
	{
		name: "chrome-devtools",
		transport: { type: "stdio", command: "mcp-server-chrome-devtools" },
		category: "browser",
		description: "Chrome DevTools integration for browser debugging",
		tags: ["browser", "debugging", "devtools"],
		author: "zenuxs",
		version: "1.0.0",
		priority: 10,
		supportsStreaming: true,
		supportsParallelCalls: false,
		isBuiltIn: true,
	},
	{
		name: "playwright",
		transport: { type: "stdio", command: "mcp-server-playwright" },
		category: "browser",
		description: "Playwright-based browser automation",
		tags: ["browser", "automation", "testing"],
		author: "zenuxs",
		version: "1.0.0",
		priority: 20,
		supportsStreaming: true,
		supportsParallelCalls: false,
		isBuiltIn: true,
	},
	{
		name: "browser-use",
		transport: { type: "stdio", command: "mcp-server-browser-use" },
		category: "browser",
		description: "Browser Use MCP for general browser interaction",
		tags: ["browser", "navigation", "forms"],
		author: "zenuxs",
		version: "1.0.0",
		priority: 30,
		supportsStreaming: true,
		supportsParallelCalls: false,
		isBuiltIn: true,
	},
	{
		name: "sentry",
		transport: { type: "stdio", command: "mcp-server-sentry" },
		category: "monitoring",
		description: "Sentry error tracking and monitoring",
		tags: ["monitoring", "errors", "alerts"],
		author: "zenuxs",
		version: "1.0.0",
		priority: 40,
		supportsStreaming: false,
		supportsParallelCalls: true,
		isBuiltIn: true,
	},
	{
		name: "context7",
		transport: { type: "stdio", command: "mcp-server-context7" },
		category: "documentation",
		description: "Context7 documentation lookup and context retrieval",
		tags: ["docs", "context", "knowledge"],
		author: "zenuxs",
		version: "1.0.0",
		priority: 50,
		supportsStreaming: false,
		supportsParallelCalls: true,
		isBuiltIn: true,
	},
	{
		name: "github",
		transport: {
			type: "stdio",
			command: "mcp-server-github",
			env: { GITHUB_TOKEN: "" },
		},
		category: "source_control",
		description: "GitHub API integration for repos, issues, PRs",
		tags: ["github", "git", "source-control", "pr", "issues"],
		author: "zenuxs",
		version: "1.0.0",
		priority: 60,
		supportsStreaming: false,
		supportsParallelCalls: true,
		isBuiltIn: true,
	},
	{
		name: "filesystem",
		transport: {
			type: "stdio",
			command: "mcp-server-filesystem",
			args: [],
		},
		category: "development",
		description: "Safe filesystem access with path restrictions",
		tags: ["filesystem", "files", "read", "write"],
		author: "zenuxs",
		version: "1.0.0",
		priority: 70,
		supportsStreaming: true,
		supportsParallelCalls: true,
		isBuiltIn: true,
	},
	{
		name: "terminal",
		transport: { type: "stdio", command: "mcp-server-terminal" },
		category: "development",
		description: "Terminal command execution",
		tags: ["terminal", "commands", "shell"],
		author: "zenuxs",
		version: "1.0.0",
		priority: 80,
		supportsStreaming: true,
		supportsParallelCalls: false,
		isBuiltIn: true,
	},
	{
		name: "ci-cd",
		transport: { type: "stdio", command: "mcp-server-ci-cd" },
		category: "development",
		description: "CI/CD pipeline integration",
		tags: ["ci", "cd", "pipeline", "deploy"],
		author: "zenuxs",
		version: "1.0.0",
		priority: 90,
		supportsStreaming: false,
		supportsParallelCalls: true,
		isBuiltIn: true,
	},
	{
		name: "docker",
		transport: { type: "stdio", command: "mcp-server-docker" },
		category: "development",
		description: "Docker container and image management",
		tags: ["docker", "containers", "images", "devops"],
		author: "zenuxs",
		version: "1.0.0",
		priority: 100,
		supportsStreaming: true,
		supportsParallelCalls: true,
		isBuiltIn: true,
	},
	{
		name: "exa-search",
		transport: { type: "stdio", command: "mcp-server-exa-search" },
		category: "research",
		description: "Exa web search and research",
		tags: ["search", "web", "research"],
		author: "zenuxs",
		version: "1.0.0",
		priority: 110,
		supportsStreaming: false,
		supportsParallelCalls: true,
		isBuiltIn: true,
	},
	{
		name: "serena",
		transport: { type: "stdio", command: "npx", args: ["-y", "@anthropic/serena-mcp"] },
		category: "development",
		description: "Tree-sitter multi-language code intelligence, call graphs, references, and symbol refactoring",
		tags: ["ast", "tree-sitter", "symbols", "call-graph", "refactoring"],
		author: "zenuxs",
		version: "1.0.0",
		priority: 15,
		supportsStreaming: true,
		supportsParallelCalls: true,
		isBuiltIn: true,
	},
	{
		name: "git",
		transport: { type: "stdio", command: "npx", args: ["-y", "@modelcontextprotocol/server-git"] },
		category: "source_control",
		description: "Structured local Git repository operations and history analysis",
		tags: ["git", "version-control", "branches", "log", "history"],
		author: "zenuxs",
		version: "1.0.0",
		priority: 65,
		supportsStreaming: false,
		supportsParallelCalls: true,
		isBuiltIn: true,
	},
	{
		name: "memory",
		transport: { type: "stdio", command: "mcp-server-memory" },
		category: "memory",
		description: "Long-term memory persistence and retrieval",
		tags: ["memory", "persistence", "context"],
		author: "zenuxs",
		version: "1.0.0",
		priority: 120,
		supportsStreaming: false,
		supportsParallelCalls: true,
		isBuiltIn: true,
	},
];
