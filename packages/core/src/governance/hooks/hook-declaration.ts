import { createHash } from "node:crypto";

export const HOOK_EVENTS = [
	"SessionStart",
	"UserPromptSubmit",
	"PreToolUse",
	"PostToolUse",
	"Stop",
] as const;

export type HookEvent = (typeof HOOK_EVENTS)[number];

export interface HookDeclaration {
	/** Stable slot id, e.g. `workspace:<relative-config-path>:<index>`. */
	id: string;
	event: HookEvent;
	matcher?: string;
	type: "process" | "command";
	command?: string;
	args?: string[];
	source: string;
	timeoutMs?: number;
}

export class HookDeclarationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "HookDeclarationError";
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Validate untrusted JSON into declarations; invalid entries are rejected. */
export function parseHookDeclarations(raw: unknown): HookDeclaration[] {
	const list = Array.isArray(raw)
		? raw
		: isRecord(raw) && Array.isArray(raw.hooks)
			? raw.hooks
			: undefined;
	if (!list) throw new HookDeclarationError("hooks config must be an array");
	return list.map((entry, index) => {
		if (!isRecord(entry)) {
			throw new HookDeclarationError(`hook ${index}: expected an object`);
		}
		const event = String(entry.event ?? "");
		if (!HOOK_EVENTS.includes(event as HookEvent)) {
			throw new HookDeclarationError(`hook ${index}: unsupported event ${event}`);
		}
		const type = entry.type === "command" ? "command" : "process";
		const command = typeof entry.command === "string" ? entry.command : undefined;
		if (!command) {
			throw new HookDeclarationError(`hook ${index}: command is required`);
		}
		const args = Array.isArray(entry.args)
			? entry.args.map((arg) => String(arg))
			: undefined;
		const timeoutMs =
			typeof entry.timeoutMs === "number" && entry.timeoutMs > 0
				? entry.timeoutMs
				: undefined;
		return {
			id: String(entry.id ?? `hook-${index}`),
			event: event as HookEvent,
			...(typeof entry.matcher === "string" ? { matcher: entry.matcher } : {}),
			type,
			command,
			...(args ? { args } : {}),
			source: String(entry.source ?? "workspace"),
			...(timeoutMs ? { timeoutMs } : {}),
		};
	});
}

/** sha256 of the behavior fields; changing any of them changes the digest. */
export function hookDigest(declaration: HookDeclaration): string {
	const canonical = {
		event: declaration.event,
		matcher: declaration.matcher ?? "",
		type: declaration.type,
		command: declaration.command ?? "",
		args: declaration.args ?? [],
		timeoutMs: declaration.timeoutMs ?? 0,
	};
	return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

export * as HookDeclaration from "./hook-declaration";
