import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { CapabilityRegistry } from "./capabilityRegistry";
import { ConnectionManager } from "./connectionManager";
import { PermissionManager } from "./permissionManager";
import { SessionManager } from "./sessionManager";
import { HealthMonitor } from "./healthMonitor";
import { McpLayer } from "./mcpClient";
import { McpToolRegistry } from "./toolRegistry";

// ── CapabilityRegistry ──

describe("CapabilityRegistry", () => {
	let registry: CapabilityRegistry;

	beforeEach(() => {
		registry = new CapabilityRegistry();
	});

	it("should register and retrieve a server", () => {
		registry.register({
			id: "test_1",
			name: "test-server",
			version: "1.0.0",
			category: "development",
			author: "test",
			status: "loading",
			priority: 50,
			entryPoint: "/path/to/server",
			description: "A test server",
			tags: ["test", "dev"],
			supportsStreaming: false,
			supportsParallelCalls: true,
			permissions: [],
			health: { status: "unknown", lastCheck: 0, latency: 0 },
			createdAt: Date.now(),
			updatedAt: Date.now(),
			isBuiltIn: true,
			isUserInstalled: false,
		});

		const retrieved = registry.get("test_1");
		expect(retrieved).toBeDefined();
		expect(retrieved!.name).toBe("test-server");
	});

	it("should unregister a server", () => {
		registry.register({
			id: "test_1",
			name: "test-server",
			version: "1.0.0",
			category: "development",
			author: "test",
			status: "loading",
			priority: 50,
			entryPoint: "/path",
			description: "desc",
			tags: [],
			supportsStreaming: false,
			supportsParallelCalls: false,
			permissions: [],
			health: { status: "unknown", lastCheck: 0, latency: 0 },
			createdAt: Date.now(),
			updatedAt: Date.now(),
			isBuiltIn: false,
			isUserInstalled: false,
		});

		expect(registry.count()).toBe(1);
		expect(registry.unregister("test_1")).toBe(true);
		expect(registry.count()).toBe(0);
	});

	it("should find by name", () => {
		registry.register({
			id: "t1",
			name: "filesystem",
			version: "1.0.0",
			category: "development",
			author: "test",
			status: "loading",
			priority: 50,
			entryPoint: "/path",
			description: "desc",
			tags: [],
			supportsStreaming: false,
			supportsParallelCalls: false,
			permissions: [],
			health: { status: "unknown", lastCheck: 0, latency: 0 },
			createdAt: Date.now(),
			updatedAt: Date.now(),
			isBuiltIn: false,
			isUserInstalled: false,
		});

		const found = registry.getByName("filesystem");
		expect(found).toBeDefined();
		expect(found!.id).toBe("t1");
	});

	it("should find by category", () => {
		registry.register(makeMeta("t1", "server1", "browser"));
		registry.register(makeMeta("t2", "server2", "development"));

		const browserServers = registry.findByCategory("browser");
		expect(browserServers).toHaveLength(1);
		expect(browserServers[0].name).toBe("server1");
	});

	it("should search by tag", () => {
		registry.register({
			...makeMeta("t1", "server1", "development"),
			tags: ["browser", "automation"],
		});
		registry.register({
			...makeMeta("t2", "server2", "development"),
			tags: ["filesystem"],
		});

		const found = registry.search("browser");
		expect(found).toHaveLength(1);
		expect(found[0].name).toBe("server1");
	});

	it("should list active servers only", () => {
		const meta1 = { ...makeMeta("t1", "active-server", "development"), status: "active" as const };
		const meta2 = { ...makeMeta("t2", "inactive-server", "development"), status: "inactive" as const };
		registry.register(meta1);
		registry.register(meta2);

		const active = registry.listActive();
		expect(active).toHaveLength(1);
		expect(active[0].name).toBe("active-server");
	});

	it("should emit events on register", () => {
		const events: string[] = [];
		registry.subscribe((e) => events.push(e.type));

		registry.register(makeMeta("t1", "s1", "development"));
		expect(events).toContain("registered");
	});

	it("should emit events on unregister", () => {
		const events: string[] = [];
		registry.register(makeMeta("t1", "s1", "development"));
		registry.subscribe((e) => events.push(e.type));
		registry.unregister("t1");

		expect(events).toContain("unregistered");
	});

	it("should update health status", () => {
		registry.register(makeMeta("t1", "s1", "development"));

		const result = registry.updateHealth("t1", {
			status: "healthy",
			latency: 42,
		});
		expect(result).toBe(true);

		const meta = registry.get("t1");
		expect(meta!.health.status).toBe("healthy");
		expect(meta!.health.latency).toBe(42);
		expect(meta!.health.lastCheck).toBeGreaterThan(0);
	});
});

