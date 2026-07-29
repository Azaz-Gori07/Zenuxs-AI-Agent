import type { ChatMessage, ToolEventData, ApprovalRequest, UsageData, CheckpointEntry, McpServerEntry, TabId, AgentMode, CompactionStrategy, ExtensionConfig } from "../types.js";
import { useState, useEffect } from "react";

// ==========================================
// AgentEventBus: Simple Pub/Sub Event Bus
// ==========================================
type EventListener<T = any> = (data: T) => void;

class EventBus {
	private listeners = new Map<string, Set<EventListener>>();

	subscribe(event: string, listener: EventListener): () => void {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set());
		}
		this.listeners.get(event)!.add(listener);
		return () => {
			const set = this.listeners.get(event);
			if (set) {
				set.delete(listener);
				if (set.size === 0) this.listeners.delete(event);
			}
		};
	}

	publish(event: string, data?: any): void {
		const set = this.listeners.get(event);
		if (set) {
			for (const listener of set) {
				try {
					listener(data);
				} catch (err) {
					console.error("Error in event listener:", err);
				}
			}
		}
	}
}

export const AgentEventBus = new EventBus();

// ==========================================
// Base Store with simple state management
// ==========================================
export class BaseStore<State> {
	protected state: State;
	private listeners = new Set<(state: State) => void>();
	protected unsubs: (() => void)[] = [];

	constructor(initialState: State) {
		this.state = initialState;
	}

	dispose(): void {
		for (const u of this.unsubs) {
			try { u() } catch {}
		}
		this.unsubs = [];
	}

	getState(): State {
		return this.state;
	}

	subscribe(listener: (state: State) => void): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	protected setState(updates: Partial<State>): void {
		this.state = { ...this.state, ...updates };
		for (const listener of this.listeners) {
			listener(this.state);
		}
	}
}

// ==========================================
// SessionStore
// ==========================================
export interface SessionState {
	activeSessionId: string | null;
	providerId: string;
	modelId: string;
	connected: boolean;
	checkpoints: CheckpointEntry[];
	mcpServers: McpServerEntry[];
	memoryLoaded: boolean;
}

export class SessionStoreClass extends BaseStore<SessionState> {
	constructor() {
		super({
			activeSessionId: null,
			providerId: "cline",
			modelId: "",
			connected: false,
			checkpoints: [],
			mcpServers: [],
			memoryLoaded: false,
		});

		this.unsubs.push(
			AgentEventBus.subscribe("session_started", (data: { sessionId: string }) => {
				this.setState({ activeSessionId: data.sessionId, connected: true, memoryLoaded: true });
			}),
			AgentEventBus.subscribe("session_hydrated", (data: { sessionId: string }) => {
				this.setState({ activeSessionId: data.sessionId, connected: true, memoryLoaded: true });
			}),
			AgentEventBus.subscribe("reset_done", () => {
				this.setState({ activeSessionId: null, checkpoints: [], memoryLoaded: false });
			}),
			AgentEventBus.subscribe("checkpoint_list", (data: { sessionId: string; checkpoints: CheckpointEntry[] }) => {
				if (this.state.activeSessionId === data.sessionId) {
					this.setState({ checkpoints: data.checkpoints });
				}
			}),
			AgentEventBus.subscribe("mcp_servers", (data: { servers: McpServerEntry[] }) => {
				this.setState({ mcpServers: data.servers });
			}),
		);
	}

	setSessionId(sessionId: string | null) {
		this.setState({ activeSessionId: sessionId });
	}

	updateProviderConfig(providerId: string, modelId: string) {
		this.setState({ providerId, modelId });
	}
}

export const SessionStore = new SessionStoreClass();

// ==========================================
// TimelineStore: Chronicled events & messages
// ==========================================
export interface TimelineState {
	messages: ChatMessage[];
	recentOperations: string[];
}

