export interface ProviderModel {
	id: string;
	name: string;
	category?: "recommended" | "free" | "paid";
	contextWindow?: number;
	pricing?: { input: number; output: number; cachedInput?: number };
	capabilities?: string[];
	supportsAttachments?: boolean;
	supportsVision?: boolean;
	supportsReasoning?: boolean;
	isFavorite?: boolean;
	recentlyUsed?: boolean;
}

export type TabId = "chat" | "history" | "settings" | "dashboard" | "logs" | "teams" | "console";

export type AgentExecutionPhase = "idle" | "starting" | "streaming" | "executing_tools" | "waiting_approval" | "completed" | "cancelled" | "error";

export type AgentMode = "act" | "plan" | "yolo" | "zen" | "ask" | "debug" | "god";

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

export interface TaskCompletionMetadata {
	timestamp?: number;
	completedAtFormatted?: string;
	durationMs?: number;
	toolsUsed?: number;
	filesModified?: number;
	inputTokens?: number;
	outputTokens?: number;
	totalCost?: number;
	model?: string;
	provider?: string;
	checkpointRef?: string;
	statusText?: string;
}

export interface ChatMessage {
	role: "user" | "assistant" | "error" | "meta" | "completion";
	text: string;
	reasoning?: string;
	toolEvents?: ToolEventData[];
	completionMetadata?: TaskCompletionMetadata;
}

