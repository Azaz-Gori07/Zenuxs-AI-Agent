import { createContext, useContext, useReducer, useCallback, useEffect, useRef, type ReactNode } from "react";
import { postMessage } from "../vscode-api.js";
import type { AppState, ExtensionMessage, TabId, AgentMode, CompactionStrategy, ApprovalKey } from "../types.js";
import { AgentEventBus } from "./stores.js";

const buildAutoDefaults = (): Record<ApprovalKey, boolean> => {
	const out: Record<ApprovalKey, boolean> = {
		write: true,
		read: true,
		read_out_of_workspace: false,
		write_out_of_workspace: false,
		mcp: true,
		mode: true,
		subtasks: true,
		execute: false,
		questions: false,
	};
	return out;
};

const initialState: AppState = {
	providers: [],
	models: {},
	currentConfig: { providerId: "cline", modelId: "", apiKey: "", baseUrl: "", autoApproveTools: true, thinking: false, reasoningEffort: "none", maxIterations: 100, mode: "act", compaction: "off", retries: 3, timeout: 0, checkpointEnabled: false },
	toggles: { workflows: [], rules: [], skills: [], tools: [], mcp: [] },
	sessionHistories: [],
	dashboardData: { totalCost: 0, totalRequests: 0, inputTokens: 0, outputTokens: 0, providerBreakdown: {}, modelBreakdown: {}, toolBreakdown: {} },
	messages: [],
	activeSessionId: null,
	isRunning: false,
	usage: null,
	pendingApproval: null,
	logs: ["System logs initialized..."],
	activeTab: "chat",
	mcpServers: [],
	checkpoints: [],
	toast: null,
	teamStatus: null,
	teamRuns: [],
	teamTasks: [],
	connectors: [],
	autoApprovals: buildAutoDefaults(),
};

type Action =
	| { type: "SET_INITIAL_DATA"; payload: Partial<AppState> }
	| { type: "APPEND_ASSISTANT_TEXT"; text: string }
	| { type: "APPEND_REASONING"; text: string }
	| { type: "UPDATE_TOOL_EVENT"; text: string; event?: import("../types.js").ToolEventData }
	| { type: "SET_APPROVAL_REQUEST"; payload: import("../types.js").ApprovalRequest }
	| { type: "CLEAR_APPROVAL" }
	| { type: "SET_APPROVAL_RESOLVED"; approvalId: string; approved: boolean; reason?: string }
	| { type: "SET_TURN_DONE"; finishReason: string; iterations: number; usage?: import("../types.js").UsageData }
	| { type: "SET_SESSION_STARTED"; sessionId: string }
	| { type: "HYDRATE_SESSION"; sessionId: string; messages: import("../types.js").ChatMessage[] }
	| { type: "RESET_SESSION" }
	| { type: "ADD_USER_MESSAGE"; text: string }
	| { type: "ADD_ERROR"; text: string }
	| { type: "SET_RUNNING"; isRunning: boolean }
	| { type: "ADD_LOG"; text: string }
	| { type: "CLEAR_LOGS" }
	| { type: "SET_TAB"; tab: TabId }
	| { type: "UPDATE_CONFIG"; config: Partial<import("../types.js").ExtensionConfig> }
	| { type: "SET_HISTORIES"; histories: import("../types.js").SessionHistory[] }
	| { type: "SET_TOGGLES"; toggles: import("../types.js").Toggles }
	| { type: "UPDATE_DASHBOARD"; data: import("../types.js").DashboardData }
	| { type: "SET_MCP_SERVERS"; servers: import("../types.js").McpServerEntry[] }
	| { type: "SET_CHECKPOINTS"; sessionId: string; checkpoints: import("../types.js").CheckpointEntry[] }
	| { type: "SHOW_TOAST"; message: string; severity: "info" | "success" | "error" }
	| { type: "DISMISS_TOAST" }
	| { type: "SET_TEAM_STATUS"; data: import("../types.js").TeamStatusData }
	| { type: "SET_TEAM_RUNS"; runs: import("../types.js").TeamRunEntry[] }
	| { type: "SET_TEAM_TASKS"; tasks: import("../types.js").TeamTaskEntry[] }
	| { type: "ADD_TEAM_MEMBER"; agentId: string }
	| { type: "REMOVE_TEAM_MEMBER"; agentId: string }
	| { type: "SET_CONNECTORS"; connectors: import("../types.js").ConnectorStatus[] }
	| { type: "SET_AUTO_APPROVALS"; autoApprovals: Record<ApprovalKey, boolean> };

