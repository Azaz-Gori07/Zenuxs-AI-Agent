/**
 * Zenuxs Runtime Profiler — Markdown Report Generator
 *
 * Produces ZENUXS_RUNTIME_PROFILE.md with:
 * - Runtime timeline
 * - Function rankings (slowest, most-called)
 * - Startup analysis
 * - Tool timings
 * - Memory usage
 * - CPU summary
 */

import type {
	ProfileData,
	ProfileSpan,
	ToolCallRecord,
} from "./profiler";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function generateMarkdownReport(data: ProfileData): string {
	const sections: string[] = [];

	sections.push(renderHeader(data));
	sections.push(renderTimeline(data));
	sections.push(renderStartupAnalysis(data));
	sections.push(renderTopSlowestFunctions(data));
	sections.push(renderTopCallCountFunctions(data));
	sections.push(renderLLMAnalysis(data));
	sections.push(renderToolAnalysis(data));
	sections.push(renderMessagePipelineAnalysis(data));
	sections.push(renderHookAnalysis(data));
	sections.push(renderMemoryAnalysis(data));
	sections.push(renderCategorySummary(data));

	return sections.join("\n\n---\n\n");
}

// ---------------------------------------------------------------------------
// Section renderers
// ---------------------------------------------------------------------------

function renderHeader(data: ProfileData): string {
	const lines: string[] = [];
	lines.push("# Zenuxs Runtime Profile");
	lines.push("");
	lines.push(`**Generated**: ${new Date().toISOString()}`);
	lines.push(`**Total duration**: ${data.totalDurationMs.toFixed(0)}ms`);
	lines.push(`**Peak memory**: ${data.peakMemoryMb}MB`);
	lines.push(`**Spans recorded**: ${data.spans.length}`);
	lines.push(`**Timeline events**: ${data.timeline.length}`);
	lines.push(`**Tool calls**: ${data.toolCalls.length}`);
	lines.push(`**Memory snapshots**: ${data.memorySnapshots.length}`);
	lines.push("");
	return lines.join("\n");
}

function renderTimeline(data: ProfileData): string {
	const lines: string[] = [];
	lines.push("## Runtime Timeline");
	lines.push("");
	lines.push("```");

	// Merge timeline events and span starts, sort by time
	const events: Array<{ timeMs: number; text: string }> = [];

	for (const t of data.timeline) {
		events.push({ timeMs: t.timeMs, text: `${t.timeMs.toFixed(0).padStart(6)}ms  ${t.label}` });
	}

	// Add span start/end as timeline entries
	for (const span of data.spans) {
		events.push({
			timeMs: span.startMs,
			text: `${span.startMs.toFixed(0).padStart(6)}ms  ▶ ${span.name}`,
		});
		events.push({
			timeMs: span.endMs,
			text: `${span.endMs.toFixed(0).padStart(6)}ms  ◀ ${span.name} (${span.durationMs.toFixed(1)}ms)`,
		});
	}

	events.sort((a, b) => a.timeMs - b.timeMs);

	for (const e of events) {
		lines.push(e.text);
	}

	lines.push("```");
	lines.push("");
	return lines.join("\n");
}

function renderStartupAnalysis(data: ProfileData): string {
	const lines: string[] = [];
	lines.push("## Startup Analysis");
	lines.push("");

	const startupSpans = data.spans
		.filter((s) => s.category === "startup")
		.sort((a, b) => a.startMs - b.startMs);

	if (startupSpans.length === 0) {
		lines.push("No startup spans recorded.");
		return lines.join("\n");
	}

	lines.push("| Phase | Start | End | Duration |");
	lines.push("|-------|-------|-----|----------|");

	for (const span of startupSpans) {
		lines.push(
			`| ${span.name} | ${span.startMs.toFixed(0)}ms | ${span.endMs.toFixed(0)}ms | ${span.durationMs.toFixed(1)}ms |`,
		);
	}

	// Calculate total startup time
	const lastEnd = Math.max(...startupSpans.map((s) => s.endMs));
	const firstStart = Math.min(...startupSpans.map((s) => s.startMs));
	lines.push("");
	lines.push(`**Total startup time**: ${(lastEnd - firstStart).toFixed(0)}ms`);
	lines.push("");
	return lines.join("\n");
}

function renderTopSlowestFunctions(data: ProfileData): string {
	const lines: string[] = [];
	lines.push("## Top 20 Slowest Functions (by total time)");
	lines.push("");

	const sorted = Array.from(data.functionStats.values())
		.sort((a, b) => b.totalMs - a.totalMs)
		.slice(0, 20);

	if (sorted.length === 0) {
		lines.push("No function data recorded.");
		return lines.join("\n");
	}

	lines.push("| Rank | Function | Category | Calls | Total (ms) | Avg (ms) | Max (ms) | Min (ms) |");
	lines.push("|------|----------|----------|-------|------------|----------|----------|----------|");

	for (let i = 0; i < sorted.length; i++) {
		const f = sorted[i];
		lines.push(
			`| ${i + 1} | ${f.name} | ${f.category} | ${f.callCount} | ${f.totalMs.toFixed(1)} | ${f.avgMs.toFixed(2)} | ${f.maxMs.toFixed(1)} | ${f.minMs.toFixed(1)} |`,
		);
	}

	lines.push("");
	return lines.join("\n");
}