export class TimelineStoreClass extends BaseStore<TimelineState> {
	constructor() {
		super({
			messages: [],
			recentOperations: [],
		});

		this.unsubs.push(
			AgentEventBus.subscribe("assistant_delta", (data: { text: string }) => {
				const msgs = [...this.state.messages];
				const last = msgs[msgs.length - 1];
				if (last && last.role === "assistant") {
					msgs[msgs.length - 1] = { ...last, text: last.text + data.text };
				} else {
					msgs.push({ role: "assistant", text: data.text });
				}
				this.setState({ messages: msgs });
			}),
			AgentEventBus.subscribe("reasoning_delta", (data: { text: string }) => {
				const msgs = [...this.state.messages];
				const last = msgs[msgs.length - 1];
				if (last && last.role === "assistant") {
					msgs[msgs.length - 1] = { ...last, reasoning: (last.reasoning || "") + data.text };
				} else {
					msgs.push({ role: "assistant", text: "", reasoning: data.text });
				}
				this.setState({ messages: msgs });
			}),
			AgentEventBus.subscribe("tool_event", (data: { text: string; event?: ToolEventData }) => {
				const msgs = [...this.state.messages];
				const eventText = data.text;
				const ops = [...this.state.recentOperations];
				if (eventText) {
					ops.push(eventText);
					if (ops.length > 50) ops.shift();
				}
				if (!data.event) {
					this.setState({ recentOperations: ops });
					return;
				}

				const eventId = data.event.id || (data.event as any).toolCallId;
				const existingIndex = msgs.findIndex((m) =>
					m.role === "assistant" &&
					Array.isArray(m.toolEvents) &&
					m.toolEvents.some((e) => e.id === eventId || (e as any).toolCallId === eventId),
				);

				if (existingIndex >= 0) {
					const existingMsg = msgs[existingIndex];
					const events = [...(existingMsg.toolEvents || [])];
					const eventIndex = events.findIndex((e) => e.id === eventId || (e as any).toolCallId === eventId);
					if (eventIndex >= 0) {
						const prevEvent = events[eventIndex];
						const nextEvent = { ...prevEvent, ...data.event };
						if (data.event.state === "running" && typeof data.event.output === "string" && typeof prevEvent.output === "string") {
							nextEvent.output = prevEvent.output + data.event.output;
						}
						events[eventIndex] = nextEvent;
					}
					msgs[existingIndex] = { ...existingMsg, toolEvents: events, text: existingMsg.text || eventText || "" };
				} else {
					msgs.push({
						role: "assistant",
						text: eventText || "",
						toolEvents: [data.event],
					});
				}
				this.setState({ messages: msgs, recentOperations: ops });
			}),
			AgentEventBus.subscribe("context_summary", (data: { threshold: number; goal?: string; task?: string; summary: string }) => {
				const msgs = [...this.state.messages];
				const textParts = [`Context usage has reached ${data.threshold}% of the model window.`];
				if (data.goal) textParts.push(`Goal: ${data.goal}`);
				if (data.task) textParts.push(`Task: ${data.task}`);
				textParts.push(data.summary);
				const text = textParts.join("\n\n");
				const isDuplicate = msgs.some((m) => m.role === "meta" && m.text === text);
				if (!isDuplicate) {
					msgs.push({ role: "meta", text });
					this.setState({ messages: msgs });
				}
			}),
			AgentEventBus.subscribe("session_hydrated", (data: { messages: ChatMessage[] }) => {
				const prevMsgs = this.state.messages;
				const prevCompletion = prevMsgs.length > 0 && prevMsgs[prevMsgs.length - 1].role === "completion" ? prevMsgs[prevMsgs.length - 1] : undefined;
				let nextMsgs = data.messages || [];
				if (prevCompletion && !nextMsgs.some((m) => m.role === "completion")) {
					nextMsgs = [...nextMsgs, prevCompletion];
				}
				this.setState({ messages: nextMsgs });
			}),
			AgentEventBus.subscribe("reset_done", () => {
				this.setState({ messages: [], recentOperations: [] });
			}),
			AgentEventBus.subscribe("user_message_sent", (data: { text: string }) => {
				this.setState({
					messages: [...this.state.messages, { role: "user", text: data.text }],
				});
			}),
			AgentEventBus.subscribe("error_occurred", (data: { text: string }) => {
				this.setState({
					messages: [...this.state.messages, { role: "error", text: data.text }],
				});
			}),
			AgentEventBus.subscribe("turn_done", (data: { finishReason: string; iterations: number; usage?: UsageData }) => {
				const errorReasons = new Set(["error", "api_error", "invalid_tool_call", "tool_execution_failed", "mistake_limit", "failed"]);
				const cancelReasons = new Set(["aborted", "cancelled", "stopped"]);
				const isError = errorReasons.has(data.finishReason);
				const isCancelled = cancelReasons.has(data.finishReason);

				if (!isError && !isCancelled) {
					const msgs = [...this.state.messages];
					const hasToolExecutions = msgs.some((m) => m.role === "assistant" && m.toolEvents && m.toolEvents.length > 0);
					if (!hasToolExecutions) {
						return;
					}

					const now = new Date();
					const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
					const lastAssistant = msgs.slice().reverse().find((m) => m.role === "assistant");
					const toolsUsed = lastAssistant?.toolEvents ? lastAssistant.toolEvents.length : undefined;

					const execState = ExecutionStore.getState();
					const durationMs = execState.durationMs || undefined;
					const inputTokens = data.usage?.inputTokens || execState.inputTokens || undefined;
					const outputTokens = data.usage?.outputTokens || execState.outputTokens || undefined;
					const totalCost = data.usage?.totalCost || execState.totalCost || undefined;

					const lastMsg = msgs[msgs.length - 1];
					if (!lastMsg || lastMsg.role !== "completion") {
						msgs.push({
							role: "completion",
							text: "Task Completed Successfully",
							completionMetadata: {
								timestamp: now.getTime(),
								completedAtFormatted: timeStr,
								durationMs: durationMs && durationMs > 0 ? durationMs : undefined,
								toolsUsed: toolsUsed && toolsUsed > 0 ? toolsUsed : undefined,
								inputTokens,
								outputTokens,
								totalCost,
								statusText: "The requested task has finished successfully.",
							},
						});
						this.setState({ messages: msgs });
					}
				}
			}),
		);
	}