function reducer(state: AppState, action: Action): AppState {
	switch (action.type) {
		case "SET_INITIAL_DATA":
			return { ...state, ...action.payload, mcpServers: (action.payload as any).mcpServers || state.mcpServers, checkpoints: (action.payload as any).checkpoints || state.checkpoints };
		case "APPEND_ASSISTANT_TEXT": {
			const msgs = [...state.messages];
			const last = msgs[msgs.length - 1];
			if (last && last.role === "assistant") msgs[msgs.length - 1] = { ...last, text: last.text + action.text };
			else msgs.push({ role: "assistant", text: action.text });
			return { ...state, messages: msgs };
		}
		case "APPEND_REASONING": {
			const msgs = [...state.messages];
			const last = msgs[msgs.length - 1];
			if (last && last.role === "assistant") msgs[msgs.length - 1] = { ...last, reasoning: (last.reasoning || "") + action.text };
			else msgs.push({ role: "assistant", text: "", reasoning: action.text });
			return { ...state, messages: msgs };
		}
		case "UPDATE_TOOL_EVENT": {
			const msgs = [...state.messages];
			const last = msgs[msgs.length - 1];
			if (last && last.role === "assistant") {
				const events = [...(last.toolEvents || [])];
				if (action.event) {
					const idx = events.findIndex((e) => e.id === action.event?.id);
					if (idx >= 0) events[idx] = { ...events[idx], ...action.event };
					else events.push(action.event);
				}
				msgs[msgs.length - 1] = { ...last, toolEvents: events };
			} else msgs.push({ role: "assistant", text: "", toolEvents: action.event ? [action.event] : [] });
			return { ...state, messages: msgs };
		}
		case "SET_APPROVAL_REQUEST": return { ...state, pendingApproval: action.payload };
		case "CLEAR_APPROVAL": return { ...state, pendingApproval: null };
		case "SET_APPROVAL_RESOLVED": return state.pendingApproval?.approvalId === action.approvalId ? { ...state, pendingApproval: null } : state;
		case "SET_TURN_DONE": return { ...state, isRunning: false, usage: action.usage ?? state.usage };
		case "SET_SESSION_STARTED": return { ...state, activeSessionId: action.sessionId, isRunning: true };
		case "HYDRATE_SESSION": return { ...state, activeSessionId: action.sessionId, messages: action.messages, isRunning: false };
		case "RESET_SESSION": return { ...state, messages: [], activeSessionId: null, isRunning: false, usage: null, pendingApproval: null, activeTab: "chat" };
		case "ADD_USER_MESSAGE": return { ...state, messages: [...state.messages, { role: "user", text: action.text }], isRunning: true };
		case "ADD_ERROR": return { ...state, messages: [...state.messages, { role: "error", text: action.text }], isRunning: false };
		case "SET_RUNNING": return { ...state, isRunning: action.isRunning };
		case "ADD_LOG": return { ...state, logs: [...state.logs, `[${new Date().toLocaleTimeString()}] ${action.text}`] };
		case "CLEAR_LOGS": return { ...state, logs: ["System logs cleared..."] };
		case "SET_TAB":
			if (state.activeTab === action.tab && (action.tab === "settings" || action.tab === "history")) {
				return { ...state, activeTab: "chat" };
			}
			return { ...state, activeTab: action.tab };
		case "UPDATE_CONFIG": return { ...state, currentConfig: { ...state.currentConfig, ...action.config } };
		case "SET_HISTORIES": return { ...state, sessionHistories: action.histories };
		case "SET_TOGGLES": return { ...state, toggles: action.toggles };
		case "UPDATE_DASHBOARD": return { ...state, dashboardData: action.data };
		case "SET_MCP_SERVERS": return { ...state, mcpServers: action.servers };
		case "SET_CHECKPOINTS": return { ...state, checkpoints: action.checkpoints };
		case "SHOW_TOAST": return { ...state, toast: { message: action.message, severity: action.severity } };
		case "DISMISS_TOAST": return { ...state, toast: null };
		case "SET_TEAM_STATUS": return { ...state, teamStatus: action.data };
		case "SET_TEAM_RUNS": return { ...state, teamRuns: action.runs };
		case "SET_TEAM_TASKS": return { ...state, teamTasks: action.tasks };
		case "ADD_TEAM_MEMBER": return state.teamStatus ? { ...state, teamStatus: { ...state.teamStatus, members: [...state.teamStatus.members, { agentId: action.agentId, role: "teammate" as const, status: "idle" as const }] } } : state;
		case "REMOVE_TEAM_MEMBER": return state.teamStatus ? { ...state, teamStatus: { ...state.teamStatus, members: state.teamStatus.members.filter(m => m.agentId !== action.agentId) } } : state;
		case "SET_CONNECTORS": return { ...state, connectors: action.connectors };
		case "SET_AUTO_APPROVALS": return { ...state, autoApprovals: action.autoApprovals };
		default: return state;
	}
}

