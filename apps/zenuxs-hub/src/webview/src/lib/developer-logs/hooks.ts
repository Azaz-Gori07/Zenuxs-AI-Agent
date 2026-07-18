import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { developerLogStore } from "./store";
import type {
	DeveloperLog,
	DeveloperLogCategory,
	DeveloperLogLevel,
} from "./store";

export function useDeveloperLogs() {
	const version = useSyncExternalStore(
		developerLogStore.subscribe,
		developerLogStore.getVersion,
		developerLogStore.getVersion,
	);
	// version is part of memo deps so consumers re-read on flush.
	const entries = useMemo(
		() => developerLogStore.getEntries(),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[version],
	);
	return { entries, version };
}

export function useDeveloperLogStoreControl() {
	const subscribe = developerLogStore.subscribe;
	const connect = useCallback(() => developerLogStore.connect(), []);
	const disconnect = useCallback(() => developerLogStore.disconnect(), []);
	const clear = useCallback(() => developerLogStore.clear(), []);
	const pause = useCallback(() => developerLogStore.pause(), []);
	const resume = useCallback(() => developerLogStore.resume(), []);
	const isPaused = useCallback(() => developerLogStore.isPaused(), []);
	return { subscribe, connect, disconnect, clear, pause, resume, isPaused };
}

// ---------------------------------------------------------------- filtering

export interface DeveloperLogFilters {
	search: string;
	regex: boolean;
	categories: Set<DeveloperLogCategory>;
	levels: Set<DeveloperLogLevel>;
	providers: Set<string>;
	models: Set<string>;
	sessions: Set<string>;
	conversations: Set<string>;
	from?: number;
	to?: number;
}

export function isSecretLikeField(key: string): boolean {
	return /key|token|secret|password|passwd|credential|authorization|bearer|auth/i.test(
		key,
	);
}

export function maskClientSecret(value: unknown): unknown {
	if (typeof value !== "string") return value;
	const trimmed = value.trim();
	if (trimmed.length <= 8) return "****************";
	const match = trimmed.match(/^([A-Za-z]+-)(.*)$/);
	if (match) {
		const prefix = match[1];
		const rest = match[2];
		if (rest.length <= 4) return `${prefix}${"*".repeat(rest.length)}`;
		return `${prefix}${"*".repeat(Math.min(20, rest.length - 4))}${rest.slice(-4)}`;
	}
	return `${"*".repeat(Math.min(20, trimmed.length - 4))}${trimmed.slice(-4)}`;
}

export function applySecretMasking(data: unknown): unknown {
	if (Array.isArray(data)) return data.map((item) => applySecretMasking(item));
	if (data && typeof data === "object") {
		const out: Record<string, unknown> = {};
		for (const [key, val] of Object.entries(data)) {
			out[key] = isSecretLikeField(key)
				? maskClientSecret(val)
				: applySecretMasking(val);
		}
		return out;
	}
	return data;
}

function matchesSearch(entry: DeveloperLog, filters: DeveloperLogFilters): boolean {
	const query = filters.search.trim();
	if (!query) return true;
	if (filters.regex) {
		try {
			const re = new RegExp(query, "i");
			return (
				re.test(entry.message) ||
				re.test(entry.source ?? "") ||
				re.test(entry.category) ||
				re.test(JSON.stringify(applySecretMasking(entry.data) ?? ""))
			);
		} catch {
			return false;
		}
	}
	const haystack = [
		entry.message,
		entry.source,
		entry.category,
		entry.provider,
		entry.model,
		entry.sessionId,
		entry.conversationId,
		entry.requestId,
		JSON.stringify(applySecretMasking(entry.data) ?? ""),
	]
		.filter(Boolean)
		.join(" ")
		.toLowerCase();
	return haystack.includes(query.toLowerCase());
}

