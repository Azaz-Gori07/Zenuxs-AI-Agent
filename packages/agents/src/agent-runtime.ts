import { createGateway, type GatewayProviderSettings } from "@cline/llms";
import type {
	AgentAfterToolResult,
	AgentBeforeModelResult,
	AgentBeforeToolResult,
	AgentMessage,
	AgentMessagePart,
	AgentModel,
	AgentModelFinishReason,
	AgentModelRequest,
	AgentRunResult,
	AgentRuntimeEvent,
	AgentRuntimeHooks,
	AgentRuntimeStateSnapshot,
	AgentStopControl,
	AgentTextPart,
	AgentTool,
	AgentToolCallPart,
	AgentToolDefinition,
	AgentToolResult,
	AgentUsage,
	AgentRuntimeConfig as BaseAgentRuntimeConfig,
	SystemPart,
	TelemetryProperties,
	ToolApprovalResult,
	ToolPolicy,
} from "@cline/shared";
import {
	captureSdkError,
	estimateTokens,
	mergeModelOptions,
	profiler,
} from "@cline/shared";
import { nanoid } from "nanoid";
import * as path from "node:path";
import type { McpServerConfig } from "./mcp/types";

// Local `createUID` helper. The clinee source imports this from
// `@cline/shared` (see `packages/shared/dist/identifier.ts`), but
// sdk-re's shared package does not expose it yet. Inlining here keeps
// PLAN.md Step 1 scoped to `packages/agents/src/` and matches the
// exact clinee implementation (`${prefix}_${nanoid(length)}`).
function createUID(prefix: string, length = 8): string {
	return `${prefix}_${nanoid(length)}`;
}

/**
 * Compose a system prompt string from a base prompt and optional system parts.
 * System parts are rendered and appended to the base prompt with double-newline
 * separation. This mirrors OpenCode's SystemPart composition model.
 */
function composeSystemPrompt(
	base: string | undefined,
	systemParts?: readonly SystemPart[],
): string | undefined {
	const _profId = profiler.start("composeSystemPrompt", "message");
	if (!base?.trim() && (!systemParts || systemParts.length === 0)) {
		profiler.end(_profId);
		return base;
	}

	const parts: string[] = [];
	if (base?.trim()) {
		parts.push(base.trim());
	}

	if (systemParts) {
		for (const part of systemParts) {
			if (part.text.trim()) {
				parts.push(part.text.trim());
			}
		}
	}

	const result = parts.join("\n\n");
	profiler.end(_profId);
	return result;
}

/**
 * Module-level constant: tool name alias map for fuzzy resolution.
 * Moved out of getTool() to avoid allocating a 36-entry object on every call.
 */
const TOOL_ALIASES: Record<string, string[]> = {
	write_file: ["write", "editor", "write_to_file", "create_file"],
	write: ["write_file", "editor", "create_file"],
	create_file: ["write_file", "write", "editor"],
	write_to_file: ["write_file", "write", "editor"],
	read_file: ["read_files", "read"],
	read_files: ["read", "read_file"],
	read: ["read_files", "read_file"],
	edit: ["editor", "replace_in_file", "replace_file"],
	editor: ["edit", "replace_in_file", "replace_file"],
	replace_file: ["edit", "editor", "replace_in_file"],
	replace_in_file: ["edit", "editor"],
	patch_file: ["apply_patch", "patch"],
	patch: ["apply_patch", "patch_file"],
	apply_patch: ["patch_file", "patch"],
	delete_file: ["remove_file", "unlink"],
	remove_file: ["delete_file", "unlink"],
	unlink: ["delete_file", "remove_file"],
	move_file: ["rename_file"],
	rename_file: ["move_file"],
	copy_file: ["copy"],
	grep: ["grep_search", "search"],
	grep_search: ["grep", "search"],
	search: ["grep", "grep_search", "search_codebase"],
	search_codebase: ["search", "grep"],
	shell: ["run_commands", "bash", "cmd", "execute_command", "exec"],
	bash: ["run_commands", "execute_command", "shell", "cmd", "exec"],
	run_commands: ["bash", "execute_command", "shell", "cmd", "exec"],
	execute_command: ["run_commands", "bash", "shell"],
	cmd: ["run_commands", "bash", "shell"],
	webfetch: ["fetch_web_content"],
	fetch_web_content: ["webfetch"],
	todowrite: ["todo_write"],
	todo_write: ["todowrite"],
	websearch: ["web_search"],
	web_search: ["websearch"],
};

export type AgentRunInput = string | AgentMessage | readonly AgentMessage[];
export type AgentEventListener = (event: AgentRuntimeEvent) => void;

/**
 * Advanced form: caller supplies a pre-built `AgentModel`. Used by
 * `@cline/core`, which constructs models itself to share gateway/telemetry
 * wiring with the rest of the session runtime.
 */
export interface IntegrationsConfig {
	subagents?: boolean;
	selfCritique?: boolean;
}

export interface AgentRuntimeConfigWithModel extends BaseAgentRuntimeConfig {
	model: AgentModel;
	/** MCP servers to connect for tool discovery */
	mcpServers?: McpServerConfig[];
	/** Feature flags for integrations (defaults: all true) */
	integrations?: IntegrationsConfig;
}

/**
 * Friendly form: caller supplies provider/model IDs and credentials, and the
 * runtime builds an `AgentModel` internally via `@cline/llms`. This is the
 * entry point most standalone users want.
 */
export interface AgentRuntimeConfigWithProvider
	extends Omit<BaseAgentRuntimeConfig, "model"> {
	/** Provider ID (e.g., "anthropic", "openai") */
	providerId: string;
	/** Model ID to use */
	modelId: string;
	/** API key for the provider */
	apiKey?: string;
	/** Custom base URL for the API */
	baseUrl?: string;
	/** Additional headers for API requests */
	headers?: Record<string, string>;
	/** Provider-specific gateway options */
	options?: GatewayProviderSettings["options"];
	/** MCP servers to connect for tool discovery */
	mcpServers?: McpServerConfig[];
	/** Feature flags for integrations (defaults: all true) */
	integrations?: IntegrationsConfig;
}

/**
 * Config accepted by `new AgentRuntime(...)` / `createAgentRuntime(...)` /
 * `new Agent(...)` / `createAgent(...)`. Either supply a pre-built `model`
 * (advanced) or `providerId` + `modelId` (+ credentials) and the runtime will
 * construct the model itself via `@cline/llms`.
 */
export type AgentRuntimeConfig =
	| AgentRuntimeConfigWithModel
	| AgentRuntimeConfigWithProvider;

function hasPrebuiltModel(
	config: AgentRuntimeConfig,
): config is AgentRuntimeConfigWithModel {
	return (config as AgentRuntimeConfigWithModel).model !== undefined;
}

function resolveRuntimeConfig(
	config: AgentRuntimeConfig,
): BaseAgentRuntimeConfig {
	if (hasPrebuiltModel(config)) {
		return config;
	}
	const { providerId, modelId, apiKey, baseUrl, headers, options, ...rest } =
		config;
	const gateway = createGateway({
		providerConfigs: [{ providerId, apiKey, baseUrl, headers, options }],
		telemetry: rest.telemetry,
	});
	const model = gateway.createAgentModel({ providerId, modelId });
	return { ...rest, model };
}

function resolveToolPolicy(
	toolName: string,
	policies: BaseAgentRuntimeConfig["toolPolicies"],
): ToolPolicy {
	return {
		...(policies?.["*"] ?? {}),
		...(policies?.[toolName] ?? {}),
	};
}

interface PendingToolAssembly {
	toolCallId: string;
	toolName?: string;
	inputText: string;
	inputValue?: unknown;
	metadata?: unknown;
	parseError?: string;
}

interface InvalidToolCall {
	toolCallId: string;
	toolName?: string;
	input: Record<string, unknown>;
	reason: "missing_name" | "missing_arguments" | "invalid_arguments";
}

function safeJsonSize(value: unknown): number {
	try {
		return JSON.stringify(value).length;
	} catch {
		return String(value).length;
	}
}

function getOutputSize(output: unknown): number {
	if (typeof output === "string") {
		return output.length;
	}
	return safeJsonSize(output);
}

function summarizeModelRequest(
	request: AgentModelRequest,
): Record<string, unknown> {
	let textChars = request.systemPrompt?.length ?? 0;
	let toolResultCount = 0;
	let toolResultChars = 0;
	let maxToolResultChars = 0;
	for (const message of request.messages) {
		for (const part of message.content) {
			switch (part.type) {
				case "text":
					textChars += part.text.length;
					break;
				case "reasoning":
					textChars += part.text.length;
					break;
			case "file":
				textChars += part.content.length;
				break;
			case "system-update":
				textChars += part.text.length;
				break;
			case "tool-call":
					textChars += safeJsonSize(part.input);
					break;
				case "tool-result": {
					const outputChars = getOutputSize(part.output);
					toolResultCount += 1;
					toolResultChars += outputChars;
					maxToolResultChars = Math.max(maxToolResultChars, outputChars);
					textChars += outputChars;
					break;
				}
			}
		}
	}

	return {
		messageCount: request.messages.length,
		toolSchemaCount: request.tools.length,
		systemPromptChars: request.systemPrompt?.length ?? 0,
		requestJsonChars: safeJsonSize({
			systemPrompt: request.systemPrompt,
			messages: request.messages,
			tools: request.tools,
			options: request.options,
		}),
		visibleTextChars: textChars,
		estimatedTextTokens: estimateTokens(textChars),
		toolResultCount,
		toolResultChars,
		maxToolResultChars,
	};
}

