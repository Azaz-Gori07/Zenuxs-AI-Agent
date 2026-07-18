/**
 * Domain-specific emitters for the {@link loggerService}.
 *
 * These helpers give every module a single, typed call site for the kinds of
 * events the Developer Logs dashboard expects (auth, providers, models, API
 * requests/responses, streaming, tools, agents, conversations, prompts,
 * memory, API keys, storage, network, performance, extensions, UI, errors,
 * console mirror, and application insights).
 *
 * They are intentionally thin wrappers so that wiring a module to the logging
 * system is a one-line change.
 */

import {
	loggerService,
	LogLevel,
	LogCategory,
	type LogEntry,
} from "./logger-service";

function data(input: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
	return input && Object.keys(input).length > 0 ? input : undefined;
}

// ---------------------------------------------------------------- Authentication
export const devLogsAuth = {
	sessionStart(provider?: string, input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.INFO,
			category: LogCategory.AUTH,
			message: "Session started",
			source: "auth",
			provider,
			data: data(input),
		});
	},
	sessionEnd(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.INFO,
			category: LogCategory.AUTH,
			message: "Session ended",
			source: "auth",
			data: data(input),
		});
	},
	login(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.SUCCESS,
			category: LogCategory.AUTH,
			message: "Login",
			source: "auth",
			data: data(input),
		});
	},
	logout(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.INFO,
			category: LogCategory.AUTH,
			message: "Logout",
			source: "auth",
			data: data(input),
		});
	},
	oauthStarted(provider?: string, input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.DEBUG,
			category: LogCategory.AUTH,
			message: "OAuth started",
			source: "auth",
			provider,
			data: data(input),
		});
	},
	oauthSuccess(provider?: string, input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.SUCCESS,
			category: LogCategory.AUTH,
			message: "OAuth success",
			source: "auth",
			provider,
			data: data(input),
		});
	},
	oauthFailed(provider?: string, input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.ERROR,
			category: LogCategory.AUTH,
			message: "OAuth failed",
			source: "auth",
			provider,
			data: data(input),
		});
	},
	apiKeyAuth(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.DEBUG,
			category: LogCategory.AUTH,
			message: "API key authentication",
			source: "auth",
			data: data(input),
		});
	},
	credentialSync(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.DEBUG,
			category: LogCategory.AUTH,
			message: "Credential sync",
			source: "auth",
			data: data(input),
		});
	},
	tokenRefresh(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.DEBUG,
			category: LogCategory.AUTH,
			message: "Token refresh",
			source: "auth",
			data: data(input),
		});
	},
	retry(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.WARNING,
			category: LogCategory.AUTH,
			message: "Authentication retry",
			source: "auth",
			data: data(input),
		});
	},
	error(message: string, input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.ERROR,
			category: LogCategory.AUTH,
			message: `Authentication error: ${message}`,
			source: "auth",
			data: data(input),
		});
	},
};

// ---------------------------------------------------------------- Providers
export const devLogsProvider = {
	selected(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.DEBUG,
			category: LogCategory.PROVIDER,
			message: "Provider selected",
			source: "providers",
			data: data(input),
		});
	},
	resolved(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.DEBUG,
			category: LogCategory.PROVIDER,
			message: "Provider resolved",
			source: "providers",
			data: data(input),
		});
	},
	changed(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.INFO,
			category: LogCategory.PROVIDER,
			message: "Provider changed",
			source: "providers",
			data: data(input),
		});
	},
	metadata(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.TRACE,
			category: LogCategory.PROVIDER,
			message: "Provider metadata",
			source: "providers",
			data: data(input),
		});
	},
	modelSelected(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.DEBUG,
			category: LogCategory.PROVIDER,
			message: "Model selected",
			source: "providers",
			data: data(input),
		});
	},
	defaultProvider(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.DEBUG,
			category: LogCategory.PROVIDER,
			message: "Default provider",
			source: "providers",
			data: data(input),
		});
	},
	failure(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.ERROR,
			category: LogCategory.PROVIDER,
			message: "Provider failure",
			source: "providers",
			data: data(input),
		});
	},
	unsupported(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.WARNING,
			category: LogCategory.PROVIDER,
			message: "Unsupported provider",
			source: "providers",
			data: data(input),
		});
	},
};