export function filterLogs(
	entries: DeveloperLog[],
	filters: DeveloperLogFilters,
): DeveloperLog[] {
	const {
		categories,
		levels,
		providers,
		models,
		sessions,
		conversations,
		from,
		to,
	} = filters;
	return entries.filter((entry) => {
		if (categories.size > 0 && !categories.has(entry.category)) return false;
		if (levels.size > 0 && !levels.has(entry.level)) return false;
		if (providers.size > 0 && (!entry.provider || !providers.has(entry.provider)))
			return false;
		if (models.size > 0 && (!entry.model || !models.has(entry.model))) return false;
		if (sessions.size > 0 && (!entry.sessionId || !sessions.has(entry.sessionId)))
			return false;
		if (
			conversations.size > 0 &&
			(!entry.conversationId || !conversations.has(entry.conversationId))
		)
			return false;
		if (from !== undefined && entry.timestamp < from) return false;
		if (to !== undefined && entry.timestamp > to) return false;
		if (!matchesSearch(entry, filters)) return false;
		return true;
	});
}

// ---------------------------------------------------------------- export

function safeStringify(value: unknown): string {
	try {
		return JSON.stringify(value, null, 2);
	} catch {
		return String(value);
	}
}

export function toJson(entries: DeveloperLog[]): string {
	return safeStringify(entries.map((e) => ({ ...e, data: applySecretMasking(e.data) })));
}

export function toTxt(entries: DeveloperLog[]): string {
	return entries
		.map((e) => {
			const parts = [
				e.iso,
				e.level,
				e.category,
				e.source ? `[${e.source}]` : "",
				e.message,
			].filter(Boolean);
			let line = parts.join(" ");
			if (e.data && Object.keys(e.data).length > 0) {
				line += `\n  data: ${safeStringify(applySecretMasking(e.data))}`;
			}
			if (e.stack) line += `\n  stack: ${e.stack}`;
			return line;
		})
		.join("\n");
}

export function toMarkdown(entries: DeveloperLog[]): string {
	const lines = ["# Developer Logs", "", `Total entries: ${entries.length}`, ""];
	for (const e of entries) {
		lines.push(`- **${e.level}** \`${e.category}\` _${e.iso}_ — ${e.message}`);
		if (e.data && Object.keys(e.data).length > 0) {
			lines.push("  ```json");
			lines.push(safeStringify(applySecretMasking(e.data)));
			lines.push("  ```");
		}
		if (e.stack) {
			lines.push("  ```");
			lines.push(e.stack);
			lines.push("  ```");
		}
	}
	return lines.join("\n");
}

function csvEscape(value: unknown): string {
	if (value === undefined || value === null) return "";
	const str =
		typeof value === "string" ? value : safeStringify(applySecretMasking(value));
	if (/[",\n]/.test(str)) {
		return `"${str.replace(/"/g, '""')}"`;
	}
	return str;
}

export function toCsv(entries: DeveloperLog[]): string {
	const header = [
		"timestamp",
		"iso",
		"level",
		"category",
		"source",
		"provider",
		"model",
		"sessionId",
		"conversationId",
		"requestId",
		"message",
		"data",
		"stack",
	];
	const rows = entries.map((e) =>
		[
			e.timestamp,
			e.iso,
			e.level,
			e.category,
			e.source,
			e.provider,
			e.model,
			e.sessionId,
			e.conversationId,
			e.requestId,
			e.message,
			e.data,
			e.stack,
		]
			.map(csvEscape)
			.join(","),
	);
	return [header.join(","), ...rows].join("\n");
}

export function downloadText(filename: string, content: string, mime: string) {
	if (typeof document === "undefined") return;
	const blob = new Blob([content], { type: mime });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	URL.revokeObjectURL(url);
}

export function copyText(text: string) {
	if (typeof navigator !== "undefined") {
		void navigator.clipboard?.writeText(text);
	}
}

// ---------------------------------------------------------------- time helpers

export function formatLogTime(timestamp: number): string {
	const d = new Date(timestamp);
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
		d.getHours(),
	)}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, "0")}`;
}

export function useMultiSelectState<T extends string>(initial?: T[]) {
	const [selected, setSelected] = useState<Set<T>>(
		() => new Set<T>(initial ?? []),
	);
	const toggle = useCallback((value: T, checked: boolean) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (checked) next.add(value);
			else next.delete(value);
			return next;
		});
	}, []);
	const clear = useCallback(() => setSelected(new Set<T>()), []);
	return { selected, toggle, clear, setSelected };
}
