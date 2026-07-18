import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

function JsonNode({
	value,
	keyName,
	depth,
	defaultOpen,
}: {
	value: unknown;
	keyName?: string;
	depth: number;
	defaultOpen: boolean;
}) {
	const [open, setOpen] = useState(defaultOpen && depth < 2);

	const isObject = value !== null && typeof value === "object";
	const isArray = Array.isArray(value);

	if (!isObject) {
		return (
			<div className="flex gap-1 py-px font-mono text-xs leading-relaxed">
				{keyName !== undefined && (
					<span className="text-violet-600 dark:text-violet-400">{keyName}:</span>
				)}
				<span className={primitiveClass(value)}>{renderPrimitive(value)}</span>
			</div>
		);
	}

	const entries = isArray
		? (value as unknown[]).map((v, i) => [String(i), v] as const)
		: Object.entries(value as Record<string, unknown>);
	const summary = isArray ? `Array(${entries.length})` : `{${entries.length}}`;

	return (
		<div className="font-mono text-xs leading-relaxed">
			<button
				className="flex w-full items-center gap-1 py-px text-left hover:bg-muted/40"
				onClick={() => setOpen((o) => !o)}
				type="button"
			>
				{open ? (
					<ChevronDown className="size-3 shrink-0 text-muted-foreground" />
				) : (
					<ChevronRight className="size-3 shrink-0 text-muted-foreground" />
				)}
				{keyName !== undefined && (
					<span className="text-violet-600 dark:text-violet-400">{keyName}:</span>
				)}
				<span className="text-muted-foreground">{summary}</span>
			</button>
			{open && (
				<div
					className={cn(
						"ml-3 border-l border-border pl-2",
						depth > 0 && "mt-0.5",
					)}
				>
					{entries.map(([k, v]) => (
						<JsonNode
							depth={depth + 1}
							defaultOpen={defaultOpen}
							key={k}
							keyName={k}
							value={v}
						/>
					))}
				</div>
			)}
		</div>
	);
}

function primitiveClass(value: unknown): string {
	if (typeof value === "string") return "text-emerald-600 dark:text-emerald-400";
	if (typeof value === "number") return "text-amber-600 dark:text-amber-400";
	if (typeof value === "boolean") return "text-sky-600 dark:text-sky-400";
	if (value === null) return "text-muted-foreground";
	return "text-foreground";
}

function renderPrimitive(value: unknown): string {
	if (value === null) return "null";
	if (typeof value === "string") return `"${value}"`;
	return String(value);
}

export function JsonView({
	value,
	defaultOpen = true,
}: {
	value: unknown;
	defaultOpen?: boolean;
}) {
	return (
		<div className="rounded-md border bg-muted/30 p-2">
			<JsonNode defaultOpen={defaultOpen} depth={0} value={value} />
		</div>
	);
}
