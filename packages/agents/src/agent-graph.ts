import { StateGraph, Annotation, END } from "@langchain/langgraph";
import type {
	AgentMessage,
	AgentToolCallPart,
	AgentRunResult,
	AgentMessagePart,
} from "@cline/shared";
import {
	AgentRuntime,
	AgentRuntimeAbortError,
} from "./agent-runtime";
import { ControlledStopError } from "./agent-runtime";
import { textFromToolMessage } from "./agent-runtime";
import { McpLayer, McpToolRegistry } from "./mcp";
import type { McpToolCall, McpServerConfig, McpLayerConfig } from "./mcp";
import { createSubAgentNode } from "./subagents/subAgentNode";
import { SUB_AGENT_ROLES } from "./subagents/roles";
import type { AgentRole, AgentHandoff } from "./subagents/types";
import { runSelfCritique } from "./reasoning/selfCritique";
import * as fs from "node:fs";
import * as path from "node:path";

export const AgentStateAnnotation = Annotation.Root({
	current_task: Annotation<string>({
		reducer: (x, y) => y ?? x,
		default: () => "",
	}),
	file_context: Annotation<string[]>({
		reducer: (x, y) => x.concat(y),
		default: () => [],
	}),
	terminal_output: Annotation<string[]>({
		reducer: (x, y) => x.concat(y),
		default: () => [],
	}),
	error: Annotation<Error | null | undefined>({
		reducer: (x, y) => (y === undefined ? x : y),
		default: () => null,
	}),
	iteration_count: Annotation<number>({
		reducer: (x, y) => y ?? x,
		default: () => 0,
	}),
	messages: Annotation<AgentMessage[]>({
		reducer: (x, y) => y ?? x,
		default: () => [],
	}),
	pending_tool_calls: Annotation<AgentToolCallPart[]>({
		reducer: (x, y) => y ?? x,
		default: () => [],
	}),
	consecutive_errors: Annotation<number>({
		reducer: (x, y) => y ?? x,
		default: () => 0,
	}),
	result: Annotation<AgentRunResult | undefined>({
		reducer: (x, y) => y ?? x,
		default: () => undefined,
	}),
	retrieved_context: Annotation<string[]>({
		reducer: (x, y) => y ?? x,
		default: () => [],
	}),
	mcp_tool_calls: Annotation<McpToolCall[]>({
		reducer: (x, y) => y ?? x,
		default: () => [],
	}),
	agent_role: Annotation<AgentRole>({
		reducer: (x, y) => y ?? x,
		default: () => "",
	}),
	agent_handoff: Annotation<AgentHandoff | undefined>({
		reducer: (x, y) => y ?? x,
		default: () => undefined,
	}),

});

function loadMcpServersFromConfig(workspaceRoot: string): McpServerConfig[] {
	try {
		const configPath = path.join(workspaceRoot, ".zenuxs-user-config.json");
		const raw = fs.readFileSync(configPath, "utf-8");
		const config = JSON.parse(raw);
		if (config.mcpServers && Array.isArray(config.mcpServers)) {
			return config.mcpServers as McpServerConfig[];
		}
	} catch {
		// ignore missing or invalid config
	}
	return [];
}

