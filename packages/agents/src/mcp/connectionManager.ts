import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import type { McpServerConfig, McpDiscoveredTool } from "./types";

interface McpConnection {
	serverName: string;
	client: Client;
	transport: StdioClientTransport | SSEClientTransport;
	tools: McpDiscoveredTool[];
	connectedAt: number;
	reconnectAttempts: number;
}

export type ConnectionEventType =
	| "connected"
	| "disconnected"
	| "reconnected"
	| "connection-failed"
	| "tools-updated";

export interface ConnectionEvent {
	type: ConnectionEventType;
	serverName: string;
	timestamp: number;
	error?: string;
	toolCount?: number;
}

export type ConnectionListener = (event: ConnectionEvent) => void;

export class ConnectionManager {
	private connections = new Map<string, McpConnection>();
	private configs = new Map<string, McpServerConfig>();
	private listeners = new Set<ConnectionListener>();
	private maxReconnectAttempts = 3;

	setMaxReconnectAttempts(attempts: number): void {
		this.maxReconnectAttempts = attempts;
	}

	async connect(serverConfig: McpServerConfig): Promise<void> {
		const existing = this.connections.get(serverConfig.name);
		if (existing) {
			// Already connected — update config and maybe reconnect
			this.configs.set(serverConfig.name, serverConfig);
			return;
		}

		this.configs.set(serverConfig.name, serverConfig);

		try {
			const client = new Client(
				{ name: "zenuxs-agent", version: "1.0.0" },
				{ capabilities: {} },
			);

			let transport: StdioClientTransport | SSEClientTransport;
			if (serverConfig.transport.type === "stdio") {
				transport = new StdioClientTransport({
					command: serverConfig.transport.command!,
					args: serverConfig.transport.args,
					env: serverConfig.transport.env,
				});
			} else {
				transport = new SSEClientTransport(
					new URL(serverConfig.transport.url!),
				);
			}

			await client.connect(transport);

			const listResult = await client.listTools();
			const tools: McpDiscoveredTool[] = (listResult.tools ?? []).map(
				(t) => ({
					serverName: serverConfig.name,
					name: t.name,
					description: t.description,
					inputSchema: t.inputSchema as Record<string, unknown>,
				}),
			);

			this.connections.set(serverConfig.name, {
				serverName: serverConfig.name,
				client,
				transport,
				tools,
				connectedAt: Date.now(),
				reconnectAttempts: 0,
			});

			this.emit({
				type: "connected",
				serverName: serverConfig.name,
				timestamp: Date.now(),
				toolCount: tools.length,
			});
		} catch (err) {
			const errMsg = err instanceof Error ? err.message : String(err);
			this.emit({
				type: "connection-failed",
				serverName: serverConfig.name,
				timestamp: Date.now(),
				error: errMsg,
			});
			throw err;
		}
	}

	async disconnect(serverName: string): Promise<void> {
		const conn = this.connections.get(serverName);
		if (!conn) return;
		try {
			await conn.client.close();
		} catch {
			// ignore close errors
		}
		this.connections.delete(serverName);
		this.emit({
			type: "disconnected",
			serverName,
			timestamp: Date.now(),
		});
	}

	async disconnectAll(): Promise<void> {
		const names = Array.from(this.connections.keys());
		await Promise.all(names.map((n) => this.disconnect(n)));
	}

	async reconnect(serverName: string): Promise<boolean> {
		const config = this.configs.get(serverName);
		if (!config) return false;

		await this.disconnect(serverName);
		try {
			await this.connect(config);
			const conn = this.connections.get(serverName);
			if (conn) {
				conn.reconnectAttempts = 0;
			}
			this.emit({
				type: "reconnected",
				serverName,
				timestamp: Date.now(),
			});
			return true;
		} catch (err) {
			const conn = this.connections.get(serverName);
			if (conn) {
				conn.reconnectAttempts++;
			}
			const errMsg = err instanceof Error ? err.message : String(err);
			this.emit({
				type: "connection-failed",
				serverName,
				timestamp: Date.now(),
				error: errMsg,
			});
			return false;
		}
	}

	async attemptReconnectWithBackoff(serverName: string): Promise<boolean> {
		const conn = this.connections.get(serverName);
		const attempts = conn?.reconnectAttempts ?? 0;
		if (attempts >= this.maxReconnectAttempts) return false;

		const delay = Math.min(1000 * Math.pow(2, attempts), 30000);
		await sleep(delay);
		return this.reconnect(serverName);
	}

	async callTool(
		serverName: string,
		toolName: string,
		args: Record<string, unknown>,
	): Promise<unknown> {
		const conn = this.connections.get(serverName);
		if (!conn) {
			throw new Error(`MCP server "${serverName}" is not connected`);
		}
		const result = await conn.client.callTool({
			name: toolName,
			arguments: args,
		});
		return result;
	}

	getTools(serverName: string): McpDiscoveredTool[] {
		return this.connections.get(serverName)?.tools ?? [];
	}

	getAllTools(): McpDiscoveredTool[] {
		const all: McpDiscoveredTool[] = [];
		for (const conn of this.connections.values()) {
			all.push(...conn.tools);
		}
		return all;
	}

	getServerForTool(toolName: string): string | undefined {
		for (const conn of this.connections.values()) {
			if (conn.tools.some((t) => t.name === toolName)) {
				return conn.serverName;
			}
		}
		return undefined;
	}

	getConnectedServers(): string[] {
		return Array.from(this.connections.keys());
	}

	isConnected(serverName: string): boolean {
		return this.connections.has(serverName);
	}

	subscribe(listener: ConnectionListener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private emit(event: ConnectionEvent): void {
		for (const listener of this.listeners) {
			try {
				listener(event);
			} catch {
				// isolated
			}
		}
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
