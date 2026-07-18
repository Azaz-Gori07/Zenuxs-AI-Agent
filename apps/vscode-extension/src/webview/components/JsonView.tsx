/**
 * JsonView — A simple interactive JSON viewer for inspecting log details.
 * Supports expand/collapse, syntax highlighting, and copy-to-clipboard.
 */

import { useState, useCallback } from "react";

interface JsonViewProps {
	data: unknown;
	initialExpanded?: boolean;
	maxDepth?: number;
}

function formatValue(value: unknown): string {
	if (value === null) return "null";
	if (value === undefined) return "undefined";
	if (typeof value === "string") return `"${value}"`;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	return JSON.stringify(value, null, 2);
}

function getTypeColor(value: unknown): string {
	if (value === null) return "var(--error, #ef4444)";
	if (value === undefined) return "var(--muted, #888)";
	if (typeof value === "string") return "var(--success, #22c55e)";
	if (typeof value === "number") return "var(--info, #3b82f6)";
	if (typeof value === "boolean") return "var(--warning, #f59e0b)";
	return "var(--fg, #ccc)";
}

function JsonNode({ name, value, depth, maxDepth }: { name?: string; value: unknown; depth: number; maxDepth: number }) {
	const [expanded, setExpanded] = useState(depth < maxDepth);
	const toggle = useCallback(() => setExpanded((e) => !e), []);

	const isObject = value !== null && typeof value === "object";
	const isArray = Array.isArray(value);
	const isExpandable = isObject || isArray;

	const entries: [string, unknown][] = [];
	if (isArray && Array.isArray(value)) {
		value.forEach((v, i) => entries.push([String(i), v]));
	} else if (isObject && value && typeof value === "object") {
		for (const [k, v] of Object.entries(value)) {
			entries.push([k, v]);
		}
	}

	const bracketOpen = isArray ? "[" : "{";
	const bracketClose = isArray ? "]" : "}";

	const copyValue = useCallback(() => {
		const text = typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
		navigator.clipboard.writeText(text).catch(() => {});
	}, [value]);

	return (
		<div style={{ marginLeft: depth > 0 ? 16 : 0 }}>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 4,
					fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace",
					fontSize: "0.82em",
					lineHeight: "1.6",
					cursor: isExpandable ? "pointer" : "default",
					userSelect: "none",
				}}
				onClick={isExpandable ? toggle : undefined}
			>
				{isExpandable && (
					<span style={{ color: "var(--muted, #888)", width: 12, display: "inline-block", flexShrink: 0 }}>
						{expanded ? "▼" : "▶"}
					</span>
				)}
				{!isExpandable && <span style={{ width: 12, flexShrink: 0 }} />}
				{name !== undefined && (
					<>
						<span style={{ color: "var(--accent, #a78bfa)" }}>"{name}"</span>
						<span style={{ color: "var(--muted, #888)" }}>: </span>
					</>
				)}
				{isExpandable ? (
					<>
						<span style={{ color: "var(--muted, #888)" }}>
							{expanded ? bracketOpen : `${bracketOpen}${entries.length} items${bracketClose}`}
						</span>
						{expanded && (
							<button
								onClick={(e) => { e.stopPropagation(); copyValue(); }}
								style={{
									background: "none",
									border: "none",
									color: "var(--muted, #888)",
									cursor: "pointer",
									fontSize: "0.75em",
									padding: "0 4px",
									marginLeft: 8,
								}}
								title="Copy"
							>
								📋
							</button>
						)}
					</>
				) : (
					<span style={{ color: getTypeColor(value) }}>{formatValue(value)}</span>
				)}
			</div>
			{isExpandable && expanded && (
				<>
					{entries.map(([k, v]) => (
						<JsonNode key={k} name={k} value={v} depth={depth + 1} maxDepth={maxDepth} />
					))}
					<div style={{ marginLeft: depth > 0 ? 16 : 0, color: "var(--muted, #888)", fontFamily: "monospace", fontSize: "0.82em" }}>
						{bracketClose}
					</div>
				</>
			)}
		</div>
	);
}

export function JsonView({ data, initialExpanded = true, maxDepth = 5 }: JsonViewProps) {
	return (
		<div
			style={{
				background: "color-mix(in srgb, var(--bg, #1a1a2e) 90%, #000)",
				borderRadius: 6,
				padding: "8px 12px",
				overflow: "auto",
				maxHeight: 400,
			}}
		>
			<JsonNode value={data} depth={0} maxDepth={maxDepth} />
		</div>
	);
}