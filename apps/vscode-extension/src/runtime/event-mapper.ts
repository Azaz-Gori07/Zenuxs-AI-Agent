import type { CoreSessionEvent, AgentEvent } from "@cline/core";

/**
 * Webview outbound message types.
 * These mirror the protocol defined in apps/zenuxs-hub/src/webview-protocol.ts
 * so the same webview UI can consume them.
 */
export type WebviewOutboundMessage =
	| { type: "status"; text: string }
	| { type: "error"; text: string }
	| { type: "session_started"; sessionId: string }
	| {
			type: "session_hydrated";
			sessionId: string;
			status?: string;
			providerId?: string;
			modelId?: string;
			messages: WebviewChatMessage[];
	  }
	| { type: "assistant_delta"; text: string }
	| { type: "reasoning_delta"; text: string; redacted?: boolean }
	| { type: "tool_event"; text: string; event?: WebviewToolEvent }
	| {
			type: "approval_request";
			approvalId: string;
			sessionId: string;
			agentId: string;
			conversationId: string;
			iteration: number;
			toolCallId: string;
			toolName: string;
			input: unknown;
	  }
	| {
			type: "approval_resolved";
			approvalId: string;
			approved: boolean;
			reason?: string;
	  }
	| {
			type: "turn_done";
			finishReason: string;
			iterations: number;
			usage?: WebviewUsage;
	  }
	| { type: "reset_done" }
	| { type: "models"; providerId: string; models: unknown[] };

export type WebviewUsage = {
	inputTokens?: number;
	outputTokens?: number;
	cacheCreationInputTokens?: number;
	cacheReadInputTokens?: number;
	totalCost?: number;
};

export type WebviewToolEvent = {
	toolCallId?: string;
	toolName?: string;
	status: "running" | "completed" | "failed";
	input?: unknown;
	output?: unknown;
	error?: string;
};

export type WebviewChatMessage = {
	role: "user" | "assistant" | "error" | "meta";
	text: string;
	reasoning?: string;
	toolEvents?: Array<{
		id: string;
		name: string;
		text: string;
		state: "input-available" | "output-available" | "output-error";
		input?: unknown;
		output?: unknown;
		error?: string;
	}>;
};

/**
 * Maps a CoreSessionEvent from the ZenuxsCore runtime into zero or more
 * WebviewOutboundMessage payloads for the VS Code chat panel.
 */
export function mapCoreEventToWebview(
	event: CoreSessionEvent,
): WebviewOutboundMessage[] {
	switch (event.type) {
		case "chunk": {
			// stdout/stderr and agent stream chunks are not displayed in the chat.
			// Agent stream chunks are serialized AgentEvents, which are handled
			// via the "agent_event" case.
			return [];
		}

		case "agent_event": {
			return mapAgentEvent(event.payload.event);
		}

		case "ended": {
			return [
				{
					type: "turn_done",
					finishReason: event.payload.reason ?? "completed",
					iterations: 0,
				},
			];
		}

		case "hook": {
			return mapHookEvent(event.payload);
		}

		case "status": {
			return [{ type: "status", text: event.payload.status }];
		}

		case "session_snapshot": {
			// Snapshots are used for session hydration, not streaming
			return [];
		}

		case "team_progress": {
			// Team progress events can be surfaced as status messages
			const summary = event.payload.summary;
			if (summary && typeof summary === "object" && "message" in summary) {
				return [
					{
						type: "status",
						text: `[team] ${(summary as { message?: string }).message ?? "team update"}`,
					},
				];
			}
			return [];
		}

		case "pending_prompts":
		case "pending_prompt_submitted": {
			return [];
		}

		default:
			return [];
	}
}

/**
 * Maps an AgentEvent into webview messages.
 *
 * AgentEvent types (from @cline/shared):
 * - content_start: contentType = "text" | "reasoning" | "tool"
 * - content_update: contentType = "tool" with partial update
 * - content_end: contentType with final text/reasoning/tool output
 * - iteration_start/end: iteration lifecycle
 * - usage: token/cost metrics
 * - notice: recovery/stop/status messages
 * - done: agent finished with reason, text, iterations, usage
 * - error: error with recoverable flag
 */