interface PreparedToolExecution {
	toolCall: AgentToolCallPart;
	tool?: AgentTool;
	input: unknown;
	skipReason?: string;
	recovery?: ToolRecoveryPlan;
}

interface ToolRecoveryPlan {
	reason: string;
	kind:
		| "normalize-input"
		| "switch-tool"
		| "recover-file-path"
		| "recover-directory-path";
	recoveryInput?: unknown;
	recoveryToolName?: string;
	diagnostic?: string;
}

interface HookBag {
	beforeRun: NonNullable<AgentRuntimeHooks["beforeRun"]>[];
	afterRun: NonNullable<AgentRuntimeHooks["afterRun"]>[];
	beforeModel: NonNullable<AgentRuntimeHooks["beforeModel"]>[];
	afterModel: NonNullable<AgentRuntimeHooks["afterModel"]>[];
	beforeTool: NonNullable<AgentRuntimeHooks["beforeTool"]>[];
	afterTool: NonNullable<AgentRuntimeHooks["afterTool"]>[];
	onEvent: NonNullable<AgentRuntimeHooks["onEvent"]>[];
}

export class ControlledStopError extends Error {
	readonly reason?: string;

	constructor(reason?: string) {
		super(reason ?? "Run stopped by runtime control");
		this.name = "ControlledStopError";
		this.reason = reason;
	}
}

export class AgentRuntimeAbortError extends Error {
	readonly reason?: unknown;

	constructor(reason?: unknown) {
		const message =
			typeof reason === "string"
				? reason
				: reason instanceof Error
					? reason.message
					: reason === undefined
						? "Run aborted"
						: String(reason);
		super(message);
		this.name = "AgentRuntimeAbortError";
		this.reason = reason;
	}
}

const DEFAULT_USAGE: AgentUsage = {
	inputTokens: 0,
	outputTokens: 0,
	cacheReadTokens: 0,
	cacheWriteTokens: 0,
};

function createMessage(
	role: AgentMessage["role"],
	content: AgentMessagePart[],
	metadata?: Record<string, unknown>,
): AgentMessage {
	return {
		id: createUID("msg"),
		role,
		content,
		createdAt: Date.now(),
		metadata,
	};
}

function cloneUsage(usage: AgentUsage): AgentUsage {
	return { ...usage };
}

function cloneMessages(messages: readonly AgentMessage[]): AgentMessage[] {
	return messages.map((message) => ({
		...message,
		content: message.content.map((part: AgentMessagePart) => ({ ...part })),
		metadata: message.metadata ? { ...message.metadata } : undefined,
		modelInfo: message.modelInfo ? { ...message.modelInfo } : undefined,
		metrics: message.metrics ? { ...message.metrics } : undefined,
	}));
}

function usageDelta(
	start: AgentUsage,
	end: AgentUsage,
): NonNullable<AgentMessage["metrics"]> | undefined {
	const inputTokens = Math.max(
		0,
		(end.inputTokens ?? 0) - (start.inputTokens ?? 0),
	);
	const outputTokens = Math.max(
		0,
		(end.outputTokens ?? 0) - (start.outputTokens ?? 0),
	);
	const cacheReadTokens = Math.max(
		0,
		(end.cacheReadTokens ?? 0) - (start.cacheReadTokens ?? 0),
	);
	const cacheWriteTokens = Math.max(
		0,
		(end.cacheWriteTokens ?? 0) - (start.cacheWriteTokens ?? 0),
	);
	const startCost = start.totalCost ?? 0;
	const endCost = end.totalCost ?? 0;
	const cost = Math.max(0, endCost - startCost);
	if (
		inputTokens === 0 &&
		outputTokens === 0 &&
		cacheReadTokens === 0 &&
		cacheWriteTokens === 0 &&
		cost === 0
	) {
		return undefined;
	}
	return {
		inputTokens: inputTokens > 0 ? inputTokens : 0,
		outputTokens: outputTokens > 0 ? outputTokens : 0,
		cacheReadTokens: cacheReadTokens > 0 ? cacheReadTokens : 0,
		cacheWriteTokens: cacheWriteTokens > 0 ? cacheWriteTokens : 0,
		...(cost > 0 ? { cost } : {}),
	};
}

function textFromMessage(message: AgentMessage | undefined): string {
	if (!message) {
		return "";
	}
	return message.content
		.filter(
			(
				part: AgentMessagePart,
			): part is Extract<AgentMessagePart, { type: "text" }> =>
				part.type === "text",
		)
		.map((part: Extract<AgentMessagePart, { type: "text" }>) => part.text)
		.join("");
}

export function textFromToolMessage(message: AgentMessage | undefined): string {
	const result = message?.content.find(
		(part): part is Extract<AgentMessagePart, { type: "tool-result" }> =>
			part.type === "tool-result",
	);
	if (!result || result.isError) {
		return "";
	}
	if (typeof result.output === "string") {
		return result.output;
	}
	try {
		return JSON.stringify(result.output);
	} catch {
		return String(result.output);
	}
}

function normalizeInput(input: AgentRunInput): AgentMessage[] {
	if (typeof input === "string") {
		return [createMessage("user", [{ type: "text", text: input }])];
	}
	if (Array.isArray(input)) {
		return cloneMessages(input);
	}
	return cloneMessages([input as AgentMessage]);
}

export class AgentRuntime {
	private config: Required<Pick<BaseAgentRuntimeConfig, "toolExecution">> &
		BaseAgentRuntimeConfig;
	private readonly listeners = new Set<AgentEventListener>();
	// biome-ignore lint/suspicious/noExplicitAny: tool input/output types vary per tool
	private readonly tools = new Map<string, AgentTool<any, any>>();
	private hooks: HookBag = {
		beforeRun: [],
		afterRun: [],
		beforeModel: [],
		afterModel: [],
		beforeTool: [],
		afterTool: [],
		onEvent: [],
	};
	private readonly state = {
		agentId: "",
		agentRole: undefined as string | undefined,
		parentAgentId: undefined as string | null | undefined,
		runId: undefined as string | undefined,
		status: "idle" as AgentRuntimeStateSnapshot["status"],
		iteration: 0,
		messages: [] as AgentMessage[],
		pendingToolCalls: [] as string[],
		usage: cloneUsage(DEFAULT_USAGE),
		lastError: undefined as string | undefined,
	};
	private initialization?: Promise<void>;
	private abortController?: AbortController;
	/** OPT-02: Cached system prompt — computed once, reused every iteration. */
	private _cachedSystemPrompt?: string | undefined;
	private _systemPromptCached = false;
	/** OPT-03: Cached tool definition array — computed once after init. */
	private _cachedToolDefinitions?: AgentToolDefinition[];
	/** OPT-01: Cached snapshot — invalidated when messages change. */
	private _cachedSnapshot?: AgentRuntimeStateSnapshot;

	constructor(config: AgentRuntimeConfig) {
		const resolved = resolveRuntimeConfig(config);
		this.config = {
			...resolved,
			toolExecution: resolved.toolExecution ?? "sequential",
		};
		this.state.agentId = resolved.agentId ?? createUID("agent");
		this.state.agentRole = resolved.agentRole;
		this.state.parentAgentId = resolved.parentAgentId;
		this.state.messages = cloneMessages(resolved.initialMessages ?? []);
	}

	async run(input: AgentRunInput): Promise<AgentRunResult> {
		return this.execute(input);
	}

	async continue(input?: AgentRunInput): Promise<AgentRunResult> {
		return this.execute(input);
	}

	abort(reason?: unknown): void {
		if (!this.abortController) {
			return;
		}
		const abortError =
			reason instanceof AgentRuntimeAbortError
				? reason
				: new AgentRuntimeAbortError(reason);
		this.state.lastError = abortError.message;
		this.abortController.abort(abortError);
	}

	subscribe(listener: AgentEventListener): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	/**
	 * Replace the conversation with a fresh set of messages, discarding any
	 * in-flight run and usage state while preserving the underlying model,
	 * tools, hooks, plugins, and active event subscribers.
	 *
	 * Useful for standalone callers that persist conversations externally and
	 * want to re-seed the runtime from storage without recreating subscribers.
	 */
	restore(messages: readonly AgentMessage[]): void {
		this.abort("Agent state restored");
		// Reset state that is not carried across restores. Keep `listeners`,
		// tools, hooks, plugins, model, and agent identity so external event
		// subscribers continue to receive events after restore().
		this.state.runId = undefined;
		this.state.status = "idle";
		this.state.iteration = 0;
		this.state.pendingToolCalls = [];
		this.state.usage = cloneUsage(DEFAULT_USAGE);
		this.state.lastError = undefined;
		this._invalidateSnapshot();
		this.state.messages = cloneMessages(messages);
		this.config = {
			...this.config,
			initialMessages: cloneMessages(messages),
		};
	}

