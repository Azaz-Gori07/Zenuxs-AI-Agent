import type {
	AgentExtensionAutomationContext,
	AgentResult,
	AutomationEventEnvelope,
	BasicLogger,
	ChatRunTurnRequest,
	ChatStartSessionRequest,
	ChatTurnResult,
	ExtensionContext,
	ITelemetryService,
} from "@cline/shared";
import type { CronEventIngressResult } from "../cron/events/cron-event-ingress";
import type { CronService } from "../cron/service/cron-service";
import type { HubScheduleRuntimeHandlers } from "../cron/service/schedule-service";
import type { RuntimeHost } from "../runtime/host/runtime-host";
import { normalizeProviderId } from "../services/llms/provider-settings";
import { SessionSource } from "../types/common";
import type {
	ZenuxsAutomationEventIngressResult,
	ZenuxsAutomationEventLog,
	ZenuxsAutomationListEventsOptions,
	ZenuxsAutomationListRunsOptions,
	ZenuxsAutomationListSpecsOptions,
	ZenuxsAutomationRun,
	ZenuxsAutomationSpec,
	ZenuxsCoreAutomationApi,
	ZenuxsCoreAutomationOptions,
} from "./types";

export function normalizeAutomationOptions(
	options: ZenuxsCoreAutomationOptions | boolean | undefined,
): ZenuxsCoreAutomationOptions | undefined {
	if (options === true) return {};
	if (!options) return undefined;
	return options;
}

export function normalizeAutomationCronScope(
	scope: ZenuxsCoreAutomationOptions["cronScope"],
): "global" | "workspace" | undefined {
	if (scope === "user") return "global";
	return scope;
}

export class ZenuxsCoreAutomationController implements ZenuxsCoreAutomationApi {
	constructor(private readonly getService: () => CronService) {}

	async start(): Promise<void> {
		await this.getService().start();
	}

	async stop(): Promise<void> {
		await this.getService().stop();
	}

	async reconcileNow(): Promise<void> {
		await this.getService().reconcileNow();
	}

	ingestEvent(
		event: AutomationEventEnvelope,
	): ZenuxsAutomationEventIngressResult {
		const result: CronEventIngressResult = this.getService().ingestEvent(event);
		return {
			event: result.event,
			duplicate: result.duplicate,
			matchedSpecIds: result.matchedSpecs.map((spec) => spec.specId),
			queuedRuns: result.queuedRuns,
			suppressions: result.suppressions,
		};
	}

	listEvents(
		options?: ZenuxsAutomationListEventsOptions,
	): ZenuxsAutomationEventLog[] {
		return this.getService().listEventLogs(options);
	}

	getEvent(eventId: string): ZenuxsAutomationEventLog | undefined {
		return this.getService().getEventLog(eventId);
	}

	listSpecs(options?: ZenuxsAutomationListSpecsOptions): ZenuxsAutomationSpec[] {
		return this.getService().listSpecs(options);
	}

	listRuns(options?: ZenuxsAutomationListRunsOptions): ZenuxsAutomationRun[] {
		return this.getService().listRuns(options);
	}
}

export interface ZenuxsCoreAutomationRuntimeHandlersInput {
	host: RuntimeHost;
	getExtensionContext(): ExtensionContext | undefined;
}

