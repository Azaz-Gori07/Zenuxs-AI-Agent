export type TabId = "chat" | "history" | "settings" | "dashboard" | "logs" | "teams";

export type AgentMode = "act" | "plan" | "yolo" | "zen";

export type CompactionStrategy = "basic" | "agentic" | "off";

export interface ExtensionConfig {
	providerId: string;
	modelId: string;
	apiKey: string;
	baseUrl: string;
	autoApproveTools: boolean;
	thinking: boolean;
	reasoningEffort: string;
	maxIterations: number;
	mode: AgentMode;
	compaction: CompactionStrategy;
	retries: number;
	timeout: number;
	checkpointEnabled: boolean;
}

export interface ToggleItem {
	id?: string;
	name: string;
	description?: string;
	enabled: boolean;
	toggleable: boolean;
	path?: string;
}

export interface Toggles {
	workflows: ToggleItem[];
	rules: ToggleItem[];
	skills: ToggleItem[];
	tools: ToggleItem[];
	mcp: ToggleItem[];
}

export interface ChatMessage {
	role: "user" | "assistant" | "error" | "meta";
	text: string;
	reasoning?: string;
	toolEvents?: ToolEventData[];
}

export interface ToolEventData {
	id?: string;
	name?: string;
	text?: string;
	state: "running" | "completed" | "failed" | "input-available" | "output-available" | "output-error";
	input?: unknown;
	output?: unknown;
	error?: string;
}

export interface ApprovalRequest {
	approvalId: string;
	sessionId: string;
	agentId: string;
	conversationId: string;
	iteration: number;
	toolCallId: string;
	toolName: string;
	input: unknown;
}

export interface UsageData {
	inputTokens?: number;
	outputTokens?: number;
	cacheReadInputTokens?: number;
	cacheCreationInputTokens?: number;
	totalCost?: number;
}

export interface SessionHistory {
	sessionId: string;
	provider?: string;
	model?: string;
	prompt?: string;
	startedAt?: string;
	metadata?: {
		title?: string;
		totalCost?: number;
		usage?: { inputTokens?: number; outputTokens?: number };
		aggregateUsage?: { inputTokens?: number; outputTokens?: number };
	};
}

export interface DashboardData {
	totalCost: number;
	totalRequests: number;
	inputTokens: number;
	outputTokens: number;
	providerBreakdown: Record<string, number>;
	modelBreakdown: Record<string, number>;
	toolBreakdown: Record<string, number>;
}

export interface McpServerEntry {
	name: string;
	status: "disconnected" | "connecting" | "connected";
	disabled: boolean;
	lastError?: string;
	toolCount: number;
	transport: string;
}

export interface CheckpointEntry {
	ref: string;
	createdAt: number;
	runCount: number;
	kind?: "stash" | "commit";
}

export interface TeamMemberEntry {
	agentId: string;
	role: "lead" | "teammate";
	description?: string;
	status: "idle" | "running" | "stopped";
}

export interface TeamStatusData {
	teamId: string;
	teamName: string;
	members: TeamMemberEntry[];
	taskCounts: Record<string, number>;
	unreadMessages: number;
	missionLogEntries: number;
	activeRuns: number;
	queuedRuns: number;
	outcomeCounts: Record<string, number>;
}

export interface TeamRunEntry {
	id: string;
	agentId: string;
	taskId?: string;
	status: string;
	message: string;
	startedAt: string;
	endedAt?: string;
	currentActivity?: string;
	error?: string;
}

export interface TeamTaskEntry {
	id: string;
	title: string;
	description: string;
	status: string;
	createdBy: string;
	assignee?: string;
	dependsOn: string[];
}

export interface ConnectorStatus {
	id: string;
	name: string;
	provider: string;
	connected: boolean;
	lastActive?: string;
}