	snapshot(): AgentRuntimeStateSnapshot {
		const _profId = profiler.start("snapshot", "message");
		// OPT-01: Return cached snapshot if messages haven't changed since last computation.
		if (this._cachedSnapshot) {
			profiler.end(_profId, { cached: true, messageCount: this.state.messages.length });
			return this._cachedSnapshot;
		}
		const result = {
			agentId: this.state.agentId,
			agentRole: this.state.agentRole,
			parentAgentId: this.state.parentAgentId,
			conversationId: this.config.conversationId?.trim() || undefined,
			runId: this.state.runId,
			status: this.state.status,
			iteration: this.state.iteration,
			messages: cloneMessages(this.state.messages),
			pendingToolCalls: [...this.state.pendingToolCalls],
			usage: cloneUsage(this.state.usage),
			lastError: this.state.lastError,
		};
		profiler.end(_profId, { messageCount: this.state.messages.length, cached: false });
		this._cachedSnapshot = result;
		return result;
	}

	/** OPT-01: Invalidate snapshot cache when messages are mutated. */
	private _invalidateSnapshot(): void {
		this._cachedSnapshot = undefined;
	}

	private async ensureInitialized(): Promise<void> {
		this.initialization ??= this.initialize();
		await this.initialization;
	}

	private async initialize(): Promise<void> {
		this.registerHooks(this.config.hooks);
		for (const tool of this.config.tools ?? []) {
			this.tools.set(tool.name, tool);
		}
		for (const plugin of this.config.plugins ?? []) {
			const setup = await plugin.setup?.({
				agentId: this.state.agentId,
				agentRole: this.state.agentRole,
				systemPrompt: this.config.systemPrompt,
			});
			for (const tool of setup?.tools ?? []) {
				this.tools.set(tool.name, tool);
			}
			this.registerHooks(setup?.hooks);
		}
		// OPT-03: Build tool definition array once after all tools are registered.
		this._cachedToolDefinitions = [...this.tools.values()].map<AgentToolDefinition>((tool) => ({
			name: tool.name,
			description: tool.description,
			inputSchema: tool.inputSchema,
		}));
	}

	private registerHooks(hooks: Partial<AgentRuntimeHooks> | undefined): void {
		if (!hooks) {
			return;
		}
		if (hooks.beforeRun) this.hooks.beforeRun.push(hooks.beforeRun);
		if (hooks.afterRun) this.hooks.afterRun.push(hooks.afterRun);
		if (hooks.beforeModel) this.hooks.beforeModel.push(hooks.beforeModel);
		if (hooks.afterModel) this.hooks.afterModel.push(hooks.afterModel);
		if (hooks.beforeTool) this.hooks.beforeTool.push(hooks.beforeTool);
		if (hooks.afterTool) this.hooks.afterTool.push(hooks.afterTool);
		if (hooks.onEvent) this.hooks.onEvent.push(hooks.onEvent);
	}

	private getTool(toolName: string): AgentTool | undefined {
		const _profId = profiler.start("getTool", "tool", { toolName });
		let tool = this.tools.get(toolName);
		if (tool) { profiler.end(_profId, { resolved: true, via: "exact" }); return tool; }
		const normalized = toolName.trim().toLowerCase();
		tool = this.tools.get(normalized);
		if (tool) { profiler.end(_profId, { resolved: true, via: "normalized" }); return tool; }

		const candidates = TOOL_ALIASES[normalized] ?? [];
		for (const candidate of candidates) {
			tool = this.tools.get(candidate);
			if (tool) { profiler.end(_profId, { resolved: true, via: "alias" }); return tool; }
		}
		profiler.end(_profId, { resolved: false });
		return undefined;
	}

	private getRequiredCompletionToolNames(): string[] {
		if (this.config.completionPolicy?.requireCompletionTool !== true) {
			return [];
		}
		return [...this.tools.values()]
			.filter((tool) => tool.lifecycle?.completesRun === true)
			.map((tool) => tool.name)
			.sort();
	}

	private getCompletionToolReminderMessage(): string | undefined {
		const terminalToolNames = this.getRequiredCompletionToolNames();
		if (terminalToolNames.length === 0) {
			return undefined;
		}
		return `[SYSTEM] This run is not complete until you call one of these terminal completion tools: ${terminalToolNames.join(
			", ",
		)}. Continue working if requirements are not met. If the task is complete, call the appropriate terminal completion tool now.`;
	}

	private checkForBuilderViolation(message: AgentMessage): string | undefined {
		const textContent = message.content
			.filter((part: AgentMessagePart): part is AgentTextPart => part.type === "text")
			.map((part) => part.text)
			.join("\n");

		if (!textContent) return undefined;
		// OPT-11: Early exit for short messages (unlikely to contain code dumps).
		if (textContent.length < 50) return undefined;

		// OPT-11: Check for code fences first (cheap), only do regex if fences found.
		const hasCodeFence = textContent.includes("```");
		if (!hasCodeFence && !textContent.includes("<!DOCTYPE html>")) {
			return undefined;
		}

		const lower = textContent.toLowerCase();
		if (
			lower.includes("show me the source code") ||
			lower.includes("print the code") ||
			lower.includes("display the code in chat") ||
			lower.includes("output the code in chat")
		) {
			return undefined;
		}

		const isCodeDump =
			textContent.includes("```html") ||
			textContent.includes("```tsx") ||
			textContent.includes("```jsx") ||
			textContent.includes("```css") ||
			textContent.includes("```typescript") ||
			textContent.includes("```javascript") ||
			textContent.includes("<!DOCTYPE html>") ||
			(textContent.match(/```[\s\S]*?```/g)?.some((block) => block.split("\n").length > 8) ?? false);

		if (isCodeDump) {
			return `[SYSTEM ENFORCEMENT] Builder Architecture Violation Detected: You outputted raw source code directly into chat instead of writing files to disk. In Builder Mode, NEVER output source code in chat text. You MUST use filesystem tools (write_file, edit) to write all files directly to the workspace filesystem, and output ONLY progress status (e.g. "✔ Creating portfolio.html...") in chat. Execute write_file tools now.`;
		}

		return undefined;
	}

	private getCompletionReminderMessages(): string[] {
		return [
			this.getCompletionToolReminderMessage(),
			this.config.completionPolicy?.completionGuard?.(),
		].filter((message): message is string => Boolean(message));
	}

	private async addUserReminderMessage(text: string): Promise<AgentMessage> {
		const reminderMessage = createMessage("user", [{ type: "text", text }]);
		this._invalidateSnapshot();
		this.state.messages.push(reminderMessage);
		await this.emit({
			type: "message-added",
			snapshot: this.snapshot(),
			message: reminderMessage,
		});
		return reminderMessage;
	}

	private async execute(input?: AgentRunInput): Promise<AgentRunResult> {
		await this.ensureInitialized();
		this._invalidateSnapshot();
		if (this.state.status === "running") {
			throw new Error("Agent runtime is already running");
		}

		this.abortController = new AbortController();
		this.state.runId = createUID("run");
		this.state.status = "running";
		this.state.iteration = 0;
		this.state.pendingToolCalls = [];
		this.state.lastError = undefined;
		this.state.usage = cloneUsage(DEFAULT_USAGE);

		try {
			await this.callBeforeRunHooks();
			await this.emit({ type: "run-started", snapshot: this.snapshot() });

			for (const message of input ? normalizeInput(input) : []) {
				this._invalidateSnapshot();
				this.state.messages.push(message);
				await this.emit({
					type: "message-added",
					snapshot: this.snapshot(),
					message,
				});
			}

			const completionToolReminder = this.getCompletionToolReminderMessage();
			if (completionToolReminder) {
				await this.addUserReminderMessage(completionToolReminder);
			}

			let finalAssistantMessage: AgentMessage | undefined;

			while (
				this.config.maxIterations === undefined ||
				this.state.iteration < this.config.maxIterations
			) {
				this.throwIfAborted();

				this.state.iteration += 1;
				const _iterId = profiler.start("agentLoop.iteration", "agent", { iteration: this.state.iteration });
				await this.emit({
					type: "turn-started",
					snapshot: this.snapshot(),
					iteration: this.state.iteration,
				});

				const { message, finishReason } = await this.generateAssistantMessage();
				finalAssistantMessage = message;
				this._invalidateSnapshot();
				this.state.messages.push(message);
				await this.emit({
					type: "message-added",
					snapshot: this.snapshot(),
					message,
				});
				await this.emit({
					type: "assistant-message",
					snapshot: this.snapshot(),
					iteration: this.state.iteration,
					message,
					finishReason,
				});

				if (finishReason === "aborted") {
					throw this.normalizeAbortError();
				}

				let toolCalls = message.content.filter(
					(part: AgentMessagePart): part is AgentToolCallPart =>
						part.type === "tool-call",
				);
				if (finishReason === "error" && toolCalls.length === 0) {
					throw new Error(this.state.lastError ?? "Model stream failed");
				}
				this.state.pendingToolCalls = toolCalls.map((part) => part.toolCallId);

				// If no structured tool calls were emitted, scan the assistant text
				// response for inline JSON that represents a tool call. This catches
				// cases where the provider/model emits tool payloads as text (e.g.
				// non-standard response format, proxy intermediaries, or models that
				// write inline JSON instead of structured tool-call parts).
				if (toolCalls.length === 0) {
					const extractedParts = this.scanTextForJsonToolCalls(message);
					if (extractedParts.length > 0) {
						message.content = message.content.filter(
							(p) => p.type !== "text",
						);
						message.content.push(...extractedParts);
						toolCalls = extractedParts.filter(
							(p): p is AgentToolCallPart => p.type === "tool-call",
						);
						this.state.pendingToolCalls = toolCalls.map(
							(part) => part.toolCallId,
						);
					}
				}

				if (toolCalls.length === 0) {
					await this.emit({
						type: "turn-finished",
						snapshot: this.snapshot(),
						iteration: this.state.iteration,
						toolCallCount: 0,
					});
					const builderViolation = this.checkForBuilderViolation(message);
					if (builderViolation) {
						await this.addUserReminderMessage(builderViolation);
						continue;
					}
					const completionReminderMessages =
						this.getCompletionReminderMessages();
					if (completionReminderMessages.length > 0) {
						for (const reminderMessage of completionReminderMessages) {
							await this.addUserReminderMessage(reminderMessage);
						}
						continue;
					}
					const result = this.finishRun("completed", finalAssistantMessage);
					await this.callAfterRunHooks(result);
					await this.emit({
						type: "run-finished",
						snapshot: this.snapshot(),
						result,
					});
					return result;
				}

				const toolMessages = await this.executeToolCalls(toolCalls);
				this.state.pendingToolCalls = [];
				for (const toolMessage of toolMessages) {
					this._invalidateSnapshot();
					this.state.messages.push(toolMessage);
					await this.emit({
						type: "message-added",
						snapshot: this.snapshot(),
						message: toolMessage,
					});
				}
				await this.emit({
					type: "turn-finished",
					snapshot: this.snapshot(),
					iteration: this.state.iteration,
					toolCallCount: toolCalls.length,
				});
				profiler.end(_iterId);
				const terminalToolMessage = this.findCompletingToolMessage(
					toolCalls,
					toolMessages,
				);
				if (terminalToolMessage) {
					const result = this.finishRun(
						"completed",
						finalAssistantMessage,
						textFromToolMessage(terminalToolMessage) || undefined,
					);
					await this.callAfterRunHooks(result);
					await this.emit({
						type: "run-finished",
						snapshot: this.snapshot(),
						result,
					});
					return result;
				}
			}

			throw new Error(
				`Agent runtime exceeded maxIterations (${this.config.maxIterations})`,
			);
		} catch (error) {
			const normalized =
				error instanceof Error ? error : new Error(String(error));
			const isControlledStop = normalized instanceof ControlledStopError;
			const status =
				this.abortController.signal.aborted || isControlledStop
					? "aborted"
					: "failed";
			this.state.status = status;
			this.state.lastError = normalized.message;
			const result: AgentRunResult = {
				agentId: this.state.agentId,
				agentRole: this.state.agentRole,
				runId: this.state.runId ?? createUID("run"),
				status,
				iterations: this.state.iteration,
				outputText: textFromMessage(this.findLastAssistantMessage()),
				messages: cloneMessages(this.state.messages),
				usage: cloneUsage(this.state.usage),
				error: status === "failed" ? normalized : undefined,
			};
			await this.callAfterRunHooks(result);
			if (status === "failed") {
				await this.emit({
					type: "run-failed",
					snapshot: this.snapshot(),
					error: normalized,
				});
			} else {
				await this.emit({
					type: "run-finished",
					snapshot: this.snapshot(),
					result,
				});
			}
			return result;
		} finally {
			this.abortController = undefined;
		}
	}

