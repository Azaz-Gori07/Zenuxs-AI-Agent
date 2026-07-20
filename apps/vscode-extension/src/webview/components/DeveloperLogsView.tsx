/**
 * DeveloperLogsView — The full Developer Settings page for the extension.
 *
 * Displays every important event occurring inside the extension in real time,
 * making it possible to debug providers, authentication, LLM requests,
 * streaming, storage, UI, and internal services from one place.
 *
 * Features:
 *   - Live log streaming with auto-scroll
 *   - Pause / Resume / Clear / Copy / Download
 *   - Search (plain text & regex)
 *   - Filter by category, level, provider, model, session, conversation, date
 *   - Detailed inspector panel (metadata, JSON, headers, timing, stack trace)
 *   - Export as JSON / CSV / TXT / Markdown
 *   - Virtualized list for millions of entries
 */

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { VirtualList, type VirtualListRow } from "./VirtualList.js";
import { JsonView } from "./JsonView.js";
import { postMessage } from "../vscode-api.js";
import { useExtensionState } from "../context/ExtensionStateContext.js";

// ---------------------------------------------------------------- Types

interface LogEntry {
	id: string;
	seq: number;
	timestamp: number;
	iso: string;
	level: string;
	category: string;
	message: string;
	source?: string;
	requestId?: string;
	sessionId?: string;
	conversationId?: string;
	provider?: string;
	model?: string;
	data?: Record<string, unknown>;
	stack?: string;
	parentId?: string;
	childIds?: string[];
}

type LogLevel = "TRACE" | "DEBUG" | "INFO" | "SUCCESS" | "WARNING" | "ERROR" | "CRITICAL";

const LOG_LEVELS: LogLevel[] = ["TRACE", "DEBUG", "INFO", "SUCCESS", "WARNING", "ERROR", "CRITICAL"];

const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
	TRACE: "var(--muted, #888)",
	DEBUG: "var(--info, #3b82f6)",
	INFO: "var(--fg, #ccc)",
	SUCCESS: "var(--success, #22c55e)",
	WARNING: "var(--warning, #f59e0b)",
	ERROR: "var(--error, #ef4444)",
	CRITICAL: "var(--error, #ef4444)",
};

const CATEGORIES = [
	"auth", "provider", "model", "api_request", "api_response", "streaming",
	"tool", "agent", "conversation", "prompt", "memory", "api_key",
	"storage", "network", "performance", "extension", "ui", "error",
	"console", "insights",
];

const CATEGORY_LABELS: Record<string, string> = {
	auth: "Authentication",
	provider: "Provider",
	model: "Model",
	api_request: "LLM Request",
	api_response: "LLM Response",
	streaming: "Streaming",
	tool: "Tool Calling",
	agent: "Agent",
	conversation: "Conversation",
	prompt: "Prompt",
	memory: "Memory",
	api_key: "API Key",
	storage: "Storage",
	network: "Network",
	performance: "Performance",
	extension: "Extension",
	ui: "UI",
	error: "Error",
	console: "Console",
	insights: "Insights",
};

// ---------------------------------------------------------------- Helpers

function formatTime(iso: string): string {
	try {
		const d = new Date(iso);
		return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3 as any });
	} catch {
		return iso;
	}
}

function formatDate(iso: string): string {
	try {
		const d = new Date(iso);
		return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
	} catch {
		return iso;
	}
}

function maskApiKey(value: string): string {
	if (!value) return value;
	const match = value.match(/^([A-Za-z]+-)(.*)$/);
	if (match) {
		const prefix = match[1];
		const rest = match[2];
		if (rest.length <= 4) return `${prefix}${"*".repeat(rest.length)}`;
		const suffix = rest.slice(-4);
		return `${prefix}${"*".repeat(Math.min(20, rest.length - 4))}${suffix}`;
	}
	if (value.length <= 8) return "****************";
	const suffix = value.slice(-4);
	return `${"*".repeat(Math.min(20, value.length - 4))}${suffix}`;
}

function escapeHtml(text: string): string {
	const div = document.createElement("div");
	div.textContent = text;
	return div.innerHTML;
}

// ---------------------------------------------------------------- Filter State

