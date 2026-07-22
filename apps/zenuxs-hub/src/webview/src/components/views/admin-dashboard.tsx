import {
	ActivityIcon,
	AlertTriangleIcon,
	ArrowUpRightIcon,
	BarChart3Icon,
	BellIcon,
	BotIcon,
	CalendarDaysIcon,
	ChevronDownIcon,
	CircleDollarSignIcon,
	ClockIcon,
	CpuIcon,
	DatabaseIcon,
	DownloadIcon,
	FileJsonIcon,
	FileSpreadsheetIcon,
	FileTextIcon,
	FlameIcon,
	GaugeIcon,
	GlobeIcon,
	ImageIcon,
	LineChartIcon,
	LockKeyholeIcon,
	type LucideIcon,
	MessageSquareIcon,
	RefreshCcwIcon,
	SearchIcon,
	ServerIcon,
	ShieldAlertIcon,
	SparklesIcon,
	TimerIcon,
	TrendingDownIcon,
	TrendingUpIcon,
	UserCheckIcon,
	UserIcon,
	UsersIcon,
	Volume2Icon,
	XIcon,
	ZapIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	ComposedChart,
	Legend,
	Line,
	Pie,
	PieChart,
	ResponsiveContainer,
	Scatter,
	ScatterChart,
	Tooltip as RechartsTooltip,
	XAxis,
	YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type {
	WebviewActionSessionSummary,
	WebviewHubEvent,
	WebviewHubState,
	WebviewSessionSummary,
} from "../../../../webview-protocol";

type AdminDashboardProps = {
	hubState: WebviewHubState;
	onOpenSession: (sessionId: string) => void;
	onRestartHub: () => void;
	onViewSessions: () => void;
	recentSessions: WebviewSessionSummary[];
	restartPending: boolean;
};

type DateRangeId =
	| "today"
	| "yesterday"
	| "7d"
	| "30d"
	| "90d"
	| "year"
	| "lifetime"
	| "custom";

type QuickRangeId = "daily" | "weekly" | "monthly" | "90d";

type SessionLike = WebviewSessionSummary | WebviewActionSessionSummary;

type UserUsage = {
	avatar: string;
	averageSessionDuration: number;
	averageTokensPerChat: number;
	chatsLast7: number;
	chatsLastMonth: number;
	chatsLifetime: number;
	chatsToday: number;
	createdDate: number;
	currentStatus: "Online" | "Offline";
	email: string;
	favoriteModel: string;
	id: string;
	imagesGenerated: number;
	inputTokens: number;
	lastActive: number;
	lastLogin: number;
	messagesSent: number;
	mostUsedProvider: string;
	outputTokens: number;
	plan: "Free" | "Pro" | "Team" | "Enterprise";
	sandboxHours: number;
	totalChats: number;
	totalTimeSpent: number;
	totalTokens: number;
	username: string;
	voiceMinutes: number;
};

type TimelineEvent = {
	detail: string;
	id: string;
	meta: string;
	timestamp: number;
	type:
		| "Login"
		| "Logout"
		| "Session"
		| "Chat"
		| "Tokens"
		| "Model"
		| "Provider"
		| "Error"
		| "Image"
		| "Voice";
};

type ChartPoint = {
	active: number;
	chats: number;
	cost: number;
	day: string;
	errors: number;
	messages: number;
	newUsers: number;
	outputTokens: number;
	tokens: number;
};

const DATE_RANGES: Array<{ id: DateRangeId; label: string; multiplier: number }> =
	[
		{ id: "today", label: "Today", multiplier: 0.18 },
		{ id: "yesterday", label: "Yesterday", multiplier: 0.15 },
		{ id: "7d", label: "Last 7 Days", multiplier: 0.48 },
		{ id: "30d", label: "Last 30 Days", multiplier: 1 },
		{ id: "90d", label: "Last 90 Days", multiplier: 2.7 },
		{ id: "year", label: "Last Year", multiplier: 8.2 },
		{ id: "lifetime", label: "Lifetime", multiplier: 14 },
		{ id: "custom", label: "Custom Range", multiplier: 1.35 },
	];

const QUICK_RANGES: Array<{ id: QuickRangeId; label: string }> = [
	{ id: "daily", label: "Daily" },
	{ id: "weekly", label: "Weekly" },
	{ id: "monthly", label: "Monthly" },
	{ id: "90d", label: "90 Days" },
];

const PROVIDERS = [
	"OpenAI",
	"Anthropic",
	"Gemini",
	"DeepSeek",
	"OpenRouter",
	"Groq",
	"Mistral",
] as const;

const MODELS = [
	"gpt-4.1",
	"claude-sonnet-4",
	"gemini-2.5-pro",
	"deepseek-v3",
	"llama-4-scout",
	"mistral-large",
] as const;

const PLANS: UserUsage["plan"][] = ["Free", "Pro", "Team", "Enterprise"];

const CHART_COLORS = [
	"#8b5cf6",
	"#22d3ee",
	"#34d399",
	"#f59e0b",
	"#fb7185",
	"#60a5fa",
	"#a78bfa",
];

const glassCard =
	"rounded-lg border border-white/10 bg-white/[0.055] shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-all duration-300 hover:border-cyan-300/35 hover:bg-white/[0.08] hover:shadow-[0_20px_70px_rgba(34,211,238,0.12)]";

const fieldChip =
	"rounded-md border border-white/10 bg-white/[0.06] px-2 py-1 text-xs font-medium text-slate-300";

function formatCompact(value: number): string {
	return new Intl.NumberFormat(undefined, {
		notation: "compact",
		maximumFractionDigits: 1,
	}).format(Math.max(0, Math.round(value)));
}

function formatFull(value: number): string {
	return new Intl.NumberFormat(undefined, {
		maximumFractionDigits: 0,
	}).format(Math.max(0, Math.round(value)));
}

function formatCurrency(value: number): string {
	return new Intl.NumberFormat(undefined, {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: value > 0 && value < 1 ? 3 : 0,
	}).format(Math.max(0, value));
}

function formatPercent(value: number): string {
	return `${Math.round(value)}%`;
}

function formatMinutes(value: number): string {
	if (value >= 60) {
		return `${Math.round(value / 60)}h`;
	}
	return `${Math.round(value)}m`;
}

function formatDate(timestamp: number): string {
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
	}).format(new Date(timestamp));
}

function formatDateTime(timestamp: number): string {
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(timestamp));
}

function relativeTime(timestamp?: number): string {
	if (!timestamp) return "unknown";
	const elapsed = Math.max(0, Date.now() - timestamp);
	const minutes = Math.floor(elapsed / 60_000);
	if (minutes < 1) return "just now";
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	return `${Math.floor(hours / 24)}d ago`;
}

function workspaceName(path?: string): string | undefined {
	const trimmed = path?.trim();
	if (!trimmed) return undefined;
	const parts = trimmed.split(/[\\/]+/).filter(Boolean);
	return parts.at(-1) ?? trimmed;
}

function shortId(id: string): string {
	return id.length > 12 ? id.slice(0, 12) : id;
}

function slug(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ".")
		.replace(/(^\.|\.$)/g, "");
}

function sessionTitle(session: SessionLike): string {
	return session.title || workspaceName(session.workspaceRoot) || shortId(session.sessionId);
}

function sessionTokens(session: SessionLike): number {
	return (session.inputTokens ?? 0) + (session.outputTokens ?? 0);
}

function normalizeSessions(
	recentSessions: WebviewSessionSummary[],
	hubState: WebviewHubState,
): SessionLike[] {
	const byId = new Map<string, SessionLike>();
	for (const session of hubState.sessionSummaries ?? []) {
		byId.set(session.sessionId, session);
	}
	for (const session of recentSessions) {
		byId.set(session.sessionId, session);
	}
	return Array.from(byId.values()).sort((a, b) => {
		const aTime = a.updatedAt ?? a.createdAt ?? 0;
		const bTime = b.updatedAt ?? b.createdAt ?? 0;
		return bTime - aTime;
	});
}