	private async callBeforeRunHooks(): Promise<void> {
		for (const hook of this.hooks.beforeRun) {
			const control = (await hook({
				snapshot: this.snapshot(),
			})) as AgentStopControl | undefined;
			this.applyStopControl(control);
		}
	}

	private async callAfterRunHooks(result: AgentRunResult): Promise<void> {
		for (const hook of this.hooks.afterRun) {
			await hook({ snapshot: this.snapshot(), result });
		}
	}

	private async generateAssistantMessage(): Promise<{
		message: AgentMessage;
		finishReason: AgentModelFinishReason;
	}> {
		const _profId = profiler.start("generateAssistantMessage", "llm", { iteration: this.state.iteration });
		const usageBeforeModel = cloneUsage(this.state.usage);
		const _composeId = profiler.start("composeSystemPrompt(call)", "message");
		let systemPrompt: string | undefined;
		if (this._systemPromptCached) {
			systemPrompt = this._cachedSystemPrompt;
		} else {
			systemPrompt = composeSystemPrompt(
				this.config.systemPrompt,
				this.config.systemParts,
			);
			this._cachedSystemPrompt = systemPrompt;
			this._systemPromptCached = true;
		}
		profiler.end(_composeId, { cached: this._systemPromptCached && systemPrompt === this._cachedSystemPrompt });
		// OPT-13: Clone messages once for the request, reuse cloned array for subsequent operations.
		const _cloneId = profiler.start("cloneMessages(generateAssistant)", "message", { messageCount: this.state.messages.length });
		const clonedMessages = cloneMessages(this.state.messages);
		let request: AgentModelRequest = {
			systemPrompt,
			messages: clonedMessages,
			tools: this._cachedToolDefinitions ?? [...this.tools.values()].map<AgentToolDefinition>((tool) => ({
				name: tool.name,
				description: tool.description,
				inputSchema: tool.inputSchema,
			})),
			signal: this.abortController?.signal,
			options: this.config.modelOptions,
		};
		profiler.end(_cloneId);

		if (this.state.iteration > 1) {
			if (await this.consumePendingUserMessage()) {
				// OPT-13: Reuse clonedMessages reference instead of cloning again.
				request = { ...request, messages: clonedMessages };
			}
		}

		request = await this.prepareTurnForModelRequest(request);

		for (const hook of this.hooks.beforeModel) {
			const result = (await hook({
				snapshot: this.snapshot(),
				request,
			})) as AgentBeforeModelResult | undefined;
			this.applyStopControl(result);
			if (result?.messages) {
				// OPT-13: Only clone if hook actually returned new messages.
				request = { ...request, messages: result.messages !== clonedMessages ? cloneMessages(result.messages) : result.messages };
			}
			if (result?.tools) {
				request = { ...request, tools: [...result.tools] };
			}
			if (result?.options) {
				request = {
					...request,
					options: mergeModelOptions(request.options, result.options),
				};
			}
		}

		this.config.logger?.debug("Agent model request diagnostics", {
			iteration: this.state.iteration,
			providerId:
				"providerId" in this.config &&
				typeof this.config.providerId === "string"
					? this.config.providerId
					: undefined,
			modelId:
				"modelId" in this.config && typeof this.config.modelId === "string"
					? this.config.modelId
					: undefined,
			...summarizeModelRequest(request),
		});

		const stream = await this.config.model.stream(request);
		const content: AgentMessagePart[] = [];
		const toolAssemblies = new Map<string, PendingToolAssembly>();
		const invalidToolCalls: InvalidToolCall[] = [];
		const sequence: Array<
			{ type: "tool"; key: string } | { type: "part"; part: AgentMessagePart }
		> = [];
		let nextToolIndex = 0;
		let finishReason: AgentModelFinishReason = "stop";
		let accumulatedText = "";
		let accumulatedReasoning = "";

		for await (const event of stream) {
			this.throwIfAborted();
			switch (event.type) {
				case "text-delta": {
					accumulatedText += event.text;
					const last = sequence.at(-1);
					if (last?.type === "part" && last.part.type === "text") {
						last.part.text += event.text;
					} else {
						sequence.push({
							type: "part",
							part: { type: "text", text: event.text },
						});
					}
					await this.emit({
						type: "assistant-text-delta",
						snapshot: this.snapshot(),
						iteration: this.state.iteration,
						text: event.text,
						accumulatedText,
					});
					break;
				}
				case "reasoning-delta": {
					accumulatedReasoning += event.text;
					const last = sequence.at(-1);
					if (last?.type === "part" && last.part.type === "reasoning") {
						last.part.text += event.text;
						last.part.redacted = event.redacted ?? last.part.redacted;
						last.part.metadata = event.metadata ?? last.part.metadata;
					} else {
						sequence.push({
							type: "part",
							part: {
								type: "reasoning",
								text: event.text,
								redacted: event.redacted,
								metadata: event.metadata,
							},
						});
					}
					await this.emit({
						type: "assistant-reasoning-delta",
						snapshot: this.snapshot(),
						iteration: this.state.iteration,
						text: event.text,
						accumulatedText: accumulatedReasoning,
						redacted: event.redacted,
						metadata: event.metadata,
					});
					break;
				}
				case "tool-call-delta": {
					const key =
						event.toolCallId ?? `tool_${event.index ?? nextToolIndex}`;
					if (event.index == null && event.toolCallId == null) {
						nextToolIndex += 1;
					}
					let assembly = toolAssemblies.get(key);
					if (!assembly) {
						assembly = {
							toolCallId: event.toolCallId ?? createUID("tool"),
							inputText: "",
						};
						toolAssemblies.set(key, assembly);
						sequence.push({ type: "tool", key });
					}
					if (event.toolCallId) {
						assembly.toolCallId = event.toolCallId;
					}
					if (event.toolName) {
						assembly.toolName = event.toolName;
					}
					if (event.input !== undefined) {
						assembly.inputValue = event.input;
					}
					if (event.metadata !== undefined) {
						assembly.metadata = mergeToolMetadata(
							assembly.metadata,
							event.metadata,
						);
					}
					if (event.inputText) {
						assembly.inputText = mergeToolInputText(
							assembly.inputText,
							event.inputText,
						);
					}
					break;
				}
				case "usage": {
					await this.updateUsage(event.usage);
					break;
				}
				case "finish": {
					finishReason = event.reason;
					if (event.error) {
						this.state.lastError = event.error;
					}
					break;
				}
			}
		}

		for (const item of sequence) {
			if (item.type === "part") {
				content.push(item.part);
				continue;
			}
			const assembly = toolAssemblies.get(item.key);
			if (!assembly?.toolName) {
				invalidToolCalls.push({
					toolCallId: assembly?.toolCallId ?? item.key,
					input: buildInvalidToolInput(assembly?.inputText ?? ""),
					reason: "missing_name",
				});
				continue;
			}
			const parsed = parseToolInput(assembly);
			if (parsed.reason) {
				invalidToolCalls.push({
					toolCallId: assembly.toolCallId,
					toolName: assembly.toolName,
					input: parsed.invalidInput,
					reason: parsed.reason,
				});
			}
			content.push({
				type: "tool-call",
				toolCallId: assembly.toolCallId,
				toolName: assembly.toolName,
				input: parsed.input,
				metadata: parsed.parseError
					? mergeToolMetadata(assembly.metadata, {
							inputParseError: parsed.parseError,
							rawInputText: assembly.inputText,
						})
					: assembly.metadata,
			});
		}

		const message = createMessage(
			"assistant",
			content,
			invalidToolCalls.length > 0 ? { invalidToolCalls } : undefined,
		);
		const metrics = usageDelta(usageBeforeModel, this.state.usage);
		if (metrics) {
			message.metrics = metrics;
		}
		if (this.config.messageModelInfo) {
			message.modelInfo = { ...this.config.messageModelInfo };
		}
		for (const hook of this.hooks.afterModel) {
			const control = (await hook({
				snapshot: this.snapshot(),
				assistantMessage: message,
				finishReason,
			})) as AgentStopControl | undefined;
			this.applyStopControl(control);
		}

		profiler.end(_profId, { finishReason, contentParts: content.length });
		return { message, finishReason };
	}