export function buildAgentGraph(
	runtime: AgentRuntime,
	mcpLayer?: McpLayer,
	mcpRegistry?: McpToolRegistry,
	workspaceRoot?: string,
) {
	// workspaceRoot is passed from the caller (CLI) to avoid private config access
	const wsRoot = workspaceRoot ?? process.cwd();
	const effectiveMcpLayer = mcpLayer ?? new McpLayer(wsRoot);
	const effectiveMcpRegistry = mcpRegistry ?? new McpToolRegistry(effectiveMcpLayer);

	const plannerNode = async (state: typeof AgentStateAnnotation.State) => {
		try {
			// @ts-expect-error – graph closure accesses runtime state
			runtime.throwIfAborted();
			// @ts-expect-error – maxIterations not on public config type
			const maxIterations = runtime.config.maxIterations;
			if (maxIterations !== undefined && state.iteration_count >= maxIterations) {
				throw new Error(`Agent runtime exceeded maxIterations (${maxIterations})`);
			}
			const nextIteration = state.iteration_count + 1;
			// @ts-expect-error – graph closure mutates runtime state
			runtime.state.iteration = nextIteration;

			// @ts-expect-error – emit/snapshot not on public API
			await runtime.emit({
				type: "turn-started",
				// @ts-expect-error – snapshot() not on public API
				snapshot: runtime.snapshot(),
				iteration: nextIteration,
			});

			// @ts-expect-error – systemPrompt not on public config type
			const originalSystemPrompt = runtime.config.systemPrompt;
			const contextBlocks: string[] = [];
			if (state.retrieved_context && state.retrieved_context.length > 0) {
				contextBlocks.push(
					"[RELEVANT CODEBASE CONTEXT]\n" + state.retrieved_context.join("\n\n"),
				);
			}

			// Add MCP tool descriptions so the planner knows what tools are available
			const mcpToolDescriptions = effectiveMcpRegistry.getToolDescriptions();

			// Capability-based MCP selection: match servers to current task
			const relevantMcpServers = effectiveMcpLayer.getCapabilitiesForTask(
				state.current_task || "",
			);
			const capabilityBlocks: string[] = [];
			if (relevantMcpServers.length > 0) {
				capabilityBlocks.push(
					"[RELEVANT MCP SERVERS FOR THIS TASK]",
					relevantMcpServers
						.map(
							(s) =>
								`- ${s.name} (${s.category}): ${s.description.substring(0, 100)}`,
						)
						.join("\n"),
				);
			}
			const allMcpContext = [
				...(mcpToolDescriptions
					? [`[AVAILABLE MCP TOOLS]\n${mcpToolDescriptions}`]
					: []),
				...capabilityBlocks,
			].join("\n\n");
			if (allMcpContext) {
				contextBlocks.push(allMcpContext);
			}

			if (contextBlocks.length > 0) {
				// @ts-expect-error – systemPrompt not on public config type
				runtime.config.systemPrompt =
					originalSystemPrompt + "\n\n" + contextBlocks.join("\n\n");
			}

			// @ts-expect-error – generateAssistantMessage not on public API
			let assistantRes;
			try {
				assistantRes = await runtime.generateAssistantMessage();
			} finally {
				// @ts-expect-error – systemPrompt not on public config type
				runtime.config.systemPrompt = originalSystemPrompt;
			}

			const { message, finishReason } = assistantRes;
			// @ts-expect-error – graph closure mutates runtime state
			runtime.state.messages.push(message);
			// @ts-expect-error – emit not on public API
			await runtime.emit({
				type: "message-added",
				// @ts-expect-error – snapshot() not on public API
				snapshot: runtime.snapshot(),
				message,
			});
			// @ts-expect-error – emit not on public API
			await runtime.emit({
				type: "assistant-message",
				// @ts-expect-error – snapshot() not on public API
				snapshot: runtime.snapshot(),
				iteration: nextIteration,
				message,
				finishReason,
			});

			// @ts-expect-error – normalizeAbortError not on public API
			if (finishReason === "aborted") {
				throw runtime.normalizeAbortError();
			}

			const toolCalls = message.content.filter(
				(part: AgentMessagePart): part is AgentToolCallPart => part.type === "tool-call",
			);
			if (finishReason === "error" && toolCalls.length === 0) {
				// @ts-expect-error – lastError not on public state type
				throw new Error(runtime.state.lastError ?? "Model stream failed");
			}

			// @ts-expect-error – pendingToolCalls not on public state type
			runtime.state.pendingToolCalls = toolCalls.map((part) => part.toolCallId);

			if (toolCalls.length === 0) {
				// @ts-expect-error – emit not on public API
				await runtime.emit({
					type: "turn-finished",
					// @ts-expect-error – snapshot() not on public API
					snapshot: runtime.snapshot(),
					iteration: nextIteration,
					toolCallCount: 0,
				});
				// @ts-expect-error – getCompletionReminderMessages not on public API
				const completionReminderMessages = runtime.getCompletionReminderMessages();
				if (completionReminderMessages.length > 0) {
					for (const reminderMessage of completionReminderMessages) {
						// @ts-expect-error – addUserReminderMessage not on public API
						await runtime.addUserReminderMessage(reminderMessage);
					}
					return {
						iteration_count: nextIteration,
						// @ts-expect-error – messages not on public state type
						messages: [...runtime.state.messages],
						error: null,
					};
				}
				// @ts-expect-error – finishRun not on public API
				const result = runtime.finishRun("completed", message);
				return {
					iteration_count: nextIteration,
					// @ts-expect-error – messages not on public state type
					messages: [...runtime.state.messages],
					result,
					error: null,
				};
			}

			return {
				iteration_count: nextIteration,
				// @ts-expect-error – messages not on public state type
				messages: [...runtime.state.messages],
				// @ts-expect-error – pendingToolCalls not on public state type
				pending_tool_calls: toolCalls,
				error: null,
			};
		} catch (error) {
			return {
				error: error instanceof Error ? error : new Error(String(error)),
			};
		}
	};

	const contextRetrievalNode = async (state: typeof AgentStateAnnotation.State) => {
		try {
			runtime.throwIfAborted();
			if (state.iteration_count > 0) {
				return {};
			}
			const query = state.current_task || "";
			if (!query.trim()) {
				return {};
			}

			// Initialize MCP Layer (auto-discovery + connection of all servers)
			const mcpServersFromConfig: McpServerConfig[] = loadMcpServersFromConfig(wsRoot);
			const runtimeMcpServers = (runtime.config as any).mcpServers as McpServerConfig[] | undefined;
			const allUserServers = [...mcpServersFromConfig, ...(runtimeMcpServers ?? [])];
			await effectiveMcpLayer.initialize(allUserServers);

			return {};
		} catch (err) {
			return {};
		}
	};

	const crewDispatcherNode = async (state: typeof AgentStateAnnotation.State) => {
		try {
			// @ts-expect-error – graph closure accesses runtime state
			runtime.throwIfAborted();

			const task = state.current_task || "";
			const messages = state.messages || [];
			const lastHandoff = state.agent_handoff;
			const planMessages = messages
				.filter((m: AgentMessage) => m.role === "assistant")
				.map((m: AgentMessage) => m.content.map((p: any) => p.text).join(" "));

			// If a handoff already has a result, check if another agent is needed
			if (lastHandoff && lastHandoff.result) {
				const currentRole = lastHandoff.to || lastHandoff.from;
				// Simple sequencing: planner → researcher → coder → reviewer
				const SEQUENCE: AgentRole[] = ["planner", "researcher", "coder", "reviewer"];
				const currentIdx = SEQUENCE.indexOf(currentRole as AgentRole);
				const nextRole = currentIdx >= 0 && currentIdx < SEQUENCE.length - 1
					? SEQUENCE[currentIdx + 1]
					: ("" as AgentRole);

				if (nextRole && nextRole in SUB_AGENT_ROLES) {
					return {
						agent_role: nextRole,
						agent_handoff: {
							from: currentRole as AgentRole,
							to: nextRole,
							task: task,
							context: `${lastHandoff.result}\n\n---\nPrevious output from ${currentRole}: ${lastHandoff.result.substring(0, 500)}`,
							result: "",
						},
					};
				}
				return { agent_role: "" as AgentRole };
			}

			// First dispatch: classify task to determine primary agent
			const taskLower = task.toLowerCase();
			const planText = planMessages.join(" ").toLowerCase();
			const planSummary = planMessages.join("\n").substring(0, 1000);

			// Browser tasks — detect before researcher since "search" may mean web search
			const browserPhrases = [
				"go to", "open website", "open url", "navigate to", "browse",
				"fill form", "submit form", "enter details",
				"download from", "extract from website", "scrape", "web scrape",
				"search on", "look up on the web", "check website",
				"go on", "visit site", "visit website",
			];
			const isBrowserTask = browserPhrases.some(
				(phrase) => taskLower.includes(phrase),
			);

			let primaryRole: AgentRole;
			if (isBrowserTask) {
				primaryRole = "browser";
			} else if (
				taskLower.includes("research") ||
				taskLower.includes("find") ||
				taskLower.includes("search") ||
				taskLower.includes("understand") ||
				taskLower.includes("how does") ||
				taskLower.includes("explain")
			) {
				primaryRole = "researcher";
			} else if (
				taskLower.includes("review") ||
				taskLower.includes("audit") ||
				taskLower.includes("check") ||
				taskLower.includes("validate")
			) {
				primaryRole = "reviewer";
			} else if (
				taskLower.includes("write") ||
				taskLower.includes("create") ||
				taskLower.includes("implement") ||
				taskLower.includes("add") ||
				taskLower.includes("modify") ||
				taskLower.includes("update") ||
				taskLower.includes("fix") ||
				taskLower.includes("refactor") ||
				planText.includes("write") ||
				planText.includes("implement") ||
				planText.includes("code")
			) {
				primaryRole = "coder";
			} else {
				// Default: let the normal planner handle it
				return { agent_role: "" as AgentRole };
			}

			return {
				agent_role: primaryRole,
				agent_handoff: {
					from: "planner" as AgentRole,
					to: primaryRole,
					task: task,
					context: planSummary ? `Plan from planner:\n${planSummary}` : task,
					result: "",
				},
			};
		} catch (error) {
			return {
				error: error instanceof Error ? error : new Error(String(error)),
			};
		}
	};

	const reasoningNode = async (state: typeof AgentStateAnnotation.State) => {
		try {
			// @ts-expect-error – graph closure accesses runtime state
			runtime.throwIfAborted();

			const role = state.agent_role;
			// Only run self-critique for coder and planner — skip researcher and reviewer
			if (role !== "coder" && role !== "planner") {
				return {};
			}

			const messages = state.messages || [];
			const lastAssistantMsg = [...messages]
				.reverse()
				.find((m: AgentMessage) => m.role === "assistant");

			if (!lastAssistantMsg) return {};

			const textParts = lastAssistantMsg.content.filter(
				(p: AgentMessagePart) => p.type === "text",
			);
			const originalText = textParts.map((p: any) => p.text).join("\n").trim();
			if (!originalText) return {};

			const task = state.current_task || "";

			console.log(`[SELF-CRITIQUE] Starting for role=${role}, task="${task.substring(0, 80)}..."`);

			const { refinedText, confidence, loopsUsed } = await runSelfCritique(
				runtime,
				role,
				originalText,
				task,
			);

			console.log(
				`[SELF-CRITIQUE] Done: loops=${loopsUsed}, confidence=${confidence.toFixed(2)}, ` +
				`refined=${refinedText.length > 0}, ` +
				`changed=${refinedText !== originalText}`,
			);

			if (!refinedText || refinedText === originalText) {
				return {};
			}

			// Replace text in the last assistant message (already in runtime state)
			const rta = runtime as any;
			const msgIndex = (rta.state.messages as AgentMessage[]).findIndex(
				(m: AgentMessage) => m.id === lastAssistantMsg.id,
			);

			if (msgIndex >= 0) {
				const newContent = lastAssistantMsg.content.map((part: AgentMessagePart) => {
					if (part.type === "text") {
						return { ...part, text: refinedText };
					}
					return part;
				});
				rta.state.messages[msgIndex] = {
					...lastAssistantMsg,
					content: newContent,
				} as AgentMessage;

				return {
					messages: [...rta.state.messages],
				};
			}

			return {};
		} catch (error) {
			console.warn("[SELF-CRITIQUE] Error:", error);
			return {};
		}
	};

	const toolSelectorNode = async (state: typeof AgentStateAnnotation.State) => {
		try {
			// @ts-expect-error – graph closure accesses runtime state
			runtime.throwIfAborted();
			const toolCalls = state.pending_tool_calls;
			if (!toolCalls || toolCalls.length === 0) {
				return {};
			}

			const mcpCalls: McpToolCall[] = [];
			const nativeCalls: AgentToolCallPart[] = [];

			for (const tc of toolCalls) {
				const resolved = effectiveMcpRegistry.resolveToolCall(tc.toolName);
				if (resolved) {
					mcpCalls.push({
						serverName: resolved.serverName,
						toolName: tc.toolName,
						toolCallId: tc.toolCallId,
						args: tc.input as Record<string, unknown>,
					});
				} else {
					nativeCalls.push(tc);
				}
			}

			return {
				mcp_tool_calls: mcpCalls,
				pending_tool_calls: nativeCalls,
			};
		} catch (error) {
			return {
				error: error instanceof Error ? error : new Error(String(error)),
			};
		}
	};

	const toolExecutorNode = async (state: typeof AgentStateAnnotation.State) => {
		try {
			// @ts-expect-error – graph closure accesses runtime state
			runtime.throwIfAborted();
			const mcpCalls = state.mcp_tool_calls;
			if (!mcpCalls || mcpCalls.length === 0) {
				return { mcp_tool_calls: [] };
			}

			const toolMessages: AgentMessage[] = [];
			const fileContextUpdates: string[] = [];
			const terminalOutputUpdates: string[] = [];

			for (const mcpCall of mcpCalls) {
				let resultContent: AgentMessagePart[];
				try {
					const rawResult = await effectiveMcpLayer.callTool(
						mcpCall.serverName,
						mcpCall.toolName,
						mcpCall.args,
					);
					const typedResult = rawResult as { content?: Array<{ type: string; text?: string }>; isError?: boolean };
					const text = typedResult.content
						?.map((c: { type: string; text?: string }) => c.text ?? "")
						.filter(Boolean)
						.join("\n") ?? JSON.stringify(rawResult);

					resultContent = [
						{
							type: "tool-result",
							toolCallId: mcpCall.toolCallId,
							toolName: mcpCall.toolName,
							output: text,
							isError: typedResult.isError === true,
						} as any,
					];

					if (text) {
						fileContextUpdates.push(text.substring(0, 200));
					}
				} catch (err) {
					const errMsg = err instanceof Error ? err.message : String(err);
					resultContent = [
						{
							type: "tool-result",
							toolCallId: mcpCall.toolCallId,
							toolName: mcpCall.toolName,
							output: { error: errMsg },
							isError: true,
						} as any,
					];
					terminalOutputUpdates.push(`MCP Error [${mcpCall.serverName}/${mcpCall.toolName}]: ${errMsg}`);
				}

				const toolMessage: AgentMessage = {
					id: `mcp_${mcpCall.toolCallId}`,
					role: "tool",
					content: resultContent,
					createdAt: Date.now(),
				};
				toolMessages.push(toolMessage);
				// @ts-expect-error – graph closure mutates runtime state
				runtime.state.messages.push(toolMessage);
			}

			return {
				mcp_tool_calls: [],
				messages: [...runtime.state.messages],
				file_context: fileContextUpdates,
				terminal_output: terminalOutputUpdates,
				error: null,
			};
		} catch (error) {
			return {
				mcp_tool_calls: [],
				error: error instanceof Error ? error : new Error(String(error)),
			};
		}
	};

	const executorNode = async (state: typeof AgentStateAnnotation.State) => {
		try {
			// @ts-expect-error – graph closure accesses runtime state
			runtime.throwIfAborted();
			// @ts-expect-error – pendingToolCalls not on public state type
			const toolCalls = state.pending_tool_calls;
			// @ts-expect-error – executeToolCalls not on public API
			const toolMessages = await runtime.executeToolCalls(toolCalls);
			// @ts-expect-error – graph closure mutates runtime state
			runtime.state.pendingToolCalls = [];
			// @ts-expect-error – graph closure mutates runtime state
			for (const toolMessage of toolMessages) {
				runtime.state.messages.push(toolMessage);
				// @ts-expect-error – emit not on public API
				await runtime.emit({
					type: "message-added",
					// @ts-expect-error – snapshot() not on public API
					snapshot: runtime.snapshot(),
					// @ts-expect-error – iteration not on public state type
					iteration: runtime.state.iteration,
					message: toolMessage,
				});
			}
			const fileTools = [
				"read_file",
				"write_file",
				"view_file",
				"write_to_file",
				"replace_file_content",
				"multi_replace_file_content",
				"grep_search",
				"list_dir",
			];
			const terminalTools = ["run_command", "execute_command", "execute_task"];
			const fileContextUpdates: string[] = [];
			const terminalOutputUpdates: string[] = [];
			for (let i = 0; i < toolCalls.length; i++) {
				const toolCall = toolCalls[i];
				const toolMessage = toolMessages[i];
				const input = toolCall.input as any;
				if (fileTools.includes(toolCall.toolName)) {
					const path =
						input?.path ||
						input?.TargetFile ||
						input?.AbsolutePath ||
						input?.AbsolutePathPath;
					if (path) {
						fileContextUpdates.push(String(path));
					}
				}
				const toolResultPart = toolMessage?.content.find(
					(part: any) => part.type === "tool-result",
				) as any;
				if (toolResultPart) {
					if (terminalTools.includes(toolCall.toolName)) {
						const cmd = input?.command || input?.CommandLine;
						const outputStr =
							typeof toolResultPart.output === "string"
								? toolResultPart.output
								: JSON.stringify(toolResultPart.output);
						terminalOutputUpdates.push(`Command: ${cmd}\nOutput: ${outputStr}`);
					}
				}
			}
			// @ts-expect-error – emit not on public API
			await runtime.emit({
				type: "turn-finished",
				// @ts-expect-error – iteration not on public state type
				snapshot: runtime.snapshot(),
				iteration: runtime.state.iteration,
				toolCallCount: toolCalls.length,
			});
			const terminalToolMessage = runtime.findCompletingToolMessage(
				toolCalls,
				toolMessages,
			);
			if (terminalToolMessage) {
				const result = runtime.finishRun(
					"completed",
					undefined,
					// @ts-expect-error – textFromToolMessage is a package-private helper
					textFromToolMessage(terminalToolMessage) || undefined,
				);
				return {
					messages: [...runtime.state.messages],
					pending_tool_calls: [],
					file_context: fileContextUpdates,
					terminal_output: terminalOutputUpdates,
					result,
					error: null,
				};
			}
			return {
				messages: [...runtime.state.messages],
				pending_tool_calls: [],
				file_context: fileContextUpdates,
				terminal_output: terminalOutputUpdates,
				error: null,
			};
		} catch (error) {
			return {
				error: error instanceof Error ? error : new Error(String(error)),
			};
		}
	};

	const errorHandlerNode = async (state: typeof AgentStateAnnotation.State) => {
		const err = state.error;
		if (!err) {
			return {};
		}
		const isAbort =
			err instanceof AgentRuntimeAbortError ||
			err.name === "AgentRuntimeAbortError" ||
			((runtime as any).abortController &&
				(runtime as any).abortController.signal.aborted);
		const consecutiveErrors = (state.consecutive_errors ?? 0) + 1;
		// @ts-expect-error – execution.maxConsecutiveMistakes not on public config
		const maxMistakes = (runtime.config as any).execution?.maxConsecutiveMistakes ?? 3;
		if (isAbort || consecutiveErrors >= maxMistakes) {
			const isControlled =
				err instanceof ControlledStopError || err.name === "ControlledStopError";
			const status = isAbort || isControlled ? "aborted" : "failed";
			// @ts-expect-error – graph closure mutates runtime state
			runtime.state.status = status;
			// @ts-expect-error – graph closure mutates runtime state
			runtime.state.lastError = err.message;
			// @ts-expect-error – finishRun not on public API
			const result = runtime.finishRun(status, undefined, undefined);
			if (status === "failed") {
				result.error = err;
			}
			return {
				result,
				consecutive_errors: consecutiveErrors,
			};
		}
		(runtime.config.logger as any)?.warn?.(
			`Recoverable error: ${err.message}. Retrying...`,
		);
		return {
			error: null,
			consecutive_errors: consecutiveErrors,
		};
	};

	const doneNode = async (state: typeof AgentStateAnnotation.State) => {
		const result =
			state.result ||
			// @ts-expect-error – finishRun not on public API
			runtime.finishRun(state.error ? "failed" : "completed");

		await (runtime as any).callAfterRunHooks(result);

		// Shutdown MCP layer (disconnect all servers, stop health monitor)
		try {
			await effectiveMcpLayer.shutdown();
		} catch {
			// ignore mcp shutdown errors
		}

		if (result.status === "failed") {
			// @ts-expect-error – emit not on public API
			await runtime.emit({
				type: "run-failed",
				// @ts-expect-error – snapshot() not on public API
				snapshot: runtime.snapshot(),
				error: state.error || result.error || new Error("Run failed"),
			});
		} else {
			// @ts-expect-error – emit not on public API
			await runtime.emit({
				type: "run-finished",
				// @ts-expect-error – snapshot() not on public API
				snapshot: runtime.snapshot(),
				result,
			});
		}

		return {
			result,
		};
	};

	// Create sub-agent nodes
	const agentNodes: Record<string, ReturnType<typeof createSubAgentNode>> = {};
	for (const [role, config] of Object.entries(SUB_AGENT_ROLES)) {
		agentNodes[role] = createSubAgentNode(runtime, effectiveMcpRegistry, config.role);
	}

	const workflow = new StateGraph(AgentStateAnnotation)
		.addNode("context_retrieval", contextRetrievalNode)
		.addNode("planner", plannerNode)
		.addNode("crew_dispatcher", crewDispatcherNode)
		.addNode("reasoning", reasoningNode)
		.addNode("tool_selector", toolSelectorNode)
		.addNode("tool_executor", toolExecutorNode)
		.addNode("executor", executorNode)
		.addNode("error_handler", errorHandlerNode)
		.addNode("done", doneNode);

	// Register sub-agent nodes
	for (const [role] of Object.entries(SUB_AGENT_ROLES)) {
		workflow.addNode(`agent_${role}`, agentNodes[role]);
	}

	workflow.addEdge("__start__", "context_retrieval");
	workflow.addEdge("context_retrieval", "planner");

	workflow.addConditionalEdges(
		"planner",
		(state) => {
			if (state.error) {
				return "error_handler";
			}
			if (state.result) {
				return "done";
			}
			if (state.pending_tool_calls && state.pending_tool_calls.length > 0) {
				return "tool_selector";
			}
			return "crew_dispatcher";
		},
		{
			error_handler: "error_handler",
			tool_selector: "tool_selector",
			done: "done",
			crew_dispatcher: "crew_dispatcher",
		},
	);

	// Build mapping of all agent node names for conditional edges
	const agentNodeTargets: Record<string, string> = {};
	for (const [role] of Object.entries(SUB_AGENT_ROLES)) {
		agentNodeTargets[`agent_${role}`] = `agent_${role}`;
	}

	const crewDispatcherTargets: Record<string, string> = {
		error_handler: "error_handler",
		done: "done",
		planner: "planner",
		...agentNodeTargets,
	};

	workflow.addConditionalEdges(
		"crew_dispatcher",
		(state) => {
			if (state.error) {
				return "error_handler";
			}
			const role = state.agent_role;
			if (role && role in SUB_AGENT_ROLES) {
				return `agent_${role}`;
			}
			if (state.result) {
				return "done";
			}
			return "planner";
		},
		crewDispatcherTargets as any,
	);

	workflow.addConditionalEdges(
		"tool_selector",
		(state) => {
			if (state.error) {
				return "error_handler";
			}
			if (state.mcp_tool_calls && state.mcp_tool_calls.length > 0) {
				return "tool_executor";
			}
			if (state.pending_tool_calls && state.pending_tool_calls.length > 0) {
				return "executor";
			}
			return "planner";
		},
		{
			error_handler: "error_handler",
			tool_executor: "tool_executor",
			executor: "executor",
			planner: "planner",
		},
	);

	workflow.addConditionalEdges(
		"tool_executor",
		(state) => {
			if (state.error) {
				return "error_handler";
			}
			if (state.pending_tool_calls && state.pending_tool_calls.length > 0) {
				return "executor";
			}
			if (state.result) {
				return "done";
			}
			const role = state.agent_role;
			if (role && role in SUB_AGENT_ROLES) {
				return `agent_${role}`;
			}
			return "planner";
		},
		{
			error_handler: "error_handler",
			executor: "executor",
			done: "done",
			planner: "planner",
			...agentNodeTargets,
		},
	);

	workflow.addConditionalEdges(
		"executor",
		(state) => {
			if (state.error) {
				return "error_handler";
			}
			if (state.result) {
				return "done";
			}
			const role = state.agent_role;
			if (role && role in SUB_AGENT_ROLES) {
				return `agent_${role}`;
			}
			return "planner";
		},
		{
			error_handler: "error_handler",
			done: "done",
			planner: "planner",
			...agentNodeTargets,
		},
	);

	// Sub-agent conditional edges — all agents route through reasoning node for self-critique
	for (const [role] of Object.entries(SUB_AGENT_ROLES)) {
		const nodeName = `agent_${role}`;
		workflow.addConditionalEdges(
			nodeName as any,
			(state) => {
				if (state.error) {
					return "error_handler";
				}
				if (state.result) {
					return "done";
				}
				return "reasoning";
			},
			{
				error_handler: "error_handler",
				done: "done",
				reasoning: "reasoning",
			},
		);
	}

	workflow.addConditionalEdges(
		"reasoning",
		(state) => {
			if (state.error) {
				return "error_handler";
			}
			if (state.result) {
				return "done";
			}
			if (state.pending_tool_calls && state.pending_tool_calls.length > 0) {
				return "tool_selector";
			}
			return "crew_dispatcher";
		},
		{
			error_handler: "error_handler",
			tool_selector: "tool_selector",
			done: "done",
			crew_dispatcher: "crew_dispatcher",
		},
	);

	workflow.addConditionalEdges(
		"error_handler",
		(state) => {
			if (state.error) {
				return "done";
			}
			return "planner";
		},
		{
			done: "done",
			planner: "planner",
		},
	);

	workflow.addEdge("done", END);

	return workflow.compile();
}
