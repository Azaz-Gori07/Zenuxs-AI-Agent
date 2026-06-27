import type { McpHealth } from "./types";
import type { CapabilityRegistry } from "./capabilityRegistry";
import type { ConnectionManager } from "./connectionManager";

export interface HealthCheckResult {
	serverName: string;
	status: McpHealth;
	latency: number;
	error?: string;
}

export class HealthMonitor {
	private registry: CapabilityRegistry;
	private connectionManager: ConnectionManager;
	private interval: ReturnType<typeof setInterval> | null = null;
	private intervalMs: number;
	private active = false;

	constructor(
		registry: CapabilityRegistry,
		connectionManager: ConnectionManager,
		intervalMs = 30000,
	) {
		this.registry = registry;
		this.connectionManager = connectionManager;
		this.intervalMs = intervalMs;
	}

	start(): void {
		if (this.active) return;
		this.active = true;
		this.runAllChecks().catch((error) => {
			console.error("[HealthMonitor] Initial health check failed:", error);
		});
		this.interval = setInterval(() => {
			this.runAllChecks().catch((error) => {
				console.error("[HealthMonitor] Periodic health check failed:", error);
			});
		}, this.intervalMs);
	}

	stop(): void {
		this.active = false;
		if (this.interval) {
			clearInterval(this.interval);
			this.interval = null;
		}
	}

	async checkServer(serverName: string): Promise<HealthCheckResult> {
		const start = Date.now();
		const meta = this.registry.getByName(serverName);
		if (!meta) {
			return {
				serverName,
				status: "unknown",
				latency: 0,
				error: "Server not found in registry",
			};
		}

		try {
			if (this.connectionManager.isConnected(serverName)) {
				const tools = this.connectionManager.getTools(serverName);
				const latency = Date.now() - start;
				const status: McpHealth = tools.length > 0 ? "healthy" : "degraded";
				return { serverName, status, latency };
			}

			// Try connecting
			const config = this.getConfigForServer(serverName);
			if (config) {
				const success = await this.connectionManager.reconnect(serverName);
				const latency = Date.now() - start;
				return {
					serverName,
					status: success ? "healthy" : "unhealthy",
					latency,
					error: success ? undefined : "Reconnection attempt failed",
				};
			}

			return {
				serverName,
				status: "unhealthy",
				latency: Date.now() - start,
				error: "Server config not found",
			};
		} catch (err) {
			return {
				serverName,
				status: "unhealthy",
				latency: Date.now() - start,
				error: err instanceof Error ? err.message : String(err),
			};
		}
	}

	async runAllChecks(): Promise<HealthCheckResult[]> {
		const servers = this.registry.list();
		const results = await Promise.allSettled(
			servers.map((s) => this.checkServer(s.name)),
		);

		const finalResults: HealthCheckResult[] = [];
		for (let i = 0; i < results.length; i++) {
			const result = results[i];
			const serverName = servers[i].name;
			let healthResult: HealthCheckResult;

			if (result.status === "fulfilled") {
				healthResult = result.value;
			} else {
				healthResult = {
					serverName,
					status: "unhealthy",
					latency: 0,
					error: result.reason instanceof Error ? result.reason.message : String(result.reason),
				};
			}

			finalResults.push(healthResult);
			this.registry.updateHealth(serverName, healthResult);
		}

		return finalResults;
	}

	getInterval(): number {
		return this.intervalMs;
	}

	setInterval(ms: number): void {
		this.intervalMs = ms;
		if (this.active) {
			this.stop();
			this.start();
		}
	}

	// @ts-expect-error – internal helper, configs are stored in the connection manager
	private getConfigForServer(serverName: string): any {
		// Configs are stored in ConnectionManager's internal configs map
		// This is a best-effort check via reconnection
		return undefined;
	}
}