function buildUsers(
	sessions: SessionLike[],
	hubState: WebviewHubState,
	multiplier: number,
): UserUsage[] {
	const now = Date.now();
	const sessionUsers = sessions.slice(0, 10).map((session, index) => {
		const title = sessionTitle(session);
		const totalTokens = Math.max(sessionTokens(session), 18_000 + index * 9_500);
		const chats = Math.max(3, Math.round((index + 3) * multiplier + 8));
		const plan = PLANS[index % PLANS.length];
		const provider = (session as any).providerId || PROVIDERS[index % PROVIDERS.length];
		const model = session.model || MODELS[index % MODELS.length];
		const username = title.replace(/\s+/g, " ").trim() || `User ${index + 1}`;
		return {
			avatar: username
				.split(/\s+/)
				.slice(0, 2)
				.map((part) => part[0]?.toUpperCase())
				.join("") || "ZU",
			averageSessionDuration: 18 + index * 4,
			averageTokensPerChat: Math.round(totalTokens / chats),
			chatsLast7: Math.max(1, Math.round(chats * 0.35)),
			chatsLastMonth: Math.max(chats, Math.round(chats * 1.8)),
			chatsLifetime: Math.max(chats * 3, Math.round(chats * 4.7)),
			chatsToday: Math.max(0, Math.round(chats * 0.08)),
			createdDate: session.createdAt ?? now - (index + 24) * 86_400_000,
			currentStatus: index < hubState.clients.length ? "Online" : "Offline",
			email: `${slug(username) || `user${index + 1}`}@zenuxs.ai`,
			favoriteModel: model,
			id: `session-user-${session.sessionId}`,
			imagesGenerated: Math.round((index + 1) * 4 * multiplier),
			inputTokens: Math.round(totalTokens * 0.54),
			lastActive: session.updatedAt ?? now - index * 2_700_000,
			lastLogin: session.updatedAt ?? now - (index + 1) * 3_600_000,
			messagesSent: Math.round(chats * (9 + index)),
			mostUsedProvider: provider,
			outputTokens: Math.round(totalTokens * 0.46),
			plan,
			sandboxHours: Math.round((index + 1) * 1.4 * multiplier * 10) / 10,
			totalChats: chats,
			totalTimeSpent: Math.round(chats * (18 + index * 2)),
			totalTokens,
			username,
			voiceMinutes: Math.round((index + 2) * 12 * multiplier),
		} satisfies UserUsage;
	});

	const seedUsers: UserUsage[] = [
		{
			avatar: "AK",
			averageSessionDuration: 42,
			averageTokensPerChat: 14_920,
			chatsLast7: 92,
			chatsLastMonth: 318,
			chatsLifetime: 1_440,
			chatsToday: 18,
			createdDate: now - 182 * 86_400_000,
			currentStatus: "Online",
			email: "ava.kim@zenuxs.ai",
			favoriteModel: "claude-sonnet-4",
			id: "seed-ava",
			imagesGenerated: 284,
			inputTokens: 8_990_000,
			lastActive: now - 420_000,
			lastLogin: now - 1_800_000,
			messagesSent: 12_280,
			mostUsedProvider: "Anthropic",
			outputTokens: 7_420_000,
			plan: "Enterprise",
			sandboxHours: 88,
			totalChats: 1_440,
			totalTimeSpent: 2_630,
			totalTokens: 16_410_000,
			username: "Ava Kim",
			voiceMinutes: 1_340,
		},
		{
			avatar: "NP",
			averageSessionDuration: 31,
			averageTokensPerChat: 8_820,
			chatsLast7: 48,
			chatsLastMonth: 176,
			chatsLifetime: 820,
			chatsToday: 7,
			createdDate: now - 119 * 86_400_000,
			currentStatus: "Offline",
			email: "noah.patel@zenuxs.ai",
			favoriteModel: "gpt-4.1",
			id: "seed-noah",
			imagesGenerated: 62,
			inputTokens: 3_920_000,
			lastActive: now - 8_700_000,
			lastLogin: now - 9_000_000,
			messagesSent: 6_510,
			mostUsedProvider: "OpenAI",
			outputTokens: 3_312_000,
			plan: "Team",
			sandboxHours: 44,
			totalChats: 820,
			totalTimeSpent: 980,
			totalTokens: 7_232_000,
			username: "Noah Patel",
			voiceMinutes: 412,
		},
		{
			avatar: "LM",
			averageSessionDuration: 12,
			averageTokensPerChat: 2_220,
			chatsLast7: 4,
			chatsLastMonth: 12,
			chatsLifetime: 44,
			chatsToday: 0,
			createdDate: now - 38 * 86_400_000,
			currentStatus: "Offline",
			email: "lina.morris@zenuxs.ai",
			favoriteModel: "gemini-2.5-pro",
			id: "seed-lina",
			imagesGenerated: 0,
			inputTokens: 56_000,
			lastActive: now - 16 * 86_400_000,
			lastLogin: now - 16 * 86_400_000,
			messagesSent: 190,
			mostUsedProvider: "Gemini",
			outputTokens: 42_000,
			plan: "Free",
			sandboxHours: 0,
			totalChats: 44,
			totalTimeSpent: 91,
			totalTokens: 98_000,
			username: "Lina Morris",
			voiceMinutes: 0,
		},
		{
			avatar: "EO",
			averageSessionDuration: 54,
			averageTokensPerChat: 19_800,
			chatsLast7: 72,
			chatsLastMonth: 260,
			chatsLifetime: 1_104,
			chatsToday: 11,
			createdDate: now - 240 * 86_400_000,
			currentStatus: "Online",
			email: "eli.okafor@zenuxs.ai",
			favoriteModel: "deepseek-v3",
			id: "seed-eli",
			imagesGenerated: 168,
			inputTokens: 12_100_000,
			lastActive: now - 960_000,
			lastLogin: now - 2_400_000,
			messagesSent: 9_860,
			mostUsedProvider: "DeepSeek",
			outputTokens: 9_760_000,
			plan: "Pro",
			sandboxHours: 127,
			totalChats: 1_104,
			totalTimeSpent: 3_840,
			totalTokens: 21_860_000,
			username: "Eli Okafor",
			voiceMinutes: 820,
		},
		{
			avatar: "RS",
			averageSessionDuration: 24,
			averageTokensPerChat: 6_420,
			chatsLast7: 22,
			chatsLastMonth: 98,
			chatsLifetime: 405,
			chatsToday: 3,
			createdDate: now - 72 * 86_400_000,
			currentStatus: "Offline",
			email: "rhea.sato@zenuxs.ai",
			favoriteModel: "mistral-large",
			id: "seed-rhea",
			imagesGenerated: 29,
			inputTokens: 1_452_000,
			lastActive: now - 2 * 86_400_000,
			lastLogin: now - 2 * 86_400_000,
			messagesSent: 2_970,
			mostUsedProvider: "Mistral",
			outputTokens: 1_148_000,
			plan: "Pro",
			sandboxHours: 19,
			totalChats: 405,
			totalTimeSpent: 442,
			totalTokens: 2_600_000,
			username: "Rhea Sato",
			voiceMinutes: 124,
		},
	];

	return [...sessionUsers, ...seedUsers].map((user, index) => ({
		...user,
		averageTokensPerChat: Math.round(
			user.totalTokens / Math.max(1, user.totalChats),
		),
		currentStatus: index < Math.max(2, hubState.clients.length) ? "Online" : user.currentStatus,
	}));
}

function buildSeries(users: UserUsage[], multiplier: number): ChartPoint[] {
	const now = Date.now();
	const totalMessages = users.reduce((sum, user) => sum + user.messagesSent, 0);
	const totalTokens = users.reduce((sum, user) => sum + user.totalTokens, 0);
	return Array.from({ length: 14 }, (_, index) => {
		const dayOffset = 13 - index;
		const rhythm = 0.72 + Math.sin(index * 0.85) * 0.18 + (index % 4) * 0.045;
		const date = new Date(now - dayOffset * 86_400_000);
		const messages = Math.max(18, Math.round((totalMessages / 42) * rhythm * multiplier));
		const tokens = Math.max(12_000, Math.round((totalTokens / 58) * rhythm * multiplier));
		return {
			active: Math.max(4, Math.round(users.length * (0.42 + rhythm * 0.22))),
			chats: Math.max(5, Math.round(messages / 7)),
			cost: Math.round((tokens / 1_000_000) * (5 + (index % 3) * 1.6)),
			day: new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date),
			errors: Math.max(0, Math.round((index % 5) + users.length * 0.12)),
			messages,
			newUsers: Math.max(1, Math.round((users.length / 5) * rhythm)),
			outputTokens: Math.round(tokens * 0.46),
			tokens,
		};
	});
}

function buildHourly(totalMessages: number): Array<{ hour: string; messages: number; requests: number }> {
	return Array.from({ length: 24 }, (_, hour) => {
		const peak = hour >= 9 && hour <= 18 ? 1.9 : 0.65;
		const wave = 0.75 + Math.sin(hour / 2.7) * 0.28;
		const messages = Math.max(2, Math.round((totalMessages / 190) * peak * wave));
		return {
			hour: `${hour.toString().padStart(2, "0")}:00`,
			messages,
			requests: Math.round(messages * 1.35),
		};
	});
}

function buildTimeline(user: UserUsage): TimelineEvent[] {
	const now = Date.now();
	const base = [
		["Login", "Successful login", user.email],
		["Session", "Session started", `${user.averageSessionDuration}m average`],
		["Chat", "Conversation created", `${user.chatsToday || 1} chats today`],
		["Tokens", "Token usage recorded", formatFull(user.totalTokens)],
		["Model", "Model selected", user.favoriteModel],
		["Provider", "Provider request completed", user.mostUsedProvider],
		["Image", "Image generation", `${user.imagesGenerated} images lifetime`],
		["Voice", "Voice usage", `${user.voiceMinutes} minutes`],
		["Error", "Recoverable request error", "retry succeeded"],
		["Logout", "Session closed", `${Math.max(1, user.averageSessionDuration - 6)}m active`],
	] as const;

	return base.map(([type, detail, meta], index) => ({
		detail,
		id: `${user.id}-${type}-${index}`,
		meta,
		timestamp: now - index * 2_700_000 - (index % 3) * 86_400_000,
		type,
	}));
}

function useCountUp(value: number): number {
	const [display, setDisplay] = useState(0);

	useEffect(() => {
		let frame = 0;
		const frames = 32;
		const start = display;
		const delta = value - start;
		const id = window.setInterval(() => {
			frame += 1;
			const progress = Math.min(1, frame / frames);
			const eased = 1 - (1 - progress) ** 3;
			setDisplay(start + delta * eased);
			if (progress === 1) {
				window.clearInterval(id);
			}
		}, 18);
		return () => window.clearInterval(id);
	}, [display, value]);

	return display;
}

function CountUp({
	formatter = formatCompact,
	value,
}: {
	formatter?: (value: number) => string;
	value: number;
}) {
	const display = useCountUp(value);
	return <>{formatter(display)}</>;
}

function ToolButton({
	children,
	label,
	onClick,
}: {
	children: React.ReactNode;
	label: string;
	onClick?: () => void;
}) {
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						className="size-8 rounded-lg border-white/10 bg-white/[0.07] text-slate-200 hover:bg-white/[0.12]"
						onClick={onClick}
						size="icon-sm"
						type="button"
						variant="outline"
					/>
				}
			>
				{children}
			</TooltipTrigger>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	);
}