interface FilterState {
	search: string;
	regex: boolean;
	categories: Set<string>;
	levels: Set<string>;
	providers: Set<string>;
	models: Set<string>;
	sessions: Set<string>;
	conversations: Set<string>;
	dateFrom: string;
	dateTo: string;
}

const DEFAULT_FILTER: FilterState = {
	search: "",
	regex: false,
	categories: new Set(),
	levels: new Set(),
	providers: new Set(),
	models: new Set(),
	sessions: new Set(),
	conversations: new Set(),
	dateFrom: "",
	dateTo: "",
};

// ---------------------------------------------------------------- Component

export function DeveloperLogsView() {
	const { runCommand, switchTab } = useExtensionState();
	const [entries, setEntries] = useState<LogEntry[]>([]);
	const [paused, setPaused] = useState(false);
	const [autoScroll, setAutoScroll] = useState(true);
	const [selectedEntry, setSelectedEntry] = useState<LogEntry | null>(null);
	const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);
	const [showFilters, setShowFilters] = useState(false);
	const [showExportMenu, setShowExportMenu] = useState(false);
	const subscribedRef = useRef(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const bufferRef = useRef<LogEntry[]>([]);
	const rafRef = useRef<number | null>(null);

	// Batch flush for smooth rendering
	const scheduleFlush = useCallback(() => {
		if (rafRef.current) return;
		rafRef.current = requestAnimationFrame(() => {
			rafRef.current = null;
			if (bufferRef.current.length === 0) return;
			const batch = bufferRef.current;
			bufferRef.current = [];
			setEntries((prev) => {
				const next = [...prev, ...batch];
				if (next.length > 100_000) {
					return next.slice(next.length - 100_000);
				}
				return next;
			});
		});
	}, []);

	// Subscribe to developer logs from the extension host
	useEffect(() => {
		if (subscribedRef.current) return;
		subscribedRef.current = true;
		postMessage({ type: "developer_logs", action: "subscribe" });

		const handler = (event: MessageEvent) => {
			const msg = event.data;
			if (!msg || typeof msg !== "object") return;

			if (msg.type === "developer_logs_batch" && Array.isArray(msg.entries)) {
				bufferRef.current.push(...msg.entries);
				scheduleFlush();
			}
		};

		window.addEventListener("message", handler);
		return () => {
			subscribedRef.current = false;
			postMessage({ type: "developer_logs", action: "unsubscribe" });
			window.removeEventListener("message", handler);
		};
	}, [scheduleFlush]);

	// Cleanup RAF on unmount
	useEffect(() => {
		return () => {
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
		};
	}, []);

	// Auto-scroll
	useEffect(() => {
		if (!autoScroll || paused) return;
		const el = containerRef.current?.querySelector("[data-log-list]");
		if (el) {
			el.scrollTop = el.scrollHeight;
		}
	}, [entries, autoScroll, paused]);

	// ---------------------------------------------------------------- Filtering

	const filteredEntries = useMemo(() => {
		return entries.filter((entry) => {
			// Level filter
			if (filter.levels.size > 0 && !filter.levels.has(entry.level)) return false;

			// Category filter
			if (filter.categories.size > 0 && !filter.categories.has(entry.category)) return false;

			// Provider filter
			if (filter.providers.size > 0 && entry.provider && !filter.providers.has(entry.provider)) return false;

			// Model filter
			if (filter.models.size > 0 && entry.model && !filter.models.has(entry.model)) return false;

			// Session filter
			if (filter.sessions.size > 0 && entry.sessionId && !filter.sessions.has(entry.sessionId)) return false;

			// Conversation filter
			if (filter.conversations.size > 0 && entry.conversationId && !filter.conversations.has(entry.conversationId)) return false;

			// Date range
			if (filter.dateFrom) {
				const from = new Date(filter.dateFrom).getTime();
				if (entry.timestamp < from) return false;
			}
			if (filter.dateTo) {
				const to = new Date(filter.dateTo).getTime() + 86400000; // end of day
				if (entry.timestamp > to) return false;
			}

			// Search
			if (filter.search) {
				const searchText = filter.search.toLowerCase();
				const haystack = `${entry.message} ${entry.source || ""} ${entry.category} ${entry.level} ${entry.provider || ""} ${entry.model || ""}`.toLowerCase();
				if (filter.regex) {
					try {
						const re = new RegExp(filter.search, "i");
						if (!re.test(haystack)) return false;
					} catch {
						return false;
					}
				} else {
					if (!haystack.includes(searchText)) return false;
				}
			}

			return true;
		});
	}, [entries, filter]);

	// Build unique providers, models, sessions for filter dropdowns
	const filterOptions = useMemo(() => {
		const providers = new Set<string>();
		const models = new Set<string>();
		const sessions = new Set<string>();
		const conversations = new Set<string>();
		for (const e of entries) {
			if (e.provider) providers.add(e.provider);
			if (e.model) models.add(e.model);
			if (e.sessionId) sessions.add(e.sessionId);
			if (e.conversationId) conversations.add(e.conversationId);
		}
		return { providers: [...providers].sort(), models: [...models].sort(), sessions: [...sessions].sort(), conversations: [...conversations].sort() };
	}, [entries]);

	// ---------------------------------------------------------------- Actions

	const handleClear = useCallback(() => {
		setEntries([]);
		postMessage({ type: "developer_logs", action: "clear" });
	}, []);

	const handlePause = useCallback(() => {
		setPaused((p) => !p);
		if (paused) {
			postMessage({ type: "developer_logs", action: "resume" });
		} else {
			postMessage({ type: "developer_logs", action: "pause" });
		}
	}, [paused]);

	const handleCopy = useCallback(() => {
		const text = filteredEntries
			.map((e) => `[${e.iso}] [${e.level}] [${e.category}] ${e.message}${e.source ? ` (${e.source})` : ""}`)
			.join("\n");
		navigator.clipboard.writeText(text).catch(() => {});
	}, [filteredEntries]);

	const handleCopyFullDetails = useCallback(() => {
		const text = filteredEntries.map((e) => JSON.stringify(e, null, 2)).join("\n\n");
		navigator.clipboard.writeText(text).catch(() => {});
	}, [filteredEntries]);

	const handleCopyEntry = useCallback((entry: LogEntry) => {
		const text = JSON.stringify(entry, null, 2);
		navigator.clipboard.writeText(text).catch(() => {});
	}, []);

	const handleCopySelected = useCallback(() => {
		if (!selectedEntry) return;
		handleCopyEntry(selectedEntry);
	}, [selectedEntry, handleCopyEntry]);

	const handleCopySession = useCallback(() => {
		if (!selectedEntry?.sessionId) return;
		const sessionLogs = filteredEntries.filter((e) => e.sessionId === selectedEntry.sessionId);
		const text = sessionLogs
			.map((e) => `[${e.iso}] [${e.level}] [${e.category}] ${e.message}`)
			.join("\n");
		navigator.clipboard.writeText(text).catch(() => {});
	}, [filteredEntries, selectedEntry]);

	const handleExport = useCallback(
		(format: "json" | "csv" | "txt" | "md") => {
			const data = filteredEntries;
			let content = "";
			let mime = "text/plain";
			let ext = "txt";

			switch (format) {
				case "json":
					content = JSON.stringify(data, null, 2);
					mime = "application/json";
					ext = "json";
					break;
				case "csv": {
					const headers = "Timestamp,Level,Category,Source,Message,Provider,Model,SessionId,RequestId";
					const rows = data.map((e) =>
						[
							`"${e.iso}"`,
							e.level,
							e.category,
							e.source || "",
							`"${e.message.replace(/"/g, '""')}"`,
							e.provider || "",
							e.model || "",
							e.sessionId || "",
							e.requestId || "",
						].join(","),
					);
					content = [headers, ...rows].join("\n");
					mime = "text/csv";
					ext = "csv";
					break;
				}
				case "md": {
					const header = "| Timestamp | Level | Category | Source | Message |\n| --- | --- | --- | --- | --- |";
					const rows = data.map(
						(e) =>
							`| ${e.iso} | ${e.level} | ${e.category} | ${e.source || ""} | ${e.message.replace(/\|/g, "\\|")} |`,
					);
					content = [header, ...rows].join("\n");
					mime = "text/markdown";
					ext = "md";
					break;
				}
				default: {
					content = data
						.map((e) => `[${e.iso}] [${e.level}] [${e.category}] ${e.message}${e.source ? ` (${e.source})` : ""}`)
						.join("\n");
					ext = "txt";
					break;
				}
			}

			const blob = new Blob([content], { type: mime });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `developer-logs-${Date.now()}.${ext}`;
			a.click();
			URL.revokeObjectURL(url);
			setShowExportMenu(false);
		},
		[filteredEntries],
	);

	const handleDownload = useCallback(() => {
		handleExport("json");
	}, [handleExport]);

	// ---------------------------------------------------------------- Filter toggle helpers

	const toggleCategory = useCallback((cat: string) => {
		setFilter((f) => {
			const next = new Set(f.categories);
			if (next.has(cat)) next.delete(cat);
			else next.add(cat);
			return { ...f, categories: next };
		});
	}, []);

	const toggleLevel = useCallback((level: string) => {
		setFilter((f) => {
			const next = new Set(f.levels);
			if (next.has(level)) next.delete(level);
			else next.add(level);
			return { ...f, levels: next };
		});
	}, []);

	const toggleProvider = useCallback((provider: string) => {
		setFilter((f) => {
			const next = new Set(f.providers);
			if (next.has(provider)) next.delete(provider);
			else next.add(provider);
			return { ...f, providers: next };
		});
	}, []);

	const toggleModel = useCallback((model: string) => {
		setFilter((f) => {
			const next = new Set(f.models);
			if (next.has(model)) next.delete(model);
			else next.add(model);
			return { ...f, models: next };
		});
	}, []);

	const toggleSession = useCallback((session: string) => {
		setFilter((f) => {
			const next = new Set(f.sessions);
			if (next.has(session)) next.delete(session);
			else next.add(session);
			return { ...f, sessions: next };
		});
	}, []);

	// ---------------------------------------------------------------- Render

	const rows: VirtualListRow<LogEntry>[] = useMemo(
		() =>
			filteredEntries.map((entry) => ({
				key: entry.id,
				data: entry,
				height: 32,
			})),
		[filteredEntries],
	);

	const renderRow = useCallback(
		(row: VirtualListRow<LogEntry>, _style: React.CSSProperties, _index: number) => {
			const entry = row.data;
			const isSelected = selectedEntry?.id === entry.id;
			const levelColor = LOG_LEVEL_COLORS[entry.level as LogLevel] || "var(--fg, #ccc)";

			return (
				<div
					onClick={() => setSelectedEntry(isSelected ? null : entry)}
					style={{
						display: "flex",
						alignItems: "center",
						gap: 8,
						padding: "4px 8px",
						fontSize: "0.78em",
						fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace",
						cursor: "pointer",
						background: isSelected ? "rgba(124, 58, 237, 0.15)" : "transparent",
						borderBottom: "1px solid color-mix(in srgb, var(--border, #333) 50%, transparent)",
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
						userSelect: "none",
					}}
					onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
					onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
				>
					{/* Timestamp */}
					<span style={{ color: "var(--muted, #888)", flexShrink: 0, width: 80, fontSize: "0.9em" }}>
						{formatTime(entry.iso)}
					</span>

					{/* Level badge */}
					<span
						style={{
							color: levelColor,
							flexShrink: 0,
							width: 60,
							fontWeight: 600,
							fontSize: "0.85em",
						}}
					>
						{entry.level}
					</span>

					{/* Category */}
					<span
						style={{
							color: "var(--accent, #a78bfa)",
							flexShrink: 0,
							width: 90,
							fontSize: "0.85em",
							overflow: "hidden",
							textOverflow: "ellipsis",
						}}
					>
						{CATEGORY_LABELS[entry.category] || entry.category}
					</span>

					{/* Source */}
					{entry.source && (
						<span style={{ color: "var(--info, #3b82f6)", flexShrink: 0, width: 80, fontSize: "0.85em", overflow: "hidden", textOverflow: "ellipsis" }}>
							{entry.source}
						</span>
					)}

					{/* Message */}
					<span
						style={{
							flex: 1,
							overflow: "hidden",
							textOverflow: "ellipsis",
							color: "var(--fg, #ccc)",
						}}
						title={entry.message}
					>
						{entry.message}
					</span>

					{/* Provider/Model badges */}
					{entry.provider && (
						<span style={{ color: "var(--warning, #f59e0b)", flexShrink: 0, fontSize: "0.8em", marginLeft: 4 }}>
							{entry.provider}
						</span>
					)}
					{entry.model && (
						<span style={{ color: "var(--success, #22c55e)", flexShrink: 0, fontSize: "0.8em", marginLeft: 4 }}>
							{entry.model}
						</span>
					)}
				</div>
			);
		},
		[selectedEntry],
	);

	// ---------------------------------------------------------------- Detail Inspector

	const renderDetailInspector = () => {
		if (!selectedEntry) return null;
		const e = selectedEntry;

		return (
			<div
				style={{
					borderTop: "1px solid var(--border, #333)",
					padding: "12px 16px",
					background: "color-mix(in srgb, var(--bg, #1a1a2e) 95%, #000)",
					maxHeight: "40%",
					overflow: "auto",
					flexShrink: 0,
				}}
			>
				<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
					<h4 style={{ margin: 0, color: "#fff", fontSize: "0.9em" }}>Log Details</h4>
					<div style={{ display: "flex", gap: 6 }}>
						<button className="btn secondary sm" onClick={handleCopySelected}>Copy</button>
						{e.sessionId && <button className="btn secondary sm" onClick={handleCopySession}>Copy Session</button>}
						<button className="btn secondary sm" onClick={() => setSelectedEntry(null)}>Close</button>
					</div>
				</div>

				<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px", fontSize: "0.82em", marginBottom: 12 }}>
					<DetailField label="ID" value={e.id} />
					<DetailField label="Sequence" value={String(e.seq)} />
					<DetailField label="Timestamp" value={e.iso} />
					<DetailField label="Level" value={e.level} color={LOG_LEVEL_COLORS[e.level as LogLevel]} />
					<DetailField label="Category" value={CATEGORY_LABELS[e.category] || e.category} />
					<DetailField label="Source" value={e.source || "—"} />
					<DetailField label="Provider" value={e.provider || "—"} />
					<DetailField label="Model" value={e.model || "—"} />
					<DetailField label="Session ID" value={e.sessionId || "—"} />
					<DetailField label="Conversation ID" value={e.conversationId || "—"} />
					<DetailField label="Request ID" value={e.requestId || "—"} />
					<DetailField label="Parent ID" value={e.parentId || "—"} />
					{e.childIds && e.childIds.length > 0 && (
						<DetailField label="Child IDs" value={e.childIds.join(", ")} />
					)}
				</div>

				<div style={{ marginBottom: 8 }}>
					<strong style={{ color: "var(--muted, #888)", fontSize: "0.82em" }}>Message</strong>
					<div style={{ color: "#fff", fontSize: "0.85em", marginTop: 2 }}>{e.message}</div>
				</div>

				{e.data && Object.keys(e.data).length > 0 && (
					<div style={{ marginBottom: 8 }}>
						<strong style={{ color: "var(--muted, #888)", fontSize: "0.82em" }}>Metadata</strong>
						<div style={{ marginTop: 4 }}>
							<JsonView data={e.data} />
						</div>
					</div>
				)}

				{e.stack && (
					<div>
						<strong style={{ color: "var(--muted, #888)", fontSize: "0.82em" }}>Stack Trace</strong>
						<pre
							style={{
								background: "color-mix(in srgb, var(--bg, #1a1a2e) 80%, #000)",
								padding: 8,
								borderRadius: 4,
								fontSize: "0.78em",
								color: "var(--error, #ef4444)",
								overflow: "auto",
								maxHeight: 200,
								margin: "4px 0 0",
								whiteSpace: "pre-wrap",
								wordBreak: "break-all",
							}}
						>
							{e.stack}
						</pre>
					</div>
				)}
			</div>
		);
	};

	// ---------------------------------------------------------------- Main Render

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
			{/* Toolbar */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 6,
					padding: "8px 12px",
					flexShrink: 0,
					borderBottom: "1px solid var(--border, #333)",
					flexWrap: "wrap",
				}}
			>
				{/* Search */}
				<div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, minWidth: 200 }}>
					<input
						type="text"
						placeholder="Search logs..."
						value={filter.search}
						onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
						style={{
							flex: 1,
							background: "color-mix(in srgb, var(--bg, #1a1a2e) 80%, #000)",
							border: "1px solid var(--border, #333)",
							borderRadius: 4,
							padding: "4px 8px",
							color: "var(--fg, #ccc)",
							fontSize: "0.82em",
							fontFamily: "inherit",
						}}
					/>
					<label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.78em", color: "var(--muted, #888)", cursor: "pointer", flexShrink: 0 }}>
						<input
							type="checkbox"
							checked={filter.regex}
							onChange={(e) => setFilter((f) => ({ ...f, regex: e.target.checked }))}
						/>
						Regex
					</label>
				</div>

				{/* Action buttons */}
				<button className="btn secondary sm" onClick={() => setShowFilters((s) => !s)} title="Toggle filters">
					{showFilters ? "Hide Filters" : "Filters"}
				</button>
				<button className="btn secondary sm" onClick={handlePause} title={paused ? "Resume" : "Pause"}>
					{paused ? "▶ Resume" : "⏸ Pause"}
				</button>
				<button className="btn secondary sm" onClick={() => setAutoScroll((a) => !a)} title="Toggle auto-scroll">
					{autoScroll ? "🔽 Auto" : "⏹ Manual"}
				</button>
				<button className="btn secondary sm" onClick={handleClear} title="Clear all logs">
					🗑 Clear
				</button>
				<button className="btn secondary sm" onClick={handleCopyFullDetails} title="Copy all visible logs with full JSON details">
					📋 Copy Details
				</button>
				<button className="btn secondary sm" onClick={handleCopy} title="Copy all visible logs (summary)">
					📋 Copy
				</button>
				<div style={{ position: "relative" }}>
					<button className="btn secondary sm" onClick={() => setShowExportMenu((s) => !s)} title="Export logs">
						📥 Export
					</button>
					{showExportMenu && (
						<div
							style={{
								position: "absolute",
								top: "100%",
								right: 0,
								background: "var(--bg, #1a1a2e)",
								border: "1px solid var(--border, #333)",
								borderRadius: 6,
								padding: 4,
								zIndex: 100,
								minWidth: 120,
								boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
							}}
						>
							{(["json", "csv", "txt", "md"] as const).map((fmt) => (
								<button
									key={fmt}
									className="btn secondary sm"
									style={{ width: "100%", justifyContent: "flex-start", marginBottom: 2 }}
									onClick={() => handleExport(fmt)}
								>
									.{fmt.toUpperCase()}
								</button>
							))}
						</div>
					)}
				</div>

				{/* Entry count */}
				<span style={{ color: "var(--muted, #888)", fontSize: "0.78em", flexShrink: 0 }}>
					{filteredEntries.length.toLocaleString()} / {entries.length.toLocaleString()} entries
				</span>

				{/* Build commands */}
				<div style={{ display: "flex", gap: 4, marginLeft: "auto", borderLeft: "1px solid var(--border, #333)", paddingLeft: 8 }}>
					<button className="btn secondary sm" onClick={() => runCommand("build")} title="Run build">Build</button>
					<button className="btn secondary sm" onClick={() => runCommand("lint")} title="Run linter">Lint</button>
					<button className="btn secondary sm" onClick={() => runCommand("test")} title="Run tests">Test</button>
					<button className="btn secondary sm danger" onClick={() => runCommand("doctor")} title="Auto-fix issues">Doctor</button>
					<button className="btn secondary sm" onClick={() => switchTab("console")} title="Switch to build console">Console</button>
				</div>
			</div>

			{/* Filters panel */}
			{showFilters && (
				<div
					style={{
						padding: "8px 12px",
						borderBottom: "1px solid var(--border, #333)",
						background: "color-mix(in srgb, var(--bg, #1a1a2e) 90%, #000)",
						flexShrink: 0,
						maxHeight: 200,
						overflow: "auto",
					}}
				>
					<div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
						{/* Level filter */}
						<FilterGroup label="Level">
							{LOG_LEVELS.map((lvl) => (
								<FilterChip
									key={lvl}
									label={lvl}
									active={filter.levels.has(lvl)}
									color={LOG_LEVEL_COLORS[lvl]}
									onClick={() => toggleLevel(lvl)}
								/>
							))}
						</FilterGroup>

						{/* Category filter */}
						<FilterGroup label="Category">
							{CATEGORIES.map((cat) => (
								<FilterChip
									key={cat}
									label={CATEGORY_LABELS[cat] || cat}
									active={filter.categories.has(cat)}
									onClick={() => toggleCategory(cat)}
								/>
							))}
						</FilterGroup>

						{/* Provider filter */}
						{filterOptions.providers.length > 0 && (
							<FilterGroup label="Provider">
								{filterOptions.providers.map((p) => (
									<FilterChip
										key={p}
										label={p}
										active={filter.providers.has(p)}
										onClick={() => toggleProvider(p)}
									/>
								))}
							</FilterGroup>
						)}

						{/* Model filter */}
						{filterOptions.models.length > 0 && (
							<FilterGroup label="Model">
								{filterOptions.models.map((m) => (
									<FilterChip
										key={m}
										label={m}
										active={filter.models.has(m)}
										onClick={() => toggleModel(m)}
									/>
								))}
							</FilterGroup>
						)}

						{/* Session filter */}
						{filterOptions.sessions.length > 0 && (
							<FilterGroup label="Session">
								{filterOptions.sessions.map((s) => (
									<FilterChip
										key={s}
										label={s.slice(0, 12)}
										active={filter.sessions.has(s)}
										onClick={() => toggleSession(s)}
									/>
								))}
							</FilterGroup>
						)}

						{/* Date range */}
						<FilterGroup label="Date Range">
							<input
								type="date"
								value={filter.dateFrom}
								onChange={(e) => setFilter((f) => ({ ...f, dateFrom: e.target.value }))}
								style={{
									background: "color-mix(in srgb, var(--bg, #1a1a2e) 80%, #000)",
									border: "1px solid var(--border, #333)",
									borderRadius: 4,
									padding: "2px 6px",
									color: "var(--fg, #ccc)",
									fontSize: "0.78em",
								}}
							/>
							<span style={{ color: "var(--muted, #888)" }}>to</span>
							<input
								type="date"
								value={filter.dateTo}
								onChange={(e) => setFilter((f) => ({ ...f, dateTo: e.target.value }))}
								style={{
									background: "color-mix(in srgb, var(--bg, #1a1a2e) 80%, #000)",
									border: "1px solid var(--border, #333)",
									borderRadius: 4,
									padding: "2px 6px",
									color: "var(--fg, #ccc)",
									fontSize: "0.78em",
								}}
							/>
						</FilterGroup>
					</div>
				</div>
			)}

			{/* Log list */}
			<div ref={containerRef} style={{ flex: 1, overflow: "hidden", position: "relative" }} data-log-list>
				{rows.length === 0 ? (
					<div
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							height: "100%",
							color: "var(--muted, #888)",
							fontSize: "0.85em",
						}}
					>
						{entries.length === 0
							? "No logs yet. Interact with the extension to see events appear here."
							: "No logs match the current filters."}
					</div>
				) : (
					<VirtualList
						rows={rows}
						renderRow={renderRow}
						estimatedRowHeight={32}
						containerStyle={{ height: "100%" }}
					/>
				)}
			</div>

			{/* Detail inspector */}
			{renderDetailInspector()}
		</div>
	);
}