export type ExtensionMessage =
	| { type: "initial_data"; providers: string[]; models: Record<string, string[]>; currentConfig: ExtensionConfig; toggles: Toggles; sessionHistories: SessionHistory[]; dashboard?: DashboardData; mcpServers?: McpServerEntry[]; checkpoints?: CheckpointEntry[] }
	| { type: "assistant_delta"; text: string }
	| { type: "reasoning_delta"; text: string; redacted?: boolean }
	| { type: "tool_event"; text: string; event?: ToolEventData }
	| { type: "approval_request"; approvalId: string; sessionId: string; agentId: string; conversationId: string; iteration: number; toolCallId: string; toolName: string; input: unknown }
	| { type: "approval_resolved"; approvalId: string; approved: boolean; reason?: string }
	| { type: "turn_done"; finishReason: string; iterations: number; usage?: UsageData }
	| { type: "session_started"; sessionId: string }
	| { type: "session_hydrated"; sessionId: string; messages: ChatMessage[] }
	| { type: "error"; text: string }
	| { type: "status"; text: string }
	| { type: "logs_stream"; text: string }
	| { type: "switch_tab"; tab: string }
	| { type: "models"; providerId: string; models: unknown[] }
	| { type: "reset_done" }
	| { type: "mcp_servers"; servers: McpServerEntry[] }
	| { type: "checkpoint_list"; sessionId: string; checkpoints: CheckpointEntry[] }
	| { type: "checkpoint_restored"; sessionId: string }
	| { type: "toast"; message: string; severity?: "info" | "success" | "error" }
	| { type: "team_status"; data: TeamStatusData }
	| { type: "team_runs"; runs: TeamRunEntry[] }
	| { type: "team_tasks"; tasks: TeamTaskEntry[] }
	| { type: "team_teammate_spawned"; agentId: string }
	| { type: "team_teammate_shutdown"; agentId: string }
	| { type: "connector_status"; connectors: ConnectorStatus[] };

export type WebviewMessage =
	| { type: "ready" }
	| { type: "send"; prompt: string; config?: Record<string, unknown> }
	| { type: "abort" }
	| { type: "new_session" }
	| { type: "approval_response"; approvalId: string; approved: boolean; reason?: string }
	| { type: "save_settings"; providerId: string; modelId: string; apiKey?: string; baseUrl?: string; autoApproveTools: boolean; thinking: boolean; reasoningEffort: string; maxIterations: number; mode?: AgentMode; compaction?: CompactionStrategy; retries?: number; timeout?: number; checkpointEnabled?: boolean }
	| { type: "toggle_setting_item"; itemType: string; id?: string; name?: string; path?: string; enabled: boolean }
	| { type: "delete_session"; sessionId: string }
	| { type: "rename_session"; sessionId: string; title: string }
	| { type: "restore_session"; sessionId: string }
	| { type: "export_session"; sessionId: string }
	| { type: "import_session" }
	| { type: "run_command"; command: string }
	| { type: "askAboutFile" }
	| { type: "clear_history" }
	| { type: "login_oauth"; providerId: string }
	| { type: "mcp_register"; name: string; transport: string; command?: string; args?: string[]; url?: string }
	| { type: "mcp_unregister"; name: string }
	| { type: "mcp_connect"; name: string }
	| { type: "mcp_disconnect"; name: string }
	| { type: "mcp_set_disabled"; name: string; disabled: boolean }
	| { type: "mcp_refresh_tools"; serverName: string }
	| { type: "mcp_list_servers" }
	| { type: "checkpoint_restore"; sessionId: string; checkpointRef: string }
	| { type: "checkpoint_list"; sessionId: string }
	| { type: "checkpoint_delete"; sessionId: string; checkpointRef: string }
	| { type: "team_spawn"; agentId: string; rolePrompt: string }
	| { type: "team_shutdown"; agentId: string; reason?: string }
	| { type: "team_status" }
	| { type: "team_run_task"; agentId: string; task: string; runMode?: "sync" | "async" }
	| { type: "team_list_runs" }
	| { type: "team_cancel_run"; runId: string }
	| { type: "team_send_message"; toAgentId: string; subject: string; body: string }
	| { type: "team_broadcast"; subject: string; body: string }
	| { type: "team_read_mailbox" }
	| { type: "team_mission_log"; kind: string; summary: string }
	| { type: "team_list_tasks" }
	| { type: "team_create_task"; title: string; description: string; assignee?: string }
	| { type: "team_complete_task"; taskId: string; summary: string }
	| { type: "connector_list" }
	| { type: "connector_connect"; provider: string; name: string; config?: Record<string, string> }
	| { type: "connector_disconnect"; id: string };

export interface AppState {
	providers: string[];
	models: Record<string, string[]>;
	currentConfig: ExtensionConfig;
	toggles: Toggles;
	sessionHistories: SessionHistory[];
	dashboardData: DashboardData;
	messages: ChatMessage[];
	activeSessionId: string | null;
	isRunning: boolean;
	usage: UsageData | null;
	pendingApproval: ApprovalRequest | null;
	logs: string[];
	activeTab: TabId;
	mcpServers: McpServerEntry[];
	checkpoints: CheckpointEntry[];
	toast: { message: string; severity: "info" | "success" | "error" } | null;
	teamStatus: TeamStatusData | null;
	teamRuns: TeamRunEntry[];
	teamTasks: TeamTaskEntry[];
	connectors: ConnectorStatus[];
}