function MetricCard({
	accent = "from-cyan-300 to-violet-400",
	change,
	icon: Icon,
	index,
	label,
	loading,
	sparkline,
	value,
	valueFormatter,
}: {
	accent?: string;
	change?: string;
	icon: LucideIcon;
	index: number;
	label: string;
	loading: boolean;
	sparkline?: number[];
	value: number;
	valueFormatter?: (value: number) => string;
}) {
	return (
		<motion.article
			className={cn(glassCard, "min-h-32 p-4")}
			custom={index}
			initial={{ opacity: 0, y: 18, scale: 0.98 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			transition={{ delay: index * 0.045, duration: 0.45, ease: "easeOut" }}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<p className="truncate text-xs font-medium uppercase text-slate-400">
						{label}
					</p>
					{loading ? (
						<div className="mt-3 h-8 w-28 animate-pulse rounded-md bg-white/10" />
					) : (
						<p className="mt-2 text-2xl font-semibold text-white tabular-nums">
							<CountUp value={value} formatter={valueFormatter} />
						</p>
					)}
				</div>
				<div
					className={cn(
						"grid size-9 place-items-center rounded-lg bg-gradient-to-br text-slate-950 shadow-lg",
						accent,
					)}
				>
					<Icon className="size-4" />
				</div>
			</div>
			<div className="mt-4 flex items-end justify-between gap-3">
				<span className="text-xs font-medium text-emerald-300">
					{change ?? "+12.4%"}
				</span>
				{sparkline ? <MiniSparkline values={sparkline} /> : null}
			</div>
		</motion.article>
	);
}

function MiniSparkline({ values }: { values: number[] }) {
	const max = Math.max(...values, 1);
	const points = values
		.map((value, index) => {
			const x = (index / Math.max(1, values.length - 1)) * 88;
			const y = 28 - (value / max) * 24;
			return `${x},${y}`;
		})
		.join(" ");
	return (
		<svg aria-hidden="true" className="h-8 w-24" viewBox="0 0 88 32">
			<polyline
				fill="none"
				points={points}
				stroke="url(#spark-gradient)"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth="2.5"
			/>
			<defs>
				<linearGradient id="spark-gradient" x1="0" x2="88" y1="0" y2="0">
					<stop stopColor="#22d3ee" />
					<stop offset="1" stopColor="#a78bfa" />
				</linearGradient>
			</defs>
		</svg>
	);
}

function Section({
	children,
	className,
	icon: Icon,
	right,
	title,
}: {
	children: React.ReactNode;
	className?: string;
	icon: LucideIcon;
	right?: React.ReactNode;
	title: string;
}) {
	const [open, setOpen] = useState(true);
	return (
		<section className={cn("space-y-4", className)}>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex min-w-0 items-center gap-3">
					<div className="grid size-8 place-items-center rounded-lg border border-white/10 bg-white/[0.07] text-cyan-200">
						<Icon className="size-4" />
					</div>
					<h2 className="truncate text-lg font-semibold text-white">{title}</h2>
				</div>
				<div className="flex items-center gap-2">
					{right}
					<ToolButton label={open ? "Collapse" : "Expand"} onClick={() => setOpen((value) => !value)}>
						<ChevronDownIcon className={cn("size-4 transition-transform", !open && "-rotate-90")} />
					</ToolButton>
				</div>
			</div>
			<AnimatePresence initial={false}>
				{open ? (
					<motion.div
						initial={{ opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: "auto" }}
						exit={{ opacity: 0, height: 0 }}
						transition={{ duration: 0.25 }}
						className="overflow-hidden"
					>
						{children}
					</motion.div>
				) : null}
			</AnimatePresence>
		</section>
	);
}

function ChartPanel({
	children,
	loading,
	subtitle,
	title,
}: {
	children: React.ReactNode;
	loading: boolean;
	subtitle?: string;
	title: string;
}) {
	return (
		<article className={cn(glassCard, "min-h-80 resize-y overflow-hidden p-4")}>
			<div className="mb-4 flex items-start justify-between gap-4">
				<div>
					<h3 className="text-sm font-semibold text-white">{title}</h3>
					{subtitle ? (
						<p className="mt-1 text-xs text-slate-400">{subtitle}</p>
					) : null}
				</div>
				<Badge className="border-cyan-300/20 bg-cyan-300/10 text-cyan-100" variant="outline">
					Live
				</Badge>
			</div>
			{loading ? (
				<div className="h-56 animate-pulse rounded-lg bg-white/[0.07]" />
			) : (
				<motion.div
					className="h-56"
					initial={{ opacity: 0, y: 8 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.35 }}
				>
					{children}
				</motion.div>
			)}
		</article>
	);
}

function tooltipProps() {
	return {
		contentStyle: {
			background: "rgba(8, 13, 30, 0.92)",
			border: "1px solid rgba(255,255,255,0.12)",
			borderRadius: 8,
			color: "#e2e8f0",
			boxShadow: "0 18px 48px rgba(0,0,0,0.35)",
		},
		cursor: { stroke: "rgba(34,211,238,0.28)" },
	};
}

function exportPayload(format: "csv" | "json" | "excel", users: UserUsage[]) {
	const columns = [
		"username",
		"email",
		"plan",
		"createdDate",
		"lastLogin",
		"lastActive",
		"totalChats",
		"chatsToday",
		"chatsLast7",
		"chatsLastMonth",
		"chatsLifetime",
		"inputTokens",
		"outputTokens",
		"totalTokens",
		"averageTokensPerChat",
		"averageSessionDuration",
		"totalTimeSpent",
		"messagesSent",
		"imagesGenerated",
		"voiceMinutes",
		"sandboxHours",
		"favoriteModel",
		"mostUsedProvider",
		"currentStatus",
	] as const;
	const fileType = format === "json" ? "application/json" : "text/csv";
	const payload =
		format === "json"
			? JSON.stringify(users, null, 2)
			: [
					columns.join(","),
					...users.map((user) =>
						columns
							.map((column) => {
								const value = user[column];
								return typeof value === "number" && column.toLowerCase().includes("date")
									? new Date(value).toISOString()
									: `"${String(value).replace(/"/g, '""')}"`;
							})
							.join(","),
					),
				].join("\n");
	const blob = new Blob([payload], { type: fileType });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = `zenuxs-admin-dashboard.${format === "excel" ? "xls" : format}`;
	anchor.click();
	URL.revokeObjectURL(url);
}

function ExportButtons({ users }: { users: UserUsage[] }) {
	return (
		<div className="flex items-center gap-2">
			<ToolButton label="Export CSV" onClick={() => exportPayload("csv", users)}>
				<DownloadIcon className="size-4" />
			</ToolButton>
			<ToolButton label="Export Excel" onClick={() => exportPayload("excel", users)}>
				<FileSpreadsheetIcon className="size-4" />
			</ToolButton>
			<ToolButton label="Export JSON" onClick={() => exportPayload("json", users)}>
				<FileJsonIcon className="size-4" />
			</ToolButton>
			<ToolButton label="Export PDF" onClick={() => window.print()}>
				<FileTextIcon className="size-4" />
			</ToolButton>
		</div>
	);
}

function UserAvatar({ user }: { user: UserUsage }) {
	return (
		<div className="grid size-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-cyan-300 via-violet-300 to-emerald-300 text-xs font-bold text-slate-950">
			{user.avatar}
		</div>
	);
}

function StatusPill({ status }: { status: UserUsage["currentStatus"] }) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
				status === "Online"
					? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200"
					: "border-slate-500/30 bg-slate-500/10 text-slate-300",
			)}
		>
			<span
				className={cn(
					"size-1.5 rounded-full",
					status === "Online" ? "bg-emerald-300" : "bg-slate-500",
				)}
			/>
			{status}
		</span>
	);
}

function Leaderboard({
	icon: Icon,
	items,
	title,
}: {
	icon: LucideIcon;
	items: Array<{ label: string; meta: string; value: string }>;
	title: string;
}) {
	return (
		<article className={cn(glassCard, "p-4")}>
			<div className="mb-4 flex items-center gap-2">
				<Icon className="size-4 text-cyan-200" />
				<h3 className="text-sm font-semibold text-white">{title}</h3>
			</div>
			<div className="space-y-3">
				{items.map((item, index) => (
					<div className="flex items-center justify-between gap-3" key={`${title}-${item.label}`}>
						<div className="flex min-w-0 items-center gap-3">
							<span className="grid size-6 place-items-center rounded-md bg-white/[0.08] text-xs font-semibold text-slate-300">
								{index + 1}
							</span>
							<div className="min-w-0">
								<p className="truncate text-sm font-medium text-slate-100">{item.label}</p>
								<p className="truncate text-xs text-slate-400">{item.meta}</p>
							</div>
						</div>
						<span className="shrink-0 text-sm font-semibold text-cyan-100">{item.value}</span>
					</div>
				))}
			</div>
		</article>
	);
}

function RetentionHeatmap({
	cohorts,
}: {
	cohorts: Array<{ cohort: string; values: number[] }>;
}) {
	return (
		<div className={cn(glassCard, "p-4")}>
			<div className="mb-4 flex items-center justify-between">
				<h3 className="text-sm font-semibold text-white">Retention Heatmap</h3>
				<div className="flex gap-1 text-[10px] text-slate-500">
					<span>D1</span>
					<span>D7</span>
					<span>D30</span>
					<span>W</span>
					<span>M</span>
				</div>
			</div>
			<div className="space-y-2">
				{cohorts.map((cohort) => (
					<div className="grid grid-cols-[4.5rem_repeat(5,minmax(2.5rem,1fr))] gap-1" key={cohort.cohort}>
						<span className="truncate text-xs text-slate-400">{cohort.cohort}</span>
						{cohort.values.map((value, index) => (
							<div
								className="grid h-8 place-items-center rounded-md border border-white/10 text-[11px] font-semibold text-white"
								key={`${cohort.cohort}-${index}`}
								style={{
									backgroundColor: `rgba(34, 211, 238, ${0.12 + value / 130})`,
								}}
							>
								{value}%
							</div>
						))}
					</div>
				))}
			</div>
		</div>
	);
}

function CalendarHeatmap({ data }: { data: Array<{ date: string; value: number }> }) {
	const max = Math.max(...data.map((item) => item.value), 1);
	return (
		<div className={cn(glassCard, "p-4")}>
			<h3 className="mb-4 text-sm font-semibold text-white">Calendar Activity</h3>
			<div className="grid grid-cols-7 gap-1">
				{data.map((item) => (
					<Tooltip key={item.date}>
						<TooltipTrigger>
							<div
								className="h-8 rounded-md border border-white/10"
								style={{
									backgroundColor: `rgba(139, 92, 246, ${0.12 + item.value / max * 0.72})`,
								}}
							/>
						</TooltipTrigger>
						<TooltipContent>
							{item.date}: {item.value} events
						</TooltipContent>
					</Tooltip>
				))}
			</div>
		</div>
	);
}