// ---------------------------------------------------------------- Sub-components

function DetailField({ label, value, color }: { label: string; value: string; color?: string }) {
	return (
		<div style={{ display: "flex", gap: 6 }}>
			<span style={{ color: "var(--muted, #888)", flexShrink: 0, minWidth: 100 }}>{label}:</span>
			<span style={{ color: color || "var(--fg, #ccc)", wordBreak: "break-all" }}>{value}</span>
		</div>
	);
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
			<span style={{ color: "var(--muted, #888)", fontSize: "0.75em", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
				{label}
			</span>
			<div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{children}</div>
		</div>
	);
}

function FilterChip({
	label,
	active,
	color,
	onClick,
}: {
	label: string;
	active: boolean;
	color?: string;
	onClick: () => void;
}) {
	return (
		<button
			onClick={onClick}
			style={{
				padding: "2px 8px",
				borderRadius: 12,
				border: `1px solid ${active ? (color || "var(--accent, #a78bfa)") : "var(--border, #333)"}`,
				background: active ? `${color || "var(--accent, #a78bfa)"}20` : "transparent",
				color: active ? (color || "var(--accent, #a78bfa)") : "var(--muted, #888)",
				fontSize: "0.75em",
				cursor: "pointer",
				fontFamily: "inherit",
				transition: "all 0.1s ease",
			}}
		>
			{label}
		</button>
	);
}