// ---------------------------------------------------------------- Models
export const devLogsModel = {
	selected(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.DEBUG,
			category: LogCategory.MODEL,
			message: "Model selected",
			source: "model",
			data: data(input),
		});
	},
	switch(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.INFO,
			category: LogCategory.MODEL,
			message: "Model switch",
			source: "model",
			data: data(input),
		});
	},
	config(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.TRACE,
			category: LogCategory.MODEL,
			message: "Model configuration",
			source: "model",
			data: data(input),
		});
	},
};

// ---------------------------------------------------------------- API Requests
export const devLogsRequest = {
	start(input: {
		requestId: string;
		provider?: string;
		sessionId?: string;
		conversationId?: string;
		method?: string;
		url?: string;
		endpoint?: string;
		headers?: Record<string, unknown>;
		payloadSize?: number;
		parentId?: string;
		model?: string;
	}) {
		return loggerService.log({
			level: LogLevel.DEBUG,
			category: LogCategory.API_REQUEST,
			message: input.endpoint
				? `API request ${input.method ?? "POST"} ${input.endpoint}`
				: "API request",
			source: "api",
			requestId: input.requestId,
			sessionId: input.sessionId,
			conversationId: input.conversationId,
			provider: input.provider,
			model: input.model,
			parentId: input.parentId,
			data: data({
				method: input.method,
				url: input.url,
				endpoint: input.endpoint,
				headers: input.headers,
				payloadSize: input.payloadSize,
			}),
		});
	},
	stream(
		requestId: string,
		input?: Record<string, unknown>,
	) {
		return loggerService.log({
			level: LogLevel.TRACE,
			category: LogCategory.API_REQUEST,
			message: "API request stream",
			source: "api",
			requestId,
			data: data(input),
		});
	},
};

// ---------------------------------------------------------------- API Responses
export const devLogsResponse = {
	received(input: {
		requestId: string;
		status: number;
		statusText?: string;
		responseTime?: number;
		responseSize?: number;
		finishReason?: string;
		usage?: Record<string, unknown>;
		cached?: boolean;
		streamFinished?: boolean;
		headers?: Record<string, unknown>;
		errors?: unknown;
	}) {
		return loggerService.log({
			level: input.status >= 400 ? LogLevel.ERROR : LogLevel.SUCCESS,
			category: LogCategory.API_RESPONSE,
			message: `API response ${input.status}${input.statusText ? ` ${input.statusText}` : ""}`,
			source: "api",
			requestId: input.requestId,
			data: data({
				statusText: input.statusText,
				responseTime: input.responseTime,
				responseSize: input.responseSize,
				finishReason: input.finishReason,
				usage: input.usage,
				cached: input.cached,
				streamFinished: input.streamFinished,
				headers: input.headers,
				errors: input.errors,
			}),
		});
	},
};

// ---------------------------------------------------------------- Streaming
export const devLogsStream = {
	started(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.DEBUG,
			category: LogCategory.STREAMING,
			message: "Stream started",
			source: "streaming",
			data: data(input),
		});
	},
	connected(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.DEBUG,
			category: LogCategory.STREAMING,
			message: "Stream connected",
			source: "streaming",
			data: data(input),
		});
	},
	firstToken(requestId: string, input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.TRACE,
			category: LogCategory.STREAMING,
			message: "First token",
			source: "streaming",
			requestId,
			data: data(input),
		});
	},
	tokensReceived(requestId: string, count: number, input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.TRACE,
			category: LogCategory.STREAMING,
			message: `Tokens received (${count})`,
			source: "streaming",
			requestId,
			data: data({ count, ...(input ?? {}) }),
		});
	},
	paused(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.WARNING,
			category: LogCategory.STREAMING,
			message: "Stream paused",
			source: "streaming",
			data: data(input),
		});
	},
	resumed(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.INFO,
			category: LogCategory.STREAMING,
			message: "Stream resumed",
			source: "streaming",
			data: data(input),
		});
	},
	ended(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.INFO,
			category: LogCategory.STREAMING,
			message: "Stream ended",
			source: "streaming",
			data: data(input),
		});
	},
	cancelled(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.WARNING,
			category: LogCategory.STREAMING,
			message: "Stream cancelled",
			source: "streaming",
			data: data(input),
		});
	},
	parserError(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.ERROR,
			category: LogCategory.STREAMING,
			message: "Stream parser error",
			source: "streaming",
			data: data(input),
		});
	},
};