export function createZenuxsCoreAutomationRuntimeHandlers(
	input: ZenuxsCoreAutomationRuntimeHandlersInput,
): HubScheduleRuntimeHandlers {
	const { host } = input;
	return {
		async startSession(request) {
			const cwd = (request.cwd?.trim() || request.workspaceRoot).trim();
			const started = await host.startSession({
				source: request.source?.trim() || SessionSource.CLI,
				interactive: false,
				config: {
					providerId: normalizeProviderId(request.provider),
					modelId: request.model,
					apiKey: request.apiKey?.trim() || undefined,
					cwd,
					workspaceRoot: request.workspaceRoot,
					systemPrompt: request.systemPrompt ?? "",
					mode: resolveMode(request),
					maxIterations: request.maxIterations,
					enableTools: request.enableTools !== false,
					enableSpawnAgent: request.enableSpawn !== false,
					enableAgentTeams: request.enableTeams !== false,
					disableMcpSettingsTools: request.disableMcpSettingsTools,
					missionLogIntervalSteps: request.missionStepInterval,
					missionLogIntervalMs: request.missionTimeIntervalMs,
				},
				toolPolicies: request.toolPolicies ?? {
					"*": {
						autoApprove: request.autoApproveTools !== false,
					},
				},
				localRuntime: {
					extensionContext: input.getExtensionContext(),
					configExtensions: request.configExtensions,
				},
			});
			return {
				sessionId: started.sessionId,
				startResult: {
					sessionId: started.sessionId,
					manifestPath: started.manifestPath,
					messagesPath: started.messagesPath,
				},
			};
		},
		async sendSession(sessionId, request) {
			const result = await host.runTurn({
				sessionId,
				prompt: request.prompt,
				userImages: request.attachments?.userImages,
				userFiles: request.attachments?.userFiles?.map((file) => file.content),
				delivery: request.delivery,
			});
			if (!result) {
				throw new Error("ZenuxsCore automation runtime returned no result");
			}
			return { result: toChatTurnResult(result) };
		},
		async abortSession(sessionId) {
			await host.abort(sessionId, new Error("ZenuxsCore automation abort"));
			return { applied: true };
		},
		async stopSession(sessionId) {
			await host.stopSession(sessionId);
			return { applied: true };
		},
	};
}

export interface ZenuxsCoreAutomationExtensionContextInput {
	automationService?: CronService;
	automation: ZenuxsCoreAutomationApi;
	context?: ExtensionContext;
	clientName?: string;
	distinctId?: string;
	logger?: BasicLogger;
	telemetry?: ITelemetryService;
}

export function createZenuxsCoreAutomationExtensionContext(
	input: ZenuxsCoreAutomationExtensionContextInput,
): ExtensionContext | undefined {
	const automation = createAutomationPluginContext(
		input.automationService,
		input.automation,
	);
	const client =
		input.context?.client ??
		(input.clientName ? { name: input.clientName } : undefined);
	const user =
		input.context?.user ??
		(input.distinctId ? { distinctId: input.distinctId } : undefined);
	const logger = input.context?.logger ?? input.logger;
	const telemetry = input.context?.telemetry ?? input.telemetry;
	if (!automation && !client && !user && !logger && !telemetry) {
		return input.context;
	}
	return {
		...(input.context ?? {}),
		...(client ? { client } : {}),
		...(user ? { user } : {}),
		...(logger ? { logger } : {}),
		...(telemetry ? { telemetry } : {}),
		...(automation ? { automation } : {}),
	};
}

function createAutomationPluginContext(
	automationService: CronService | undefined,
	automation: ZenuxsCoreAutomationApi,
): AgentExtensionAutomationContext | undefined {
	if (!automationService) {
		return undefined;
	}
	return {
		ingestEvent: (event: AutomationEventEnvelope) => {
			automation.ingestEvent(event);
		},
	};
}

function toChatTurnResult(result: AgentResult): ChatTurnResult {
	return {
		text: result.text,
		usage: {
			inputTokens: result.usage.inputTokens,
			outputTokens: result.usage.outputTokens,
			cacheReadTokens: result.usage.cacheReadTokens,
			cacheWriteTokens: result.usage.cacheWriteTokens,
			totalCost: result.usage.totalCost,
		},
		inputTokens: result.usage.inputTokens,
		outputTokens: result.usage.outputTokens,
		iterations: result.iterations,
		finishReason: result.finishReason,
		toolCalls: result.toolCalls.map((call) => ({
			name: call.name,
			input: call.input,
			output: call.output,
			error: call.error,
			durationMs: call.durationMs,
		})),
	};
}

function resolveMode(
	request: ChatStartSessionRequest | ChatRunTurnRequest["config"],
): "act" | "plan" | "ask" | "debug" | "god" | "zen" | "yolo" {
	const valid = ["act", "plan", "ask", "debug", "god", "zen", "yolo"];
	const mode = request.mode || "act";
	return valid.includes(mode) ? (mode as "act" | "plan" | "ask" | "debug" | "god" | "zen" | "yolo") : "act";
}