	clear() {
		this.setState({ messages: [], recentOperations: [] });
	}
}

export const TimelineStoreClassRef = TimelineStoreClass;
export const TimelineStore = new TimelineStoreClass();

// ==========================================
// ExecutionStore: Metrics, tokens, status
// ==========================================
export type AgentState = "idle" | "thinking" | "searching" | "reading" | "writing" | "calling" | "testing" | "finished" | "error";

export interface ExecutionState {
	status: AgentState;
	phase: import("../types.js").AgentExecutionPhase;
	isRunning: boolean;
	inputTokens: number;
	outputTokens: number;
	totalCost: number;
	durationMs: number;
	contextTokens: number;
	contextMaxTokens: number;
	compacted: boolean;
}

export class ExecutionStoreClass extends BaseStore<ExecutionState> {
	private startTime = 0;
	private intervalId: any = null;

	constructor() {
		super({
			status: "idle",
			phase: "idle",
			isRunning: false,
			inputTokens: 0,
			outputTokens: 0,
			totalCost: 0,
			durationMs: 0,
			contextTokens: 0,
			contextMaxTokens: 128000,
			compacted: false,
		});

		this.unsubs.push(
			AgentEventBus.subscribe("session_started", () => {
				this.startTime = Date.now();
				this.setState({
					status: "thinking",
					phase: "starting",
					isRunning: true,
					durationMs: 0,
					compacted: false,
				});
				this.startTimer();
			}),
			AgentEventBus.subscribe("execution_started", () => {
				this.startTime = Date.now();
				this.setState({
					status: "thinking",
					phase: "starting",
					isRunning: true,
					durationMs: 0,
				});
				this.startTimer();
			}),
			AgentEventBus.subscribe("user_message_sent", () => {
				this.startTime = Date.now();
				this.setState({ isRunning: true, phase: "starting", status: "thinking" });
				this.startTimer();
			}),
			AgentEventBus.subscribe("assistant_delta", () => {
				this.setState({ status: "thinking", phase: "streaming", isRunning: true });
			}),
			AgentEventBus.subscribe("reasoning_delta", () => {
				this.setState({ status: "thinking", phase: "streaming", isRunning: true });
			}),
			AgentEventBus.subscribe("usage", (data: UsageData | { usage?: UsageData }) => {
				const usage = "usage" in data && data.usage ? data.usage : (data as UsageData);
				const inputTokens = usage.inputTokens ?? this.state.inputTokens;
				const outputTokens = usage.outputTokens ?? this.state.outputTokens;
				const totalCost = usage.totalCost ?? this.state.totalCost;
				const contextTokens = typeof inputTokens === "number" && typeof outputTokens === "number"
					? inputTokens + outputTokens
					: inputTokens ?? this.state.contextTokens;
				this.setState({ inputTokens, outputTokens, totalCost, contextTokens });
			}),
			AgentEventBus.subscribe("tool_event", (data: { text: string; event?: ToolEventData }) => {
				if (data.event) {
					const name = (data.event.name || "").toLowerCase();
					let status: AgentState = "calling";
					if (data.event.state === "running") {
						if (name.includes("search") || name.includes("grep") || name.includes("glob") || name.includes("list_dir")) {
							status = "searching";
						} else if (name.includes("read")) {
							status = "reading";
						} else if (name.includes("write") || name.includes("edit") || name.includes("replace") || name.includes("patch")) {
							status = "writing";
						} else if (name.includes("test")) {
							status = "testing";
						}
						this.setState({ status, phase: "executing_tools", isRunning: true });
					}
				}
			}),
			AgentEventBus.subscribe("approval_request", () => {
				this.setState({ phase: "waiting_approval", isRunning: true });
			}),
			AgentEventBus.subscribe("turn_done", (data: { finishReason: string; iterations: number; usage?: UsageData }) => {
				this.stopTimer();
				const isCancelled = data.finishReason === "aborted" || data.finishReason === "cancelled";
				const isError = data.finishReason === "error" || data.finishReason === "failed";
				const status: AgentState = isError ? "error" : isCancelled ? "idle" : "finished";
				const phase: import("../types.js").AgentExecutionPhase = isCancelled ? "cancelled" : isError ? "error" : "completed";
				const inputTokens = data.usage?.inputTokens ?? this.state.inputTokens;
				const outputTokens = data.usage?.outputTokens ?? this.state.outputTokens;
				const totalCost = data.usage?.totalCost ?? this.state.totalCost;
				const contextTokens = typeof inputTokens === "number" && typeof outputTokens === "number"
					? inputTokens + outputTokens
					: inputTokens ?? this.state.contextTokens;

				this.setState({
					status,
					phase,
					isRunning: false,
					inputTokens,
					outputTokens,
					totalCost,
					contextTokens,
				});
			}),
			AgentEventBus.subscribe("reset_done", () => {
				this.stopTimer();
				this.setState({
					status: "idle",
					phase: "idle",
					isRunning: false,
					inputTokens: 0,
					outputTokens: 0,
					totalCost: 0,
					durationMs: 0,
					contextTokens: 0,
					compacted: false,
				});
			}),
			AgentEventBus.subscribe("error_occurred", () => {
				this.stopTimer();
				this.setState({ status: "error", phase: "error", isRunning: false });
			}),
			AgentEventBus.subscribe("status", (data: { text: string }) => {
				if (data.text && (data.text.includes("compaction") || data.text.includes("compacted"))) {
					this.setState({ compacted: true });
				}
			}),
		);
	}

