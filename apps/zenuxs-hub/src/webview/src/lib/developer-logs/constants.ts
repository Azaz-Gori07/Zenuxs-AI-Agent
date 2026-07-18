import type {
	DeveloperLogCategory,
	DeveloperLogLevel,
} from "./store";

export const LEVEL_COLORS: Record<
	DeveloperLogLevel,
	{ text: string; bg: string; dot: string; label: string }
> = {
	TRACE: {
		text: "text-slate-500 dark:text-slate-400",
		bg: "bg-slate-500/10",
		dot: "bg-slate-400",
		label: "TRACE",
	},
	DEBUG: {
		text: "text-sky-600 dark:text-sky-400",
		bg: "bg-sky-500/10",
		dot: "bg-sky-400",
		label: "DEBUG",
	},
	INFO: {
		text: "text-blue-600 dark:text-blue-400",
		bg: "bg-blue-500/10",
		dot: "bg-blue-400",
		label: "INFO",
	},
	SUCCESS: {
		text: "text-emerald-600 dark:text-emerald-400",
		bg: "bg-emerald-500/10",
		dot: "bg-emerald-400",
		label: "SUCCESS",
	},
	WARNING: {
		text: "text-amber-600 dark:text-amber-400",
		bg: "bg-amber-500/10",
		dot: "bg-amber-400",
		label: "WARNING",
	},
	ERROR: {
		text: "text-red-600 dark:text-red-400",
		bg: "bg-red-500/10",
		dot: "bg-red-400",
		label: "ERROR",
	},
	CRITICAL: {
		text: "text-fuchsia-600 dark:text-fuchsia-400",
		bg: "bg-fuchsia-500/10",
		dot: "bg-fuchsia-400",
		label: "CRITICAL",
	},
};

export const ALL_LEVELS: DeveloperLogLevel[] = [
	"TRACE",
	"DEBUG",
	"INFO",
	"SUCCESS",
	"WARNING",
	"ERROR",
	"CRITICAL",
];

export const CATEGORY_META: Record<
	DeveloperLogCategory,
	{ label: string; short: string }
> = {
	auth: { label: "Authentication", short: "AUTH" },
	provider: { label: "Provider", short: "PROV" },
	model: { label: "Model", short: "MODEL" },
	api_request: { label: "API Request", short: "REQ" },
	api_response: { label: "API Response", short: "RES" },
	streaming: { label: "Streaming", short: "STRM" },
	tool: { label: "Tool", short: "TOOL" },
	agent: { label: "Agent", short: "AGNT" },
	conversation: { label: "Conversation", short: "CONV" },
	prompt: { label: "Prompt", short: "PRMT" },
	memory: { label: "Memory", short: "MEM" },
	api_key: { label: "API Key", short: "KEY" },
	storage: { label: "Storage", short: "STOR" },
	network: { label: "Network", short: "NET" },
	performance: { label: "Performance", short: "PERF" },
	extension: { label: "Extension", short: "EXT" },
	ui: { label: "UI", short: "UI" },
	error: { label: "Error", short: "ERR" },
	console: { label: "Console", short: "CON" },
	insights: { label: "Insights", short: "INS" },
};

export const ALL_CATEGORIES = Object.keys(
	CATEGORY_META,
) as DeveloperLogCategory[];