// ---------------------------------------------------------------- Tools
export const devLogsTool = {
	started(name: string, input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.DEBUG,
			category: LogCategory.TOOL,
			message: `Tool started: ${name}`,
			source: "tools",
			data: data({ tool: name, ...(input ?? {}) }),
		});
	},
	completed(name: string, input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.SUCCESS,
			category: LogCategory.TOOL,
			message: `Tool completed: ${name}`,
			source: "tools",
			data: data({ tool: name, ...(input ?? {}) }),
		});
	},
	failed(name: string, input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.ERROR,
			category: LogCategory.TOOL,
			message: `Tool failed: ${name}`,
			source: "tools",
			data: data({ tool: name, ...(input ?? {}) }),
		});
	},
	retry(name: string, input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.WARNING,
			category: LogCategory.TOOL,
			message: `Tool retry: ${name}`,
			source: "tools",
			data: data({ tool: name, ...(input ?? {}) }),
		});
	},
};

// ---------------------------------------------------------------- Agents
export const devLogsAgent = {
	started(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.INFO,
			category: LogCategory.AGENT,
			message: "Agent started",
			source: "agents",
			data: data(input),
		});
	},
	finished(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.SUCCESS,
			category: LogCategory.AGENT,
			message: "Agent finished",
			source: "agents",
			data: data(input),
		});
	},
	planner(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.TRACE,
			category: LogCategory.AGENT,
			message: "Planner",
			source: "agents",
			data: data(input),
		});
	},
	memoryRetrieval(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.TRACE,
			category: LogCategory.AGENT,
			message: "Memory retrieval",
			source: "agents",
			data: data(input),
		});
	},
	contextInjection(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.TRACE,
			category: LogCategory.AGENT,
			message: "Context injection",
			source: "agents",
			data: data(input),
		});
	},
	toolSelection(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.TRACE,
			category: LogCategory.AGENT,
			message: "Tool selection",
			source: "agents",
			data: data(input),
		});
	},
	toolResults(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.TRACE,
			category: LogCategory.AGENT,
			message: "Tool results",
			source: "agents",
			data: data(input),
		});
	},
	finalAnswer(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.INFO,
			category: LogCategory.AGENT,
			message: "Final answer",
			source: "agents",
			data: data(input),
		});
	},
};

// ---------------------------------------------------------------- Conversations
export const devLogsConversation = {
	created(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.INFO,
			category: LogCategory.CONVERSATION,
			message: "Conversation created",
			source: "conversation",
			data: data(input),
		});
	},
	loaded(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.DEBUG,
			category: LogCategory.CONVERSATION,
			message: "Conversation loaded",
			source: "conversation",
			data: data(input),
		});
	},
	saved(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.DEBUG,
			category: LogCategory.CONVERSATION,
			message: "Conversation saved",
			source: "conversation",
			data: data(input),
		});
	},
	deleted(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.WARNING,
			category: LogCategory.CONVERSATION,
			message: "Conversation deleted",
			source: "conversation",
			data: data(input),
		});
	},
	renamed(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.INFO,
			category: LogCategory.CONVERSATION,
			message: "Conversation renamed",
			source: "conversation",
			data: data(input),
		});
	},
	exported(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.INFO,
			category: LogCategory.CONVERSATION,
			message: "Conversation exported",
			source: "conversation",
			data: data(input),
		});
	},
	imported(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.INFO,
			category: LogCategory.CONVERSATION,
			message: "Conversation imported",
			source: "conversation",
			data: data(input),
		});
	},
};