export interface ToolEventData {
	id?: string;
	name?: string;
	text?: string;
	state: "running" | "completed" | "failed" | "input-available" | "output-available" | "output-error";
	input?: unknown;
	output?: unknown;
	error?: string;
	filePath?: string;
	originalContent?: string;
	newContent?: string;
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

export interface AutoApprovalPref {
	key: ApprovalKey;
	label: string;
	desc: string;
	defaultEnabled: boolean;
}

export type ApprovalKey =
	| "write"
	| "read"
	| "read_out_of_workspace"
	| "write_out_of_workspace"
	| "mcp"
	| "mode"
	| "subtasks"
	| "execute"
	| "questions";

export type ExtensionMessage =
	| { type: "initial_data"; providers: import("@cline/shared").ProviderListItem[]; models: Record<string, ProviderModel[]>; currentConfig: ExtensionConfig; toggles: Toggles; sessionHistories: SessionHistory[]; dashboard?: DashboardData; mcpServers?: McpServerEntry[]; checkpoints?: CheckpointEntry[]; autoApprovals?: Record<string, boolean>; showOnboarding?: boolean }
	| { type: "assistant_delta"; text: string }
	| { type: "reasoning_delta"; text: string; redacted?: boolean }
	| { type: "tool_event"; text: string; event?: ToolEventData }
	| { type: "approval_request"; approvalId: string; sessionId: string; agentId: string; conversationId: string; iteration: number; toolCallId: string; toolName: string; input: unknown }
	| { type: "approval_resolved"; approvalId: string; approved: boolean; reason?: string }
	| { type: "turn_done"; finishReason: string; iterations: number; usage?: UsageData }
	| { type: "session_started"; sessionId: string }
	| { type: "session_hydrated"; sessionId: string; messages: ChatMessage[]; executionTasks?: PersistedTaskExecution[] }
	| { type: "error"; text: string }
	| { type: "status"; text: string }
	| { type: "logs_stream"; text: string }
	| { type: "switch_tab"; tab: string }
	| { type: "models"; providerId: string; models: ProviderModel[] }
	| { type: "models_request"; providerId: string }
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
	| { type: "connector_status"; connectors: ConnectorStatus[] }
	| { type: "developer_logs_batch"; entries: any[] }
	| { type: "developer_logs_state"; enabled: boolean }
	| { type: "oauth_status"; providerId: string; status: "authenticating" | "success" | "error" | "logged_out"; message?: string };

export type WebviewMessage =
	| { type: "ready" }
	| { type: "send"; prompt: string; config?: Record<string, unknown> }
	| { type: "open_file"; filePath: string; line?: number }
	| { type: "show_diff"; filePath: string; originalContent?: string; newContent?: string }
	| { type: "abort" }
	| { type: "new_session" }
	| { type: "approval_response"; approvalId: string; approved: boolean; reason?: string; input?: unknown; policy?: string }
	| { type: "save_settings"; providerId: string; modelId: string; apiKey?: string; baseUrl?: string; autoApproveTools: boolean; thinking: boolean; reasoningEffort: string; maxIterations: number; mode?: AgentMode; compaction?: CompactionStrategy; retries?: number; timeout?: number; checkpointEnabled?: boolean; autoApprovals?: Record<string, boolean> }
	| { type: "toggle_setting_item"; itemType: string; id?: string; name?: string; path?: string; enabled: boolean }
	| { type: "delete_session"; sessionId: string }
	| { type: "rename_session"; sessionId: string; title: string }
	| { type: "restore_session"; sessionId: string }
	| { type: "save_execution_data"; sessionId: string; tasks: PersistedTaskExecution[] }
	| { type: "export_session"; sessionId: string }
	| { type: "import_session" }
	| { type: "run_command"; command: string }
	| { type: "askAboutFile" }
	| { type: "clear_history" }
	| { type: "login_oauth"; providerId: string }
	| { type: "logout_oauth"; providerId: string }
	| { type: "skip_onboarding" }
	| { type: "models_request"; providerId: string }
	| { type: "status"; text: string }
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
	| { type: "connector_disconnect"; id: string }
	| { type: "developer_logs"; action: "subscribe" | "unsubscribe" | "clear" | "pause" | "resume" }
	| { type: "webview_log"; level: string; message: string; stack?: string | null };

export interface AppState {
	providers: import("@cline/shared").ProviderListItem[];
	models: Record<string, ProviderModel[]>;
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
	autoApprovals: Record<ApprovalKey, boolean>;
	showOnboarding?: boolean;
	oauthStatus: Record<string, "idle" | "authenticating" | "success" | "error">;
}

export const SCHEMA_VERSION = "2.0";

export type TaskFsmState = "idle" | "running" | "completed" | "cancelled" | "interrupted" | "failed";

export type EventOrigin = "user" | "llm" | "filesystem" | "terminal" | "tool" | "provider";

export interface EventSourceInfo {
	store?: string;
	provider?: string;
	model?: string;
	agent?: string;
}

export interface PlanningDetails {
	requirements?: string[];
	goal?: string;
	approach?: string;
	executionStrategy?: string[];
	expectedChanges?: string[];
	potentialRisks?: string[];
	estimatedWork?: string;
}

export interface TestDetails {
	name?: string;
	status?: "running" | "passed" | "failed";
	detail?: string;
	durationMs?: number;
}

export interface TimelineEventMetadata {
	cwd?: string;
	command?: string;
	arguments?: string[];
	exitCode?: number;
	stdout?: string;
	stderr?: string;
	retryCount?: number;
	filePath?: string;
	diff?: { targetContent?: string; replacementContent?: string };
	planningDetails?: PlanningDetails;
	testDetails?: TestDetails;
}

export interface TimelineEvent {
	id: string;
	sequence: number;
	version: string;
	timestamp: number;
	startedAt: number;
	finishedAt?: number;
	duration?: number;
	parentEventId?: string;
	phase: "execution";
	eventType: "planning" | "reading" | "writing" | "editing" | "command" | "tool" | "testing" | "warning" | "error" | "completion" | "cancellation" | "interruption";
	status: "pending" | "running" | "completed" | "failed" | "cancelled";
	title: string;
	description?: string;
	origin: EventOrigin;
	source?: EventSourceInfo;
	metadata?: TimelineEventMetadata;
}

export interface TaskSummaryV2 {
	overview: string;
	purpose: string;
	completedFeatures: string[];
	warnings: string[];
	errors: string[];
	filesChanged: number;
	commandsExecuted: number;
	testsPassed: number;
	durationMs: number;
	tokensUsed: number;
	cost: number;
	provider?: string;
	model?: string;
	finalStatus: string;
}

export interface FileChangesV2 {
	created: string[];
	modified: string[];
	deleted: string[];
	renamed: Array<{ from: string; to: string }>;
}

export interface TaskDataV2 {
	schemaVersion: string;
	taskId: number;
	title: string;
	startedAt: number;
	finishedAt?: number;
	state: TaskFsmState;
	liveStatus: string;
	collapsed: boolean;
	events: TimelineEvent[];
	summary?: TaskSummaryV2;
	fileChanges?: FileChangesV2;
	interrupted?: boolean;
	interruptedReason?: string;
}

// Backward compatibility types
export type TaskExecution = TaskDataV2;
export type BuildStep = any;
export type TestResult = any;
export type TaskSummary = TaskSummaryV2;

export interface PersistedTaskExecution extends TaskExecution {
	interrupted?: boolean;
	interruptedReason?: string;
}