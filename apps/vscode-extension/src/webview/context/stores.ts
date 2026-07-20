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

	constructor(initialState: State) {
		this.state = initialState;
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

		// Listen for connection states and checkpoint info
		AgentEventBus.subscribe("session_started", (data: { sessionId: string }) => {
			this.setState({ activeSessionId: data.sessionId, connected: true, memoryLoaded: true });
		});

		AgentEventBus.subscribe("session_hydrated", (data: { sessionId: string }) => {
			this.setState({ activeSessionId: data.sessionId, connected: true, memoryLoaded: true });
		});

		AgentEventBus.subscribe("reset_done", () => {
			this.setState({ activeSessionId: null, checkpoints: [], memoryLoaded: false });
		});

		AgentEventBus.subscribe("checkpoint_list", (data: { sessionId: string; checkpoints: CheckpointEntry[] }) => {
			if (this.state.activeSessionId === data.sessionId) {
				this.setState({ checkpoints: data.checkpoints });
			}
		});

		AgentEventBus.subscribe("mcp_servers", (data: { servers: McpServerEntry[] }) => {
			this.setState({ mcpServers: data.servers });
		});
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

		AgentEventBus.subscribe("assistant_delta", (data: { text: string }) => {
			const msgs = [...this.state.messages];
			const last = msgs[msgs.length - 1];
			if (last && last.role === "assistant") {
				msgs[msgs.length - 1] = { ...last, text: last.text + data.text };
			} else {
				msgs.push({ role: "assistant", text: data.text });
			}
			this.setState({ messages: msgs });
		});

		AgentEventBus.subscribe("reasoning_delta", (data: { text: string }) => {
			const msgs = [...this.state.messages];
			const last = msgs[msgs.length - 1];
			if (last && last.role === "assistant") {
				msgs[msgs.length - 1] = { ...last, reasoning: (last.reasoning || "") + data.text };
			} else {
				msgs.push({ role: "assistant", text: "", reasoning: data.text });
			}
			this.setState({ messages: msgs });
		});

		AgentEventBus.subscribe("tool_event", (data: { text: string; event?: ToolEventData }) => {
			const msgs = [...this.state.messages];
			const last = msgs[msgs.length - 1];
			const eventText = data.text;
			const ops = [...this.state.recentOperations];
			if (eventText) {
				ops.push(eventText);
				if (ops.length > 50) ops.shift();
			}

			if (last && last.role === "assistant") {
				const events = [...(last.toolEvents || [])];
				if (data.event) {
					const idx = events.findIndex((e) => e.id === data.event?.id);
					if (idx >= 0) {
						events[idx] = { ...events[idx], ...data.event };
					} else {
						events.push(data.event);
					}
				}
				msgs[msgs.length - 1] = { ...last, toolEvents: events };
			} else {
				msgs.push({
					role: "assistant",
					text: "",
					toolEvents: data.event ? [data.event] : [],
				});
			}
			this.setState({ messages: msgs, recentOperations: ops });
		});

		AgentEventBus.subscribe("session_hydrated", (data: { messages: ChatMessage[] }) => {
			this.setState({ messages: data.messages });
		});

		AgentEventBus.subscribe("reset_done", () => {
			this.setState({ messages: [], recentOperations: [] });
		});

		AgentEventBus.subscribe("user_message_sent", (data: { text: string }) => {
			this.setState({
				messages: [...this.state.messages, { role: "user", text: data.text }],
			});
		});

		AgentEventBus.subscribe("error_occurred", (data: { text: string }) => {
			this.setState({
				messages: [...this.state.messages, { role: "error", text: data.text }],
			});
		});
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
			isRunning: false,
			inputTokens: 0,
			outputTokens: 0,
			totalCost: 0,
			durationMs: 0,
			contextTokens: 0,
			contextMaxTokens: 128000,
			compacted: false,
		});

		AgentEventBus.subscribe("session_started", () => {
			this.startTime = Date.now();
			this.setState({
				status: "thinking",
				isRunning: true,
				durationMs: 0,
				compacted: false,
			});
			this.startTimer();
		});

		AgentEventBus.subscribe("user_message_sent", () => {
			this.startTime = Date.now();
			this.setState({ isRunning: true, status: "thinking" });
			this.startTimer();
		});

		AgentEventBus.subscribe("assistant_delta", () => {
			this.setState({ status: "thinking" });
		});

		AgentEventBus.subscribe("reasoning_delta", () => {
			this.setState({ status: "thinking" });
		});

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
					this.setState({ status });
				}
			}
		});

		AgentEventBus.subscribe("turn_done", (data: { finishReason: string; iterations: number; usage?: UsageData }) => {
			this.stopTimer();
			const status: AgentState = data.finishReason === "error" || data.finishReason === "failed" ? "error" : "finished";
			const inputTokens = data.usage?.inputTokens || this.state.inputTokens;
			const outputTokens = data.usage?.outputTokens || this.state.outputTokens;
			const totalCost = data.usage?.totalCost || this.state.totalCost;

			// Estimate context tokens based on input tokens if not explicitly given
			const contextTokens = inputTokens;

			this.setState({
				status,
				isRunning: false,
				inputTokens,
				outputTokens,
				totalCost,
				contextTokens,
			});
		});

		AgentEventBus.subscribe("reset_done", () => {
			this.stopTimer();
			this.setState({
				status: "idle",
				isRunning: false,
				inputTokens: 0,
				outputTokens: 0,
				totalCost: 0,
				durationMs: 0,
				contextTokens: 0,
				compacted: false,
			});
		});

		AgentEventBus.subscribe("error_occurred", () => {
			this.stopTimer();
			this.setState({ status: "error", isRunning: false });
		});

		// Listen to status update events that might contain compaction info
		AgentEventBus.subscribe("status", (data: { text: string }) => {
			if (data.text && (data.text.includes("compaction") || data.text.includes("compacted"))) {
				this.setState({ compacted: true });
			}
		});
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

		AgentEventBus.subscribe("approval_request", (data: ApprovalRequest) => {
			this.setState({ pendingApproval: data });
		});

		AgentEventBus.subscribe("approval_resolved", () => {
			this.setState({ pendingApproval: null });
		});

		AgentEventBus.subscribe("tool_event", (data: { text: string; event?: ToolEventData }) => {
			if (data.event) {
				const te = data.event;
				// Clean up progress on tool completion
				if (te.state === "completed" || te.state === "output-available") {
					this.setState({ toolProgress: null });
				} else if (te.state === "running") {
					// Guess some progress for running tools
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
		});

		AgentEventBus.subscribe("reset_done", () => {
			this.setState({ pendingApproval: null, toolProgress: null, lastToolError: null });
		});
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