// ---------------------------------------------------------------- Prompts
export const devLogsPrompt = {
	system(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.TRACE,
			category: LogCategory.PROMPT,
			message: "System prompt",
			source: "prompt",
			data: data(input),
		});
	},
	user(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.TRACE,
			category: LogCategory.PROMPT,
			message: "User prompt",
			source: "prompt",
			data: data(input),
		});
	},
	assistant(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.TRACE,
			category: LogCategory.PROMPT,
			message: "Assistant prompt",
			source: "prompt",
			data: data(input),
		});
	},
	contextSize(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.TRACE,
			category: LogCategory.PROMPT,
			message: "Context size",
			source: "prompt",
			data: data(input),
		});
	},
	injectedMemories(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.TRACE,
			category: LogCategory.PROMPT,
			message: "Injected memories",
			source: "prompt",
			data: data(input),
		});
	},
	compression(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.DEBUG,
			category: LogCategory.PROMPT,
			message: "Prompt compression",
			source: "prompt",
			data: data(input),
		});
	},
};

// ---------------------------------------------------------------- Memory
export const devLogsMemory = {
	saved(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.DEBUG,
			category: LogCategory.MEMORY,
			message: "Memory saved",
			source: "memory",
			data: data(input),
		});
	},
	loaded(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.DEBUG,
			category: LogCategory.MEMORY,
			message: "Memory loaded",
			source: "memory",
			data: data(input),
		});
	},
	updated(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.DEBUG,
			category: LogCategory.MEMORY,
			message: "Memory updated",
			source: "memory",
			data: data(input),
		});
	},
	deleted(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.WARNING,
			category: LogCategory.MEMORY,
			message: "Memory deleted",
			source: "memory",
			data: data(input),
		});
	},
	vectorSearch(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.TRACE,
			category: LogCategory.MEMORY,
			message: "Vector search",
			source: "memory",
			data: data(input),
		});
	},
	embeddingGeneration(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.TRACE,
			category: LogCategory.MEMORY,
			message: "Embedding generation",
			source: "memory",
			data: data(input),
		});
	},
};

// ---------------------------------------------------------------- API Keys
export const devLogsApiKey = {
	added(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.INFO,
			category: LogCategory.API_KEY,
			message: "API key added",
			source: "api_key",
			data: data(input),
		});
	},
	updated(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.INFO,
			category: LogCategory.API_KEY,
			message: "API key updated",
			source: "api_key",
			data: data(input),
		});
	},
	deleted(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.WARNING,
			category: LogCategory.API_KEY,
			message: "API key deleted",
			source: "api_key",
			data: data(input),
		});
	},
	validation(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.DEBUG,
			category: LogCategory.API_KEY,
			message: "API key validation",
			source: "api_key",
			data: data(input),
		});
	},
	sync(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.DEBUG,
			category: LogCategory.API_KEY,
			message: "API key sync",
			source: "api_key",
			data: data(input),
		});
	},
	encryption(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.TRACE,
			category: LogCategory.API_KEY,
			message: "API key encryption",
			source: "api_key",
			data: data(input),
		});
	},
	decryption(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.TRACE,
			category: LogCategory.API_KEY,
			message: "API key decryption",
			source: "api_key",
			data: data(input),
		});
	},
};

// ---------------------------------------------------------------- Storage
export const devLogsStorage = {
	settingsSaved(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.DEBUG,
			category: LogCategory.STORAGE,
			message: "Settings saved",
			source: "storage",
			data: data(input),
		});
	},
	settingsLoaded(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.DEBUG,
			category: LogCategory.STORAGE,
			message: "Settings loaded",
			source: "storage",
			data: data(input),
		});
	},
	localStorage(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.TRACE,
			category: LogCategory.STORAGE,
			message: "Local storage",
			source: "storage",
			data: data(input),
		});
	},
	indexedDb(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.TRACE,
			category: LogCategory.STORAGE,
			message: "IndexedDB",
			source: "storage",
			data: data(input),
		});
	},
	fileSystem(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.TRACE,
			category: LogCategory.STORAGE,
			message: "File system",
			source: "storage",
			data: data(input),
		});
	},
	cache(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.TRACE,
			category: LogCategory.STORAGE,
			message: "Cache",
			source: "storage",
			data: data(input),
		});
	},
};

