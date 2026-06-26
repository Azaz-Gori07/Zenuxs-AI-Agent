import type {
	AgentMessage,
	AgentToolCallPart,
	AgentMessagePart,
} from "@cline/shared";
import type { AgentRuntime } from "../agent-runtime";
import { McpToolRegistry } from "../mcp/toolRegistry";
import { SUB_AGENT_ROLES, getRoleToolDescriptions } from "./roles";
import type { AgentRole, AgentHandoff } from "./types";

export interface SubAgentNodeResult {
	messages?: AgentMessage[];
	pending_tool_calls?: AgentToolCallPart[];
	agent_handoff?: AgentHandoff;
	error?: Error | null;
}

export function createSubAgentNode(
	runtime: AgentRuntime,
	mcpRegistry: McpToolRegistry,
	role: AgentRole,
) {
	const roleConfig = SUB_AGENT_ROLES[role];
	if (!roleConfig) {
		throw new Error(`Unknown sub-agent role: ${role}`);
	}

	const rt = runtime as any;

	return async (state: any): Promise<SubAgentNodeResult> => {
		try {
			rt.throwIfAborted();

			const handoff = state.agent_handoff as AgentHandoff | undefined;
			const taskToExecute = handoff?.task || state.current_task || "";
			const contextFrom = handoff?.context || "";
			const agentStart = Date.now();

			await rt.emit({
				type: "turn-started",
				snapshot: rt.snapshot(),
				iteration: rt.state.iteration,
			});

			const originalSystemPrompt = rt.config.systemPrompt;

			const contextBlocks: string[] = [];

			if (contextFrom) {
				contextBlocks.push(`[CONTEXT FROM PREVIOUS AGENT]\n${contextFrom}`);
			}

			if (state.retrieved_context && state.retrieved_context.length > 0) {
				contextBlocks.push(
					"[RELEVANT CODEBASE CONTEXT]\n" + state.retrieved_context.join("\n\n"),
				);
			}

			const mcpToolLines = getRoleToolDescriptions(role, buildServerToolMap(mcpRegistry));
			if (mcpToolLines) {
				contextBlocks.push(`[AVAILABLE MCP TOOLS FOR ${role.toUpperCase()}]\n${mcpToolLines}`);
			}

			let rolePrompt = roleConfig.systemPrompt;
			if (contextBlocks.length > 0) {
				rolePrompt = rolePrompt + "\n\n" + contextBlocks.join("\n\n");
			}
			rt.config.systemPrompt = rolePrompt;

			let assistantRes;
			try {
				assistantRes = await rt.generateAssistantMessage();
			} finally {
				rt.config.systemPrompt = originalSystemPrompt;
			}

			const { message, finishReason } = assistantRes;

			rt.state.messages.push(message);

			await rt.emit({
				type: "message-added",
				snapshot: rt.snapshot(),
				message,
			});
			await rt.emit({
				type: "assistant-message",
				snapshot: rt.snapshot(),
				iteration: rt.state.iteration,
				message,
				finishReason,
			});

		if (finishReason === "aborted") {
			throw rt.normalizeAbortError();
		}

		const toolCalls = message.content.filter(
				(part: AgentMessagePart): part is AgentToolCallPart => part.type === "tool-call",
			);

			if (finishReason === "error" && toolCalls.length === 0) {
				throw new Error(rt.state.lastError ?? "Model stream failed");
			}

			rt.state.pendingToolCalls = toolCalls.map((part: AgentToolCallPart) => part.toolCallId);

			const resultText = message.content
				.filter((p: any) => p.type === "text")
				.map((p: any) => p.text)
				.join("\n");

			const nextHandoff: AgentHandoff = {
				from: role,
				to: "" as AgentRole,
				task: taskToExecute,
				context: resultText,
				result: resultText,
			};

			if (toolCalls.length === 0) {
				await rt.emit({
					type: "turn-finished",
					snapshot: rt.snapshot(),
					iteration: rt.state.iteration,
					toolCallCount: 0,
				});

				return {
					messages: [...rt.state.messages],
					pending_tool_calls: [],
					agent_handoff: nextHandoff,
					error: null,
				};
			}

			return {
				messages: [...rt.state.messages],
				pending_tool_calls: toolCalls,
				error: null,
			};
		} catch (error) {
			return {
				error: error instanceof Error ? error : new Error(String(error)),
			};
		}
	};
}

function buildServerToolMap(
	mcpRegistry: McpToolRegistry,
): Map<string, string[]> {
	const map = new Map<string, string[]>();
	for (const tool of mcpRegistry.getAllTools()) {
		const list = map.get(tool.serverName) ?? [];
		list.push(tool.name);
		map.set(tool.serverName, list);
	}
	return map;
}
