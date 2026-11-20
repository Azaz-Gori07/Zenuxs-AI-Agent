import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type {
	HookAuthorization,
	HookExecutionResult,
} from "../../governance/hooks/hook-governance";
import type { HookDeclaration } from "../../governance/hooks/hook-declaration";

export interface FlowStep {
	id: string;
	kind: "hook" | "plugin" | "agent";
	name?: string;
	prompt?: string;
	hookIndex?: number;
	pluginId?: string;
}

export interface FlowDefinition {
	id: string;
	name: string;
	steps: FlowStep[];
}

export interface FlowStepRecord {
	status: "completed" | "failed";
	result: string;
	reason?: string;
}

export interface FlowRunRecord {
	runId: string;
	flowId: string;
	status: "running" | "completed" | "failed";
	steps: Record<string, FlowStepRecord>;
	startedAt: string;
	finishedAt?: string;
}

export interface FlowEvent {
	type: "flow_started" | "step_result" | "flow_completed" | "flow_failed";
	runId: string;
	stepId?: string;
	status?: string;
	result?: string;
	reason?: string;
}

export interface FlowDependencies {
	hooks: HookDeclaration[];
	authorizeHook: (declaration: HookDeclaration) => Promise<HookAuthorization>;
	executeHook: (declaration: HookDeclaration) => Promise<HookExecutionResult>;
	isPluginEnabled: (pluginId: string) => boolean;
	runAgentStep: (prompt: string) => Promise<string>;
}

export class FlowError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "FlowError";
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Durable, fail-closed flow runner. Flows can only use gated hooks and plugins. */
export class FlowRunner {
	private readonly storeDir: string;
	private readonly runFile: string;

	constructor(dataDir: string) {
		this.storeDir = join(dataDir, "automation", "flows");
		this.runFile = join(this.storeDir, "runs.json");
		mkdirSync(this.storeDir, { recursive: true, mode: 0o700 });
	}

	loadDefinition(filePath: string): FlowDefinition {
		const raw = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
		if (!isRecord(raw) || typeof raw.id !== "string") {
			throw new FlowError("flow must declare an id");
		}
		if (!Array.isArray(raw.steps)) throw new FlowError("flow steps must be an array");
		const steps = raw.steps.map((entry, index): FlowStep => {
			if (!isRecord(entry) || typeof entry.id !== "string") {
				throw new FlowError(`step ${index} must declare an id`);
			}
			if (entry.kind !== "hook" && entry.kind !== "plugin" && entry.kind !== "agent") {
				throw new FlowError(`step ${entry.id}: unsupported kind`);
			}
			if (entry.kind === "agent" && typeof entry.prompt !== "string") {
				throw new FlowError(`step ${entry.id}: agent steps require a prompt`);
			}
			if (entry.kind === "plugin" && typeof entry.pluginId !== "string") {
				throw new FlowError(`step ${entry.id}: plugin steps require pluginId`);
			}
			if (entry.kind === "hook" && typeof entry.hookIndex !== "number") {
				throw new FlowError(`step ${entry.id}: hook steps require hookIndex`);
			}
			// No arbitrary command/shell field is accepted from a flow definition.
			return {
				id: entry.id,
				kind: entry.kind,
				...(typeof entry.name === "string" ? { name: entry.name } : {}),
				...(typeof entry.prompt === "string" ? { prompt: entry.prompt } : {}),
				...(typeof entry.pluginId === "string" ? { pluginId: entry.pluginId } : {}),
				...(typeof entry.hookIndex === "number" ? { hookIndex: entry.hookIndex } : {}),
			};
		});
		return { id: raw.id, name: typeof raw.name === "string" ? raw.name : raw.id, steps };
	}

	list(): FlowRunRecord[] {
		try {
			const parsed = JSON.parse(readFileSync(this.runFile, "utf8")) as unknown;
			return isRecord(parsed) && Array.isArray(parsed.runs)
				? (parsed.runs as FlowRunRecord[])
				: [];
		} catch {
			return [];
		}
	}

