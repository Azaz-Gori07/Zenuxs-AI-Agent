import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
	FlowRunner,
	HookGovernance,
	HookTrustStore,
	PluginExchange,
	parseHookDeclarations,
	type FlowEvent,
	type HookDeclaration,
} from "@cline/core";
import { resolveClineDataDir } from "@cline/shared/storage";
import { Command } from "commander";

type Io = { writeln: (text?: string) => void; writeErr: (text: string) => void };

function emit(io: Io, value: unknown): void {
	io.writeln(JSON.stringify(value));
}

/** Agent steps really invoke the built CLI against the current provider env. */
function runAgentStep(prompt: string): Promise<string> {
	const entry = process.argv[1] ? resolve(process.argv[1]) : "";
	const child = spawnSync(
		process.execPath,
		[
			entry,
			"-P",
			"openai-compatible",
			"-m",
			"fake-model",
			"-k",
			"fake-key",
			"--auto-approve",
			"true",
			"--json",
			prompt,
		],
		{ encoding: "utf8", env: process.env, timeout: 90_000, cwd: process.cwd() },
	);
	const result = child.stdout
		.split("\n")
		.map((line) => {
			try {
				return JSON.parse(line) as Record<string, unknown>;
			} catch {
				return undefined;
			}
		})
		.find((record) => record?.type === "run_result");
	return Promise.resolve(
		typeof result?.text === "string" ? result.text : `no result (exit ${child.status})`,
	);
}

export function createFlowCommand(io: Io): Command {
	const command = new Command("flow").description("Run durable automation flows");
	const dataDir = () => resolveClineDataDir();

	command
		.command("run")
		.description("Run a flow definition")
		.requiredOption("--file <path>", "Flow definition JSON")
		.option("--workspace <path>", "Workspace root used by hook steps")
		.option("--resume <runId>", "Resume a run, reusing completed steps")
		.action(async (opts: { file: string; workspace?: string; resume?: string }) => {
			try {
				const runner = new FlowRunner(dataDir());
				const definition = runner.loadDefinition(resolve(opts.file));
				const workspace = resolve(opts.workspace ?? process.cwd());
				const hooksFile = join(workspace, ".zenuxs", "hooks.json");
				const declarations: HookDeclaration[] = existsSync(hooksFile)
					? parseHookDeclarations(
							JSON.parse(readFileSync(hooksFile, "utf8")) as unknown,
						).map((declaration, index) => ({
							...declaration,
							id: `workspace:${index}`,
							source: hooksFile,
						}))
					: [];
				const governance = new HookGovernance(
					new HookTrustStore(join(dataDir(), "governance", "hook-trust.json")),
				);
				const exchange = new PluginExchange(dataDir());
				const dependencies = {
					hooks: declarations,
					authorizeHook: async (declaration: HookDeclaration) =>
						governance.authorize(declaration, workspace),
					executeHook: async (declaration: HookDeclaration) =>
						governance.execute(declaration, workspace),
					isPluginEnabled: (pluginId: string) =>
						exchange.list().some((plugin) => plugin.id === pluginId && plugin.enabled),
					runAgentStep,
				};
				const record = await runner.run(
					definition,
					dependencies,
					(event: FlowEvent) => emit(io, event),
					opts.resume ? { runId: opts.resume, resume: true } : {},
				);
				emit(io, { type: "flow_record", record });
				if (record.status === "failed") process.exitCode = 1;
			} catch (error) {
				io.writeErr(error instanceof Error ? error.message : String(error));
				process.exitCode = 1;
			}
		});

	command
		.command("list")
		.description("List flow runs")
		.action(() => emit(io, { runs: new FlowRunner(dataDir()).list() }));

	return command;
}