	private async prepareTurnForModelRequest(
		request: AgentModelRequest,
	): Promise<AgentModelRequest> {
		if (!this.config.prepareTurn) {
			return request;
		}

		const result = await this.config.prepareTurn({
			agentId: this.state.agentId,
			conversationId: this.config.conversationId,
			parentAgentId: this.state.parentAgentId ?? null,
			iteration: this.state.iteration,
			messages: request.messages,
			systemPrompt: request.systemPrompt,
			systemParts: request.systemParts,
			tools: request.tools,
			model: {
				id: this.config.messageModelInfo?.id,
				provider: this.config.messageModelInfo?.provider,
			},
			signal: request.signal,
			emitStatusNotice: (message, metadata) => {
				void this.emit({
					type: "status-notice",
					snapshot: this.snapshot(),
					message,
					metadata,
				});
			},
		});
		if (!result) {
			return request;
		}

		let next = request;
		if (result.messages) {
			const preparedMessages = cloneMessages(result.messages);
			this._invalidateSnapshot();
			this.state.messages = preparedMessages;
			next = { ...next, messages: cloneMessages(preparedMessages) };
		}
		if (result.systemPrompt !== undefined) {
			next = { ...next, systemPrompt: result.systemPrompt };
		}
		if (result.systemParts !== undefined) {
			next = { ...next, systemParts: result.systemParts };
		}
		return next;
	}

	private async consumePendingUserMessage(): Promise<boolean> {
		const consumePendingUserMessage = this.config.consumePendingUserMessage;
		if (!consumePendingUserMessage) {
			return false;
		}
		const pending = (await consumePendingUserMessage())?.trim();
		if (!pending) {
			return false;
		}
		const message = createMessage("user", [{ type: "text", text: pending }]);
		this._invalidateSnapshot();
		this.state.messages.push(message);
		await this.emit({
			type: "message-added",
			snapshot: this.snapshot(),
			message,
		});
		return true;
	}

	private async updateUsage(usage: Partial<AgentUsage>): Promise<void> {
		this.state.usage = {
			inputTokens: this.state.usage.inputTokens + (usage.inputTokens ?? 0),
			outputTokens: this.state.usage.outputTokens + (usage.outputTokens ?? 0),
			cacheReadTokens:
				this.state.usage.cacheReadTokens + (usage.cacheReadTokens ?? 0),
			cacheWriteTokens:
				this.state.usage.cacheWriteTokens + (usage.cacheWriteTokens ?? 0),
			totalCost: (this.state.usage.totalCost ?? 0) + (usage.totalCost ?? 0),
		};
		await this.emit({
			type: "usage-updated",
			snapshot: this.snapshot(),
			usage: cloneUsage(this.state.usage),
		});
	}

	private async executeToolCalls(
		toolCalls: AgentToolCallPart[],
	): Promise<AgentMessage[]> {
		const _profId = profiler.start("executeToolCalls", "tool", { toolCount: toolCalls.length });
		const prepared: PreparedToolExecution[] = [];
		for (const toolCall of toolCalls) {
			prepared.push(await this.prepareToolExecution(toolCall));
		}

		if (this.config.toolExecution === "parallel") {
			const results = await Promise.all(
				prepared.map((execution) => this.executePreparedTool(execution)),
			);
			profiler.end(_profId);
			return results;
		}

		const results: AgentMessage[] = [];
		for (const execution of prepared) {
			results.push(await this.executePreparedTool(execution));
		}
		profiler.end(_profId);
		return results;
	}

	private recoverToolExecution(
		prepared: PreparedToolExecution,
		errorText: string,
	): PreparedToolExecution | undefined {
		if (prepared.recovery) {
			return undefined;
		}
		if (
			errorText.includes("Tool execution is disabled for provider") ||
			errorText.includes("requires approval") ||
			errorText.includes("was not approved")
		) {
			return undefined;
		}
		const toolName = prepared.toolCall.toolName.trim().toLowerCase();
		const normalizedInput = this.normalizeToolInputPayload(
			prepared.toolCall.toolName,
			prepared.input,
		);

		const nextCandidates = new Set<string>();
		const addCandidate = (name?: string): void => {
			if (!name) return;
			const tool = this.getTool(name);
			if (tool) nextCandidates.add(tool.name);
		};

		const recoveryPayloads: Array<{
			kind: ToolRecoveryPlan["kind"];
			reason: string;
			input?: unknown;
			toolName?: string;
		}> = [];

		if (
			errorText.includes("File path is required") ||
			errorText.includes("required") ||
			errorText.includes("Invalid")
		) {
			recoveryPayloads.push({
				kind: "normalize-input",
				reason: "Recovered missing file input by normalizing the payload.",
				input: normalizedInput,
			});
		}

		if (
			errorText.includes("ENOTDIR") ||
			errorText.includes("Path is a directory") ||
			errorText.includes("not a directory")
		) {
			const pathValue = this.extractPathLikeValue(prepared.input);
			if (pathValue) {
				const targetToolName =
					toolName.includes("grep") || toolName.includes("search")
						? "grep"
						: "read";
				const targetTool = this.getTool(targetToolName);
				recoveryPayloads.push({
					kind: "recover-file-path",
					reason: "Recovered filesystem path as a file target.",
					input: this.buildFileSearchPayload(targetToolName, pathValue, prepared.input),
					toolName: targetTool?.name,
				});
			}
		}

		if (
			(errorText.includes("Unknown tool") || errorText.includes("skipped")) &&
			toolName.includes("search")
		) {
			addCandidate("grep");
			addCandidate("search_codebase");
			if (nextCandidates.size > 0) {
				recoveryPayloads.push({
					kind: "switch-tool",
					reason: "Recovered tool selection to a compatible file-search tool.",
					toolName: [...nextCandidates][0],
					input: normalizedInput,
				});
			}
		}

		if (recoveryPayloads.length === 0) {
			return undefined;
		}

		const chosen = recoveryPayloads[0];
		return {
			...prepared,
			skipReason: undefined,
			input: chosen.input ?? normalizedInput,
			recovery: {
				kind: chosen.kind,
				reason: chosen.reason,
				recoveryInput: chosen.input,
				recoveryToolName: chosen.toolName,
				diagnostic: errorText,
			},
			tool: chosen.toolName ? this.getTool(chosen.toolName) ?? prepared.tool : prepared.tool,
			toolCall: {
				...prepared.toolCall,
				toolName: chosen.toolName ?? prepared.toolCall.toolName,
			},
		};
	}

	private extractPathLikeValue(input: unknown): string | undefined {
		if (typeof input === "string") {
			return input.trim() || undefined;
		}
		if (!input || typeof input !== "object" || Array.isArray(input)) {
			return undefined;
		}
		const obj = input as Record<string, unknown>;
		const candidate =
			typeof obj.path === "string"
				? obj.path
				: typeof obj.filePath === "string"
					? obj.filePath
					: typeof obj.file === "string"
						? obj.file
						: undefined;
		return candidate?.trim() || undefined;
	}

	private buildFileSearchPayload(
		toolName: string,
		pathValue: string,
		originalInput?: unknown,
	): unknown {
		const norm = toolName.trim().toLowerCase();
		if (norm.includes("read")) {
			return { path: pathValue, files: [{ path: pathValue }] };
		}
		const pattern =
			originalInput &&
			typeof originalInput === "object" &&
			!Array.isArray(originalInput) &&
			typeof (originalInput as Record<string, unknown>).pattern === "string"
				? ((originalInput as Record<string, unknown>).pattern as string)
				: path.basename(pathValue);
		return { pattern, path: pathValue };
	}

