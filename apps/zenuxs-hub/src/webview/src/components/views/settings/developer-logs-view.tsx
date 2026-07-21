import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	AlertTriangle,
	Check,
	ChevronDown,
	Copy,
	Download,
	Filter,
	type LucideIcon,
	Pause,
	PauseCircle,
	Play,
	Regex,
	ScrollText,
	Search,
	Trash2,
	X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { PageFrame, PageHeader } from "../page-layout";
import {
	ALL_CATEGORIES,
	ALL_LEVELS,
	CATEGORY_META,
	LEVEL_COLORS,
} from "@/lib/developer-logs/constants";
import { JsonView } from "@/lib/developer-logs/json-view";
import { VirtualList } from "@/lib/developer-logs/virtual-list";
import {
	applySecretMasking,
	copyText,
	downloadText,
	filterLogs,
	formatLogTime,
	maskClientSecret,
	toCsv,
	toJson,
	toMarkdown,
	toTxt,
	useDeveloperLogStoreControl,
	useDeveloperLogs,
	useMultiSelectState,
	type DeveloperLogFilters,
} from "@/lib/developer-logs/hooks";
import type {
	DeveloperLog,
	DeveloperLogCategory,
	DeveloperLogLevel,
} from "@/lib/developer-logs/store";
export { maskClientSecret };

// ---------------------------------------------------------------- row

function LogRow({
	log,
	selected,
	onSelect,
}: {
	log: DeveloperLog;
	selected: boolean;
	onSelect: (log: DeveloperLog) => void;
}) {
	const level = LEVEL_COLORS[log.level];
	const cat = CATEGORY_META[log.category];
	return (
		<button
			className={`group flex w-full items-center gap-2 border-b border-border/60 px-3 text-left text-xs transition-colors ${
				selected ? "bg-accent" : "hover:bg-muted/40"
			}`}
			onClick={() => onSelect(log)}
			type="button"
		>
			<span className="shrink-0 tabular-nums text-muted-foreground/70">
				{formatLogTime(log.timestamp).slice(11, 23)}
			</span>
			<span
				className={`inline-flex h-4 w-16 shrink-0 items-center justify-center rounded px-1 text-[10px] font-bold ${level.bg} ${level.text}`}
			>
				{log.level}
			</span>
			<span className="inline-flex h-4 w-10 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-medium text-muted-foreground">
				{cat.short}
			</span>
			{log.source && (
				<span className="shrink-0 max-w-[10rem] truncate text-muted-foreground">
					[{log.source}]
				</span>
			)}
			<span className="min-w-0 flex-1 truncate font-mono">{log.message}</span>
			{(log.provider || log.model) && (
				<span className="hidden shrink-0 truncate text-[10px] text-muted-foreground sm:block">
					{log.provider}
					{log.provider && log.model ? ":" : ""}
					{log.model}
				</span>
			)}
		</button>
	);
}

// ---------------------------------------------------------------- filter button