	get(runId: string): FlowRunRecord | undefined {
		return this.list().find((run) => run.runId === runId);
	}

	private save(run: FlowRunRecord): void {
		const runs = this.list().filter((item) => item.runId !== run.runId);
		runs.push(run);
		mkdirSync(dirname(this.runFile), { recursive: true, mode: 0o700 });
		const temp = `${this.runFile}.tmp`;
		writeFileSync(temp, `${JSON.stringify({ runs }, null, 2)}\n`, {
			encoding: "utf8",
			mode: 0o600,
		});
		renameSync(temp, this.runFile);
	}

	async run(
		definition: FlowDefinition,
		dependencies: FlowDependencies,
		emit: (event: FlowEvent) => void,
		options: { runId?: string; resume?: boolean } = {},
	): Promise<FlowRunRecord> {
		const runId = options.runId ?? `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
		const previous = options.resume ? this.get(runId) : undefined;
		if (options.resume && !previous) throw new FlowError(`unknown run ${runId}`);
		const record: FlowRunRecord = previous
			? { ...previous, status: "running" }
			: {
					runId,
					flowId: definition.id,
					status: "running",
					steps: {},
					startedAt: new Date().toISOString(),
				};
		this.save(record);
		emit({ type: "flow_started", runId });

		let failed = false;
		for (const step of definition.steps) {
			if (record.steps[step.id]?.status === "completed") {
				emit({
					type: "step_result",
					runId,
					stepId: step.id,
					status: "completed",
					result: "reused-from-journal",
				});
				continue;
			}
			const outcome = await this.executeStep(step, dependencies);
			record.steps[step.id] = outcome;
			this.save(record);
			emit({
				type: "step_result",
				runId,
				stepId: step.id,
				status: outcome.status,
				result: outcome.result,
				...(outcome.reason ? { reason: outcome.reason } : {}),
			});
			if (outcome.status === "failed") {
				failed = true;
				break;
			}
		}
		record.status = failed ? "failed" : "completed";
		record.finishedAt = new Date().toISOString();
		this.save(record);
		emit({ type: failed ? "flow_failed" : "flow_completed", runId });
		return record;
	}

	private async executeStep(
		step: FlowStep,
		dependencies: FlowDependencies,
	): Promise<FlowStepRecord> {
		if (step.kind === "agent") {
			try {
				const result = await dependencies.runAgentStep(step.prompt ?? "");
				return { status: "completed", result };
			} catch (error) {
				return {
					status: "failed",
					result: "agent step failed",
					reason: error instanceof Error ? error.message : String(error),
				};
			}
		}
		if (step.kind === "plugin") {
			const pluginId = step.pluginId ?? "";
			if (!dependencies.isPluginEnabled(pluginId)) {
				return {
					status: "failed",
					result: "plugin step denied",
					reason: `plugin ${pluginId} is not enabled`,
				};
			}
			return { status: "completed", result: `plugin ${pluginId} enabled` };
		}
		const declaration = dependencies.hooks[step.hookIndex ?? -1];
		if (!declaration) {
			return { status: "failed", result: "hook step denied", reason: "no such hook" };
		}
		const authorization = await dependencies.authorizeHook(declaration);
		if (!authorization.runnable) {
			// Fail closed: never call executeHook for an untrusted hook.
			return {
				status: "failed",
				result: "hook step denied",
				reason: `${authorization.state}: ${authorization.reason}`,
			};
		}
		const execution = await dependencies.executeHook(declaration);
		return {
			status: execution.exitCode === 0 || execution.exitCode === null ? "completed" : "failed",
			result: `hook exit=${String(execution.exitCode)}`,
			...(execution.exitCode ? { reason: execution.stderr?.trim() } : {}),
		};
	}
}

export * as FlowRunnerModule from "./flow-runner";