	private findCompletingToolMessage(
		toolCalls: AgentToolCallPart[],
		toolMessages: AgentMessage[],
	): AgentMessage | undefined {
		for (let index = 0; index < toolCalls.length; index += 1) {
			const toolCall = toolCalls[index];
			if (this.getTool(toolCall.toolName)?.lifecycle?.completesRun !== true) {
				continue;
			}
			const toolMessage = toolMessages[index];
			const result = toolMessage?.content.find(
				(part): part is Extract<AgentMessagePart, { type: "tool-result" }> =>
					part.type === "tool-result" &&
					part.toolCallId === toolCall.toolCallId,
			);
			if (result && !result.isError) {
				return toolMessage;
			}
		}
		return undefined;
	}

	private normalizeToolInputPayload(toolName: string, rawInput: unknown): unknown {
		if (rawInput === undefined || rawInput === null) {
			return {};
		}

		// If input is a string, try JSON.parse first before heuristic mapping.
		// This catches cases where the LLM response contains a JSON-encoded tool
		// payload that wasn't parsed upstream (e.g. inline JSON in streaming text,
		// non-standard provider response format, or parseToolArguments fallback).
		if (typeof rawInput === "string") {
			const str = rawInput.trim();
			if (str.startsWith("{") || str.startsWith("[")) {
				try {
					const parsed = JSON.parse(str);
					if (typeof parsed === "object" && parsed !== null) {
						rawInput = parsed;
					}
				} catch {
					// Not valid JSON — fall through to existing heuristics
				}
			}
		}

		const normName = toolName.trim().toLowerCase();

		// String inputs (e.g. create_file("test.txt") or read_file("test.txt"))
		if (typeof rawInput === "string") {
			const str = rawInput.trim();
			if (normName.includes("create") || normName.includes("write")) {
				return { filePath: str, path: str, content: "", new_text: "" };
			}
			if (normName.includes("read")) {
				return { files: [{ path: str }], path: str };
			}
			if (normName.includes("delete") || normName.includes("remove") || normName.includes("unlink")) {
				return { filePath: str, path: str, file: str };
			}
			if (normName.includes("bash") || normName.includes("command") || normName.includes("shell") || normName.includes("exec")) {
				return { commands: [str], command: str };
			}
			return str;
		}

		if (typeof rawInput !== "object" || Array.isArray(rawInput)) {
			return rawInput;
		}

		const obj = { ...(rawInput as Record<string, unknown>) };

		// Normalize write / create_file inputs
		if (normName.includes("write") || normName.includes("create")) {
			const filePath = (obj.filePath || obj.path || obj.file || obj.filename || obj.dest || obj.destination) as string | undefined;
			const content = (obj.content !== undefined ? obj.content : obj.text !== undefined ? obj.text : obj.new_text !== undefined ? obj.new_text : obj.code) as string | undefined;
			if (filePath !== undefined) {
				if (obj.filePath === undefined && obj.path === undefined) {
					obj.filePath = filePath;
				}
			}
			if (content !== undefined) {
				if (obj.content === undefined && obj.new_text === undefined) {
					obj.content = content;
				}
			}
		}

		// Normalize edit / replace_file inputs
		if (normName.includes("edit") || normName.includes("replace")) {
			const filePath = (obj.filePath || obj.path || obj.file || obj.filename) as string | undefined;
			const oldStr = (obj.oldString ?? obj.old_text ?? obj.old ?? obj.search) as string | undefined;
			const newStr = (obj.newString ?? obj.new_text ?? obj.new ?? obj.replace) as string | undefined;
			if (filePath !== undefined) {
				if (obj.filePath === undefined && obj.path === undefined) obj.filePath = filePath;
			}
			if (oldStr !== undefined) {
				if (obj.oldString === undefined && obj.old_text === undefined) obj.oldString = oldStr;
			}
			if (newStr !== undefined) {
				if (obj.newString === undefined && obj.new_text === undefined) obj.newString = newStr;
			}
		}

		// Normalize read_files / read inputs
		if (normName.includes("read")) {
			const filesArr = obj.files as Array<{ path?: string }> | undefined;
			const filePath = (obj.filePath || obj.path || obj.file || (filesArr && filesArr[0] && filesArr[0].path)) as string | undefined;
			if (filePath !== undefined) {
				if (obj.path === undefined) obj.path = filePath;
				if (obj.filePath === undefined) obj.filePath = filePath;
				if (!obj.files) {
					obj.files = [{ path: filePath, start_line: obj.start_line, end_line: obj.end_line }];
				}
			}
		}

		return obj;
	}

	/**
	 * Scan the assistant message text for inline JSON that represents tool calls.
	 * This catches cases where the model emits tool payloads as bare JSON in its
	 * text response instead of using structured tool-call parts (e.g. non-standard
	 * provider response format, proxy intermediaries, or models that embed JSON
	 * alongside natural-language explanation).
	 *
	 * Strategy:
	 * 1. Concatenate all text parts of the message.
	 * 2. Find JSON objects or arrays using a brace-balancing scanner.
	 * 3. Try JSON.parse on each candidate.
	 * 4. Map the parsed fields to a registered tool name via heuristics:
	 *    - If the object has an explicit `tool`/`toolName`/`name` field, use it.
	 *    - If it has `filePath` + `content`/`code` → `write_file`.
	 *    - If it has `filePath` + edit-related fields → `edit`.
	 *    - If it has `command`/`commands` → `bash`.
	 *    - If it has `filePath`/`path` only → `read_file`.
	 * 5. Verify the tool name resolves via getTool().
	 * 6. Create AgentToolCallPart objects for each match.
	 */
	private scanTextForJsonToolCalls(
		message: AgentMessage,
	): AgentToolCallPart[] {
		const textParts = message.content.filter(
			(p): p is AgentTextPart => p.type === "text",
		);
		if (textParts.length === 0) return [];

		const fullText = textParts.map((p) => p.text).join("\n");
		// OPT-10: Early exit if text too short or no JSON delimiters present.
		if (fullText.length < 10) return [];
		if (!fullText.includes("{") && !fullText.includes("[")) return [];
		const candidates = this.findJsonCandidates(fullText);
		if (candidates.length === 0) return [];

		const result: AgentToolCallPart[] = [];
		const usedRanges: Array<{ start: number; end: number }> = [];

		for (const { start, end, raw } of candidates) {
			if (usedRanges.some((r) => start < r.end && end > r.start)) continue;

			let parsed: unknown;
			try {
				parsed = JSON.parse(raw);
			} catch {
				continue;
			}
			if (typeof parsed !== "object" || parsed === null) continue;

			const obj = parsed as Record<string, unknown>;
			const toolName = this.matchToolNameFromJson(obj);
			if (!toolName) continue;

			const tool = this.getTool(toolName);
			if (!tool) continue;

			usedRanges.push({ start, end });
			result.push({
				type: "tool-call",
				toolCallId: createUID("tool"),
				toolName,
				input: obj,
			});
		}

		return result;
	}

	/**
	 * Find JSON object/array candidates in text using brace/bracelet balancing.
	 * Returns the raw string and its character range for each candidate.
	 */
	private findJsonCandidates(text: string): Array<{
		start: number;
		end: number;
		raw: string;
	}> {
		const candidates: Array<{ start: number; end: number; raw: string }> = [];
		const delimiters: Record<string, string> = { "{": "}", "[": "]" };

		for (let i = 0; i < text.length; i++) {
			const ch = text[i];
			const close = delimiters[ch];
			if (!close) continue;

			let depth = 1;
			let inString = false;
			let escape = false;
			for (let j = i + 1; j < text.length; j++) {
				const c = text[j];
				if (escape) {
					escape = false;
					continue;
				}
				if (c === "\\") {
					escape = true;
					continue;
				}
				if (c === '"') {
					inString = !inString;
					continue;
				}
				if (inString) continue;

				if (c === ch) {
					depth++;
				} else if (c === close) {
					depth--;
					if (depth === 0) {
						const raw = text.slice(i, j + 1);
						if (raw.length >= 2) {
							candidates.push({ start: i, end: j + 1, raw });
						}
						break;
					}
				}
			}
		}

		return candidates;
	}

	/**
	 * Infer a tool name from the fields of a parsed JSON object.
	 * Checks for explicit tool-name fields first, then heuristics.
	 */
	private matchToolNameFromJson(
		obj: Record<string, unknown>,
	): string | undefined {
		// Explicit tool-name field
		const explicitName =
			(typeof obj.tool === "string" ? obj.tool : undefined) ??
			(typeof obj.toolName === "string" ? obj.toolName : undefined) ??
			(typeof obj.name === "string" ? obj.name : undefined);
		if (explicitName && this.getTool(explicitName)) {
			return explicitName;
		}

		const hasFilePath = (key: string) =>
			key === "filePath" || key === "path" || key === "file" || key === "filename";

		const filePathKeys = Object.keys(obj).filter(hasFilePath);
		const hasFilePathValue = filePathKeys.length > 0;

		const hasContent =
			typeof obj.content === "string" ||
			typeof obj.text === "string" ||
			typeof obj.code === "string" ||
			typeof obj.new_text === "string";

		const hasEditFields =
			typeof obj.oldString === "string" ||
			typeof obj.old_text === "string" ||
			typeof obj.search === "string";

		const hasCommand =
			typeof obj.command === "string" ||
			typeof obj.commands === "string" ||
			(Array.isArray(obj.commands) && obj.commands.length > 0);

		// Write / create tools
		if (hasFilePathValue && hasContent) {
			if (this.getTool("write_file")) return "write_file";
			if (this.getTool("write")) return "write";
		}

		// Edit tool
		if (hasFilePathValue && hasEditFields) {
			if (this.getTool("editor")) return "editor";
			if (this.getTool("edit")) return "edit";
		}

		// Bash / shell
		if (hasCommand) {
			if (this.getTool("bash")) return "bash";
			if (this.getTool("shell")) return "shell";
		}

		// Read tool (filePath but no content)
		if (hasFilePathValue) {
			if (this.getTool("read_file")) return "read_file";
			if (this.getTool("read")) return "read";
		}

		return undefined;
	}