// ── PermissionManager ──

describe("PermissionManager", () => {
	let registry: CapabilityRegistry;
	let pm: PermissionManager;

	beforeEach(() => {
		registry = new CapabilityRegistry();
		pm = new PermissionManager(registry);
		registry.register(makeMeta("t1", "test-server", "development"));
	});

	it("should default to require-approval", async () => {
		const decision = await pm.checkPermission({
			serverName: "test-server",
			toolName: "read_file",
			args: {},
		});
		expect(decision.allowed).toBe(true);
		expect(decision.autoApproved).toBe(false);
	});

	it("should deny when policy is deny", async () => {
		pm.setServerPolicy("test-server", "deny");
		const decision = await pm.checkPermission({
			serverName: "test-server",
			toolName: "write_file",
			args: {},
		});
		expect(decision.allowed).toBe(false);
	});

	it("should auto-approve with auto-approve policy", async () => {
		pm.setGlobalPolicy("auto-approve");
		const decision = await pm.checkPermission({
			serverName: "test-server",
			toolName: "read_file",
			args: {},
		});
		expect(decision.autoApproved).toBe(true);
	});

	it("should apply tool-level override over server-level", async () => {
		pm.setServerPolicy("test-server", "deny");
		pm.setToolPolicy("test-server", "read_file", "auto-approve");
		const decision = await pm.checkPermission({
			serverName: "test-server",
			toolName: "read_file",
			args: {},
		});
		expect(decision.autoApproved).toBe(true);
	});

	it("should reject for unknown server", async () => {
		const decision = await pm.checkPermission({
			serverName: "nonexistent",
			toolName: "test",
			args: {},
		});
		expect(decision.allowed).toBe(false);
	});
});

// ── SessionManager ──

describe("SessionManager", () => {
	let sm: SessionManager;

	beforeEach(() => {
		sm = new SessionManager();
	});

	it("should create a session", () => {
		const session = sm.createSession("test-server");
		expect(session.serverName).toBe("test-server");
		expect(session.status).toBe("active");
		expect(session.sessionId).toMatch(/^mcp_ses_/);
	});

	it("should record activity", () => {
		const session = sm.createSession("test-server");
		const before = session.toolCallCount;
		sm.recordActivity(session.sessionId);
		expect(session.toolCallCount).toBe(before + 1);
	});

	it("should close a session", () => {
		const session = sm.createSession("test-server");
		sm.closeSession(session.sessionId);
		expect(session.status).toBe("closed");
	});

	it("should get sessions for a server", () => {
		sm.createSession("server-a");
		sm.createSession("server-a");
		sm.createSession("server-b");

		expect(sm.getSessionsForServer("server-a")).toHaveLength(2);
		expect(sm.getSessionsForServer("server-b")).toHaveLength(1);
	});

	it("should prune idle sessions", async () => {
		sm.setIdleTimeout(1); // 1ms timeout
		sm.createSession("server-a");
		sm.createSession("server-b");

		// Wait for timeout to expire
		await new Promise((r) => setTimeout(r, 5));

		const pruned = sm.pruneIdleSessions();
		expect(pruned).toBe(2);
	});
});

// ── McpLayer (integration) ──