interface ExtensionStateContextValue {
	state: AppState;
	dispatch: React.Dispatch<Action>;
	sendMessage: (prompt: string, config?: Record<string, unknown>) => void;
	abort: () => void;
	newSession: () => void;
	saveSettings: (settings: {
		providerId: string; modelId: string; apiKey?: string; baseUrl?: string;
		autoApproveTools: boolean; thinking: boolean; reasoningEffort: string;
		maxIterations: number; mode?: AgentMode; compaction?: CompactionStrategy; retries?: number;
		timeout?: number; checkpointEnabled?: boolean;
		autoApprovals?: Record<string, boolean>;
	}) => void;
	toggleItem: (itemType: string, id: string | undefined, name: string | undefined, path: string | undefined, enabled: boolean) => void;
	deleteSession: (sessionId: string) => void;
	renameSession: (sessionId: string, title: string) => void;
	restoreSession: (sessionId: string) => void;
	exportSession: (sessionId: string) => void;
	importSession: () => void;
	runCommand: (command: string) => void;
	approveTool: (approvalId: string, approved: boolean, reason?: string) => void;
	attachFile: () => void;
	clearHistory: () => void;
	loginOAuth: (providerId: string) => void;
	switchTab: (tab: TabId) => void;
	registerMcpServer: (name: string, transport: string, command?: string, args?: string[], url?: string) => void;
	unregisterMcpServer: (name: string) => void;
	connectMcpServer: (name: string) => void;
	disconnectMcpServer: (name: string) => void;
	setMcpServerDisabled: (name: string, disabled: boolean) => void;
	refreshMcpTools: (serverName: string) => void;
	listMcpServers: () => void;
	restoreCheckpoint: (sessionId: string, checkpointRef: string) => void;
	listCheckpoints: (sessionId: string) => void;
	deleteCheckpoint: (sessionId: string, checkpointRef: string) => void;
	spawnTeammate: (agentId: string, rolePrompt: string) => void;
	shutdownTeammate: (agentId: string, reason?: string) => void;
	getTeamStatus: () => void;
	runTeamTask: (agentId: string, task: string, runMode?: "sync" | "async") => void;
	listTeamRuns: () => void;
	cancelTeamRun: (runId: string) => void;
	sendTeamMessage: (toAgentId: string, subject: string, body: string) => void;
	broadcastTeamMessage: (subject: string, body: string) => void;
	readTeamMailbox: () => void;
	addTeamMissionLog: (kind: string, summary: string) => void;
	listTeamTasks: () => void;
	createTeamTask: (title: string, description: string, assignee?: string) => void;
	completeTeamTask: (taskId: string, summary: string) => void;
	listConnectors: () => void;
	connectConnector: (provider: string, name: string, config?: Record<string, string>) => void;
	disconnectConnector: (id: string) => void;
}