// ---------------------------------------------------------------- Network
export const devLogsNetwork = {
	online(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.SUCCESS,
			category: LogCategory.NETWORK,
			message: "Online",
			source: "network",
			data: data(input),
		});
	},
	offline(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.WARNING,
			category: LogCategory.NETWORK,
			message: "Offline",
			source: "network",
			data: data(input),
		});
	},
	dnsFailure(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.ERROR,
			category: LogCategory.NETWORK,
			message: "DNS failure",
			source: "network",
			data: data(input),
		});
	},
	timeout(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.ERROR,
			category: LogCategory.NETWORK,
			message: "Timeout",
			source: "network",
			data: data(input),
		});
	},
	retry(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.WARNING,
			category: LogCategory.NETWORK,
			message: "Network retry",
			source: "network",
			data: data(input),
		});
	},
	slow(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.WARNING,
			category: LogCategory.NETWORK,
			message: "Slow network",
			source: "network",
			data: data(input),
		});
	},
};

// ---------------------------------------------------------------- Performance
export const devLogsPerformance = {
	appStartup(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.INFO,
			category: LogCategory.PERFORMANCE,
			message: "App startup",
			source: "performance",
			data: data(input),
		});
	},
	initialRender(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.TRACE,
			category: LogCategory.PERFORMANCE,
			message: "Initial render",
			source: "performance",
			data: data(input),
		});
	},
	providerLoadTime(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.DEBUG,
			category: LogCategory.PERFORMANCE,
			message: "Provider load time",
			source: "performance",
			data: data(input),
		});
	},
	requestDuration(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.DEBUG,
			category: LogCategory.PERFORMANCE,
			message: "Request duration",
			source: "performance",
			data: data(input),
		});
	},
	memoryUsage(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.DEBUG,
			category: LogCategory.PERFORMANCE,
			message: "Memory usage",
			source: "performance",
			data: data(input),
		});
	},
	cpuUsage(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.DEBUG,
			category: LogCategory.PERFORMANCE,
			message: "CPU usage",
			source: "performance",
			data: data(input),
		});
	},
	fps(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.TRACE,
			category: LogCategory.PERFORMANCE,
			message: "FPS",
			source: "performance",
			data: data(input),
		});
	},
	renderTime(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.TRACE,
			category: LogCategory.PERFORMANCE,
			message: "Render time",
			source: "performance",
			data: data(input),
		});
	},
};

// ---------------------------------------------------------------- Extensions
export const devLogsExtension = {
	activated(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.INFO,
			category: LogCategory.EXTENSION,
			message: "Extension activated",
			source: "extension",
			data: data(input),
		});
	},
	deactivated(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.INFO,
			category: LogCategory.EXTENSION,
			message: "Extension deactivated",
			source: "extension",
			data: data(input),
		});
	},
	commandExecuted(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.DEBUG,
			category: LogCategory.EXTENSION,
			message: "Command executed",
			source: "extension",
			data: data(input),
		});
	},
	webviewCreated(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.DEBUG,
			category: LogCategory.EXTENSION,
			message: "Webview created",
			source: "extension",
			data: data(input),
		});
	},
	webviewDestroyed(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.DEBUG,
			category: LogCategory.EXTENSION,
			message: "Webview destroyed",
			source: "extension",
			data: data(input),
		});
	},
	messagePassing(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.TRACE,
			category: LogCategory.EXTENSION,
			message: "Message passing",
			source: "extension",
			data: data(input),
		});
	},
	ipc(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.TRACE,
			category: LogCategory.EXTENSION,
			message: "IPC event",
			source: "extension",
			data: data(input),
		});
	},
};

// ---------------------------------------------------------------- UI
export const devLogsUi = {
	componentMounted(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.TRACE,
			category: LogCategory.UI,
			message: "Component mounted",
			source: "ui",
			data: data(input),
		});
	},
	componentUnmounted(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.TRACE,
			category: LogCategory.UI,
			message: "Component unmounted",
			source: "ui",
			data: data(input),
		});
	},
	stateChange(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.TRACE,
			category: LogCategory.UI,
			message: "State change",
			source: "ui",
			data: data(input),
		});
	},
	navigation(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.DEBUG,
			category: LogCategory.UI,
			message: "Navigation",
			source: "ui",
			data: data(input),
		});
	},
	modalOpen(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.TRACE,
			category: LogCategory.UI,
			message: "Modal open",
			source: "ui",
			data: data(input),
		});
	},
	modalClose(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.TRACE,
			category: LogCategory.UI,
			message: "Modal close",
			source: "ui",
			data: data(input),
		});
	},
	themeChange(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.DEBUG,
			category: LogCategory.UI,
			message: "Theme change",
			source: "ui",
			data: data(input),
		});
	},
};

