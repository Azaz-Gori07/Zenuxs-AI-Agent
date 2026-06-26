import type { McpPermission } from "./types";
import type { CapabilityRegistry } from "./capabilityRegistry";

export interface PermissionRequest {
	serverName: string;
	toolName: string;
	args: Record<string, unknown>;
}

export interface PermissionDecision {
	allowed: boolean;
	autoApproved: boolean;
	reason?: string;
}

export type PermissionPolicy = "auto-approve" | "require-approval" | "deny";

export class PermissionManager {
	private registry: CapabilityRegistry;
	private globalPolicy: PermissionPolicy = "require-approval";
	private serverOverrides = new Map<string, PermissionPolicy>();
	private toolOverrides = new Map<string, Map<string, PermissionPolicy>>();

	constructor(registry: CapabilityRegistry) {
		this.registry = registry;
	}

	setGlobalPolicy(policy: PermissionPolicy): void {
		this.globalPolicy = policy;
	}

	setServerPolicy(serverName: string, policy: PermissionPolicy): void {
		this.serverOverrides.set(serverName, policy);
	}

	setToolPolicy(
		serverName: string,
		toolName: string,
		policy: PermissionPolicy,
	): void {
		let serverMap = this.toolOverrides.get(serverName);
		if (!serverMap) {
			serverMap = new Map();
			this.toolOverrides.set(serverName, serverMap);
		}
		serverMap.set(toolName, policy);
	}

	async checkPermission(request: PermissionRequest): Promise<PermissionDecision> {
		const server = this.registry.getByName(request.serverName);
		if (!server) {
			return {
				allowed: false,
				autoApproved: false,
				reason: `Server "${request.serverName}" not found in registry`,
			};
		}

		// Check tool-level override first
		const toolOverride = this.toolOverrides.get(request.serverName)?.get(
			request.toolName,
		);
		if (toolOverride) {
			return this.decideFromPolicy(toolOverride, request);
		}

		// Check server-level override
		const serverPolicy = this.serverOverrides.get(request.serverName);
		if (serverPolicy) {
			return this.decideFromPolicy(serverPolicy, request);
		}

		// Check per-tool permission from server config
		const toolPermission = server.permissions.find(
			(p) => p.toolName === request.toolName || p.toolName === "*",
		);
		if (toolPermission) {
			return {
				allowed: !toolPermission.requiresApproval,
				autoApproved: toolPermission.autoApprove,
				reason: toolPermission.autoApprove
					? "Auto-approved by permission config"
					: "Requires manual approval",
			};
		}

		// Fall back to global policy
		return this.decideFromPolicy(this.globalPolicy, request);
	}

	getServerPolicy(serverName: string): PermissionPolicy {
		return this.serverOverrides.get(serverName) ?? this.globalPolicy;
	}

	getToolPolicy(serverName: string, toolName: string): PermissionPolicy {
		return (
			this.toolOverrides.get(serverName)?.get(toolName) ??
			this.serverOverrides.get(serverName) ??
			this.globalPolicy
		);
	}

	private decideFromPolicy(
		policy: PermissionPolicy,
		request: PermissionRequest,
	): PermissionDecision {
		switch (policy) {
			case "auto-approve":
				return {
					allowed: true,
					autoApproved: true,
				};
			case "deny":
				return {
					allowed: false,
					autoApproved: false,
					reason: `Tool "${request.toolName}" on "${request.serverName}" is denied by policy`,
				};
			case "require-approval":
				return {
					allowed: true,
					autoApproved: false,
					reason: "Requires manual approval",
				};
		}
	}
}