describe("McpLayer", () => {
	it("should create layer with all sub-components", () => {
		const layer = new McpLayer("/test");
		expect(layer.registry).toBeInstanceOf(CapabilityRegistry);
		expect(layer.connectionManager).toBeInstanceOf(ConnectionManager);
		expect(layer.permissionManager).toBeInstanceOf(PermissionManager);
		expect(layer.sessionManager).toBeInstanceOf(SessionManager);
		expect(layer.userMcpManager).toBeDefined();
		expect(layer.dynamicLoader).toBeDefined();
	});

	it("should register built-in servers on init", async () => {
		const layer = new McpLayer("/tmp/mcp-test");

		// Mock connectionManager.connect to avoid actually spawning processes
		const originalConnect = layer.connectionManager.connect.bind(
			layer.connectionManager,
		);
		vi.spyOn(layer.connectionManager, "connect").mockResolvedValue(undefined);

		await layer.initialize([]);

		// Built-in servers should be registered even if connection fails
		expect(layer.registry.count()).toBeGreaterThanOrEqual(12);
		expect(layer.registry.getByName("filesystem")).toBeDefined();
		expect(layer.registry.getByName("github")).toBeDefined();
		expect(layer.registry.getByName("sentry")).toBeDefined();

		// Each built-in should be in loading state (not active, since connect was mocked)
		// Actually with mockResolvedValue, status would be "active" from the init code
		// Let's just verify they exist in the registry

		await layer.shutdown();
	});

	it("should map task to capabilities", () => {
		const layer = new McpLayer("/test");
		// Manually register some servers
		layer.registry.register({
			id: "b1",
			name: "chrome-devtools",
			version: "1.0.0",
			category: "browser",
			author: "test",
			status: "active",
			priority: 10,
			entryPoint: "/path",
			description: "Browser debugging",
			tags: ["browser", "debugging"],
			supportsStreaming: true,
			supportsParallelCalls: false,
			permissions: [],
			health: { status: "healthy", lastCheck: Date.now(), latency: 5 },
			createdAt: Date.now(),
			updatedAt: Date.now(),
			isBuiltIn: true,
			isUserInstalled: false,
		});
		layer.registry.register({
			id: "b2",
			name: "playwright",
			version: "1.0.0",
			category: "browser",
			author: "test",
			status: "active",
			priority: 20,
			entryPoint: "/path",
			description: "Browser automation",
			tags: ["browser", "automation"],
			supportsStreaming: true,
			supportsParallelCalls: false,
			permissions: [],
			health: { status: "healthy", lastCheck: Date.now(), latency: 10 },
			createdAt: Date.now(),
			updatedAt: Date.now(),
			isBuiltIn: true,
			isUserInstalled: false,
		});
		layer.registry.register({
			id: "d1",
			name: "filesystem",
			version: "1.0.0",
			category: "development",
			author: "test",
			status: "active",
			priority: 70,
			entryPoint: "/path",
			description: "File access",
			tags: ["development", "files"],
			supportsStreaming: true,
			supportsParallelCalls: true,
			permissions: [],
			health: { status: "healthy", lastCheck: Date.now(), latency: 2 },
			createdAt: Date.now(),
			updatedAt: Date.now(),
			isBuiltIn: true,
			isUserInstalled: false,
		});

		// Test browser task matching
		const browserCaps = layer.getCapabilitiesForTask(
			"browse the website and extract data",
		);
		expect(browserCaps.length).toBeGreaterThanOrEqual(2);
		expect(browserCaps[0].name).toBe("chrome-devtools"); // lower priority first

		// Test filesystem task matching
		const fileCaps = layer.getCapabilitiesForTask("read files from the project");
		expect(fileCaps.some((c) => c.name === "filesystem")).toBe(true);
	});

	it("should support tool registry wrapper", () => {
		const layer = new McpLayer("/test");
		const registry = new McpToolRegistry(layer);
		expect(registry.getAllTools()).toEqual([]);
		expect(registry.isMcpTool("nonexistent")).toBe(false);
		expect(registry.getToolDescriptions()).toBe("");
	});
});

// ── HealthMonitor ──

describe("HealthMonitor", () => {
	it("should start and stop without error", () => {
		const registry = new CapabilityRegistry();
		const cm = new ConnectionManager();
		const hm = new HealthMonitor(registry, cm, 60000);

		expect(() => {
			hm.start();
			hm.stop();
		}).not.toThrow();
	});

	it("should report unknown for unregistered servers", async () => {
		const registry = new CapabilityRegistry();
		const cm = new ConnectionManager();
		const hm = new HealthMonitor(registry, cm, 60000);

		const result = await hm.checkServer("nonexistent");
		expect(result.status).toBe("unknown");
	});
});

// ── Helpers ──

function makeMeta(id: string, name: string, category: any) {
	return {
		id,
		name,
		version: "1.0.0",
		category,
		author: "test",
		status: "loading" as const,
		priority: 50,
		entryPoint: "/path",
		description: `Server ${name}`,
		tags: [],
		supportsStreaming: false,
		supportsParallelCalls: false,
		permissions: [],
		health: { status: "unknown" as const, lastCheck: 0, latency: 0 },
		createdAt: Date.now(),
		updatedAt: Date.now(),
		isBuiltIn: false,
		isUserInstalled: false,
	};
}
