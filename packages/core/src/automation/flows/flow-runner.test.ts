import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HookGovernance } from "../../governance/hooks/hook-governance";
import { HookTrustStore } from "../../governance/hooks/hook-trust-store";
import { FlowRunner, type FlowDependencies, type FlowEvent } from "./flow-runner";

function dependencies(governance: HookGovernance, hooks: FlowDependencies["hooks"]): FlowDependencies {
	return {
		hooks,
		authorizeHook: async (declaration) => governance.authorize(declaration, "/workspace"),
		executeHook: async (declaration) => governance.execute(declaration, "/workspace"),
		isPluginEnabled: (id) => id === "enabled-plugin",
		runAgentStep: async (prompt) => `agent:${prompt}`,
	};
}

describe("flow runner (security)", () => {
	it("does not execute an untrusted hook step", async () => {
		const dir = mkdtempSync(join(tmpdir(), "flow-runner-"));
		try {
			const declarations = [
				{
					id: "hook-0",
					event: "PreToolUse" as const,
					type: "process" as const,
					command: "/bin/false",
					args: [],
					source: "workspace",
				},
			];
			const governance = new HookGovernance(new HookTrustStore(join(dir, "trust.json")));
			const runner = new FlowRunner(dir);
			const events: FlowEvent[] = [];
			const definition = {
				id: "flow",
				name: "flow",
				steps: [{ id: "hook", kind: "hook" as const, hookIndex: 0 }],
			};
			const record = await runner.run(
				definition,
				dependencies(governance, declarations),
				(event) => events.push(event),
			);
			expect(record.status).toBe("failed");
			expect(record.steps.hook?.status).toBe("failed");
			expect(record.steps.hook?.reason).toContain("pending");
			expect(events.some((event) => event.type === "flow_failed")).toBe(true);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("requires an enabled plugin for plugin steps", async () => {
		const dir = mkdtempSync(join(tmpdir(), "flow-runner-"));
		try {
			const governance = new HookGovernance(new HookTrustStore(join(dir, "trust.json")));
			const runner = new FlowRunner(dir);
			const record = await runner.run(
				{
					id: "flow",
					name: "flow",
					steps: [{ id: "plugin", kind: "plugin", pluginId: "disabled-plugin" }],
				},
				dependencies(governance, []),
				() => {},
			);
			expect(record.status).toBe("failed");
			expect(record.steps.plugin?.reason).toContain("not enabled");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("reuses completed steps on resume", async () => {
		const dir = mkdtempSync(join(tmpdir(), "flow-runner-"));
		try {
			const governance = new HookGovernance(new HookTrustStore(join(dir, "trust.json")));
			const runner = new FlowRunner(dir);
			const definition = {
				id: "flow",
				name: "flow",
				steps: [
					{ id: "agent", kind: "agent" as const, prompt: "hello" },
					{ id: "plugin", kind: "plugin" as const, pluginId: "enabled-plugin" },
				],
			};
			let agentCalls = 0;
			const deps = {
				...dependencies(governance, []),
				runAgentStep: async (prompt: string) => {
					agentCalls += 1;
					return `agent:${prompt}`;
				},
			};
			const first = await runner.run(definition, deps, () => {});
			expect(first.status).toBe("completed");
			const second = await runner.run(definition, deps, () => {}, {
				runId: first.runId,
				resume: true,
			});
			expect(second.status).toBe("completed");
			expect(agentCalls).toBe(1);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("rejects flow definitions that try to carry shell commands", async () => {
		const dir = mkdtempSync(join(tmpdir(), "flow-runner-"));
		try {
			const file = join(dir, "flow.json");
			writeFileSync(
				file,
				JSON.stringify({
					id: "bad",
					steps: [{ id: "step", kind: "agent", prompt: "x", command: "rm -rf /" }],
				}),
			);
			const runner = new FlowRunner(dir);
			const definition = runner.loadDefinition(file);
			expect(definition.steps[0]).not.toHaveProperty("command");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
