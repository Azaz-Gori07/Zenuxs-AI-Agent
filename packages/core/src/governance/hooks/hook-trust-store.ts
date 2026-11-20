import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type HookPolicy = "user_decides" | "allow_trusted_only" | "deny";

export interface HookTrustEntry {
	id: string;
	digest: string;
	workspace: string;
	grantedAt: string;
	grantedBy: string;
}

export interface HookRevocation {
	id: string;
	digest: string;
	workspace: string;
	revokedAt: string;
}

export interface HookTrustData {
	schemaVersion: 1;
	policy: HookPolicy;
	entries: HookTrustEntry[];
	revocations: HookRevocation[];
}

export class HookTrustStoreError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "HookTrustStoreError";
	}
}

function emptyData(): HookTrustData {
	return { schemaVersion: 1, policy: "user_decides", entries: [], revocations: [] };
}

function validate(value: unknown): HookTrustData {
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		throw new HookTrustStoreError("trust store must be an object");
	}
	const record = value as Record<string, unknown>;
	if (record.schemaVersion !== 1) {
		throw new HookTrustStoreError("unsupported trust store schemaVersion");
	}
	if (
		record.policy !== "user_decides" &&
		record.policy !== "allow_trusted_only" &&
		record.policy !== "deny"
	) {
		throw new HookTrustStoreError("invalid trust policy");
	}
	if (!Array.isArray(record.entries) || !Array.isArray(record.revocations)) {
		throw new HookTrustStoreError("trust store entries must be arrays");
	}
	return {
		schemaVersion: 1,
		policy: record.policy,
		entries: record.entries.filter(
			(entry): entry is HookTrustEntry =>
				entry !== null &&
				typeof entry === "object" &&
				typeof (entry as HookTrustEntry).digest === "string" &&
				typeof (entry as HookTrustEntry).id === "string",
		),
		revocations: record.revocations.filter(
			(entry): entry is HookRevocation =>
				entry !== null &&
				typeof entry === "object" &&
				typeof (entry as HookRevocation).digest === "string",
		),
	};
}

/** File-backed trust store. Any corruption fails closed (no grants are honored). */
export class HookTrustStore {
	private readonly filePath: string;
	private data: HookTrustData;
	private corrupt = false;

	constructor(filePath: string) {
		this.filePath = filePath;
		this.data = emptyData();
		if (!existsSync(filePath)) return;
		try {
			const raw = readFileSync(filePath, "utf8");
			this.data = validate(JSON.parse(raw) as unknown);
		} catch (error) {
			this.corrupt = true;
			this.corruptReason =
				error instanceof Error ? error.message : "unreadable trust store";
		}
	}

	private corruptReason = "";

	isCorrupt(): boolean {
		return this.corrupt;
	}

	getCorruptReason(): string {
		return this.corruptReason;
	}

	getData(): HookTrustData {
		return this.data;
	}

	getPolicy(): HookPolicy {
		return this.data.policy;
	}

	setPolicy(policy: HookPolicy): void {
		this.assertHealthy();
		this.data.policy = policy;
		this.save();
	}

	find(id: string, digest: string, workspace: string): HookTrustEntry | undefined {
		return this.data.entries.find(
			(entry) =>
				entry.id === id && entry.digest === digest && entry.workspace === workspace,
		);
	}

	findSlot(id: string, workspace: string): HookTrustEntry | undefined {
		return this.data.entries.find(
			(entry) => entry.id === id && entry.workspace === workspace,
		);
	}

	isRevoked(id: string, digest: string, workspace: string): boolean {
		return this.data.revocations.some(
			(entry) =>
				entry.id === id && entry.digest === digest && entry.workspace === workspace,
		);
	}

	grant(entry: HookTrustEntry): void {
		this.assertHealthy();
		this.data.revocations = this.data.revocations.filter(
			(revocation) =>
				!(
					revocation.id === entry.id &&
					revocation.digest === entry.digest &&
					revocation.workspace === entry.workspace
				),
		);
		const existing = this.findSlot(entry.id, entry.workspace);
		this.data.entries = [
			...this.data.entries.filter((item) => item !== existing),
			entry,
		];
		this.save();
	}

	revoke(options: {
		id?: string;
		digest?: string;
		workspace?: string;
		all?: boolean;
	}): number {
		this.assertHealthy();
		const targets = this.data.entries.filter((entry) => {
			if (options.all) return true;
			if (options.digest && entry.digest !== options.digest) return false;
			if (options.id && entry.id !== options.id) return false;
			if (options.workspace && entry.workspace !== options.workspace) return false;
			return Boolean(options.digest || options.id || options.workspace);
		});
		if (targets.length === 0) return 0;
		this.data.entries = this.data.entries.filter((entry) => !targets.includes(entry));
		this.data.revocations.push(
			...targets.map((entry) => ({
				id: entry.id,
				digest: entry.digest,
				workspace: entry.workspace,
				revokedAt: new Date().toISOString(),
			})),
		);
		this.save();
		return targets.length;
	}

	private assertHealthy(): void {
		if (this.corrupt) {
			throw new HookTrustStoreError(
				`trust store is corrupt (${this.corruptReason}); repairs are refused`,
			);
		}
	}

	private save(): void {
		mkdirSync(dirname(this.filePath), { recursive: true, mode: 0o700 });
		const temp = `${this.filePath}.tmp`;
		writeFileSync(temp, `${JSON.stringify(this.data, null, 2)}\n`, {
			encoding: "utf8",
			mode: 0o600,
		});
		renameSync(temp, this.filePath);
	}
}

export * as HookTrustStoreModule from "./hook-trust-store";