function renderTopCallCountFunctions(data: ProfileData): string {
	const lines: string[] = [];
	lines.push("## Top 20 Highest Call Count Functions");
	lines.push("");

	const sorted = Array.from(data.functionStats.values())
		.sort((a, b) => b.callCount - a.callCount)
		.slice(0, 20);

	if (sorted.length === 0) {
		lines.push("No function data recorded.");
		return lines.join("\n");
	}

	lines.push("| Rank | Function | Category | Calls | Total (ms) | Avg (ms) |");
	lines.push("|------|----------|----------|-------|------------|----------|");

	for (let i = 0; i < sorted.length; i++) {
		const f = sorted[i];
		lines.push(
			`| ${i + 1} | ${f.name} | ${f.category} | ${f.callCount} | ${f.totalMs.toFixed(1)} | ${f.avgMs.toFixed(2)} |`,
		);
	}

	lines.push("");
	return lines.join("\n");
}

function renderLLMAnalysis(data: ProfileData): string {
	const lines: string[] = [];
	lines.push("## LLM Analysis");
	lines.push("");

	const llmSpans = data.spans
		.filter((s) => s.category === "llm")
		.sort((a, b) => a.startMs - b.startMs);

	if (llmSpans.length === 0) {
		lines.push("No LLM spans recorded.");
		return lines.join("\n");
	}

	lines.push("### LLM Spans");
	lines.push("");
	lines.push("| Phase | Duration | Details |");
	lines.push("|-------|----------|---------|");

	for (const span of llmSpans) {
		const meta = span.meta ? Object.entries(span.meta).map(([k, v]) => `${k}=${v}`).join(", ") : "";
		lines.push(`| ${span.name} | ${span.durationMs.toFixed(1)}ms | ${meta} |`);
	}

	// Summary stats
	const totalLlmTime = llmSpans.reduce((sum, s) => sum + s.durationMs, 0);
	lines.push("");
	lines.push(`**Total LLM time**: ${totalLlmTime.toFixed(0)}ms`);
	lines.push(`**LLM calls**: ${llmSpans.length}`);
	lines.push("");
	return lines.join("\n");
}

function renderToolAnalysis(data: ProfileData): string {
	const lines: string[] = [];
	lines.push("## Tool Call Analysis");
	lines.push("");

	if (data.toolCalls.length === 0) {
		lines.push("No tool calls recorded.");
		return lines.join("\n");
	}

	// Group by tool name
	const byTool = new Map<string, ToolCallRecord[]>();
	for (const tc of data.toolCalls) {
		const arr = byTool.get(tc.toolName) ?? [];
		arr.push(tc);
		byTool.set(tc.toolName, arr);
	}

	lines.push("### Per-Tool Summary");
	lines.push("");
	lines.push("| Tool | Calls | Total (ms) | Avg (ms) | Max (ms) | Avg Args Size | Avg Result Size | Retries |");
	lines.push("|------|-------|------------|----------|----------|---------------|-----------------|---------|");

	const toolSummaries: Array<{ name: string; calls: ToolCallRecord[] }> = [];
	for (const [name, calls] of byTool) {
		toolSummaries.push({ name, calls });
	}
	toolSummaries.sort((a, b) => {
		const totalA = a.calls.reduce((s, c) => s + c.durationMs, 0);
		const totalB = b.calls.reduce((s, c) => s + c.durationMs, 0);
		return totalB - totalA;
	});

	for (const { name, calls } of toolSummaries) {
		const total = calls.reduce((s, c) => s + c.durationMs, 0);
		const avg = total / calls.length;
		const max = Math.max(...calls.map((c) => c.durationMs));
		const avgArgs = Math.round(calls.reduce((s, c) => s + c.argsSize, 0) / calls.length);
		const avgResult = Math.round(calls.reduce((s, c) => s + c.resultSize, 0) / calls.length);
		const retries = calls.reduce((s, c) => s + c.retryCount, 0);
		lines.push(
			`| ${name} | ${calls.length} | ${total.toFixed(0)} | ${avg.toFixed(1)} | ${max.toFixed(0)} | ${avgArgs} | ${avgResult} | ${retries} |`,
		);
	}

	// Individual tool calls timeline
	lines.push("");
	lines.push("### Tool Call Timeline");
	lines.push("");
	lines.push("| # | Tool | Start | Duration | Args Size | Result Size |");
	lines.push("|---|------|-------|----------|-----------|-------------|");

	for (let i = 0; i < data.toolCalls.length; i++) {
		const tc = data.toolCalls[i];
		lines.push(
			`| ${i + 1} | ${tc.toolName} | ${tc.startMs.toFixed(0)}ms | ${tc.durationMs.toFixed(0)}ms | ${tc.argsSize} | ${tc.resultSize} |`,
		);
	}

	lines.push("");
	return lines.join("\n");
}

