/**
 * Zenuxs Runtime Profiler
 *
 * Lightweight, opt-in runtime profiler that measures where Zenuxs-Code
 * spends its time. Enabled via `ZENUXS_PROFILE=1` environment variable
 * or by calling `profiler.enable()`.
 *
 * When disabled (default), all instrumentation methods are no-ops with
 * a single boolean check — effectively zero overhead.
 *
 * Usage:
 *   import { profiler } from "@cline/shared";
 *   profiler.start("cli.startup");
 *   // ... work ...
 *   profiler.end("cli.startup");
 *   await profiler.finish(); // writes output files
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProfileSpan {
	name: string;
	category: SpanCategory;
	startMs: number;
	endMs: number;
	durationMs: number;
	parentId: number | null;
	id: number;
	meta?: Record<string, unknown>;
}

export type SpanCategory =
	| "startup"
	| "agent"
	| "llm"
	| "tool"
	| "filesystem"
	| "message"
	| "event"
	| "hook"
	| "memory";

export interface TimelineEvent {
	timeMs: number;
	label: string;
	category: SpanCategory;
	spanId?: number;
	meta?: Record<string, unknown>;
}

export interface FunctionStats {
	name: string;
	category: SpanCategory;
	callCount: number;
	totalMs: number;
	selfMs: number;
	avgMs: number;
	maxMs: number;
	minMs: number;
}

export interface MemorySnapshot {
	timeMs: number;
	rssMb: number;
	heapUsedMb: number;
	heapTotalMb: number;
	externalMb: number;
	largeObjectCount: number;
}

export interface ToolCallRecord {
	toolName: string;
	startMs: number;
	endMs: number;
	durationMs: number;
	argsSize: number;
	resultSize: number;
	retryCount: number;
	recoveryCount: number;
}

export interface FlamegraphNode {
	name: string;
	value: number;
	children: FlamegraphNode[];
	category: SpanCategory;
	self: number;
}

export interface ProfileData {
	enabled: boolean;
	processStartMs: number;
	spans: ProfileSpan[];
	timeline: TimelineEvent[];
	functionStats: Map<string, FunctionStats>;
	memorySnapshots: MemorySnapshot[];
	toolCalls: ToolCallRecord[];
	peakMemoryMb: number;
	totalDurationMs: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MEMORY_SNAPSHOT_INTERVAL_MS = 500;
const MAX_SPAN_STACK_DEPTH = 64;

// ---------------------------------------------------------------------------
// Profiler
// ---------------------------------------------------------------------------

class RuntimeProfiler {
	private _enabled = false;
	private _processStartMs = 0;
	private _spans: ProfileSpan[] = [];
	private _timeline: TimelineEvent[] = [];
	private _functionStats = new Map<string, FunctionStats>();
	private _memorySnapshots: MemorySnapshot[] = [];
	private _toolCalls: ToolCallRecord[] = [];
	private _spanStack: number[] = [];
	private _nextSpanId = 1;
	private _lastMemorySnapshotMs = 0;
	private _finished = false;
	private _finishPromise: Promise<void> | null = null;

	constructor() {
		// Auto-enable from environment
		if (
			typeof process !== "undefined" &&
			(process.env.ZENUXS_PROFILE === "1" ||
				process.env.ZENUXS_PROFILE === "true")
		) {
			this.enable();
		}
	}

	// -----------------------------------------------------------------------
	// Control
	// -----------------------------------------------------------------------

	get enabled(): boolean {
		return this._enabled;
	}

	enable(): void {
		if (this._enabled) return;
		this._enabled = true;
		this._processStartMs = performance.now();
		this._lastMemorySnapshotMs = this._processStartMs;
		this.markTimeline("profiler.enabled", "startup");
		this.takeMemorySnapshot();
	}

	disable(): void {
		this._enabled = false;
	}

	// -----------------------------------------------------------------------
	// Span tracking — start/end
	// -----------------------------------------------------------------------

	start(name: string, category: SpanCategory, meta?: Record<string, unknown>): number {
		if (!this._enabled) return -1;
		const now = performance.now();
		const id = this._nextSpanId++;
		const parentId =
			this._spanStack.length > 0
				? this._spanStack[this._spanStack.length - 1]
				: null;

		this._spanStack.push(id);
		if (this._spanStack.length > MAX_SPAN_STACK_DEPTH) {
			this._spanStack.shift();
		}

		// Store start info temporarily — end() will create the full span
		(this as any)._pendingSpans = (this as any)._pendingSpans ?? new Map<number, { name: string; category: SpanCategory; startMs: number; parentId: number | null; meta?: Record<string, unknown> }>();
		(this as any)._pendingSpans.set(id, { name, category, startMs: now, parentId, meta });

		this.maybeSnapshotMemory(now);
		return id;
	}

	end(spanId: number, meta?: Record<string, unknown>): void {
		if (!this._enabled || spanId < 0) return;
		const now = performance.now();
		const pending = (this as any)._pendingSpans?.get(spanId);
		if (!pending) return;
		(this as any)._pendingSpans.delete(spanId);

		// Remove from stack
		const stackIdx = this._spanStack.lastIndexOf(spanId);
		if (stackIdx >= 0) this._spanStack.splice(stackIdx, 1);

		const durationMs = now - pending.startMs;
		const span: ProfileSpan = {
			name: pending.name,
			category: pending.category,
			startMs: pending.startMs - this._processStartMs,
			endMs: now - this._processStartMs,
			durationMs,
			parentId: pending.parentId,
			id: spanId,
			meta: { ...pending.meta, ...meta },
		};
		this._spans.push(span);

		// Update function stats
		this.updateFunctionStats(pending.name, pending.category, durationMs);

		this.maybeSnapshotMemory(now);
	}

	// -----------------------------------------------------------------------
	// Span tracking — wrap (convenience for sync/async functions)
	// -----------------------------------------------------------------------

	wrap<T>(name: string, category: SpanCategory, fn: () => T, meta?: Record<string, unknown>): T {
		if (!this._enabled) return fn();
		const id = this.start(name, category, meta);
		try {
			const result = fn();
			if (result instanceof Promise) {
				return result.then(
					(v) => { this.end(id); return v; },
					(e) => { this.end(id, { error: true }); throw e; },
				) as T;
			}
			this.end(id);
			return result;
		} catch (e) {
			this.end(id, { error: true });
			throw e;
		}
	}

	// -----------------------------------------------------------------------
	// Timeline events (instant markers)
	// -----------------------------------------------------------------------

	markTimeline(label: string, category: SpanCategory, meta?: Record<string, unknown>): void {
		if (!this._enabled) return;
		this._timeline.push({
			timeMs: performance.now() - this._processStartMs,
			label,
			category,
			meta,
		});
	}

	// -----------------------------------------------------------------------
	// Tool call tracking
	// -----------------------------------------------------------------------

	recordToolCall(record: ToolCallRecord): void {
		if (!this._enabled) return;
		this._toolCalls.push(record);
	}

	// -----------------------------------------------------------------------
	// Memory
	// -----------------------------------------------------------------------

	takeMemorySnapshot(): void {
		if (!this._enabled) return;
		try {
			const mem = process.memoryUsage();
			const snapshot: MemorySnapshot = {
				timeMs: performance.now() - this._processStartMs,
				rssMb: Math.round(mem.rss / 1_048_576),
				heapUsedMb: Math.round(mem.heapUsed / 1_048_576),
				heapTotalMb: Math.round(mem.heapTotal / 1_048_576),
				externalMb: Math.round(mem.external / 1_048_576),
				largeObjectCount: 0, // populated by V8 heap stats if available
			};
			this._memorySnapshots.push(snapshot);
		} catch {
			// memoryUsage may fail in browser contexts
		}
	}

	private maybeSnapshotMemory(now: number): void {
		if (now - this._lastMemorySnapshotMs >= MEMORY_SNAPSHOT_INTERVAL_MS) {
			this._lastMemorySnapshotMs = now;
			this.takeMemorySnapshot();
		}
	}

	// -----------------------------------------------------------------------
	// Function stats
	// -----------------------------------------------------------------------

	private updateFunctionStats(name: string, category: SpanCategory, durationMs: number): void {
		const existing = this._functionStats.get(name);
		if (existing) {
			existing.callCount++;
			existing.totalMs += durationMs;
			existing.avgMs = existing.totalMs / existing.callCount;
			if (durationMs > existing.maxMs) existing.maxMs = durationMs;
			if (durationMs < existing.minMs) existing.minMs = durationMs;
		} else {
			this._functionStats.set(name, {
				name,
				category,
				callCount: 1,
				totalMs: durationMs,
				selfMs: durationMs,
				avgMs: durationMs,
				maxMs: durationMs,
				minMs: durationMs,
			});
		}
	}

	// -----------------------------------------------------------------------
	// Data access
	// -----------------------------------------------------------------------

	getData(): ProfileData {
		const now = performance.now();
		return {
			enabled: this._enabled,
			processStartMs: this._processStartMs,
			spans: [...this._spans],
			timeline: [...this._timeline],
			functionStats: new Map(this._functionStats),
			memorySnapshots: [...this._memorySnapshots],
			toolCalls: [...this._toolCalls],
			peakMemoryMb: this._memorySnapshots.reduce((max, s) => Math.max(max, s.heapUsedMb), 0),
			totalDurationMs: now - this._processStartMs,
		};
	}

	// -----------------------------------------------------------------------
	// Finish — generate output files
	// -----------------------------------------------------------------------

	async finish(outputDir?: string): Promise<void> {
		if (!this._enabled || this._finished) return;
		if (this._finishPromise) return this._finishPromise;

		this._finished = true;
		this.markTimeline("profiler.finishing", "startup");
		this.takeMemorySnapshot();

		this._finishPromise = this.generateReports(outputDir);
		return this._finishPromise;
	}

	private async generateReports(outputDir?: string): Promise<void> {
		// Dynamic imports to avoid pulling in fs/path when profiler is disabled
		const { generateMarkdownReport } = await import("./profiler-report");
		const { generateFlamegraphData } = await import("./profiler-flamegraph");
		const fs = await import("node:fs");
		const path = await import("node:path");

		const dir = outputDir ?? process.cwd();
		const data = this.getData();

		// Generate all three output files
		const mdReport = generateMarkdownReport(data);
		const flamegraphData = generateFlamegraphData(data);

		const mdPath = path.join(dir, "ZENUXS_RUNTIME_PROFILE.md");
		const jsonPath = path.join(dir, "ZENUXS_PROFILE_DATA.json");
		const flamePath = path.join(dir, "ZENUXS_FLAMEGRAPH_DATA.json");

		// Write files in parallel
		await Promise.all([
			fs.promises.writeFile(mdPath, mdReport, "utf-8"),
			fs.promises.writeFile(
				jsonPath,
				JSON.stringify(serializeProfileData(data), null, 2),
				"utf-8",
			),
			fs.promises.writeFile(
				flamePath,
				JSON.stringify(flamegraphData, null, 2),
				"utf-8",
			),
		]);

		// Log completion
		const elapsed = performance.now() - this._processStartMs;
		console.error(
			`\n[profiler] Reports written:\n` +
			`  ${mdPath}\n` +
			`  ${jsonPath}\n` +
			`  ${flamePath}\n` +
			`  Total profiled time: ${elapsed.toFixed(0)}ms\n` +
			`  Spans recorded: ${this._spans.length}\n` +
			`  Timeline events: ${this._timeline.length}\n`,
		);
	}
}

// ---------------------------------------------------------------------------
// Serialization helper
// ---------------------------------------------------------------------------

function serializeProfileData(data: ProfileData): Record<string, unknown> {
	return {
		enabled: data.enabled,
		processStartMs: data.processStartMs,
		totalDurationMs: data.totalDurationMs,
		peakMemoryMb: data.peakMemoryMb,
		spans: data.spans,
		timeline: data.timeline,
		functionStats: Array.from(data.functionStats.values()).sort(
			(a, b) => b.totalMs - a.totalMs,
		),
		memorySnapshots: data.memorySnapshots,
		toolCalls: data.toolCalls,
	};
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const profiler = new RuntimeProfiler();