	private async prepareToolExecution(
		toolCall: AgentToolCallPart,
	): Promise<PreparedToolExecution> {
		const tool = this.getTool(toolCall.toolName);
		let input = this.normalizeToolInputPayload(toolCall.toolName, toolCall.input);
		let skipReason: string | undefined;
		const metadata =
			toolCall.metadata &&
			typeof toolCall.metadata === "object" &&
			!Array.isArray(toolCall.metadata)
				? (toolCall.metadata as Record<string, unknown>)
				: undefined;

		if (typeof metadata?.inputParseError === "string") {
			skipReason = metadata.inputParseError;
		}

		const toolSource =
			metadata?.toolSource &&
			typeof metadata.toolSource === "object" &&
			!Array.isArray(metadata.toolSource)
				? (metadata.toolSource as Record<string, unknown>)
				: undefined;
		if (toolSource?.executionMode === "provider") {
			const providerId =
				typeof toolSource.providerId === "string"
					? toolSource.providerId
					: "provider";
			skipReason = `Tool execution is disabled for provider ${providerId}`;
		}

		let policyOverride: ToolPolicy | undefined;
		if (tool && !skipReason) {
			for (const hook of this.hooks.beforeTool) {
				const result = (await hook({
					snapshot: this.snapshot(),
					tool,
					toolCall,
					input,
				})) as AgentBeforeToolResult | undefined;
				if (result?.input !== undefined) {
					input = result.input;
				}
				if (result?.policy) {
					policyOverride = {
						...policyOverride,
						...result.policy,
					};
				}
				this.applyStopControl(result);
				if (result?.skip) {
					skipReason =
						result.reason ?? `Tool ${tool.name} was blocked by a runtime hook`;
					break;
				}
			}
		}

		if (tool && !skipReason) {
			const policy = {
				...resolveToolPolicy(toolCall.toolName, this.config.toolPolicies),
				...policyOverride,
			};
			if (policy.enabled === false) {
				skipReason = `Tool "${toolCall.toolName}" is disabled by policy`;
			} else if (policy.autoApprove === false) {
				const approval = await this.requestToolApproval(
					toolCall,
					input,
					policy,
				);
				if (!approval.approved) {
					skipReason =
						approval.reason ?? `Tool "${toolCall.toolName}" was not approved`;
				}
			}
		}

		return {
			toolCall: { ...toolCall, input },
			tool,
			input,
			skipReason,
		};
	}

	private async requestToolApproval(
		toolCall: AgentToolCallPart,
		input: unknown,
		policy: ToolPolicy,
	): Promise<ToolApprovalResult> {
		const requestApproval = this.config.requestToolApproval;
		if (!requestApproval) {
			return {
				approved: false,
				reason: `Tool "${toolCall.toolName}" requires approval but no approval callback is configured`,
			};
		}
		try {
			return await requestApproval({
				sessionId:
					this.config.sessionId?.trim() ||
					this.config.conversationId?.trim() ||
					this.state.runId ||
					this.state.agentId,
				agentId: this.state.agentId,
				conversationId:
					this.config.conversationId?.trim() ||
					this.state.runId ||
					this.state.agentId,
				iteration: this.state.iteration,
				toolCallId: toolCall.toolCallId,
				toolName: toolCall.toolName,
				input,
				policy,
			});
		} catch (error) {
			return {
				approved: false,
				reason: `Tool "${toolCall.toolName}" approval request failed: ${
					error instanceof Error ? error.message : String(error)
				}`,
			};
		}
	}

	private async executePreparedTool(
		prepared: PreparedToolExecution,
	): Promise<AgentMessage> {
		const _toolProfId = profiler.start(`tool.execute(${prepared.toolCall.toolName})`, "tool", {
			toolName: prepared.toolCall.toolName,
			inputSize: JSON.stringify(prepared.input ?? {}).length,
		});
		const startedAt = new Date();
		await this.emit({
			type: "tool-started",
			snapshot: this.snapshot(),
			iteration: this.state.iteration,
			toolCall: prepared.toolCall,
		});

		let current = prepared;
		let result: AgentToolResult | undefined;
		let lastErrorText: string | undefined;

		for (let attempt = 0; attempt < 2; attempt += 1) {
			try {
				if (current.skipReason) {
					throw new Error(current.skipReason);
				}
				if (!current.tool) {
					throw new Error(`Unknown tool: ${current.toolCall.toolName}`);
				}

				const output = await current.tool.execute(current.input, {
					sessionId: this.config.sessionId,
					agentId: this.state.agentId,
					conversationId: this.config.conversationId,
					runId: this.state.runId ?? createUID("run"),
					iteration: this.state.iteration,
					toolCallId: current.toolCall.toolCallId,
					signal: this.abortController?.signal,
					metadata: this.config.toolContextMetadata,
					snapshot: this.snapshot(),
					emitUpdate: (update: unknown) => {
						void this.emit({
							type: "tool-updated",
							snapshot: this.snapshot(),
							iteration: this.state.iteration,
							toolCall: current.toolCall,
							update,
						});
					},
				});
				result = { output };
				break;
			} catch (error) {
				lastErrorText = error instanceof Error ? error.message : String(error);
				const recovered = this.recoverToolExecution(current, lastErrorText);
				if (recovered && recovered !== current) {
					current = recovered;
					continue;
				}

				result = {
					output: { error: lastErrorText },
					isError: true,
				};
				break;
			}
		}

		if (!result) {
			result = {
				output: { error: lastErrorText ?? "Tool execution failed" },
				isError: true,
			};
		}

		const endedAt = new Date();
		const durationMs = Math.max(0, endedAt.getTime() - startedAt.getTime());

		if (current.tool) {
			for (const hook of this.hooks.afterTool) {
				const after = (await hook({
					snapshot: this.snapshot(),
					tool: current.tool,
					toolCall: current.toolCall,
					input: current.input,
					result,
					startedAt,
					endedAt,
					durationMs,
				})) as AgentAfterToolResult | undefined;
				this.applyStopControl(after);
				if (after?.result) {
					result = after.result;
				}
			}
		}

		const message = createMessage("tool", [
			{
				type: "tool-result",
				toolCallId: current.toolCall.toolCallId,
				toolName: current.tool?.name ?? current.toolCall.toolName,
				output: result.output,
				isError: result.isError,
			},
		]);

		await this.emit({
			type: "tool-finished",
			snapshot: this.snapshot(),
			iteration: this.state.iteration,
			toolCall: current.toolCall,
			message,
		});

		// Record tool call metrics
		const outputStr = JSON.stringify(result.output ?? {});
		profiler.end(_toolProfId, { resultSize: outputStr.length, isError: result.isError });
		profiler.recordToolCall({
			toolName: current.toolCall.toolName,
			startMs: performance.now(),
			endMs: performance.now(),
			durationMs,
			argsSize: JSON.stringify(prepared.input ?? {}).length,
			resultSize: outputStr.length,
			retryCount: 0,
			recoveryCount: 0,
		});

		return message;
	}

	private finishRun(
		status: AgentRunResult["status"],
		assistantMessage?: AgentMessage,
		outputText?: string,
	): AgentRunResult {
		this.state.status = status;
		return {
			agentId: this.state.agentId,
			agentRole: this.state.agentRole,
			runId: this.state.runId ?? createUID("run"),
			status,
			iterations: this.state.iteration,
			outputText:
				outputText ??
				textFromMessage(assistantMessage ?? this.findLastAssistantMessage()),
			messages: cloneMessages(this.state.messages),
			usage: cloneUsage(this.state.usage),
		};
	}

	private findLastAssistantMessage(): AgentMessage | undefined {
		return [...this.state.messages]
			.reverse()
			.find((message) => message.role === "assistant");
	}

	private throwIfAborted(): void {
		if (this.abortController?.signal.aborted) {
			throw this.normalizeAbortError();
		}
	}

	private normalizeAbortError(): Error {
		const reason = this.abortController?.signal.reason;
		if (reason instanceof Error) {
			return reason;
		}
		if (typeof reason === "string") {
			return new Error(reason);
		}
		return new Error(this.state.lastError ?? "Run aborted");
	}

