import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
	HookGovernance,
	HookTrustStore,
	type HookDeclaration,
	parseHookDeclarations,
} from "@cline/core";
import { resolveClineDataDir } from "@cline/shared/storage";
import { Command } from "commander";

type Io = { writeln: (text?: string) => void; writeErr: (text: string) => void };

function workspaceHooks(workspace: string): HookDeclaration[] {
	const file = join(workspace, ".zenuxs", "hooks.json");
	if (!existsSync(file)) return [];
	const raw = JSON.parse(readFileSync(file, "utf8")) as unknown;
	return parseHookDeclarations(raw).map((declaration, index) => ({
		...declaration,
		id: `workspace:${index}`,
		source: file,
	}));
}

function emit(io: Io, value: unknown): void {
	io.writeln(JSON.stringify(value));
}

export function createHooksGovernanceCommand(io: Io): Command {
	const command = new Command("hooks").description(
		"Review, grant and revoke trust for workspace hooks",
	);
	const dataDir = () => join(resolveClineDataDir(), "governance", "hook-trust.json");
	const governance = () => new HookGovernance(new HookTrustStore(dataDir()));

	command
		.command("review")
		.description("List hooks and their trust state")
		.requiredOption("--workspace <path>", "Workspace root")
		.action((opts: { workspace: string }) => {
			const declarations = workspaceHooks(opts.workspace);
			const review = governance().review(declarations, opts.workspace);
			emit(io, { workspace: opts.workspace, hooks: review });
		});

	command
		.command("status")
		.description("Show the trust store policy")
		.action(() => {
			const store = new HookTrustStore(dataDir());
			emit(io, {
				policy: store.getPolicy(),
				corrupt: store.isCorrupt(),
				entries: store.getData().entries,
				revocations: store.getData().revocations,
			});
		});

	command
		.command("grant")
		.description("Grant trust for a reviewed hook digest")
		.requiredOption("--workspace <path>", "Workspace root")
		.option("--digest <digest>", "Exact digest from `hooks review`")
		.option("--all", "Grant every reviewed hook in the workspace")
		.action((opts: { workspace: string; digest?: string; all?: boolean }) => {
			if (!opts.digest && !opts.all) {
				io.writeErr("grant requires --digest or --all");
				process.exitCode = 1;
				return;
			}
			const declarations = workspaceHooks(opts.workspace);
			const gov = governance();
			const granted = opts.all
				? gov.grantAll(declarations, opts.workspace)
				: gov.grantByDigest(declarations, opts.workspace, opts.digest ?? "")
					? 1
					: 0;
			emit(io, { granted });
			if (granted === 0) process.exitCode = 1;
		});

	command
		.command("revoke")
		.description("Revoke a grant by digest or all grants for a workspace")
		.requiredOption("--workspace <path>", "Workspace root")
		.option("--digest <digest>", "Digest to revoke")
		.option("--all", "Revoke every grant")
		.action((opts: { workspace: string; digest?: string; all?: boolean }) => {
			if (!opts.digest && !opts.all) {
				io.writeErr("revoke requires --digest or --all");
				process.exitCode = 1;
				return;
			}
			const revoked = governance().revoke({
				workspace: opts.workspace,
				...(opts.digest ? { digest: opts.digest } : {}),
				all: opts.all,
			});
			emit(io, { revoked });
		});

	command
		.command("run")
		.description("Execute one workspace hook through the trust gate")
		.requiredOption("--workspace <path>", "Workspace root")
		.requiredOption("--index <number>", "Hook index from `hooks review`")
		.action(async (opts: { workspace: string; index: string }) => {
			const index = Number.parseInt(opts.index, 10);
			const declaration = workspaceHooks(opts.workspace)[index];
			if (!declaration) {
				io.writeErr(`no hook at index ${opts.index}`);
				process.exitCode = 1;
				return;
			}
			const result = await governance().execute(
				declaration,
				opts.workspace,
			);
			emit(io, result);
			if (!result.ran || (result.exitCode !== 0 && result.exitCode !== null)) {
				process.exitCode = 1;
			}
		});

	return command;
}