function mapAgentEvent(event: AgentEvent): WebviewOutboundMessage[] {
	switch (event.type) {
		case "content_start": {
			if (event.contentType === "reasoning") {
				return [
					{
						type: "reasoning_delta",
						text: event.text ?? "",
						redacted: event.redacted ?? false,
					},
				];
			}
			if (event.contentType === "text") {
				return [{ type: "assistant_delta", text: event.text ?? "" }];
			}
			if (event.contentType === "tool") {
				return [
					{
						type: "tool_event",
						text: `Running ${event.toolName ?? "tool"}...`,
						event: {
							toolCallId: event.toolCallId,
							toolName: event.toolName,
							status: "running",
							input: event.input,
						},
					},
				];
			}
			return [];
		}

		case "content_update": {
			// Tool progress updates
			if (event.contentType === "tool") {
				return [
					{
						type: "tool_event",
						text: `${event.toolName ?? "Tool"} progress`,
						event: {
							toolCallId: event.toolCallId,
							toolName: event.toolName,
							status: "running",
							output: event.update,
						},
					},
				];
			}
			return [];
		}

		case "content_end": {
			// Don't emit assistant_delta for text/reasoning here — the
			// content was already streamed incrementally via content_start.
			// Only tool results need to be finalized at content_end.
			if (event.contentType === "tool") {
				const failed = !!event.error;
				return [
					{
						type: "tool_event",
						text: `${event.toolName ?? "Tool"} ${failed ? "failed" : "completed"}`,
						event: {
							toolCallId: event.toolCallId,
							toolName: event.toolName,
							status: failed ? "failed" : "completed",
							output: event.output,
							error: event.error,
						},
					},
				];
			}
			return [];
		}

		case "usage": {
			// Usage events are informational; we surface them as status
			return [
				{
					type: "status",
					text: `Tokens: ${event.inputTokens} in / ${event.outputTokens} out`,
				},
			];
		}

		case "notice": {
			return [{ type: "status", text: event.message }];
		}

		case "done": {
			const errorReasons = new Set(["error", "api_error", "invalid_tool_call", "tool_execution_failed", "mistake_limit"]);
			const cancelReasons = new Set(["aborted", "cancelled", "stopped"]);
			const isError = errorReasons.has(event.reason);
			const isCancelled = cancelReasons.has(event.reason);
			const finishReason = isError ? "error" : event.reason !== "auto_compaction" ? event.reason ?? "completed" : "completed";
			const msgs: WebviewOutboundMessage[] = [
				{
					type: "turn_done",
					finishReason: isCancelled ? "cancelled" : finishReason,
					iterations: event.iterations ?? 0,
					usage: event.usage
						? {
							inputTokens: event.usage.inputTokens,
							outputTokens: event.usage.outputTokens,
							cacheReadInputTokens: event.usage.cacheReadTokens,
							cacheCreationInputTokens: event.usage.cacheWriteTokens,
							totalCost: event.usage.totalCost,
						}
						: undefined,
				},
			];
			if (isError) {
				const errorText = event.text?.trim() ? event.text : `The API returned an error (${event.reason}). Check the developer logs for details.`;
				msgs.push({ type: "error", text: errorText });
			}
			if (isCancelled) {
				msgs.push({ type: "status", text: "Task Cancelled" });
			}
			return msgs;
		}

		case "error": {
			if (event.error?.message) {
				return [{ type: "error", text: event.error.message }];
			}
			return [];
		}

		case "iteration_start":
		case "iteration_end": {
			// Iteration lifecycle events are not surfaced to the UI
			return [];
		}

		default:
			return [];
	}
}

/**
 * Maps a session hook event into webview messages.
 */
function mapHookEvent(payload: {
	sessionId: string;
	hookEventName: string;
	toolName?: string;
	iteration?: number;
}): WebviewOutboundMessage[] {
	if (payload.hookEventName === "tool_call") {
		return [
			{
				type: "tool_event",
				text: `Running ${payload.toolName ?? "tool"}...`,
				event: {
					toolName: payload.toolName,
					status: "running",
				},
			},
		];
	}

	if (payload.hookEventName === "tool_result") {
		return [
			{
				type: "tool_event",
				text: `${payload.toolName ?? "Tool"} completed`,
				event: {
					toolName: payload.toolName,
					status: "completed",
				},
			},
		];
	}

	return [];
}
