import type { McpServerConfig, McpServerMeta, DynamicLoadResult } from "./types";
import type { CapabilityRegistry } from "./capabilityRegistry";
import type { ConnectionManager } from "./connectionManager";
import type { DiscoveryEngine, McpPackageManifest } from "./discoveryEngine";
import { nanoid } from "nanoid";
import * as fs from "node:fs";
import * as path from "node:path";

export class DynamicLoader {
	private registry: CapabilityRegistry;
	private connectionManager: ConnectionManager;
	private discoveryEngine: DiscoveryEngine;
	private workspaceRoot: string;

	constructor(
		registry: CapabilityRegistry,
		connectionManager: ConnectionManager,
		discoveryEngine: DiscoveryEngine,
		workspaceRoot: string,
	) {
		this.registry = registry;
		this.connectionManager = connectionManager;
		this.discoveryEngine = discoveryEngine;
		this.workspaceRoot = workspaceRoot;
	}

	async enable(serverName: string): Promise<DynamicLoadResult> {
		const meta = this.registry.getByName(serverName);
		if (!meta) {
			return {
				success: false,
				error: `Server "${serverName}" not found in registry`,
			};
		}

		if (meta.status === "active") {
			return { success: true, serverName };
		}

		const config = this.buildConfigFromMeta(meta);
		if (!config) {
			return {
				success: false,
				error: `Cannot build config for "${serverName}"`,
			};
		}

		try {
			await this.connectionManager.connect(config);
			this.registry.updateStatus(meta.id, "active");
			return { success: true, serverName };
		} catch (err) {
			this.registry.updateStatus(meta.id, "error");
			return {
				success: false,
				error: err instanceof Error ? err.message : String(err),
			};
		}
	}

	async disable(serverName: string): Promise<DynamicLoadResult> {
		const meta = this.registry.getByName(serverName);
		if (!meta) {
			return {
				success: false,
				error: `Server "${serverName}" not found in registry`,
			};
		}

		try {
			await this.connectionManager.disconnect(serverName);
			this.registry.updateStatus(meta.id, "inactive");
			return { success: true, serverName };
		} catch (err) {
			return {
				success: false,
				error: err instanceof Error ? err.message : String(err),
			};
		}
	}

	async reload(serverName: string): Promise<DynamicLoadResult> {
		await this.disable(serverName);
		return this.enable(serverName);
	}

	async update(serverName: string, config?: Partial<McpServerMeta>): Promise<DynamicLoadResult> {
		const meta = this.registry.getByName(serverName);
		if (!meta) {
			return {
				success: false,
				error: `Server "${serverName}" not found in registry`,
			};
		}

		if (config) {
			this.registry.update(meta.id, config);
		}

		return this.reload(serverName);
	}

	async install(
		serverDir: string,
		manifest?: McpPackageManifest,
	): Promise<DynamicLoadResult> {
		const mcpDir = path.resolve(this.workspaceRoot, "mcp");
		const dirName = path.basename(serverDir);
		const targetDir = path.join(mcpDir, dirName);

		try {
			// Copy directory if not already in mcp/
			if (path.resolve(serverDir) !== targetDir) {
				await this.copyDirectory(serverDir, targetDir);
			}

			// Read manifest if not provided
			const actualManifest = manifest ?? this.readManifestFromDir(targetDir);
			if (!actualManifest) {
				return {
					success: false,
					error: `No MCP manifest found in "${serverDir}"`,
				};
			}

			// Build config and meta
			const meta: McpServerMeta = {
				id: `mcp_${nanoid(8)}`,
				name: actualManifest.name || dirName,
				version: actualManifest.version || "0.0.0",
				category: actualManifest.mcp?.category ?? "user_installed",
				author: actualManifest.mcp?.author || "user",
				status: "loading",
				priority: actualManifest.mcp?.priority ?? 50,
				entryPoint: actualManifest.mcp?.command
					? path.join(targetDir, actualManifest.mcp.command)
					: targetDir,
				description: actualManifest.description || "",
				tags: actualManifest.mcp?.tags ?? [],
				supportsStreaming: actualManifest.mcp?.supportsStreaming ?? false,
				supportsParallelCalls: actualManifest.mcp?.supportsParallelCalls ?? false,
				permissions: actualManifest.mcp?.permissions ?? [],
				health: { status: "unknown", lastCheck: 0, latency: 0 },
				createdAt: Date.now(),
				updatedAt: Date.now(),
				isBuiltIn: false,
				isUserInstalled: true,
			};

			this.registry.register(meta);
			return this.enable(meta.name);
		} catch (err) {
			return {
				success: false,
				error: err instanceof Error ? err.message : String(err),
			};
		}
	}

	async uninstall(serverName: string): Promise<DynamicLoadResult> {
		const meta = this.registry.getByName(serverName);
		if (!meta) {
			return {
				success: false,
				error: `Server "${serverName}" not found in registry`,
			};
		}

		try {
			await this.connectionManager.disconnect(serverName);
			this.registry.unregister(meta.id);

			// Remove from mcp directory if it exists there
			const serverDir = path.join(
				this.workspaceRoot,
				"mcp",
				meta.name,
			);
			if (fs.existsSync(serverDir)) {
				fs.rmSync(serverDir, { recursive: true, force: true });
			}

			return { success: true, serverName };
		} catch (err) {
			return {
				success: false,
				error: err instanceof Error ? err.message : String(err),
			};
		}
	}

	listLoadable(): McpServerMeta[] {
		return this.registry.list();
	}

	private buildConfigFromMeta(meta: McpServerMeta): McpServerConfig | null {
		if (!meta.entryPoint) return null;
		return {
			name: meta.name,
			transport: { type: "stdio", command: meta.entryPoint, args: [] },
			category: meta.category,
			description: meta.description,
			tags: meta.tags,
			author: meta.author,
			version: meta.version,
			priority: meta.priority,
			isBuiltIn: meta.isBuiltIn,
			isUserInstalled: meta.isUserInstalled,
		};
	}

	private readManifestFromDir(dir: string): McpPackageManifest | null {
		const pkgPath = path.join(dir, "package.json");
		try {
			if (fs.existsSync(pkgPath)) {
				return JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as McpPackageManifest;
			}
		} catch {
			// ignore
		}

		const mcpJsonPath = path.join(dir, ".mcp.json");
		try {
			if (fs.existsSync(mcpJsonPath)) {
				return JSON.parse(fs.readFileSync(mcpJsonPath, "utf-8")) as McpPackageManifest;
			}
		} catch {
			// ignore
		}

		return null;
	}

	private async copyDirectory(src: string, dest: string): Promise<void> {
		if (!fs.existsSync(dest)) {
			fs.mkdirSync(dest, { recursive: true });
		}

		const entries = fs.readdirSync(src, { withFileTypes: true });
		for (const entry of entries) {
			const srcPath = path.join(src, entry.name);
			const destPath = path.join(dest, entry.name);

			if (entry.isDirectory()) {
				await this.copyDirectory(srcPath, destPath);
			} else {
				fs.copyFileSync(srcPath, destPath);
			}
		}
	}
}