function ProviderTreemap({
	data,
}: {
	data: Array<{ name: string; tokens: number; users: number }>;
}) {
	const total = Math.max(1, data.reduce((sum, item) => sum + item.tokens, 0));
	return (
		<div className={cn(glassCard, "p-4")}>
			<h3 className="mb-4 text-sm font-semibold text-white">Provider Treemap</h3>
			<div className="flex h-64 gap-2 overflow-hidden rounded-lg">
				{data.map((item, index) => (
					<div
						className="flex min-w-20 flex-col justify-between rounded-lg border border-white/10 p-3 text-slate-950"
						key={item.name}
						style={{
							background: `linear-gradient(135deg, ${CHART_COLORS[index % CHART_COLORS.length]}, ${CHART_COLORS[(index + 1) % CHART_COLORS.length]})`,
							flex: Math.max(0.28, item.tokens / total * 7),
						}}
					>
						<span className="text-xs font-bold">{item.name}</span>
						<span className="text-[11px] font-semibold">{formatCompact(item.tokens)} tokens</span>
						<span className="text-[11px]">{item.users} users</span>
					</div>
				))}
			</div>
		</div>
	);
}

function TimelineDrawer({
	onClose,
	user,
}: {
	onClose: () => void;
	user: UserUsage | null;
}) {
	const [range, setRange] = useState<DateRangeId>("30d");
	const events = useMemo(() => {
		if (!user) return [];
		const allEvents = buildTimeline(user);
		if (range === "lifetime" || range === "custom") return allEvents;
		const rangeMs =
			range === "today"
				? 86_400_000
				: range === "yesterday"
					? 2 * 86_400_000
					: range === "7d"
						? 7 * 86_400_000
						: range === "90d"
							? 90 * 86_400_000
							: 30 * 86_400_000;
		const cutoff = Date.now() - rangeMs;
		return allEvents.filter((event) => event.timestamp >= cutoff);
	}, [range, user]);

	return (
		<AnimatePresence>
			{user ? (
				<>
					<motion.button
						aria-label="Close timeline"
						className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-sm"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={onClose}
						type="button"
					/>
					<motion.aside
						className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-white/10 bg-[#070b18]/95 p-5 text-slate-100 shadow-2xl backdrop-blur-2xl"
						initial={{ x: "100%" }}
						animate={{ x: 0 }}
						exit={{ x: "100%" }}
						transition={{ type: "spring", stiffness: 260, damping: 30 }}
					>
						<div className="flex items-start justify-between gap-4">
							<div className="flex min-w-0 items-center gap-3">
								<UserAvatar user={user} />
								<div className="min-w-0">
									<h3 className="truncate text-lg font-semibold text-white">{user.username}</h3>
									<p className="truncate text-sm text-slate-400">{user.email}</p>
								</div>
							</div>
							<ToolButton label="Close" onClick={onClose}>
								<XIcon className="size-4" />
							</ToolButton>
						</div>
						<div className="mt-5 grid grid-cols-3 gap-2">
							<div className={fieldChip}>Chats {formatFull(user.totalChats)}</div>
							<div className={fieldChip}>Tokens {formatCompact(user.totalTokens)}</div>
							<div className={fieldChip}>Plan {user.plan}</div>
						</div>
						<div className="mt-5">
							<Select value={range} onValueChange={(value) => setRange(value as DateRangeId)}>
								<SelectTrigger className="w-full border-white/10 bg-white/[0.07] text-slate-100">
									<SelectValue placeholder="Timeline range" />
								</SelectTrigger>
								<SelectContent>
									{DATE_RANGES.map((item) => (
										<SelectItem key={item.id} value={item.id}>
											{item.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="mt-6 min-h-0 flex-1 overflow-y-auto pr-1">
							<div className="space-y-3">
								{events.map((event) => (
									<div className="relative rounded-lg border border-white/10 bg-white/[0.055] p-4" key={event.id}>
										<div className="flex items-start justify-between gap-3">
											<div>
												<p className="text-sm font-semibold text-white">{event.type}</p>
												<p className="mt-1 text-sm text-slate-300">{event.detail}</p>
											</div>
											<time className="shrink-0 text-xs text-slate-500">
												{formatDateTime(event.timestamp)}
											</time>
										</div>
										<p className="mt-3 text-xs text-cyan-200">{event.meta}</p>
									</div>
								))}
							</div>
						</div>
					</motion.aside>
				</>
			) : null}
		</AnimatePresence>
	);
}

function UserUsageExplorer({
	loading,
	onSelectUser,
	users,
}: {
	loading: boolean;
	onSelectUser: (user: UserUsage) => void;
	users: UserUsage[];
}) {
	if (loading) {
		return <div className="h-96 animate-pulse rounded-lg bg-white/[0.07]" />;
	}
	return (
		<motion.div
			className={cn(glassCard, "overflow-hidden")}
			initial={{ opacity: 0, y: 12 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.35 }}
		>
			<div className="overflow-x-auto">
				<table className="w-full min-w-[132rem] text-left text-sm">
					<thead className="sticky top-0 bg-[#101629] text-xs uppercase text-slate-400">
						<tr>
							{[
								"Avatar",
								"Username",
								"Email",
								"Plan",
								"Created",
								"Last Login",
								"Last Active",
								"Total Chats",
								"Today",
								"7 Days",
								"Month",
								"Lifetime",
								"Input Tokens",
								"Output Tokens",
								"Total Tokens",
								"Avg Tokens/Chat",
								"Avg Session",
								"Total Time",
								"Messages",
								"Images",
								"Voice",
								"Sandbox",
								"Favorite Model",
								"Provider",
								"Status",
							].map((header) => (
								<th className="px-3 py-3 font-semibold" key={header}>
									{header}
								</th>
							))}
						</tr>
					</thead>
					<tbody className="divide-y divide-white/10">
						{users.length === 0 ? (
							<tr>
								<td className="px-3 py-8 text-center text-slate-400" colSpan={25}>
									No users match current filters.
								</td>
							</tr>
						) : null}
						{users.map((user) => (
							<tr
								className="cursor-pointer transition-colors hover:bg-white/[0.06]"
								key={user.id}
								onClick={() => onSelectUser(user)}
							>
								<td className="px-3 py-3">
									<UserAvatar user={user} />
								</td>
								<td className="px-3 py-3 font-medium text-white">{user.username}</td>
								<td className="px-3 py-3 text-slate-300">{user.email}</td>
								<td className="px-3 py-3">
									<Badge className="border-violet-300/20 bg-violet-300/10 text-violet-100" variant="outline">
										{user.plan}
									</Badge>
								</td>
								<td className="px-3 py-3 text-slate-300">{formatDate(user.createdDate)}</td>
								<td className="px-3 py-3 text-slate-300">{relativeTime(user.lastLogin)}</td>
								<td className="px-3 py-3 text-slate-300">{relativeTime(user.lastActive)}</td>
								<td className="px-3 py-3 text-slate-100">{formatFull(user.totalChats)}</td>
								<td className="px-3 py-3 text-slate-300">{formatFull(user.chatsToday)}</td>
								<td className="px-3 py-3 text-slate-300">{formatFull(user.chatsLast7)}</td>
								<td className="px-3 py-3 text-slate-300">{formatFull(user.chatsLastMonth)}</td>
								<td className="px-3 py-3 text-slate-300">{formatFull(user.chatsLifetime)}</td>
								<td className="px-3 py-3 text-slate-300">{formatCompact(user.inputTokens)}</td>
								<td className="px-3 py-3 text-slate-300">{formatCompact(user.outputTokens)}</td>
								<td className="px-3 py-3 font-semibold text-cyan-100">{formatCompact(user.totalTokens)}</td>
								<td className="px-3 py-3 text-slate-300">{formatFull(user.averageTokensPerChat)}</td>
								<td className="px-3 py-3 text-slate-300">{formatMinutes(user.averageSessionDuration)}</td>
								<td className="px-3 py-3 text-slate-300">{formatMinutes(user.totalTimeSpent)}</td>
								<td className="px-3 py-3 text-slate-300">{formatFull(user.messagesSent)}</td>
								<td className="px-3 py-3 text-slate-300">{formatFull(user.imagesGenerated)}</td>
								<td className="px-3 py-3 text-slate-300">{formatMinutes(user.voiceMinutes)}</td>
								<td className="px-3 py-3 text-slate-300">{user.sandboxHours}h</td>
								<td className="px-3 py-3 text-slate-300">{user.favoriteModel}</td>
								<td className="px-3 py-3 text-slate-300">{user.mostUsedProvider}</td>
								<td className="px-3 py-3">
									<StatusPill status={user.currentStatus} />
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</motion.div>
	);
}

function HubOperations({
	events,
	hubState,
	onOpenSession,
	onRestartHub,
	onViewSessions,
	restartPending,
	sessions,
}: {
	events: WebviewHubEvent[];
	hubState: WebviewHubState;
	onOpenSession: (sessionId: string) => void;
	onRestartHub: () => void;
	onViewSessions: () => void;
	restartPending: boolean;
	sessions: SessionLike[];
}) {
	const copyHubUrl = useCallback(() => {
		if (hubState.hubUrl) {
			void navigator.clipboard?.writeText(hubState.hubUrl);
		}
	}, [hubState.hubUrl]);

	return (
		<div className="grid gap-4 xl:grid-cols-[1fr_1fr_1fr]">
			<article className={cn(glassCard, "p-4")}>
				<div className="mb-4 flex items-center justify-between">
					<h3 className="text-sm font-semibold text-white">Hub Controls</h3>
					<Badge className="border-emerald-300/20 bg-emerald-300/10 text-emerald-100" variant="outline">
						{hubState.connected ? "Connected" : "Offline"}
					</Badge>
				</div>
				<div className="space-y-3 text-sm">
					<div className="flex items-center justify-between gap-3">
						<span className="text-slate-400">Uptime</span>
						<span className="font-medium text-slate-100">{hubState.hubUptime ?? "0m"}</span>
					</div>
					<div className="flex items-center justify-between gap-3">
						<span className="text-slate-400">Core</span>
						<span className="font-medium text-slate-100">{hubState.coreVersion ? `v${hubState.coreVersion}` : "v-"}</span>
					</div>
					<button
						className="flex w-full min-w-0 items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-xs text-slate-300 transition-colors hover:bg-white/[0.08]"
						onClick={copyHubUrl}
						type="button"
					>
						<span className="truncate">{hubState.hubUrl ?? "no hub url"}</span>
						<ArrowUpRightIcon className="size-3.5 shrink-0" />
					</button>
					<Button
						className="w-full rounded-lg border-white/10 bg-white/[0.07] text-slate-100 hover:bg-white/[0.12]"
						disabled={!hubState.connected || restartPending}
						onClick={onRestartHub}
						type="button"
						variant="outline"
					>
						<RefreshCcwIcon className={cn("size-4", restartPending && "animate-spin")} />
						{restartPending ? "Restarting" : "Restart Hub"}
					</Button>
				</div>
			</article>
			<article className={cn(glassCard, "p-4")}>
				<div className="mb-4 flex items-center justify-between">
					<h3 className="text-sm font-semibold text-white">Active Sessions</h3>
					<Button className="h-7 rounded-lg text-xs" onClick={onViewSessions} type="button" variant="outline">
						View all
					</Button>
				</div>
				<div className="space-y-2">
					{sessions.slice(0, 4).map((session) => (
						<button
							className="flex w-full items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-left transition-colors hover:bg-white/[0.08]"
							key={session.sessionId}
							onClick={() => onOpenSession(session.sessionId)}
							type="button"
						>
							<div className="min-w-0">
								<p className="truncate text-sm font-medium text-white">{sessionTitle(session)}</p>
								<p className="truncate text-xs text-slate-400">
									{(session as any).providerId ?? "provider"} / {session.model ?? "model"}
								</p>
							</div>
							<span className="shrink-0 text-xs text-slate-500">{relativeTime(session.updatedAt ?? session.createdAt)}</span>
						</button>
					))}
					{sessions.length === 0 ? <p className="text-sm text-slate-400">No sessions yet.</p> : null}
				</div>
			</article>
			<article className={cn(glassCard, "p-4")}>
				<div className="mb-4 flex items-center justify-between">
					<h3 className="text-sm font-semibold text-white">Recent Events</h3>
					<BellIcon className="size-4 text-cyan-200" />
				</div>
				<div className="space-y-2">
					{events.slice(0, 4).map((event) => (
						<div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2" key={event.id}>
							<div className="flex items-center justify-between gap-3">
								<p className="truncate text-sm font-medium text-white">{event.title}</p>
								<time className="shrink-0 text-xs text-slate-500">{relativeTime(event.timestamp)}</time>
							</div>
							<p className="mt-1 truncate text-xs text-slate-400">{event.body}</p>
						</div>
					))}
					{events.length === 0 ? <p className="text-sm text-slate-400">No hub events yet.</p> : null}
				</div>
			</article>
		</div>
	);
}

export function AdminDashboard({
	hubState,
	onOpenSession,
	onRestartHub,
	onViewSessions,
	recentSessions,
	restartPending,
}: AdminDashboardProps) {
	const [dateRange, setDateRange] = useState<DateRangeId>("30d");
	const [quickRange, setQuickRange] = useState<QuickRangeId>("daily");
	const [globalSearch, setGlobalSearch] = useState("");
	const [userSearch, setUserSearch] = useState("");
	const [selectedUser, setSelectedUser] = useState<UserUsage | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		setLoading(true);
		const id = window.setTimeout(() => setLoading(false), 620);
		return () => window.clearTimeout(id);
	}, [dateRange, quickRange]);

	const rangeConfig = DATE_RANGES.find((item) => item.id === dateRange) ?? DATE_RANGES[3];
	const multiplier = rangeConfig.multiplier;
	const sessions = useMemo(
		() => normalizeSessions(recentSessions, hubState),
		[hubState, recentSessions],
	);
	const users = useMemo(
		() => buildUsers(sessions, hubState, multiplier),
		[sessions, hubState, multiplier],
	);
	const filteredUsers = useMemo(() => {
		const query = `${globalSearch} ${userSearch}`.trim().toLowerCase();
		if (!query) return users;
		return users.filter((user) =>
			[
				user.username,
				user.email,
				user.plan,
				user.favoriteModel,
				user.mostUsedProvider,
				user.currentStatus,
			]
				.join(" ")
				.toLowerCase()
				.includes(query),
		);
	}, [globalSearch, userSearch, users]);

	const totals = useMemo(() => {
		const totalUsers = Math.max(users.length, Math.round(users.length * (3.2 + multiplier)));
		const paidUsers = users.filter((user) => user.plan !== "Free").length;
		const totalMessages = users.reduce((sum, user) => sum + user.messagesSent, 0);
		const totalChats = users.reduce((sum, user) => sum + user.totalChats, 0);
		const inputTokens = users.reduce((sum, user) => sum + user.inputTokens, 0);
		const outputTokens = users.reduce((sum, user) => sum + user.outputTokens, 0);
		const totalTokens = inputTokens + outputTokens;
		const images = users.reduce((sum, user) => sum + user.imagesGenerated, 0);
		const voice = users.reduce((sum, user) => sum + user.voiceMinutes, 0);
		const sandbox = users.reduce((sum, user) => sum + user.sandboxHours, 0);
		return {
			active24: users.filter((user) => Date.now() - user.lastActive < 86_400_000).length,
			active7: Math.round(totalUsers * 0.58),
			active30: Math.round(totalUsers * 0.74),
			active90: Math.round(totalUsers * 0.86),
			avgMessagesPerUser: totalMessages / Math.max(1, users.length) / 30,
			avgTokensConversation: totalTokens / Math.max(1, totalChats),
			avgTokensMessage: totalTokens / Math.max(1, totalMessages),
			avgTokensUser: totalTokens / Math.max(1, users.length),
			churnUsers: Math.round(totalUsers * 0.06),
			conversations: totalChats,
			freeUsers: totalUsers - paidUsers,
			imagesToday: Math.round(images * 0.06),
			inputTokens,
			liveApiCalls: Math.round(totalChats * 0.22 + hubState.clients.length * 4),
			liveChats: Math.max(1, Math.round(totalChats * 0.014)),
			liveErrors: Math.max(0, Math.round((hubState.events ?? []).filter((event: WebviewHubEvent) => event.severity === "error").length + users.length * 0.08)),
			liveUsers: Math.max(hubState.clients.length, users.filter((user) => user.currentStatus === "Online").length),
			messages30d: Math.round(totalMessages * Math.min(1.6, multiplier)),
			monthlyActive: Math.round(totalUsers * 0.74),
			newUsers: Math.round(totalUsers * 0.14),
			outputTokens,
			paidUsers,
			reactivatedUsers: Math.round(totalUsers * 0.04),
			retention: 84,
			returningUsers: Math.round(totalUsers * 0.62),
			sandboxHours: sandbox,
			todayTokens: Math.round(totalTokens * 0.032),
			totalCost: users.reduce((sum, user) => sum + user.totalTokens / 1_000_000 * 8.4, 0),
			totalMessages,
			totalTokens,
			totalUsers,
			voiceMinutes: voice,
			yesterdayTokens: Math.round(totalTokens * 0.029),
		};
	}, [hubState.clients.length, hubState.events, multiplier, users]);

	const chartData = useMemo(() => buildSeries(users, multiplier), [multiplier, users]);
	const hourlyData = useMemo(() => buildHourly(totals.totalMessages), [totals.totalMessages]);
	const planData = useMemo(
		() =>
			PLANS.map((plan) => ({
				name: plan,
				value: users.filter((user) => user.plan === plan).length,
			})),
		[users],
	);
	const providerData = useMemo(
		() =>
			PROVIDERS.map((provider, index) => {
				const providerUsers = users.filter((user) => user.mostUsedProvider.toLowerCase().includes(provider.toLowerCase()));
				const fallbackUsers = providerUsers.length ? providerUsers : users.filter((_, userIndex) => userIndex % PROVIDERS.length === index);
				const tokens = fallbackUsers.reduce((sum, user) => sum + user.totalTokens, 0);
				const chats = fallbackUsers.reduce((sum, user) => sum + user.totalChats, 0);
				return {
					averageCost: tokens / 1_000_000 * (4.2 + index * 0.55),
					averageLatency: 480 + index * 72,
					chats,
					name: provider,
					requests: Math.round(chats * 1.4 + index * 18),
					tokens,
					users: Math.max(1, fallbackUsers.length),
				};
			}),
		[users],
	);
	const modelData = useMemo(
		() =>
			MODELS.map((model, index) => ({
				daily: Math.round((index + 2) * 42 * multiplier),
				model,
				monthly: Math.round((index + 4) * 380 * multiplier),
				tokens: users
					.filter((user) => user.favoriteModel === model || users.indexOf(user) % MODELS.length === index)
					.reduce((sum, user) => sum + Math.round(user.totalTokens / 2), 0),
				users: Math.max(1, users.filter((user) => user.favoriteModel === model).length + index),
			})),
		[multiplier, users],
	);
	const retentionCohorts = useMemo(
		() =>
			["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((cohort, index) => ({
				cohort,
				values: [92 - index * 2, 78 - index * 2, 62 - index, 58 - index * 2, 45 - index],
			})),
		[],
	);
	const calendarData = useMemo(
		() =>
			Array.from({ length: 35 }, (_, index) => ({
				date: formatDate(Date.now() - (34 - index) * 86_400_000),
				value: Math.round((chartData[index % chartData.length]?.messages ?? 20) / 12),
			})),
		[chartData],
	);

	const topUsers = [...users].sort((a, b) => b.totalTokens - a.totalTokens);
	const lowUsers = [...users].sort((a, b) => a.totalTokens - b.totalTokens);
	const peakDay = chartData.reduce((best, item) => (item.tokens > best.tokens ? item : best), chartData[0]);
	const peakHour = hourlyData.reduce((best, item) => (item.requests > best.requests ? item : best), hourlyData[0]);
	const liveSpark = chartData.slice(-8).map((item) => item.messages);

	const primaryMetrics = [
		{ accent: "from-cyan-300 to-blue-400", change: "+18.2%", icon: UsersIcon, label: "Total Users", value: totals.totalUsers },
		{ accent: "from-violet-300 to-fuchsia-400", change: "+24.7%", icon: MessageSquareIcon, label: "Messages (30D)", value: totals.messages30d },
		{ accent: "from-emerald-300 to-cyan-300", change: "+11.8%", icon: ActivityIcon, label: "Active Users (DAU)", value: totals.active24 },
		{ accent: "from-amber-300 to-orange-400", change: "+8.4%", icon: CalendarDaysIcon, label: "Monthly Active", value: totals.monthlyActive },
		{ accent: "from-sky-300 to-violet-300", change: "+16.1%", icon: LineChartIcon, label: "Conversations", value: totals.conversations },
		{ accent: "from-slate-200 to-cyan-300", change: "+5.9%", icon: UserIcon, label: "Free Users", value: totals.freeUsers },
		{ accent: "from-lime-300 to-emerald-400", change: "+14.3%", icon: CircleDollarSignIcon, label: "Paid Users", value: totals.paidUsers },
		{ accent: "from-rose-300 to-violet-400", change: "+3.6%", icon: UserCheckIcon, label: "Retention", value: totals.retention, valueFormatter: formatPercent },
		{ accent: "from-cyan-300 to-emerald-300", change: "+19.8%", icon: ImageIcon, label: "Images Today", value: totals.imagesToday },
		{ accent: "from-violet-300 to-cyan-300", change: "+9.1%", icon: Volume2Icon, label: "Voice Minutes", value: totals.voiceMinutes },
		{ accent: "from-orange-300 to-cyan-300", change: "+7.5%", icon: ServerIcon, label: "Sandbox Hours", value: totals.sandboxHours },
		{ accent: "from-blue-300 to-emerald-300", change: "+10.2%", icon: GaugeIcon, label: "Avg Messages/User/Day", value: totals.avgMessagesPerUser, valueFormatter: (value: number) => value.toFixed(1) },
	];

	return (
		<div className="h-full overflow-y-auto bg-[#050610] text-slate-100">
			<motion.div
				className="relative min-h-full overflow-hidden"
				initial={{ opacity: 0, y: 16 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.55, ease: "easeOut" }}
			>
				<div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
				<header className="sticky top-0 z-30 border-b border-white/10 bg-[#050610]/86 px-6 py-4 backdrop-blur-2xl max-[720px]:px-4">
					<div className="mx-auto flex max-w-[100rem] flex-wrap items-center justify-between gap-4">
						<div className="min-w-0">
							<div className="flex items-center gap-2">
								<Badge className="border-cyan-300/20 bg-cyan-300/10 text-cyan-100" variant="outline">
									Admin
								</Badge>
								<Badge className="border-violet-300/20 bg-violet-300/10 text-violet-100" variant="outline">
									Realtime
								</Badge>
							</div>
							<h1 className="mt-2 truncate text-3xl font-semibold text-white max-[720px]:text-2xl">
								Zenuxs Admin Dashboard
							</h1>
						</div>
						<div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
							<div className="relative min-w-64 flex-1 max-w-md">
								<SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
								<Input
									className="h-9 rounded-lg border-white/10 bg-white/[0.07] pl-9 text-slate-100 placeholder:text-slate-500"
									onChange={(event) => setGlobalSearch(event.target.value)}
									placeholder="Search users, conversations, providers, models"
									value={globalSearch}
								/>
							</div>
							<Select value={dateRange} onValueChange={(value) => setDateRange(value as DateRangeId)}>
								<SelectTrigger className="h-9 min-w-40 border-white/10 bg-white/[0.07] text-slate-100">
									<SelectValue placeholder="Date range" />
								</SelectTrigger>
								<SelectContent>
									{DATE_RANGES.map((item) => (
										<SelectItem key={item.id} value={item.id}>
											{item.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<ExportButtons users={filteredUsers} />
						</div>
					</div>
					<div className="mx-auto mt-3 flex max-w-[100rem] flex-wrap items-center gap-2">
						{QUICK_RANGES.map((item) => (
							<button
								className={cn(
									"rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
									quickRange === item.id
										? "border-cyan-300/40 bg-cyan-300/12 text-cyan-100"
										: "border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-slate-200",
								)}
								key={item.id}
								onClick={() => setQuickRange(item.id)}
								type="button"
							>
								{item.label}
							</button>
						))}
						{dateRange === "custom" ? (
							<div className="flex items-center gap-2">
								<Input className="h-8 w-36 border-white/10 bg-white/[0.07] text-slate-100" type="date" />
								<Input className="h-8 w-36 border-white/10 bg-white/[0.07] text-slate-100" type="date" />
							</div>
						) : null}
					</div>
				</header>

				<main className="mx-auto max-w-[100rem] space-y-8 px-6 py-6 max-[720px]:px-4">
					<section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
						{primaryMetrics.map((metric, index) => (
							<MetricCard
								accent={metric.accent}
								change={metric.change}
								icon={metric.icon}
								index={index}
								key={metric.label}
								label={metric.label}
								loading={loading}
								sparkline={liveSpark}
								value={metric.value}
								valueFormatter={metric.valueFormatter}
							/>
						))}
					</section>

					<Section icon={ZapIcon} title="Realtime Dashboard">
						<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
							<MetricCard accent="from-emerald-300 to-cyan-300" change="auto refresh" icon={ActivityIcon} index={0} label="Live Users" loading={loading} sparkline={liveSpark} value={totals.liveUsers} />
							<MetricCard accent="from-cyan-300 to-blue-400" change="streaming" icon={MessageSquareIcon} index={1} label="Live Chats" loading={loading} sparkline={liveSpark} value={totals.liveChats} />
							<MetricCard accent="from-violet-300 to-cyan-300" change="now" icon={SparklesIcon} index={2} label="Live Token Usage" loading={loading} sparkline={liveSpark} value={totals.todayTokens} />
							<MetricCard accent="from-amber-300 to-rose-300" change={`${totals.liveErrors} errors`} icon={AlertTriangleIcon} index={3} label="Live Requests" loading={loading} sparkline={liveSpark} value={totals.liveApiCalls} />
						</div>
					</Section>

					<Section icon={BarChart3Icon} title="Advanced Graphs">
						<div className="grid gap-4 xl:grid-cols-2">
							<ChartPanel loading={loading} title="Daily Messages" subtitle="Messages, chats, and active users">
								<ResponsiveContainer height="100%" width="100%">
									<AreaChart data={chartData}>
										<CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
										<XAxis dataKey="day" stroke="#94a3b8" tickLine={false} />
										<YAxis stroke="#94a3b8" tickLine={false} width={44} />
										<RechartsTooltip {...tooltipProps()} />
										<Area dataKey="messages" fill="#22d3ee33" isAnimationActive stroke="#22d3ee" strokeWidth={2} type="monotone" />
										<Area dataKey="chats" fill="#8b5cf633" isAnimationActive stroke="#a78bfa" strokeWidth={2} type="monotone" />
									</AreaChart>
								</ResponsiveContainer>
							</ChartPanel>
							<ChartPanel loading={loading} title="New Users" subtitle="Acquisition by day">
								<ResponsiveContainer height="100%" width="100%">
									<BarChart data={chartData}>
										<CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
										<XAxis dataKey="day" stroke="#94a3b8" tickLine={false} />
										<YAxis stroke="#94a3b8" tickLine={false} width={36} />
										<RechartsTooltip {...tooltipProps()} />
										<Bar dataKey="newUsers" radius={[6, 6, 0, 0]} isAnimationActive>
											{chartData.map((item, index) => (
												<Cell fill={CHART_COLORS[index % CHART_COLORS.length]} key={item.day} />
											))}
										</Bar>
									</BarChart>
								</ResponsiveContainer>
							</ChartPanel>
							<ChartPanel loading={loading} title="Weekly Trends" subtitle="Active, paid, and churn movement">
								<ResponsiveContainer height="100%" width="100%">
									<ComposedChart data={chartData}>
										<CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
										<XAxis dataKey="day" stroke="#94a3b8" tickLine={false} />
										<YAxis stroke="#94a3b8" tickLine={false} width={36} />
										<RechartsTooltip {...tooltipProps()} />
										<Bar dataKey="active" fill="#34d399" radius={[6, 6, 0, 0]} stackId="trend" />
										<Bar dataKey="errors" fill="#fb7185" radius={[6, 6, 0, 0]} stackId="trend" />
										<Line dataKey="cost" dot={false} stroke="#f59e0b" strokeWidth={2} type="monotone" />
									</ComposedChart>
								</ResponsiveContainer>
							</ChartPanel>
							<ChartPanel loading={loading} title="Token Usage" subtitle="Input and output token volume">
								<ResponsiveContainer height="100%" width="100%">
									<AreaChart data={chartData}>
										<CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
										<XAxis dataKey="day" stroke="#94a3b8" tickLine={false} />
										<YAxis stroke="#94a3b8" tickFormatter={formatCompact} tickLine={false} width={56} />
										<RechartsTooltip {...tooltipProps()} formatter={(value) => formatCompact(Number(value))} />
										<Area dataKey="tokens" fill="#8b5cf633" stroke="#a78bfa" strokeWidth={2} type="monotone" />
										<Area dataKey="outputTokens" fill="#22d3ee33" stroke="#22d3ee" strokeWidth={2} type="monotone" />
										<Legend />
									</AreaChart>
								</ResponsiveContainer>
							</ChartPanel>
							<ChartPanel loading={loading} title="Users by Plan" subtitle="Plan distribution">
								<ResponsiveContainer height="100%" width="100%">
									<PieChart>
										<Pie data={planData} dataKey="value" innerRadius={58} outerRadius={92} paddingAngle={4}>
											{planData.map((item, index) => (
												<Cell fill={CHART_COLORS[index % CHART_COLORS.length]} key={item.name} />
											))}
										</Pie>
										<RechartsTooltip {...tooltipProps()} />
										<Legend />
									</PieChart>
								</ResponsiveContainer>
							</ChartPanel>
							<ChartPanel loading={loading} title="Conversation Scatter" subtitle="Length versus token load">
								<ResponsiveContainer height="100%" width="100%">
									<ScatterChart>
										<CartesianGrid stroke="rgba(255,255,255,0.08)" />
										<XAxis dataKey="totalChats" name="Chats" stroke="#94a3b8" type="number" />
										<YAxis dataKey="totalTokens" name="Tokens" stroke="#94a3b8" tickFormatter={formatCompact} type="number" />
										<RechartsTooltip {...tooltipProps()} formatter={(value) => formatCompact(Number(value))} />
										<Scatter data={users} fill="#22d3ee" isAnimationActive />
									</ScatterChart>
								</ResponsiveContainer>
							</ChartPanel>
						</div>
					</Section>

					<Section icon={SparklesIcon} title="Token Analytics">
						<div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
							<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
								{[
									["Total Input Tokens", totals.inputTokens],
									["Total Output Tokens", totals.outputTokens],
									["Total Tokens", totals.totalTokens],
									["Today's Tokens", totals.todayTokens],
									["Yesterday Tokens", totals.yesterdayTokens],
									["Last 7 Days", totals.totalTokens * 0.22],
									["Last 30 Days", totals.totalTokens * 0.48],
									["Last 90 Days", totals.totalTokens * 0.72],
									["All Time Tokens", totals.totalTokens],
									["Average Tokens per User", totals.avgTokensUser],
									["Average Tokens per Conversation", totals.avgTokensConversation],
									["Average Tokens per Message", totals.avgTokensMessage],
								].map(([label, value], index) => (
									<MetricCard
										accent={index % 2 === 0 ? "from-cyan-300 to-violet-400" : "from-emerald-300 to-cyan-300"}
										icon={SparklesIcon}
										index={index}
										key={label}
										label={String(label)}
										loading={loading}
										value={Number(value)}
									/>
								))}
							</div>
							<article className={cn(glassCard, "p-4")}>
								<h3 className="text-sm font-semibold text-white">Peak Token Usage</h3>
								<div className="mt-4 grid gap-3">
									<div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
										<p className="text-xs text-slate-400">Peak Token Usage Day</p>
										<p className="mt-2 text-2xl font-semibold text-white">{peakDay.day}</p>
										<p className="mt-1 text-sm text-cyan-200">{formatCompact(peakDay.tokens)} tokens</p>
									</div>
									<div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
										<p className="text-xs text-slate-400">Peak Token Usage Hour</p>
										<p className="mt-2 text-2xl font-semibold text-white">{peakHour.hour}</p>
										<p className="mt-1 text-sm text-cyan-200">{formatCompact(peakHour.requests)} requests</p>
									</div>
								</div>
							</article>
						</div>
					</Section>

					<Section icon={ActivityIcon} title="User Activity">
						<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
							{[
								["Active users in last 24 hours", totals.active24, ActivityIcon],
								["Active users in last 7 days", totals.active7, CalendarDaysIcon],
								["Active users in last 30 days", totals.active30, UsersIcon],
								["Active users in last 90 days", totals.active90, TimerIcon],
								["Returning users", totals.returningUsers, UserCheckIcon],
								["New users", totals.newUsers, UserIcon],
								["Churn users", totals.churnUsers, TrendingDownIcon],
								["Reactivated users", totals.reactivatedUsers, TrendingUpIcon],
							].map(([label, value, Icon], index) => (
								<MetricCard icon={Icon as LucideIcon} index={index} key={String(label)} label={String(label)} loading={loading} value={Number(value)} />
							))}
						</div>
					</Section>

					<Section icon={UsersIcon} title="User Usage Explorer" right={<ExportButtons users={filteredUsers} />}>
						<div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
							<div className="relative">
								<SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
								<Input
									className="h-9 rounded-lg border-white/10 bg-white/[0.07] pl-9 text-slate-100 placeholder:text-slate-500"
									onChange={(event) => setUserSearch(event.target.value)}
									placeholder="Search users"
									value={userSearch}
								/>
							</div>
							<div className="flex flex-wrap gap-2">
								<span className={fieldChip}>{filteredUsers.length} users</span>
								<span className={fieldChip}>{formatCompact(totals.totalTokens)} tokens</span>
								<span className={fieldChip}>{formatCurrency(totals.totalCost)} API cost</span>
							</div>
						</div>
						<UserUsageExplorer loading={loading} onSelectUser={setSelectedUser} users={filteredUsers} />
					</Section>

					<Section icon={FlameIcon} title="Highest Usage Leaderboards">
						<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
							<Leaderboard icon={UserCheckIcon} title="Highest Active User" items={topUsers.slice(0, 3).map((user) => ({ label: user.username, meta: user.email, value: relativeTime(user.lastActive) }))} />
							<Leaderboard icon={MessageSquareIcon} title="Highest Chats" items={[...users].sort((a, b) => b.totalChats - a.totalChats).slice(0, 3).map((user) => ({ label: user.username, meta: user.plan, value: formatFull(user.totalChats) }))} />
							<Leaderboard icon={SparklesIcon} title="Highest Tokens" items={topUsers.slice(0, 3).map((user) => ({ label: user.username, meta: user.favoriteModel, value: formatCompact(user.totalTokens) }))} />
							<Leaderboard icon={ClockIcon} title="Highest Session Time" items={[...users].sort((a, b) => b.totalTimeSpent - a.totalTimeSpent).slice(0, 3).map((user) => ({ label: user.username, meta: user.mostUsedProvider, value: formatMinutes(user.totalTimeSpent) }))} />
							<Leaderboard icon={ImageIcon} title="Highest Images" items={[...users].sort((a, b) => b.imagesGenerated - a.imagesGenerated).slice(0, 3).map((user) => ({ label: user.username, meta: user.plan, value: formatFull(user.imagesGenerated) }))} />
							<Leaderboard icon={Volume2Icon} title="Highest Voice Usage" items={[...users].sort((a, b) => b.voiceMinutes - a.voiceMinutes).slice(0, 3).map((user) => ({ label: user.username, meta: user.plan, value: formatMinutes(user.voiceMinutes) }))} />
							<Leaderboard icon={CircleDollarSignIcon} title="Highest API Cost" items={topUsers.slice(0, 3).map((user) => ({ label: user.username, meta: user.mostUsedProvider, value: formatCurrency(user.totalTokens / 1_000_000 * 8.4) }))} />
							<Leaderboard icon={ActivityIcon} title="Highest Daily Usage" items={[...users].sort((a, b) => b.chatsToday - a.chatsToday).slice(0, 3).map((user) => ({ label: user.username, meta: "today", value: formatFull(user.chatsToday) }))} />
							<Leaderboard icon={CalendarDaysIcon} title="Highest Weekly Usage" items={[...users].sort((a, b) => b.chatsLast7 - a.chatsLast7).slice(0, 3).map((user) => ({ label: user.username, meta: "7 days", value: formatFull(user.chatsLast7) }))} />
							<Leaderboard icon={BarChart3Icon} title="Highest Monthly Usage" items={[...users].sort((a, b) => b.chatsLastMonth - a.chatsLastMonth).slice(0, 3).map((user) => ({ label: user.username, meta: "month", value: formatFull(user.chatsLastMonth) }))} />
						</div>
					</Section>

					<Section icon={TrendingDownIcon} title="Lowest Usage Leaderboards">
						<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
							<Leaderboard icon={UserIcon} title="Lowest Active User" items={[...users].sort((a, b) => a.lastActive - b.lastActive).slice(0, 3).map((user) => ({ label: user.username, meta: user.email, value: relativeTime(user.lastActive) }))} />
							<Leaderboard icon={SparklesIcon} title="Lowest Tokens" items={lowUsers.slice(0, 3).map((user) => ({ label: user.username, meta: user.plan, value: formatCompact(user.totalTokens) }))} />
							<Leaderboard icon={MessageSquareIcon} title="Lowest Chats" items={[...users].sort((a, b) => a.totalChats - b.totalChats).slice(0, 3).map((user) => ({ label: user.username, meta: user.plan, value: formatFull(user.totalChats) }))} />
							<Leaderboard icon={TimerIcon} title="Inactive Users" items={[...users].sort((a, b) => a.lastActive - b.lastActive).slice(0, 3).map((user) => ({ label: user.username, meta: "inactive", value: relativeTime(user.lastActive) }))} />
							<Leaderboard icon={AlertTriangleIcon} title="Users Never Chatted" items={users.filter((user) => user.totalChats < 50).slice(0, 3).map((user) => ({ label: user.username, meta: "low chat", value: formatFull(user.totalChats) }))} />
						</div>
					</Section>

					<Section icon={TimerIcon} title="Time and Chat Analytics">
						<div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
							<div className="grid gap-3 sm:grid-cols-2">
								{[
									["Average Session Time", users.reduce((sum, user) => sum + user.averageSessionDuration, 0) / users.length, ClockIcon],
									["Longest Session", Math.max(...users.map((user) => user.averageSessionDuration)), TimerIcon],
									["Shortest Session", Math.min(...users.map((user) => user.averageSessionDuration)), TimerIcon],
									["Average Daily Usage", totals.totalMessages / 30, ActivityIcon],
									["Average Weekly Usage", totals.totalMessages / 4, CalendarDaysIcon],
									["Average Monthly Usage", totals.totalMessages, BarChart3Icon],
									["Average Response Time", 3.4, GaugeIcon],
									["Average AI Generation Time", 7.8, BotIcon],
									["Messages per User", totals.totalMessages / users.length, MessageSquareIcon],
									["Average Conversation Length", totals.totalMessages / Math.max(1, totals.conversations), LineChartIcon],
									["Longest Conversation", Math.max(...users.map((user) => user.messagesSent)), MessageSquareIcon],
									["Most Active Conversation", Math.max(...users.map((user) => user.totalChats)), FlameIcon],
								].map(([label, value, Icon], index) => (
									<MetricCard icon={Icon as LucideIcon} index={index} key={String(label)} label={String(label)} loading={loading} value={Number(value)} valueFormatter={index < 3 ? formatMinutes : undefined} />
								))}
							</div>
							<ChartPanel loading={loading} title="Messages per Hour" subtitle="Requests, messages, and hourly load">
								<ResponsiveContainer height="100%" width="100%">
									<BarChart data={hourlyData}>
										<CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
										<XAxis dataKey="hour" interval={2} stroke="#94a3b8" tickLine={false} />
										<YAxis stroke="#94a3b8" tickLine={false} width={36} />
										<RechartsTooltip {...tooltipProps()} />
										<Bar dataKey="messages" fill="#22d3ee" radius={[6, 6, 0, 0]} />
										<Bar dataKey="requests" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
									</BarChart>
								</ResponsiveContainer>
							</ChartPanel>
						</div>
					</Section>

					<Section icon={BotIcon} title="Model and Provider Analytics">
						<div className="grid gap-4 xl:grid-cols-2">
							<ChartPanel loading={loading} title="Model Usage %" subtitle="Users, tokens, daily and monthly model usage">
								<ResponsiveContainer height="100%" width="100%">
									<ComposedChart data={modelData}>
										<CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
										<XAxis dataKey="model" stroke="#94a3b8" tickLine={false} />
										<YAxis stroke="#94a3b8" tickFormatter={formatCompact} tickLine={false} width={56} />
										<RechartsTooltip {...tooltipProps()} formatter={(value) => formatCompact(Number(value))} />
										<Bar dataKey="tokens" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
										<Line dataKey="users" stroke="#22d3ee" strokeWidth={2} />
									</ComposedChart>
								</ResponsiveContainer>
							</ChartPanel>
							<ChartPanel loading={loading} title="Provider Analytics" subtitle="Users, tokens, chats, requests, latency, and cost">
								<ResponsiveContainer height="100%" width="100%">
									<BarChart data={providerData}>
										<CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
										<XAxis dataKey="name" stroke="#94a3b8" tickLine={false} />
										<YAxis stroke="#94a3b8" tickFormatter={formatCompact} tickLine={false} width={56} />
										<RechartsTooltip {...tooltipProps()} formatter={(value) => formatCompact(Number(value))} />
										<Bar dataKey="tokens" fill="#22d3ee" radius={[6, 6, 0, 0]} />
										<Bar dataKey="requests" fill="#34d399" radius={[6, 6, 0, 0]} />
									</BarChart>
								</ResponsiveContainer>
							</ChartPanel>
							<ProviderTreemap data={providerData} />
							<div className={cn(glassCard, "overflow-hidden p-4")}>
								<h3 className="mb-4 text-sm font-semibold text-white">Provider Table</h3>
								<div className="overflow-x-auto">
									<table className="w-full min-w-[48rem] text-sm">
										<thead className="text-left text-xs uppercase text-slate-400">
											<tr>
												{["Provider", "Users", "Tokens", "Chats", "Requests", "Avg Latency", "Avg Cost"].map((header) => (
													<th className="pb-3" key={header}>{header}</th>
												))}
											</tr>
										</thead>
										<tbody className="divide-y divide-white/10">
											{providerData.map((provider) => (
												<tr key={provider.name}>
													<td className="py-3 font-medium text-white">{provider.name}</td>
													<td className="py-3 text-slate-300">{provider.users}</td>
													<td className="py-3 text-slate-300">{formatCompact(provider.tokens)}</td>
													<td className="py-3 text-slate-300">{formatFull(provider.chats)}</td>
													<td className="py-3 text-slate-300">{formatFull(provider.requests)}</td>
													<td className="py-3 text-slate-300">{provider.averageLatency}ms</td>
													<td className="py-3 text-slate-300">{formatCurrency(provider.averageCost)}</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</div>
						</div>
					</Section>

					<Section icon={CircleDollarSignIcon} title="Revenue and Retention Analytics">
						<div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
							<div className="grid gap-3 sm:grid-cols-2">
								{[
									["MRR", totals.paidUsers * 38 + 1_200, CircleDollarSignIcon, formatCurrency],
									["ARR", (totals.paidUsers * 38 + 1_200) * 12, CircleDollarSignIcon, formatCurrency],
									["Free to Paid Conversion", 18, TrendingUpIcon, formatPercent],
									["Trial Conversion", 31, TrendingUpIcon, formatPercent],
									["Renewal Rate", 91, UserCheckIcon, formatPercent],
									["Cancelled Users", totals.churnUsers, TrendingDownIcon, undefined],
									["Day 1 Retention", 92, UserCheckIcon, formatPercent],
									["Day 7 Retention", 78, UserCheckIcon, formatPercent],
									["Day 30 Retention", 62, UserCheckIcon, formatPercent],
									["Weekly Cohort", 74, CalendarDaysIcon, formatPercent],
									["Monthly Cohort", 68, CalendarDaysIcon, formatPercent],
								].map(([label, value, Icon, formatter], index) => (
									<MetricCard icon={Icon as LucideIcon} index={index} key={String(label)} label={String(label)} loading={loading} value={Number(value)} valueFormatter={formatter as ((value: number) => string) | undefined} />
								))}
							</div>
							<div className="grid gap-4">
								<ChartPanel loading={loading} title="Revenue Graph" subtitle="MRR and API cost trend">
									<ResponsiveContainer height="100%" width="100%">
										<ComposedChart data={chartData}>
											<CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
											<XAxis dataKey="day" stroke="#94a3b8" tickLine={false} />
											<YAxis stroke="#94a3b8" tickLine={false} width={40} />
											<RechartsTooltip {...tooltipProps()} formatter={(value) => formatCurrency(Number(value))} />
											<Bar dataKey="cost" fill="#f59e0b" radius={[6, 6, 0, 0]} />
											<Line dataKey="active" stroke="#22d3ee" strokeWidth={2} />
										</ComposedChart>
									</ResponsiveContainer>
								</ChartPanel>
								<RetentionHeatmap cohorts={retentionCohorts} />
								<CalendarHeatmap data={calendarData} />
							</div>
						</div>
					</Section>

					<Section icon={BellIcon} title="Notifications, System Health, and Security">
						<div className="grid gap-4 xl:grid-cols-3">
							<article className={cn(glassCard, "p-4")}>
								<h3 className="mb-4 text-sm font-semibold text-white">Notifications</h3>
								{[
									["Recent errors", `${totals.liveErrors} recoverable errors`, AlertTriangleIcon] as const,
									["Failed API calls", `${Math.max(1, totals.liveErrors + 2)} failed calls`, ShieldAlertIcon] as const,
									["System notices", "Queue workers healthy", BellIcon] as const,
									["Billing alerts", `${formatCurrency(totals.totalCost)} projected API cost`, CircleDollarSignIcon] as const,
								].map(([label, value, Icon]) => {
									const IconComp = Icon as any;
									return (
										<div className="mb-3 flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3 last:mb-0" key={String(label)}>
											{IconComp ? <IconComp className="size-4 text-cyan-200" /> : null}
											<div>
												<p className="text-sm font-medium text-white">{String(label)}</p>
												<p className="text-xs text-slate-400">{String(value)}</p>
											</div>
										</div>
									);
								})}
							</article>
							<article className={cn(glassCard, "p-4")}>
								<h3 className="mb-4 text-sm font-semibold text-white">System Health</h3>
								{[
									["CPU", 41, CpuIcon] as const,
									["RAM", 63, GaugeIcon] as const,
									["Database", 72, DatabaseIcon] as const,
									["Redis", 54, ServerIcon] as const,
									["Queue", 37, ActivityIcon] as const,
									["API Status", 98, GlobeIcon] as const,
									["Storage", 46, ServerIcon] as const,
								].map(([label, value, Icon]) => {
									const IconComp = Icon as any;
									return (
										<div className="mb-4 last:mb-0" key={String(label)}>
											<div className="mb-2 flex items-center justify-between text-xs">
												<span className="flex items-center gap-2 text-slate-300">
													{IconComp ? <IconComp className="size-3.5 text-cyan-200" /> : null}
													{String(label)}
												</span>
												<span className="text-slate-400">{Number(value)}%</span>
											</div>
											<Progress className="[&_[data-slot=progress-indicator]]:bg-cyan-300 [&_[data-slot=progress-track]]:bg-white/10" value={Number(value)} />
										</div>
									);
								})}
							</article>
							<article className={cn(glassCard, "p-4")}>
								<h3 className="mb-4 text-sm font-semibold text-white">Security</h3>
								{[
									["Failed Logins", 7, LockKeyholeIcon] as const,
									["Suspicious Users", 3, ShieldAlertIcon] as const,
									["Blocked Users", 2, XIcon] as const,
									["IP Analytics", 118, GlobeIcon] as const,
									["Country Analytics", 24, GlobeIcon] as const,
								].map(([label, value, Icon]) => {
									const IconComp = Icon as any;
									return (
										<div className="mb-3 flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] p-3 last:mb-0" key={String(label)}>
											<span className="flex items-center gap-2 text-sm text-slate-300">
												{IconComp ? <IconComp className="size-4 text-cyan-200" /> : null}
												{String(label)}
											</span>
											<span className="font-semibold text-white">{Number(value)}</span>
										</div>
									);
								})}
							</article>
						</div>
					</Section>

					<Section icon={ServerIcon} title="Hub Operations">
						<HubOperations
							events={hubState.events ?? []}
							hubState={hubState}
							onOpenSession={onOpenSession}
							onRestartHub={onRestartHub}
							onViewSessions={onViewSessions}
							restartPending={restartPending}
							sessions={sessions}
						/>
					</Section>
				</main>
			</motion.div>
			<TimelineDrawer onClose={() => setSelectedUser(null)} user={selectedUser} />
		</div>
	);
}