// ---------------------------------------------------------------- Errors
export const devLogsError = {
	capture(input: {
		message: string;
		type?: string;
		stack?: string;
		source?: string;
		severity?: "error" | "critical";
		recoveryAction?: string;
		data?: Record<string, unknown>;
	}) {
		return loggerService.log({
			level: input.severity === "critical" ? LogLevel.CRITICAL : LogLevel.ERROR,
			category: LogCategory.ERROR,
			message: input.message,
			source: input.source ?? "error",
			stack: input.stack,
			data: data({
				errorType: input.type,
				recoveryAction: input.recoveryAction,
				...input.data,
			}),
		});
	},
};

// ---------------------------------------------------------------- Console mirror
export const devLogsConsole = {
	log(message: string, data?: unknown[]) {
		return loggerService.log({
			level: LogLevel.INFO,
			category: LogCategory.CONSOLE,
			message,
			source: "console.log",
			data: data ? { args: data } : undefined,
		});
	},
	info(message: string, data?: unknown[]) {
		return loggerService.log({
			level: LogLevel.INFO,
			category: LogCategory.CONSOLE,
			message,
			source: "console.info",
			data: data ? { args: data } : undefined,
		});
	},
	warn(message: string, data?: unknown[]) {
		return loggerService.log({
			level: LogLevel.WARNING,
			category: LogCategory.CONSOLE,
			message,
			source: "console.warn",
			data: data ? { args: data } : undefined,
		});
	},
	error(message: string, data?: unknown[]) {
		return loggerService.log({
			level: LogLevel.ERROR,
			category: LogCategory.CONSOLE,
			message,
			source: "console.error",
			data: data ? { args: data } : undefined,
		});
	},
	debug(message: string, data?: unknown[]) {
		return loggerService.log({
			level: LogLevel.DEBUG,
			category: LogCategory.CONSOLE,
			message,
			source: "console.debug",
			data: data ? { args: data } : undefined,
		});
	},
};

// ---------------------------------------------------------------- Application Insights
export const devLogsInsights = {
	connected(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.SUCCESS,
			category: LogCategory.INSIGHTS,
			message: "Telemetry connected",
			source: "insights",
			data: data(input),
		});
	},
	failed(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.ERROR,
			category: LogCategory.INSIGHTS,
			message: "Telemetry failed",
			source: "insights",
			data: data(input),
		});
	},
	ingestionEndpoint(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.DEBUG,
			category: LogCategory.INSIGHTS,
			message: "Telemetry ingestion endpoint",
			source: "insights",
			data: data(input),
		});
	},
	retry(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.WARNING,
			category: LogCategory.INSIGHTS,
			message: "Telemetry retry",
			source: "insights",
			data: data(input),
		});
	},
	droppedEvents(input?: Record<string, unknown>) {
		return loggerService.log({
			level: LogLevel.WARNING,
			category: LogCategory.INSIGHTS,
			message: "Dropped events",
			source: "insights",
			data: data(input),
		});
	},
};

export const devLogs = {
	auth: devLogsAuth,
	provider: devLogsProvider,
	model: devLogsModel,
	request: devLogsRequest,
	response: devLogsResponse,
	stream: devLogsStream,
	tool: devLogsTool,
	agent: devLogsAgent,
	conversation: devLogsConversation,
	prompt: devLogsPrompt,
	memory: devLogsMemory,
	apiKey: devLogsApiKey,
	storage: devLogsStorage,
	network: devLogsNetwork,
	performance: devLogsPerformance,
	extension: devLogsExtension,
	ui: devLogsUi,
	error: devLogsError,
	console: devLogsConsole,
	insights: devLogsInsights,
};

export type { LogEntry };
