import type { McpServerMeta, McpCategory, McpStatus, McpHealth } from "./types";

export type RegistryEventType =
	| "registered"
	| "unregistered"
	| "status-changed"
	| "health-changed"
	| "updated";

export interface RegistryEvent {
	type: RegistryEventType;
	serverId: string;
	serverName: string;
	timestamp: number;
	previous?: Partial<McpServerMeta>;
	current?: Partial<McpServerMeta>;
}

export type RegistryListener = (event: RegistryEvent) => void;

export class CapabilityRegistry {
	private servers = new Map<string, McpServerMeta>();
	private listeners = new Set<RegistryListener>();

	register(server: McpServerMeta): void {
		this.servers.set(server.id, server);
		this.emit({
			type: "registered",
			serverId: server.id,
			serverName: server.name,
			timestamp: Date.now(),
			current: server,
		});
	}

	unregister(id: string): boolean {
		const existing = this.servers.get(id);
		if (!existing) return false;
		this.servers.delete(id);
		this.emit({
			type: "unregistered",
			serverId: id,
			serverName: existing.name,
			timestamp: Date.now(),
			previous: existing,
		});
		return true;
	}

	get(id: string): McpServerMeta | undefined {
		return this.servers.get(id);
	}

	getByName(name: string): McpServerMeta | undefined {
		for (const server of this.servers.values()) {
			if (server.name === name) return server;
		}
		return undefined;
	}

	list(): McpServerMeta[] {
		return Array.from(this.servers.values());
	}

	listActive(): McpServerMeta[] {
		return this.list().filter((s) => s.status === "active");
	}

	findByCategory(category: McpCategory): McpServerMeta[] {
		return this.list().filter((s) => s.category === category);
	}

	findByTag(tag: string): McpServerMeta[] {
		return this.list().filter((s) => s.tags.includes(tag));
	}

	search(query: string): McpServerMeta[] {
		const q = query.toLowerCase();
		return this.list().filter(
			(s) =>
				s.name.toLowerCase().includes(q) ||
				s.description.toLowerCase().includes(q) ||
				s.tags.some((t) => t.toLowerCase().includes(q)),
		);
	}

	updateStatus(id: string, status: McpStatus): boolean {
		const server = this.servers.get(id);
		if (!server) return false;
		const previous = { ...server };
		server.status = status;
		server.updatedAt = Date.now();
		this.emit({
			type: "status-changed",
			serverId: id,
			serverName: server.name,
			timestamp: Date.now(),
			previous: { status: previous.status },
			current: { status },
		});
		return true;
	}

	updateHealth(
		id: string,
		health: { status: McpHealth; latency: number; error?: string },
	): boolean {
		const server = this.servers.get(id);
		if (!server) return false;
		const previous = { ...server };
		server.health = {
			status: health.status,
			lastCheck: Date.now(),
			latency: health.latency,
			error: health.error,
		};
		server.updatedAt = Date.now();
		this.emit({
			type: "health-changed",
			serverId: id,
			serverName: server.name,
			timestamp: Date.now(),
			previous: { health: previous.health },
			current: { health: server.health },
		});
		return true;
	}

	update(id: string, partial: Partial<McpServerMeta>): boolean {
		const server = this.servers.get(id);
		if (!server) return false;
		const previous = { ...server };
		Object.assign(server, partial);
		server.updatedAt = Date.now();
		this.emit({
			type: "updated",
			serverId: id,
			serverName: server.name,
			timestamp: Date.now(),
			previous,
			current: { ...server },
		});
		return true;
	}

	subscribe(listener: RegistryListener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	count(): number {
		return this.servers.size;
	}

	private emit(event: RegistryEvent): void {
		for (const listener of this.listeners) {
			try {
				listener(event);
			} catch {
				// listener errors are isolated
			}
		}
	}
}