	updateContextWindow(maxTokens: number) {
		if (this.state.contextMaxTokens !== maxTokens) {
			this.setState({ contextMaxTokens: maxTokens });
		}
	}

	private startTimer() {
		if (this.intervalId) clearInterval(this.intervalId);
		this.intervalId = setInterval(() => {
			if (this.startTime > 0 && this.state.isRunning) {
				this.setState({ durationMs: Date.now() - this.startTime });
			}
		}, 1000);
	}

	private stopTimer() {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	dispose(): void {
		this.stopTimer();
		super.dispose();
	}
}

export const ExecutionStore = new ExecutionStoreClass();

// ==========================================
// ToolExecutionStore: Approvals, progress, recovery
// ==========================================
export interface ToolExecutionState {
	pendingApproval: ApprovalRequest | null;
	toolProgress: { toolName: string; progressPercent: number; details?: string } | null;
	lastToolError: { toolName: string; message: string; stack?: string } | null;
	autoApproveRules: Record<string, boolean>;
}

export class ToolExecutionStoreClass extends BaseStore<ToolExecutionState> {
	constructor() {
		super({
			pendingApproval: null,
			toolProgress: null,
			lastToolError: null,
			autoApproveRules: {
				write: true,
				read: true,
				read_out_of_workspace: false,
				write_out_of_workspace: false,
				mcp: true,
				mode: true,
				subtasks: true,
				execute: false,
				questions: false,
			},
		});

		this.unsubs.push(
			AgentEventBus.subscribe("approval_request", (data: ApprovalRequest) => {
				this.setState({ pendingApproval: data });
			}),
			AgentEventBus.subscribe("approval_resolved", () => {
				this.setState({ pendingApproval: null });
			}),
			AgentEventBus.subscribe("tool_event", (data: { text: string; event?: ToolEventData }) => {
				if (data.event) {
					const te = data.event;
					if (te.state === "completed" || te.state === "output-available") {
						this.setState({ toolProgress: null });
					} else if (te.state === "running") {
						this.setState({
							toolProgress: {
								toolName: te.name || "Tool",
								progressPercent: 30,
								details: data.text || "Executing...",
							},
							lastToolError: null,
						});
					} else if (te.state === "failed" || te.state === "output-error") {
						this.setState({
							toolProgress: null,
							lastToolError: {
								toolName: te.name || "Tool",
								message: te.error || "Unknown tool execution failure",
							},
						});
					}
				}
			}),
			AgentEventBus.subscribe("reset_done", () => {
				this.setState({ pendingApproval: null, toolProgress: null, lastToolError: null });
			}),
		);
	}

	clearApproval() {
		this.setState({ pendingApproval: null });
	}

	updateAutoApproveRules(rules: Record<string, boolean>) {
		this.setState({ autoApproveRules: { ...this.state.autoApproveRules, ...rules } });
	}

	clearToolError() {
		this.setState({ lastToolError: null });
	}

	updateToolProgress(toolName: string, progressPercent: number, details?: string) {
		this.setState({ toolProgress: { toolName, progressPercent, details } });
	}
}

export const ToolExecutionStore = new ToolExecutionStoreClass();

// Custom hook to subscribe and read state from any store
export function useStore<T>(store: { getState: () => T; subscribe: (l: (state: T) => void) => () => void }): T {
	const [state, setState] = useState(store.getState());
	useEffect(() => {
		const unsubscribe = store.subscribe((nextState) => {
			setState(nextState);
		});
		return unsubscribe;
	}, [store]);
	return state;
}