const ExtensionStateContext = createContext<ExtensionStateContextValue | null>(null);

export function ExtensionStateProvider({ children }: { children: ReactNode }) {
	const [state, dispatch] = useReducer(reducer, initialState);
	const stateRef = useRef(state);
	stateRef.current = state;

	useEffect(() => {
		(window as any).logStartup?.("WEBVIEW", state.activeSessionId || "None", "React", "ExtensionStateProvider_mount", "EVENT", "N/A", "SUCCESS");
	}, []);

	const handleMessage = useCallback((event: MessageEvent<ExtensionMessage>) => {
		const msg = event.data;
		if (!msg || typeof msg !== "object") {
			return;
		}
		AgentEventBus.publish(msg.type, msg);

		switch (msg.type) {
			case "initial_data":
				if (typeof window !== "undefined") {
					(window as any).logStartup?.("WEBVIEW", stateRef.current.activeSessionId || "None", "React", "handleMessage_initial_data", "EVENT", "N/A", "RECEIVED");
				}
				dispatch({ type: "SET_INITIAL_DATA", payload: { providers: msg.providers, models: msg.models, currentConfig: msg.currentConfig, toggles: msg.toggles, sessionHistories: msg.sessionHistories, dashboardData: msg.dashboard || calculateFallback(msg.sessionHistories), mcpServers: (msg as any).mcpServers || [], checkpoints: (msg as any).checkpoints || [] } });
				if ((msg as any).autoApprovals) {
					dispatch({ type: "SET_AUTO_APPROVALS", autoApprovals: (msg as any).autoApprovals });
				}
				if (typeof window !== "undefined") {
					(window as any).logStartup?.("WEBVIEW", stateRef.current.activeSessionId || "None", "React", "dispatch_initial_data", "EVENT", "N/A", "DISPATCHED");
				}
				break;
			case "assistant_delta": dispatch({ type: "APPEND_ASSISTANT_TEXT", text: msg.text }); break;
			case "reasoning_delta": dispatch({ type: "APPEND_REASONING", text: msg.text }); break;
			case "tool_event": dispatch({ type: "UPDATE_TOOL_EVENT", text: msg.text, event: msg.event }); break;
			case "approval_request": dispatch({ type: "SET_APPROVAL_REQUEST", payload: msg }); break;
			case "approval_resolved": dispatch({ type: "SET_APPROVAL_RESOLVED", approvalId: msg.approvalId, approved: msg.approved, reason: msg.reason }); break;
			case "turn_done": dispatch({ type: "SET_TURN_DONE", finishReason: msg.finishReason, iterations: msg.iterations, usage: msg.usage }); break;
			case "session_started": dispatch({ type: "SET_SESSION_STARTED", sessionId: msg.sessionId }); break;
			case "session_hydrated": dispatch({ type: "HYDRATE_SESSION", sessionId: msg.sessionId, messages: msg.messages }); break;
			case "reset_done": dispatch({ type: "RESET_SESSION" }); break;
			case "error": dispatch({ type: "ADD_ERROR", text: msg.text }); dispatch({ type: "ADD_LOG", text: `Error: ${msg.text}` }); AgentEventBus.publish("error_occurred", { text: msg.text }); break;
			case "status": dispatch({ type: "ADD_LOG", text: msg.text }); break;
			case "logs_stream": dispatch({ type: "ADD_LOG", text: msg.text }); break;
			case "switch_tab": dispatch({ type: "SET_TAB", tab: msg.tab.replace("-tab", "") as TabId }); break;
			case "models": dispatch({ type: "SET_INITIAL_DATA", payload: { models: { ...stateRef.current.models, [msg.providerId]: msg.models.map((m: any) => typeof m === "string" ? m : m.id || m.name || String(m)) } } }); break;
			case "mcp_servers": dispatch({ type: "SET_MCP_SERVERS", servers: msg.servers }); break;
			case "checkpoint_list": dispatch({ type: "SET_CHECKPOINTS", sessionId: msg.sessionId, checkpoints: msg.checkpoints }); break;
			case "checkpoint_restored": dispatch({ type: "ADD_LOG", text: `Checkpoint restored: ${msg.sessionId}` }); break;
			case "toast": dispatch({ type: "SHOW_TOAST", message: msg.message, severity: msg.severity || "info" }); setTimeout(() => dispatch({ type: "DISMISS_TOAST" }), 3000); break;
			case "team_status": dispatch({ type: "SET_TEAM_STATUS", data: msg.data }); break;
			case "team_runs": dispatch({ type: "SET_TEAM_RUNS", runs: msg.runs }); break;
			case "team_tasks": dispatch({ type: "SET_TEAM_TASKS", tasks: msg.tasks }); break;
			case "team_teammate_spawned": dispatch({ type: "ADD_TEAM_MEMBER", agentId: msg.agentId }); break;
			case "team_teammate_shutdown": dispatch({ type: "REMOVE_TEAM_MEMBER", agentId: msg.agentId }); break;
			case "connector_status": dispatch({ type: "SET_CONNECTORS", connectors: msg.connectors }); break;
		}
	}, []);

	useEffect(() => {
		window.addEventListener("message", handleMessage);
		if (typeof window !== "undefined") {
			(window as any).logStartup?.("WEBVIEW", stateRef.current.activeSessionId || "None", "React", "ready_message_sent", "EVENT", "N/A", "START");
		}
		postMessage({ type: "ready" });
		return () => window.removeEventListener("message", handleMessage);
	}, [handleMessage]);

	const actions = {
		sendMessage: (prompt: string, config?: Record<string, unknown>) => { dispatch({ type: "ADD_USER_MESSAGE", text: prompt }); AgentEventBus.publish("user_message_sent", { text: prompt }); postMessage({ type: "send", prompt, config }); },
		abort: () => { dispatch({ type: "SET_RUNNING", isRunning: false }); postMessage({ type: "abort" }); },
		newSession: () => { dispatch({ type: "RESET_SESSION" }); postMessage({ type: "new_session" }); },
		saveSettings: (settings: Parameters<ExtensionStateContextValue["saveSettings"]>[0]) => { dispatch({ type: "UPDATE_CONFIG", config: settings as any }); postMessage({ type: "save_settings", ...settings }); },
		toggleItem: (itemType: string, id: string | undefined, name: string | undefined, path: string | undefined, enabled: boolean) => postMessage({ type: "toggle_setting_item", itemType, id, name, path, enabled }),
		deleteSession: (sessionId: string) => postMessage({ type: "delete_session", sessionId }),
		renameSession: (sessionId: string, title: string) => postMessage({ type: "rename_session", sessionId, title }),
		restoreSession: (sessionId: string) => { postMessage({ type: "restore_session", sessionId }); dispatch({ type: "SET_TAB", tab: "chat" }); },
		exportSession: (sessionId: string) => postMessage({ type: "export_session", sessionId }),
		importSession: () => postMessage({ type: "import_session" }),
		runCommand: (command: string) => postMessage({ type: "run_command", command }),
		approveTool: (approvalId: string, approved: boolean, reason?: string) => { postMessage({ type: "approval_response", approvalId, approved, reason }); dispatch({ type: "CLEAR_APPROVAL" }); },
		attachFile: () => postMessage({ type: "askAboutFile" }),
		clearHistory: () => postMessage({ type: "clear_history" }),
		loginOAuth: (providerId: string) => postMessage({ type: "login_oauth", providerId }),
		switchTab: (tab: TabId) => dispatch({ type: "SET_TAB", tab }),
		registerMcpServer: (name: string, transport: string, command?: string, args?: string[], url?: string) => postMessage({ type: "mcp_register", name, transport, command, args, url }),
		unregisterMcpServer: (name: string) => postMessage({ type: "mcp_unregister", name }),
		connectMcpServer: (name: string) => postMessage({ type: "mcp_connect", name }),
		disconnectMcpServer: (name: string) => postMessage({ type: "mcp_disconnect", name }),
		setMcpServerDisabled: (name: string, disabled: boolean) => postMessage({ type: "mcp_set_disabled", name, disabled }),
		refreshMcpTools: (serverName: string) => postMessage({ type: "mcp_refresh_tools", serverName }),
		listMcpServers: () => postMessage({ type: "mcp_list_servers" }),
		restoreCheckpoint: (sessionId: string, checkpointRef: string) => postMessage({ type: "checkpoint_restore", sessionId, checkpointRef }),
		listCheckpoints: (sessionId: string) => postMessage({ type: "checkpoint_list", sessionId }),
		deleteCheckpoint: (sessionId: string, checkpointRef: string) => postMessage({ type: "checkpoint_delete", sessionId, checkpointRef }),
		spawnTeammate: (agentId: string, rolePrompt: string) => postMessage({ type: "team_spawn", agentId, rolePrompt }),
		shutdownTeammate: (agentId: string, reason?: string) => postMessage({ type: "team_shutdown", agentId, reason }),
		getTeamStatus: () => postMessage({ type: "team_status" }),
		runTeamTask: (agentId: string, task: string, runMode?: "sync" | "async") => postMessage({ type: "team_run_task", agentId, task, runMode }),
		listTeamRuns: () => postMessage({ type: "team_list_runs" }),
		cancelTeamRun: (runId: string) => postMessage({ type: "team_cancel_run", runId }),
		sendTeamMessage: (toAgentId: string, subject: string, body: string) => postMessage({ type: "team_send_message", toAgentId, subject, body }),
		broadcastTeamMessage: (subject: string, body: string) => postMessage({ type: "team_broadcast", subject, body }),
		readTeamMailbox: () => postMessage({ type: "team_read_mailbox" }),
		addTeamMissionLog: (kind: string, summary: string) => postMessage({ type: "team_mission_log", kind, summary }),
		listTeamTasks: () => postMessage({ type: "team_list_tasks" }),
		createTeamTask: (title: string, description: string, assignee?: string) => postMessage({ type: "team_create_task", title, description, assignee }),
		completeTeamTask: (taskId: string, summary: string) => postMessage({ type: "team_complete_task", taskId, summary }),
		listConnectors: () => postMessage({ type: "connector_list" }),
		connectConnector: (provider: string, name: string, config?: Record<string, string>) => postMessage({ type: "connector_connect", provider, name, config }),
		disconnectConnector: (id: string) => postMessage({ type: "connector_disconnect", id }),
	};

	return (
		<ExtensionStateContext.Provider value={{ state, dispatch, ...actions }}>
			{children}
		</ExtensionStateContext.Provider>
	);
}

