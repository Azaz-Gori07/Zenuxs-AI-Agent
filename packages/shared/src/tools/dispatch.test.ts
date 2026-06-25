import { describe, expect, it, vi } from "vitest";
import type { AgentToolContext } from "../agent";
import { ToolRuntime, dispatch, dispatchAll } from "./dispatch";
import { make, makeDynamic, toDefinitions } from "./definition";

const mockContext: AgentToolContext = {
	agentId: "test-agent",
	iteration: 1,
};

describe("ToolRuntime.dispatch", () => {
	it("returns error for unknown tool", async () => {
		const result = await dispatch(
			{},
			{ toolCallId: "call_1", toolName: "unknown", input: {} },
			mockContext,
		);
		expect(result.result.type).toBe("error");
		expect(result.result.value).toContain("Unknown tool");
	});

	it("returns error for tool without execute handler", async () => {
		const tool = make({
			description: "A tool without execute",
			inputSchema: { type: "object" },
		});
		const result = await dispatch(
			{ noop: tool },
			{ toolCallId: "call_1", toolName: "noop", input: {} },
			mockContext,
		);
		expect(result.result.type).toBe("error");
		expect(result.result.value).toContain("no execute handler");
	});

	it("executes a tool and returns the result", async () => {
		const tool = make({
			description: "Greeting tool",
			inputSchema: {
				type: "object",
				properties: { name: { type: "string" } },
				required: ["name"],
			},
			execute: async ({ name }: { name: string }) => `Hello, ${name}!`,
		});

		const result = await dispatch(
			{ greet: tool },
			{ toolCallId: "call_1", toolName: "greet", input: { name: "World" } },
			mockContext,
		);

		expect(result.result.type).toBe("json");
		expect(result.result.value).toBe("Hello, World!");
		expect(result.events).toHaveLength(1);
		expect(result.events[0].type).toBe("tool-result");
	});

	it("returns error for invalid tool input", async () => {
		const tool = make({
			description: "Tool with required field",
			inputSchema: {
				type: "object",
				properties: { x: { type: "number" } },
				required: ["x"],
			},
			execute: async ({ x }: { x: number }) => x * 2,
		});

		const result = await dispatch(
			{ calc: tool },
			{ toolCallId: "call_1", toolName: "calc", input: {} },
			mockContext,
		);

		expect(result.result.type).toBe("error");
		expect(result.result.value).toContain("Missing required property");
	});

	it("handles tool execution errors gracefully", async () => {
		const tool = make({
			description: "Failing tool",
			inputSchema: { type: "object" },
			execute: async () => {
				throw new Error("Something went wrong");
			},
		});

		const result = await dispatch(
			{ fail: tool },
			{ toolCallId: "call_1", toolName: "fail", input: {} },
			mockContext,
		);

		expect(result.result.type).toBe("error");
		expect(result.result.value).toBe("Something went wrong");
	});
});

describe("ToolRuntime.dispatchAll", () => {
	it("executes multiple tools sequentially by default", async () => {
		const tool = make({
			description: "Counter tool",
			inputSchema: { type: "object" },
			execute: async () => "done",
		});

		const results = await dispatchAll(
			{ t: tool },
			[
				{ toolCallId: "call_1", toolName: "t", input: {} },
				{ toolCallId: "call_2", toolName: "t", input: {} },
			],
			mockContext,
		);

		expect(results).toHaveLength(2);
		expect(results[0].result.type).toBe("json");
		expect(results[1].result.type).toBe("json");
	});

	it("executes tools in parallel when requested", async () => {
		const tool = make({
			description: "Slow tool",
			inputSchema: { type: "object" },
			execute: async () => {
				await new Promise((r) => setTimeout(r, 10));
				return "done";
			},
		});

		const results = await dispatchAll(
			{ t: tool },
			[
				{ toolCallId: "call_1", toolName: "t", input: {} },
				{ toolCallId: "call_2", toolName: "t", input: {} },
			],
			mockContext,
			true,
		);

		expect(results).toHaveLength(2);
	});
});

describe("tool definition helpers", () => {
	it("toDefinitions converts enhanced tools to definitions", () => {
		const tool = make({
			description: "Test tool",
			inputSchema: { type: "object", properties: { x: { type: "string" } } },
			execute: async ({ x }: { x: string }) => x,
		});

		const defs = toDefinitions({ my_tool: tool });
		expect(defs).toHaveLength(1);
		expect(defs[0].name).toBe("my_tool");
		expect(defs[0].description).toBe("Test tool");
		expect(defs[0].inputSchema).toEqual({
			type: "object",
			properties: { x: { type: "string" } },
		});
	});

	it("makeDynamic creates a tool from jsonSchema", () => {
		const tool = makeDynamic({
			description: "Dynamic tool",
			jsonSchema: { type: "object", properties: { q: { type: "string" } } },
			execute: async (params) => params,
		});

		expect(tool.description).toBe("Dynamic tool");
		expect(tool.inputSchema).toEqual({
			type: "object",
			properties: { q: { type: "string" } },
		});
	});

	it("tool dispatcher returns error for undefined tool", async () => {
		const result = await ToolRuntime.dispatch(
			{},
			{ toolCallId: "c1", toolName: "nonexistent", input: {} },
			mockContext,
		);
		expect(result.result.type).toBe("error");
	});
});
