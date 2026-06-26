import * as fs from "node:fs";
import * as path from "node:path";
import type { McpServerConfig, McpCategory, McpServerMeta, McpPermission, McpHealth } from "./types";
import { DEFAULT_MCP_DIR, BUILT_IN_MCP_SERVERS } from "./types";
import { nanoid } from "nanoid";

export interface DiscoveryResult {
	servers: McpServerMeta[];
	errors: DiscoveryError[];
}

export interface DiscoveryError {
	serverName: string;
	message: string;
}

export interface McpPackageManifest {
	name: string;
	version?: string;
	description?: string;
	mcp?: {
		category?: McpCategory;
		command?: string;
		args?: string[];
		env?: Record<string, string>;
		tags?: string[];
		author?: string;
		priority?: number;
		supportsStreaming?: boolean;
		supportsParallelCalls?: boolean;
		permissions?: McpPermission[];
	};
}

export class DiscoveryEngine {
	private mcpDir: string;
	private userConfigs: McpServerConfig[] = [];

	constructor(mcpDir?: string) {
		this.mcpDir = mcpDir ?? DEFAULT_MCP_DIR;
	}

	setUserConfigs(configs: McpServerConfig[]): void {
		this.userConfigs = configs;
	}

	async discoverAll(workspaceRoot: string): Promise<DiscoveryResult> {
		const errors: DiscoveryError[] = [];
		const servers: McpServerMeta[] = [];

		// 1. Scan /mcp directory
		const mcpDirPath = path.resolve(workspaceRoot, this.mcpDir);
		const dirServers = await this.scanMcpDirectory(mcpDirPath, errors);
		servers.push(...dirServers);

		// 2. Register from user config (zenuxs-user-config.json mcpServers)
		const configServers = this.discoverFromConfig(errors);
		servers.push(...configServers);

		return { servers, errors };
	}

	private async scanMcpDirectory(
		mcpDirPath: string,
		errors: DiscoveryError[],
	): Promise<McpServerMeta[]> {
		const servers: McpServerMeta[] = [];

		let entries: string[];
		try {
			entries = fs.readdirSync(mcpDirPath, { withFileTypes: true }).map(
				(e) => e.name,
			);
		} catch {
			// Directory doesn't exist yet — that's OK
			return [];
		}

		for (const entry of entries) {
			const serverPath = path.join(mcpDirPath, entry);
			let stat: fs.Stats;
			try {
				stat = fs.statSync(serverPath);
			} catch {
				continue;
			}

			if (!stat.isDirectory()) continue;

			// Look for package.json or .mcp.json manifest
			const manifest = this.readManifest(serverPath);
			if (!manifest) {
				// No manifest — skip (not a valid MCP server dir)
				continue;
			}

			const serverMeta = this.buildMetaFromManifest(
				entry,
				serverPath,
				manifest,
				false,
			);
			servers.push(serverMeta);
		}

		return servers;
	}

	private readManifest(
		serverDir: string,
	): McpPackageManifest | null {
		// Try package.json first
		const pkgPath = path.join(serverDir, "package.json");
		try {
			if (fs.existsSync(pkgPath)) {
				const raw = fs.readFileSync(pkgPath, "utf-8");
				const pkg = JSON.parse(raw) as McpPackageManifest;
				if (pkg.mcp || pkg.name) {
					return pkg;
				}
			}
		} catch {
			// ignore
		}

		// Try .mcp.json
		const mcpJsonPath = path.join(serverDir, ".mcp.json");
		try {
			if (fs.existsSync(mcpJsonPath)) {
				const raw = fs.readFileSync(mcpJsonPath, "utf-8");
				return JSON.parse(raw) as McpPackageManifest;
			}
		} catch {
			// ignore
		}

		return null;
	}

	private buildMetaFromManifest(
		dirName: string,
		serverPath: string,
		manifest: McpPackageManifest,
		isBuiltIn: boolean,
	): McpServerMeta {
		const mcp = manifest.mcp ?? {};
		const entryPoint = mcp.command
			? path.join(serverPath, mcp.command)
			: serverPath;

		return {
			id: `mcp_${nanoid(8)}`,
			name: manifest.name || dirName,
			version: manifest.version || "0.0.0",
			category: mcp.category ?? "user_installed",
			author: mcp.author || "unknown",
			status: "loading",
			priority: mcp.priority ?? 50,
			entryPoint,
			description: manifest.description || "",
			tags: mcp.tags ?? [],
			supportsStreaming: mcp.supportsStreaming ?? false,
			supportsParallelCalls: mcp.supportsParallelCalls ?? false,
			permissions: mcp.permissions ?? [],
			health: {
				status: "unknown",
				lastCheck: 0,
				latency: 0,
			},
			createdAt: Date.now(),
			updatedAt: Date.now(),
			isBuiltIn,
			isUserInstalled: !isBuiltIn,
		};
	}

	private discoverFromConfig(
		errors: DiscoveryError[],
	): McpServerMeta[] {
		const servers: McpServerMeta[] = [];

		for (const config of this.userConfigs) {
			try {
				const server: McpServerMeta = {
					id: `mcp_${nanoid(8)}`,
					name: config.name,
					version: config.version || "0.0.0",
					category: config.category ?? "user_installed",
					author: config.author || "user",
					status: "loading",
					priority: config.priority ?? 50,
					entryPoint:
						config.transport.command || config.transport.url || config.name,
					description: config.description || `User-configured MCP: ${config.name}`,
					tags: config.tags ?? [],
					supportsStreaming: config.supportsStreaming ?? false,
					supportsParallelCalls: config.supportsParallelCalls ?? false,
					permissions: config.permissions ?? [],
					health: {
						status: "unknown",
						lastCheck: 0,
						latency: 0,
					},
					createdAt: Date.now(),
					updatedAt: Date.now(),
					isBuiltIn: config.isBuiltIn ?? false,
					isUserInstalled: config.isUserInstalled ?? true,
				};
				servers.push(server);
			} catch (err) {
				errors.push({
					serverName: config.name,
					message: err instanceof Error ? err.message : String(err),
				});
			}
		}

		return servers;
	}

	static generateConfigFromManifest(
		meta: McpServerMeta,
		workspaceRoot: string,
	): McpServerConfig | null {
		if (meta.category === "user_installed" && !meta.entryPoint) {
			return null;
		}

		return {
			name: meta.name,
			transport: {
				type: "stdio",
				command: meta.entryPoint,
				args: [],
			},
			category: meta.category,
			description: meta.description,
			tags: meta.tags,
			author: meta.author,
			version: meta.version,
			priority: meta.priority,
			supportsStreaming: meta.supportsStreaming,
			supportsParallelCalls: meta.supportsParallelCalls,
			permissions: meta.permissions,
			isBuiltIn: meta.isBuiltIn,
			isUserInstalled: meta.isUserInstalled,
		};
	}
}
