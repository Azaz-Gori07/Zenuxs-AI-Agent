import { spawn } from "node:child_process";
import {
	type HookDeclaration,
	hookDigest,
} from "./hook-declaration";
import { HookTrustStore } from "./hook-trust-store";

export type HookTrustState =
	| "trusted"
	| "pending"
	| "stale"
	| "revoked"
	| "blocked";

export interface HookAuthorization {
	runnable: boolean;
	state: HookTrustState;
	reason: string;
	digest: string;
	grantedBy?: string;
}

export interface HookReviewItem extends HookAuthorization {
	declaration: HookDeclaration;
}

export interface HookExecutionResult extends HookAuthorization {
	ran: boolean;
	exitCode?: number | null;
	stdout?: string;
	stderr?: string;
}

const MAX_CAPTURE_BYTES = 64 * 1024;

/**
 * Decides whether a workspace hook may run and executes it only when trusted.
 * No code path here spawns a process before `authorize` returns runnable=true.
 */
export class HookGovernance {
	private readonly store: HookTrustStore;

	constructor(store: HookTrustStore) {
		this.store = store;
	}

	getStore(): HookTrustStore {
		return this.store;
	}

	authorize(declaration: HookDeclaration, workspace: string): HookAuthorization {
		const digest = hookDigest(declaration);
		const policy = this.store.getPolicy();
		if (policy === "deny") {
			return { runnable: false, state: "blocked", reason: "policy denies hooks", digest };
		}
		if (this.store.isCorrupt()) {
			return {
				runnable: false,
				state: "blocked",
				reason: `trust store corrupt: ${this.store.getCorruptReason()}`,
				digest,
			};
		}
		if (this.store.isRevoked(declaration.id, digest, workspace)) {
			return { runnable: false, state: "revoked", reason: "grant was revoked", digest };
		}
		const slot = this.store.findSlot(declaration.id, workspace);
		if (!slot) {
			return {
				runnable: false,
				state: "pending",
				reason: "no explicit grant for this workspace",
				digest,
			};
		}
		if (slot.digest !== digest) {
			return {
				runnable: false,
				state: "stale",
				reason: "declaration changed since it was granted",
				digest,
			};
		}
		if (policy === "allow_trusted_only" && !this.store.find(declaration.id, digest, workspace)) {
			return { runnable: false, state: "blocked", reason: "policy allows only trusted hooks", digest };
		}
		return {
			runnable: true,
			state: "trusted",
			reason: "explicit user grant on record",
			digest,
			grantedBy: slot.grantedBy,
		};
	}

	review(declarations: HookDeclaration[], workspace: string): HookReviewItem[] {
		return declarations.map((declaration) => ({
			declaration,
			...this.authorize(declaration, workspace),
		}));
	}

	/** Grant requires the exact digest of a declaration presented for review. */
	grantByDigest(
		declarations: HookDeclaration[],
		workspace: string,
		digest: string,
		grantedBy = "user",
	): boolean {
		if (this.store.isCorrupt()) return false;
		const declaration = declarations.find((item) => hookDigest(item) === digest);
		if (!declaration) return false;
		this.store.grant({
			id: declaration.id,
			digest,
			workspace,
			grantedAt: new Date().toISOString(),
			grantedBy,
		});
		return true;
	}

	grantAll(declarations: HookDeclaration[], workspace: string, grantedBy = "user"): number {
		if (this.store.isCorrupt()) return 0;
		let count = 0;
		for (const declaration of declarations) {
			const digest = hookDigest(declaration);
			if (this.store.find(declaration.id, digest, workspace)) continue;
			this.store.grant({
				id: declaration.id,
				digest,
				workspace,
				grantedAt: new Date().toISOString(),
				grantedBy,
			});
			count += 1;
		}
		return count;
	}

	revoke(options: {
		id?: string;
		digest?: string;
		workspace?: string;
		all?: boolean;
	}): number {
		return this.store.revoke(options);
	}

	/** Execute only after authorization; untrusted hooks never spawn. */
	async execute(
		declaration: HookDeclaration,
		workspace: string,
	): Promise<HookExecutionResult> {
		const authorization = this.authorize(declaration, workspace);
		if (!authorization.runnable) {
			return { ran: false, ...authorization };
		}
		const command = declaration.command ?? "";
		const processArgs =
			declaration.type === "command"
				? ["-c", command]
				: declaration.args ?? [];
		const executable = declaration.type === "command" ? "/bin/sh" : command;
		const timeoutMs = declaration.timeoutMs ?? 10_000;
		return await new Promise<HookExecutionResult>((resolve) => {
			const child = spawn(executable, processArgs, {
				cwd: workspace,
				env: process.env,
				shell: false,
			});
			let stdout = "";
			let stderr = "";
			let settled = false;
			const timer = setTimeout(() => {
				if (settled) return;
				settled = true;
				child.kill("SIGKILL");
				resolve({
					ran: true,
					...authorization,
					reason: "hook timed out",
					exitCode: null,
					stdout,
					stderr,
				});
			}, timeoutMs);
			child.stdout?.on("data", (chunk: Buffer) => {
				if (stdout.length < MAX_CAPTURE_BYTES) stdout += chunk.toString("utf8");
			});
			child.stderr?.on("data", (chunk: Buffer) => {
				if (stderr.length < MAX_CAPTURE_BYTES) stderr += chunk.toString("utf8");
			});
			child.on("error", (error) => {
				if (settled) return;
				settled = true;
				clearTimeout(timer);
				resolve({ ran: true, ...authorization, stderr: error.message, exitCode: 1 });
			});
			child.on("close", (code) => {
				if (settled) return;
				settled = true;
				clearTimeout(timer);
				resolve({ ran: true, ...authorization, exitCode: code, stdout, stderr });
			});
		});
	}
}

export * as HookGovernanceModule from "./hook-governance";