function renderMessagePipelineAnalysis(data: ProfileData): string {
	const lines: string[] = [];
	lines.push("## Message Pipeline Analysis");
	lines.push("");

	const msgSpans = data.spans
		.filter((s) => s.category === "message")
		.sort((a, b) => a.startMs - b.startMs);

	if (msgSpans.length === 0) {
		lines.push("No message pipeline spans recorded.");
		return lines.join("\n");
	}

	// Group by name
	const byName = new Map<string, ProfileSpan[]>();
	for (const s of msgSpans) {
		const arr = byName.get(s.name) ?? [];
		arr.push(s);
		byName.set(s.name, arr);
	}

	lines.push("| Function | Calls | Total (ms) | Avg (ms) | Max (ms) |");
	lines.push("|----------|-------|------------|----------|----------|");

	for (const [name, spans] of byName) {
		const total = spans.reduce((s, sp) => s + sp.durationMs, 0);
		const avg = total / spans.length;
		const max = Math.max(...spans.map((s) => s.durationMs));
		lines.push(`| ${name} | ${spans.length} | ${total.toFixed(1)} | ${avg.toFixed(2)} | ${max.toFixed(1)} |`);
	}

	const totalMsgTime = msgSpans.reduce((s, sp) => s + sp.durationMs, 0);
	lines.push("");
	lines.push(`**Total message pipeline time**: ${totalMsgTime.toFixed(0)}ms`);
	lines.push("");
	return lines.join("\n");
}

function renderHookAnalysis(data: ProfileData): string {
	const lines: string[] = [];
	lines.push("## Hook & Event Analysis");
	lines.push("");

	const hookSpans = data.spans
		.filter((s) => s.category === "hook" || s.category === "event")
		.sort((a, b) => a.startMs - b.startMs);

	if (hookSpans.length === 0) {
		lines.push("No hook/event spans recorded.");
		return lines.join("\n");
	}

	const byName = new Map<string, ProfileSpan[]>();
	for (const s of hookSpans) {
		const arr = byName.get(s.name) ?? [];
		arr.push(s);
		byName.set(s.name, arr);
	}

	lines.push("| Hook/Event | Calls | Total (ms) | Avg (ms) | Max (ms) |");
	lines.push("|------------|-------|------------|----------|----------|");

	for (const [name, spans] of byName) {
		const total = spans.reduce((s, sp) => s + sp.durationMs, 0);
		const avg = total / spans.length;
		const max = Math.max(...spans.map((s) => s.durationMs));
		lines.push(`| ${name} | ${spans.length} | ${total.toFixed(1)} | ${avg.toFixed(2)} | ${max.toFixed(1)} |`);
	}

	lines.push("");
	return lines.join("\n");
}

function renderMemoryAnalysis(data: ProfileData): string {
	const lines: string[] = [];
	lines.push("## Memory Analysis");
	lines.push("");

	if (data.memorySnapshots.length === 0) {
		lines.push("No memory snapshots recorded.");
		return lines.join("\n");
	}

	lines.push("| Time (ms) | RSS (MB) | Heap Used (MB) | Heap Total (MB) | External (MB) |");
	lines.push("|-----------|----------|----------------|-----------------|---------------|");

	for (const snap of data.memorySnapshots) {
		lines.push(
			`| ${snap.timeMs.toFixed(0)} | ${snap.rssMb} | ${snap.heapUsedMb} | ${snap.heapTotalMb} | ${snap.externalMb} |`,
		);
	}

	const peak = data.memorySnapshots.reduce(
		(max, s) => (s.heapUsedMb > max.heapUsedMb ? s : max),
		data.memorySnapshots[0],
	);
	lines.push("");
	lines.push(`**Peak heap usage**: ${peak.heapUsedMb}MB at ${peak.timeMs.toFixed(0)}ms`);
	lines.push(`**Peak RSS**: ${data.memorySnapshots.reduce((m, s) => Math.max(m, s.rssMb), 0)}MB`);
	lines.push("");
	return lines.join("\n");
}

function renderCategorySummary(data: ProfileData): string {
	const lines: string[] = [];
	lines.push("## Category Summary");
	lines.push("");

	const byCategory = new Map<string, { count: number; totalMs: number }>();
	for (const span of data.spans) {
		const existing = byCategory.get(span.category) ?? { count: 0, totalMs: 0 };
		existing.count++;
		existing.totalMs += span.durationMs;
		byCategory.set(span.category, existing);
	}

	lines.push("| Category | Spans | Total Time (ms) | % of Total |");
	lines.push("|----------|-------|-----------------|------------|");

	const sorted = Array.from(byCategory.entries()).sort(
		(a, b) => b[1].totalMs - a[1].totalMs,
	);

	for (const [cat, stats] of sorted) {
		const pct = ((stats.totalMs / data.totalDurationMs) * 100).toFixed(1);
		lines.push(`| ${cat} | ${stats.count} | ${stats.totalMs.toFixed(0)} | ${pct}% |`);
	}

	lines.push("");
	return lines.join("\n");
}