export function useExtensionState(): ExtensionStateContextValue {
	const ctx = useContext(ExtensionStateContext);
	if (!ctx) throw new Error("useExtensionState must be used within ExtensionStateProvider");
	return ctx;
}

function calculateFallback(histories: import("../types.js").SessionHistory[]): import("../types.js").DashboardData {
	let totalCost = 0;
	const providerBreakdown: Record<string, number> = {};
	const modelBreakdown: Record<string, number> = {};
	const toolBreakdown: Record<string, number> = {};
	let inputTokens = 0, outputTokens = 0;
	if (Array.isArray(histories)) {
		for (const s of histories) {
			totalCost += s.metadata?.totalCost || 0;
			inputTokens += s.metadata?.usage?.inputTokens || s.metadata?.aggregateUsage?.inputTokens || 0;
			outputTokens += s.metadata?.usage?.outputTokens || s.metadata?.aggregateUsage?.outputTokens || 0;
			if (s.provider) providerBreakdown[s.provider] = (providerBreakdown[s.provider] || 0) + 1;
			if (s.model) modelBreakdown[s.model] = (modelBreakdown[s.model] || 0) + 1;
		}
	}
	return { totalCost, totalRequests: Array.isArray(histories) ? histories.length : 0, inputTokens, outputTokens, providerBreakdown, modelBreakdown, toolBreakdown };
}
