import type {
	AgentMessage,
	AgentModel,
	AgentModelEvent,
	AgentModelRequest,
	AgentTool,
} from "@cline/shared";
import { profiler } from "@cline/shared";
import { afterAll, describe, expect, it } from "vitest";
import { AgentRuntime } from "./index";

class ScriptedPerfModel implements AgentModel {
	public readonly requests: AgentModelRequest[] = [];

	constructor(
		private readonly steps: Array<
			(
				request: AgentModelRequest,
			) => Iterable<AgentModelEvent> | AsyncIterable<AgentModelEvent>
		>,
	) {}

	async stream(request: AgentModelRequest): Promise<AsyncIterable<AgentModelEvent>> {
		this.requests.push(request);
		const step = this.steps.shift();
		if (!step) throw new Error("No scripted model step available");
		return toAsyncIterable(step(request));
	}
}

async function* toAsyncIterable(
	events: Iterable<AgentModelEvent> | AsyncIterable<AgentModelEvent>,
): AsyncIterable<AgentModelEvent> {
	for await (const event of events) yield event;
}

function makeHistory(count: number): AgentMessage[] {
	return Array.from({ length: count }, (_, index) => ({
		id: `msg_${index}`,
		role: index % 2 === 0 ? "user" : "assistant",
		createdAt: Date.now() - (count - index),
		content: [
			{
				type: "text",
				text: `message ${index}\n${"x".repeat(1_000)}`,
			},
		],
	}));
}

const echoTool: AgentTool<{ text: string }, { echoed: string }> = {
	name: "echo",
	description: "Echo text",
	inputSchema: { type: "object" },
	async execute(input) {
		return { echoed: input.text };
	},
};

describe("AgentRuntime performance baseline", () => {
	afterAll(async () => {
		await profiler.finish();
	});

	it("measures local pre-provider runtime overhead with history and tools", async () => {
		const model = new ScriptedPerfModel([
			() => [
				{
					type: "tool-call-delta",
					toolCallId: "call_1",
					toolName: "echo",
					inputText: '{"text":"first"}',
				},
				{ type: "finish", reason: "tool-calls" },
			],
			() => [
				{
					type: "tool-call-delta",
					toolCallId: "call_2",
					toolName: "echo",
					inputText: '{"text":"second"}',
				},
				{ type: "finish", reason: "tool-calls" },
			],
			() => [
				{ type: "text-delta", text: "done" },
				{ type: "finish", reason: "stop" },
			],
		]);
		const runtime = new AgentRuntime({
			model,
			tools: [echoTool],
			initialMessages: makeHistory(60),
			systemPrompt: "You are a performance test agent.",
			systemParts: Array.from({ length: 8 }, (_, index) => ({
				text: `system part ${index} ${"p".repeat(500)}`,
			})),
			maxIterations: 5,
		});

		const start = performance.now();
		const result = await runtime.run("start");
		const elapsed = performance.now() - start;

		console.log(
			`[BENCH] AgentRuntime local overhead: ${elapsed.toFixed(1)}ms, requests=${model.requests.length}, messages=${result.messages.length}`,
		);
		expect(result.status).toBe("completed");
		expect(result.outputText).toBe("done");
		expect(model.requests).toHaveLength(3);
		expect(elapsed).toBeGreaterThan(0);
	});
});