function FilterMenuButton({
	icon: Icon,
	label,
	options,
	selected,
	onToggle,
	onClear,
}: {
	icon: LucideIcon;
	label: string;
	options: { value: string; label: string }[];
	selected: Set<string>;
	onToggle: (value: string, checked: boolean) => void;
	onClear: () => void;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						size="sm"
						variant={selected.size > 0 ? "default" : "outline"}
						title={label}
					/>
				}
			>
				<Icon className="size-3.5" />
				<span className="max-[820px]:hidden">{label}</span>
				{selected.size > 0 && (
					<span className="ml-0.5 rounded bg-background/20 px-1 text-[10px]">
						{selected.size}
					</span>
				)}
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="max-h-80 w-60 overflow-auto">
				<DropdownMenuLabel>{label}</DropdownMenuLabel>
				{selected.size > 0 && (
					<>
						<DropdownMenuItem onClick={onClear}>Clear {label}</DropdownMenuItem>
						<DropdownMenuSeparator />
					</>
				)}
				<DropdownMenuGroup>
					{options.map((opt) => (
						<DropdownMenuCheckboxItem
							checked={selected.has(opt.value)}
							key={opt.value}
							onCheckedChange={(checked: boolean) => onToggle(opt.value, checked)}
						>
							<span className="truncate" title={opt.label}>
								{opt.label}
							</span>
						</DropdownMenuCheckboxItem>
					))}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

// ---------------------------------------------------------------- detail panel

function DetailPanel({
	log,
	allEntries,
	onClose,
	onSelect,
	jsonExpanded,
	setJsonExpanded,
}: {
	log: DeveloperLog;
	allEntries: DeveloperLog[];
	onClose: () => void;
	onSelect: (log: DeveloperLog) => void;
	jsonExpanded: boolean;
	setJsonExpanded: (v: boolean) => void;
}) {
	const related = useMemo(() => {
		const set = new Set<string>();
		if (log.requestId) {
			set.add(log.requestId);
			if (log.parentId) set.add(log.parentId);
		}
		if (log.parentId) set.add(log.parentId);
		(log.childIds ?? []).forEach((id: string) => set.add(id));
		if (log.requestId) set.add(log.requestId);
		return allEntries.filter(
			(e) =>
				(e.requestId && set.has(e.requestId)) ||
				(e.id === log.parentId) ||
				(e.parentId === log.id) ||
				(e.parentId === log.parentId && log.parentId),
		);
	}, [log, allEntries]);

	const parent = useMemo(
		() => (log.parentId ? allEntries.find((e) => e.id === log.parentId) : undefined),
		[log.parentId, allEntries],
	);
	const children = useMemo(
		() => allEntries.filter((e) => e.parentId === log.id),
		[log.id, allEntries],
	);

	const maskedData = applySecretMasking(log.data);

	return (
		<aside className="flex h-full w-[34rem] max-w-[42vw] shrink-0 flex-col border-l border-border bg-background">
			<div className="flex items-center justify-between border-b border-border px-3 py-2">
				<div className="flex min-w-0 items-center gap-2">
					<span
						className={`inline-flex h-5 items-center justify-center rounded px-1.5 text-[10px] font-bold ${LEVEL_COLORS[log.level].bg} ${LEVEL_COLORS[log.level].text}`}
					>
						{log.level}
					</span>
					<span className="truncate text-sm font-medium">
						{CATEGORY_META[log.category].label}
					</span>
				</div>
				<Button
					aria-label="Close details"
					onClick={onClose}
					size="icon-sm"
					variant="ghost"
				>
					<X className="size-4" />
				</Button>
			</div>

			<ScrollArea className="flex-1">
				<div className="space-y-3 p-3">
					<div>
						<h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
							Message
						</h4>
						<p className="mt-1 break-words font-mono text-sm">{log.message}</p>
					</div>

					<div className="grid grid-cols-2 gap-2 text-xs">
						<Field label="Time" value={log.iso} />
						<Field label="Source" value={log.source} />
						<Field label="Category" value={log.category} />
						<Field label="Provider" value={log.provider} />
						<Field label="Model" value={log.model} />
						<Field label="Session" value={log.sessionId} />
						<Field label="Conversation" value={log.conversationId} />
						<Field label="Request" value={log.requestId} />
						<Field label="Parent" value={log.parentId} />
						<Field label="Entry ID" value={log.id} />
					</div>

					{log.stack && (
						<div>
							<h4 className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
								<AlertTriangle className="size-3" /> Stack trace
							</h4>
							<pre className="mt-1 overflow-auto rounded-md border bg-muted/30 p-2 font-mono text-[11px] text-destructive">
								{log.stack}
							</pre>
							<Button
								className="mt-1"
								onClick={() => copyText(log.stack ?? "")}
								size="xs"
								variant="outline"
							>
								<Copy className="size-3" /> Copy stack trace
							</Button>
						</div>
					)}

					{log.data && Object.keys(log.data).length > 0 && (
						<div>
							<div className="flex items-center justify-between">
								<h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
									Metadata
								</h4>
								<Button
									onClick={() => setJsonExpanded(!jsonExpanded)}
									size="xs"
									variant="ghost"
								>
									{jsonExpanded ? "Collapse JSON" : "Expand JSON"}
								</Button>
							</div>
							<div className="mt-1">
								<JsonView defaultOpen={jsonExpanded} value={maskedData} />
							</div>
							<Button
								className="mt-1"
								onClick={() => copyText(toJson([log]) )}
								size="xs"
								variant="outline"
							>
								<Copy className="size-3" /> Copy JSON
							</Button>
						</div>
					)}

					{parent && (
						<TraceBlock
							title="Parent request"
							entries={[parent]}
							onSelect={onSelect}
						/>
					)}
					{children.length > 0 && (
						<TraceBlock title="Child requests" entries={children} onSelect={onSelect} />
					)}
					{related.length > 0 && (
						<TraceBlock
							title="Related logs"
							entries={related.slice(0, 50)}
							onSelect={onSelect}
						/>
					)}
				</div>
			</ScrollArea>
		</aside>
	);
}

function Field({ label, value }: { label: string; value?: string }) {
	if (!value) return null;
	return (
		<div className="min-w-0">
			<p className="text-[10px] uppercase tracking-wide text-muted-foreground">
				{label}
			</p>
			<p className="truncate font-mono text-[11px]" title={value}>
				{value}
			</p>
		</div>
	);
}

function TraceBlock({
	title,
	entries,
	onSelect,
}: {
	title: string;
	entries: DeveloperLog[];
	onSelect: (e: DeveloperLog) => void;
}) {
	return (
		<div>
			<h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
				{title} ({entries.length})
			</h4>
			<div className="mt-1 space-y-1">
				{entries.map((e) => (
					<button
						className="flex w-full items-center gap-2 rounded border border-border bg-muted/20 px-2 py-1 text-left text-[11px] hover:bg-muted/50"
						key={e.id}
						onClick={() => onSelect(e)}
						type="button"
					>
						<span
							className={`inline-flex h-4 w-14 shrink-0 items-center justify-center rounded px-1 text-[9px] font-bold ${LEVEL_COLORS[e.level].bg} ${LEVEL_COLORS[e.level].text}`}
						>
							{e.level}
						</span>
						<span className="min-w-0 flex-1 truncate">{e.message}</span>
					</button>
				))}
			</div>
		</div>
	);
}

// ---------------------------------------------------------------- main view

export function DeveloperLogsView({ chrome = "content" }: { chrome?: "full" | "content" }) {
	const { entries } = useDeveloperLogs();
	const { connect, disconnect, clear, pause, resume, isPaused } =
		useDeveloperLogStoreControl();

	const [search, setSearch] = useState("");
	const [regex, setRegex] = useState(false);
	const [selectedLog, setSelectedLog] = useState<DeveloperLog | null>(null);
	const [jsonExpanded, setJsonExpanded] = useState(true);
	const [autoScroll, setAutoScroll] = useState(true);
	const [atTop, setAtTop] = useState(true);

	const categories = useMultiSelectState<DeveloperLogCategory>();
	const levels = useMultiSelectState<DeveloperLogLevel>();
	const providers = useMultiSelectState<string>();
	const models = useMultiSelectState<string>();
	const sessions = useMultiSelectState<string>();
	const conversations = useMultiSelectState<string>();

	const scrollRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		connect();
		return () => disconnect();
	}, [connect, disconnect]);

	const dynamicProviders = useMemo(
		() =>
			Array.from(
				new Set(entries.map((e) => e.provider).filter((p): p is string => !!p)),
			).sort(),
		[entries],
	);
	const dynamicModels = useMemo(
		() =>
			Array.from(
				new Set(entries.map((e) => e.model).filter((m): m is string => !!m)),
			).sort(),
		[entries],
	);
	const dynamicSessions = useMemo(
		() =>
			Array.from(
				new Set(entries.map((e) => e.sessionId).filter((s): s is string => !!s)),
			).sort(),
		[entries],
	);
	const dynamicConversations = useMemo(
		() =>
			Array.from(
				new Set(
					entries.map((e) => e.conversationId).filter((c): c is string => !!c),
				),
			).sort(),
		[entries],
	);

	const filters = useMemo<DeveloperLogFilters>(
		() => ({
			search,
			regex,
			categories: categories.selected,
			levels: levels.selected,
			providers: providers.selected,
			models: models.selected,
			sessions: sessions.selected,
			conversations: conversations.selected,
		}),
		[search, regex, categories.selected, levels.selected, providers.selected, models.selected, sessions.selected, conversations.selected],
	);

	const filtered = useMemo(() => filterLogs(entries, filters), [entries, filters]);

	// Auto-scroll to bottom for live tailing when new logs arrive.
	useEffect(() => {
		if (!autoScroll || !scrollRef.current) return;
		const el = scrollRef.current;
		el.scrollTop = el.scrollHeight;
	}, [filtered.length, autoScroll]);

	const handleSelect = useCallback((log: DeveloperLog) => {
		setSelectedLog(log);
	}, []);

	const handleExport = useCallback(
		(exportType: "json" | "txt" | "md" | "csv") => {
			if (filtered.length === 0) {
				toast.error("No logs to export");
				return;
			}
			const stamp = new Date().toISOString().replace(/[:.]/g, "-");
			if (exportType === "json") {
				downloadText(
					`developer-logs-${stamp}.json`,
					toJson(filtered),
					"application/json",
				);
			} else if (exportType === "txt") {
				downloadText(`developer-logs-${stamp}.txt`, toTxt(filtered), "text/plain");
			} else if (exportType === "md") {
				downloadText(
					`developer-logs-${stamp}.md`,
					toMarkdown(filtered),
					"text/markdown",
				);
			} else {
				downloadText(`developer-logs-${stamp}.csv`, toCsv(filtered), "text/csv");
			}
			toast.success(`Exported ${filtered.length} logs as ${exportType.toUpperCase()}`);
		},
		[filtered],
	);

	const copySelected = useCallback(() => {
		if (!selectedLog) return;
		copyText(toJson([selectedLog]));
		toast.success("Copied selected log");
	}, [selectedLog]);
	void copySelected;

	const copyAll = useCallback(() => {
		copyText(toJson(filtered));
		toast.success(`Copied ${filtered.length} logs`);
	}, [filtered]);

	const paused = isPaused();

	const categoryOptions = ALL_CATEGORIES.map((c) => ({
		value: c,
		label: CATEGORY_META[c].label,
	}));
	const levelOptions = ALL_LEVELS.map((l) => ({ value: l, label: l }));

	const togglePause = () => {
		if (paused) {
			resume();
			toast.success("Logging resumed");
		} else {
			pause();
			toast.success("Logging paused");
		}
	};

	const stats = useMemo(() => {
		let errors = 0;
		let warns = 0;
		for (const e of filtered) {
			if (e.level === "ERROR" || e.level === "CRITICAL") errors++;
			else if (e.level === "WARNING") warns++;
		}
		return { errors, warns };
	}, [filtered]);

	const content = (
		<div className="flex h-full min-h-0 flex-col">
			{/* Toolbar */}
			<div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
				<div className="relative flex min-w-[14rem] flex-1 items-center">
					<Search className="pointer-events-none absolute left-2.5 size-3.5 text-muted-foreground" />
					<Input
						className="h-8 pl-8 pr-8 text-xs"
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Search logs (message, source, metadata)..."
						value={search}
					/>
					{search && (
						<button
							aria-label="Clear search"
							className="absolute right-2 text-muted-foreground hover:text-foreground"
							onClick={() => setSearch("")}
							type="button"
						>
							<X className="size-3.5" />
						</button>
					)}
				</div>

				<Button
					size="sm"
					variant={regex ? "default" : "outline"}
					onClick={() => setRegex((r) => !r)}
					title="Toggle regex search"
				>
					<Regex className="size-3.5" />
					<span className="max-[820px]:hidden">Regex</span>
				</Button>

				<FilterMenuButton
					icon={Filter}
					label="Level"
					options={levelOptions}
					selected={levels.selected as Set<string>}
					onToggle={(v, c) => levels.toggle(v as DeveloperLogLevel, c)}
					onClear={levels.clear}
				/>
				<FilterMenuButton
					icon={ScrollText}
					label="Category"
					options={categoryOptions}
					selected={categories.selected as Set<string>}
					onToggle={(v, c) => categories.toggle(v as DeveloperLogCategory, c)}
					onClear={categories.clear}
				/>
				<FilterMenuButton
					icon={Filter}
					label="Provider"
					options={dynamicProviders.map((p) => ({ value: p, label: p }))}
					selected={providers.selected}
					onToggle={providers.toggle}
					onClear={providers.clear}
				/>
				<FilterMenuButton
					icon={Filter}
					label="Model"
					options={dynamicModels.map((m) => ({ value: m, label: m }))}
					selected={models.selected}
					onToggle={models.toggle}
					onClear={models.clear}
				/>
				<FilterMenuButton
					icon={Filter}
					label="Session"
					options={dynamicSessions.map((s) => ({ value: s, label: s.slice(0, 12) }))}
					selected={sessions.selected}
					onToggle={sessions.toggle}
					onClear={sessions.clear}
				/>
				<FilterMenuButton
					icon={Filter}
					label="Conversation"
					options={dynamicConversations.map((c) => ({
						value: c,
						label: c.slice(0, 12),
					}))}
					selected={conversations.selected}
					onToggle={conversations.toggle}
					onClear={conversations.clear}
				/>

				<div className="ml-auto flex items-center gap-1.5">
					<Button size="sm" variant="outline" onClick={togglePause} title={paused ? "Resume logging" : "Pause logging"}>
						{paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
						<span className="max-[820px]:hidden">{paused ? "Resume" : "Pause"}</span>
					</Button>
					<Button size="sm" variant="outline" onClick={copyAll} title="Copy logs">
						<Copy className="size-3.5" />
						<span className="max-[820px]:hidden">Copy</span>
					</Button>
					<Button size="sm" variant="outline" onClick={() => clear()} title="Clear logs">
						<Trash2 className="size-3.5" />
						<span className="max-[820px]:hidden">Clear</span>
					</Button>
					<DropdownMenu>
						<DropdownMenuTrigger
							render={<Button size="sm" variant="outline" title="Export logs" />}
						>
							<Download className="size-3.5" />
							<span className="max-[820px]:hidden">Export</span>
							<ChevronDown className="size-3.5" />
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={() => handleExport("json")}>
								JSON
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => handleExport("txt")}>
								TXT
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => handleExport("md")}>
								Markdown
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => handleExport("csv")}>
								CSV
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			{/* Status strip */}
			<div className="flex items-center gap-3 border-b border-border bg-muted/30 px-3 py-1 text-[11px] text-muted-foreground">
				<span>
					{filtered.length.toLocaleString()} / {entries.length.toLocaleString()} logs
				</span>
				{stats.errors > 0 && (
					<span className="text-destructive">● {stats.errors} errors</span>
				)}
				{stats.warns > 0 && (
					<span className="text-amber-600 dark:text-amber-400">
						● {stats.warns} warnings
					</span>
				)}
				<button
					className={`ml-auto flex items-center gap-1 ${autoScroll ? "text-foreground" : "hover:text-foreground"}`}
					onClick={() => setAutoScroll((s) => !s)}
					type="button"
				>
					{autoScroll ? (
						<Check className="size-3" />
					) : (
						<PauseCircle className="size-3" />
					)}
					Auto-scroll
				</button>
				{!atTop && (
					<button
						className="text-primary hover:underline"
						onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
						type="button"
					>
						Jump to top
					</button>
				)}
			</div>

			{/* Body */}
			<div className="flex min-h-0 flex-1">
				<div className="flex min-w-0 flex-1 flex-col">
					{filtered.length === 0 ? (
						<div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
							{entries.length === 0
								? "No logs yet. Activity across the app will appear here in real time."
								: "No logs match the current filters."}
						</div>
					) : (
						<VirtualList
							items={filtered}
							onScrollTopChange={setAtTop}
							scrollRef={scrollRef}
							renderRow={(log) => (
								<LogRow
									log={log}
									onSelect={handleSelect}
									selected={selectedLog?.id === log.id}
								/>
							)}
						/>
					)}
				</div>

				{selectedLog && (
					<DetailPanel
						allEntries={entries}
						jsonExpanded={jsonExpanded}
						log={selectedLog}
						onClose={() => setSelectedLog(null)}
						onSelect={handleSelect}
						setJsonExpanded={setJsonExpanded}
					/>
				)}
			</div>
		</div>
	);

	if (chrome === "content") {
		return content;
	}

	return (
		<PageFrame>
			<PageHeader
				title="Developer Logs"
				description="Live, searchable, categorized logs for debugging the entire application."
			/>
			<div className="h-[calc(100vh-9rem)] min-h-0 overflow-hidden rounded-lg border">
				{content}
			</div>
		</PageFrame>
	);
}
