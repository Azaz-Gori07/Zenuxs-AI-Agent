/**
 * Zenuxs Runtime Profiler — Flamegraph Data Generator
 *
 * Produces ZENUXS_FLAMEGRAPH_DATA.json suitable for flamegraph visualization.
 * Builds a call tree from parent-child span relationships, computes self-time
 * vs child-time, and outputs a nested tree structure.
 */

import type { ProfileData, FlamegraphNode, ProfileSpan } from "./profiler";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface FlamegraphOutput {
	/** Root node of the call tree */
	root: FlamegraphNode;
	/** Flat list of all nodes for easy searching */
	flatNodes: FlamegraphNode[];
	/** Metadata */
	metadata: {
		totalDurationMs: number;
		spanCount: number;
		generatedAt: string;
	};
}

export function generateFlamegraphData(data: ProfileData): FlamegraphOutput {
	// Build a lookup by span ID
	const spanById = new Map<number, ProfileSpan>();
	for (const span of data.spans) {
		spanById.set(span.id, span);
	}

	// Build children map
	const childrenByParentId = new Map<number | null, ProfileSpan[]>();
	for (const span of data.spans) {
		const key = span.parentId;
		const arr = childrenByParentId.get(key) ?? [];
		arr.push(span);
		childrenByParentId.set(key, arr);
	}

	// Sort children by start time within each parent
	for (const [, children] of childrenByParentId) {
		children.sort((a, b) => a.startMs - b.startMs);
	}

	// Build the tree recursively
	const rootSpans = childrenByParentId.get(null) ?? [];

	const root: FlamegraphNode = {
		name: "root",
		value: data.totalDurationMs,
		children: rootSpans.map((s) => buildNode(s, childrenByParentId)),
		category: "startup",
		self: 0,
	};

	// Compute self time: total - sum of direct children
	computeSelfTime(root);

	// Flatten
	const flatNodes: FlamegraphNode[] = [];
	flattenTree(root, flatNodes);

	return {
		root,
		flatNodes: flatNodes.sort((a, b) => b.value - a.value),
		metadata: {
			totalDurationMs: data.totalDurationMs,
			spanCount: data.spans.length,
			generatedAt: new Date().toISOString(),
		},
	};
}

// ---------------------------------------------------------------------------
// Tree building
// ---------------------------------------------------------------------------

function buildNode(
	span: ProfileSpan,
	childrenByParentId: Map<number | null, ProfileSpan[]>,
): FlamegraphNode {
	const children = (childrenByParentId.get(span.id) ?? []).map((child) =>
		buildNode(child, childrenByParentId),
	);

	return {
		name: span.name,
		value: span.durationMs,
		children,
		category: span.category,
		self: span.durationMs, // will be adjusted by computeSelfTime
	};
}

function computeSelfTime(node: FlamegraphNode): void {
	let childTotal = 0;
	for (const child of node.children) {
		computeSelfTime(child);
		childTotal += child.value;
	}
	node.self = Math.max(0, node.value - childTotal);
}

function flattenTree(node: FlamegraphNode, out: FlamegraphNode[]): void {
	out.push(node);
	for (const child of node.children) {
		flattenTree(child, out);
	}
}