	private async emit(event: AgentRuntimeEvent): Promise<void> {
		const _profId = profiler.start(`emit(${event.type})`, "event");
		const metadata = buildEventMetadata(event);
		switch (event.type) {
			case "run-started":
				// Verbatim clinee calls `logger?.info?.(...)`. sdk-re's
				// `BasicLogger` does not declare `info` (it uses `log`), so
				// we narrow to an optional-info shape at the call site to
				// preserve the clinee runtime contract without mutating
				// shared's `BasicLogger` interface.
				(
					this.config.logger as
						| {
								info?: (msg: string, md?: unknown) => void;
						  }
						| undefined
				)?.info?.("Agent run started", metadata);
				break;
			case "tool-finished":
				(
					this.config.logger as
						| {
								info?: (msg: string, md?: unknown) => void;
						  }
						| undefined
				)?.info?.("Agent tool finished", metadata);
				break;
			case "run-failed":
				this.config.logger?.error?.("Agent run failed", {
					...metadata,
					error: event.error,
				});
				captureSdkError(this.config.telemetry, {
					component: "agents",
					operation: "agent.run",
					error: event.error,
					severity: "error",
					handled: false,
					context: metadata as TelemetryProperties,
				});
				break;
			default:
				this.config.logger?.debug?.("Agent event", metadata);
				break;
		}
		this.config.telemetry?.capture({
			event: `agent.${event.type}`,
			properties: metadata as TelemetryProperties,
		});
		for (const listener of this.listeners) {
			listener(event);
		}
		for (const hook of this.hooks.onEvent) {
			await hook(event);
		}
		profiler.end(_profId);
	}

	private applyStopControl(
		control: AgentStopControl | undefined | undefined,
	): void {
		if (!control?.stop) {
			return;
		}
		if (control.reason) {
			this.state.lastError = control.reason;
		}
		throw new ControlledStopError(control.reason);
	}
}

function buildEventMetadata(event: AgentRuntimeEvent): Record<string, unknown> {
	return {
		agentId: event.snapshot.agentId,
		agentRole: event.snapshot.agentRole,
		runId: event.snapshot.runId,
		status: event.snapshot.status,
		iteration: event.snapshot.iteration,
		eventType: event.type,
	};
}

function mergeToolMetadata(current: unknown, patch: unknown): unknown {
	if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
		return patch;
	}
	if (!current || typeof current !== "object" || Array.isArray(current)) {
		return patch;
	}
	return {
		...(current as Record<string, unknown>),
		...patch,
	};
}

function parseToolInput(assembly: PendingToolAssembly): {
	input: unknown;
	parseError?: string;
	invalidInput: Record<string, unknown>;
	reason?: InvalidToolCall["reason"];
} {
	if (assembly.inputValue !== undefined) {
		return {
			input: assembly.inputValue,
			invalidInput: buildInvalidToolInput(JSON.stringify(assembly.inputValue)),
		};
	}
	if (!assembly.inputText.trim()) {
		return {
			input: {},
			invalidInput: {},
			parseError: `Tool call ${assembly.toolName ?? assembly.toolCallId} emitted empty arguments. Tool calls must include valid JSON arguments.`,
			reason: "invalid_arguments",
		};
	}
	const parsed = parseToolArguments(assembly.inputText);
	if (parsed.ok) {
		return {
			input: parsed.value,
			invalidInput: buildInvalidToolInput(assembly.inputText),
		};
	}
	return {
		input: {},
		invalidInput: buildInvalidToolInput(assembly.inputText, parsed.error),
		parseError: `Tool call ${assembly.toolName ?? assembly.toolCallId} emitted invalid JSON arguments: ${parsed.error}`,
		reason: "invalid_arguments",
	};
}

function buildInvalidToolInput(
	value: string,
	parseError?: string,
): Record<string, unknown> {
	const trimmed = value.trim();
	if (!trimmed) {
		return {};
	}
	return parseError
		? { rawInputText: value, parseError }
		: { rawInputText: value };
}

/**
 * Robust JSON parser with recovery for common LLM formatting mistakes.
 * Handles: markdown code fences, trailing commas, single quotes,
 * malformed escapes, nested JSON strings, unicode, multiline strings,
 * partial streamed payloads, whitespace issues.
 */
export function parseToolArguments(
	value: string,
): { ok: true; value: unknown } | { ok: false; error: string } {
	const _profId = profiler.start("parseToolArguments", "tool", { inputLength: value.length });
	let trimmed = value.trim();
	
	// Treat empty input, empty braces, or empty parens as empty object
	if (!trimmed || trimmed === "{}" || trimmed === "()") {
		return { ok: true, value: {} };
	}

	// OPT-12: Fast path — if input starts with { or [, try direct JSON.parse first.
	if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
		try {
			const result = { ok: true as const, value: JSON.parse(trimmed) };
			profiler.end(_profId, { result: "fast" });
			return result;
		} catch {
			// Fall through to recovery steps
		}
	}

	// Step 1: Strip markdown code fences if present
	if (trimmed.startsWith("```json")) {
		trimmed = trimmed.slice(7);
		const endIdx = trimmed.lastIndexOf("```");
		if (endIdx !== -1) {
			trimmed = trimmed.slice(0, endIdx);
		}
		trimmed = trimmed.trim();
	} else if (trimmed.startsWith("```")) {
		trimmed = trimmed.slice(3);
		const endIdx = trimmed.lastIndexOf("```");
		if (endIdx !== -1) {
			trimmed = trimmed.slice(0, endIdx);
		}
		trimmed = trimmed.trim();
	}

	// Step 2: Strip function call wrappers like `run_commands(...)` or `(...)`
	const fnMatch = trimmed.match(/^(?:[a-zA-Z0-9_-]+\s*)?\(([\s\S]*)\)$/);
	if (fnMatch) {
		const inside = fnMatch[1].trim();
		if (!inside) {
			return { ok: true, value: {} };
		}
		trimmed = inside;
	}

	// Step 3: Direct parse fast path
	try {
		return { ok: true, value: JSON.parse(trimmed) };
	} catch {
		// Fall through to recovery
	}

	// Step 4: Python-style / keyword argument syntax recovery (e.g. `command="ls -la"` or `path='foo.txt'`)
	const kwMatch = trimmed.match(/^([a-zA-Z0-9_$]+)\s*=\s*(.*)$/s);
	if (kwMatch) {
		const key = kwMatch[1];
		let valStr = kwMatch[2].trim();
		try {
			const parsedVal = JSON.parse(valStr);
			return { ok: true, value: { [key]: parsedVal } };
		} catch {
			if (
				(valStr.startsWith("'") && valStr.endsWith("'")) ||
				(valStr.startsWith('"') && valStr.endsWith('"'))
			) {
				valStr = valStr.slice(1, -1);
			}
			return { ok: true, value: { [key]: valStr } };
		}
	}

	// Step 5: JSON structural recovery for object/array strings
	let recovered = trimmed;

	// Remove trailing commas before } or ]
	recovered = recovered.replace(/,\s*([}\]])/g, "$1");

	// Fix unquoted object keys: e.g. {command: "ls"} -> {"command": "ls"}
	recovered = recovered.replace(/(?<=[{\s,])([a-zA-Z0-9_$]+)\s*:/g, '"$1":');

	// Replace single quotes with double quotes for keys and values
	recovered = recovered.replace(/(?<=[{[\s,])'([^']*)'(?=[\s:}\],])/g, '"$1"');

	// Fix unescaped control characters
	recovered = recovered.replace(/[\x00-\x1f]/g, (match) => {
		const escapes: Record<string, string> = {
			'\n': '\\n',
			'\r': '\\r',
			'\t': '\\t',
		};
		return escapes[match] || `\\u${match.charCodeAt(0).toString(16).padStart(4, '0')}`;
	});

	try {
		return { ok: true, value: JSON.parse(recovered) };
	} catch {
		// Fall through to raw string check
	}

	// Step 6: Fallback for plain string inputs (e.g. raw commands like `ls -la` or `"ls -la"`)
	if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
		let plain = trimmed;
		if (
			(plain.startsWith("'") && plain.endsWith("'")) ||
			(plain.startsWith('"') && plain.endsWith('"'))
		) {
			plain = plain.slice(1, -1);
		}
		profiler.end(_profId, { result: "plain" });
		return { ok: true, value: plain };
	}

	profiler.end(_profId, { result: "failed" });
	return {
		ok: false,
		error: "Tool call arguments could not be parsed as JSON. Ensure the outer tool payload is valid JSON and escape embedded quotes/newlines inside string fields.",
	};
}

function mergeToolInputText(current: string, incoming: string): string {
	if (!current) {
		return incoming;
	}
	const trimmedIncoming = incoming.trim();
	if (trimmedIncoming.startsWith("{") || trimmedIncoming.startsWith("[")) {
		try {
			const parsedIncoming = JSON.parse(trimmedIncoming);
			if (typeof parsedIncoming === "object" && parsedIncoming !== null) {
				const parsedCurrent = JSON.parse(current.trim());
				if (typeof parsedCurrent === "object" && parsedCurrent !== null) {
					return incoming;
				}
			}
		} catch {
			// Ignore JSON parse errors - if either current or incoming is not a complete valid JSON object, treat as incremental stream delta
		}
	}
	return current + incoming;
}

export function createAgentRuntime(config: AgentRuntimeConfig): AgentRuntime {
	return new AgentRuntime(config);
}

/**
 * `Agent` is the user-friendly name for `AgentRuntime`. They are the same
 * class; this alias exists so standalone callers can write:
 *
 *     const agent = new Agent({ providerId, modelId, apiKey });
 *     await agent.run("hello");
 *
 * while `@cline/core` (which owns model construction) continues to use
 * the `AgentRuntime` name with `{ model, ... }` configs.
 */
export const Agent = AgentRuntime;
export type Agent = AgentRuntime;

export function createAgent(config: AgentRuntimeConfig): AgentRuntime {
	return new AgentRuntime(config);
}
