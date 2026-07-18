/**
 * VirtualList — A performant virtualized list component for rendering massive
 * log datasets without blocking the UI.
 *
 * It renders only the visible rows (plus a configurable overscan), recycling
 * DOM nodes as the user scrolls. Supports variable row heights (estimated then
 * measured), smooth scrolling, and batch updates.
 */

import { useState, useRef, useCallback, useEffect, type ReactNode, type CSSProperties } from "react";

export interface VirtualListRow<T> {
	key: string;
	data: T;
	height?: number;
}

interface VirtualListProps<T> {
	rows: VirtualListRow<T>[];
	renderRow: (row: VirtualListRow<T>, style: CSSProperties, index: number) => ReactNode;
	overscan?: number;
	estimatedRowHeight?: number;
	containerStyle?: CSSProperties;
	onScroll?: (scrollTop: number) => void;
	scrollTop?: number;
}

const DEFAULT_OVERSCAN = 10;
const DEFAULT_ESTIMATED_ROW_HEIGHT = 36;

export function VirtualList<T>({
	rows,
	renderRow,
	overscan = DEFAULT_OVERSCAN,
	estimatedRowHeight = DEFAULT_ESTIMATED_ROW_HEIGHT,
	containerStyle,
	onScroll,
	scrollTop: externalScrollTop,
}: VirtualListProps<T>) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [scrollTop, setScrollTop] = useState(0);
	const [containerHeight, setContainerHeight] = useState(600);
	const measuredHeights = useRef<Map<string, number>>(new Map());

	const getRowHeight = useCallback(
		(row: VirtualListRow<T>): number => {
			return measuredHeights.current.get(row.key) ?? row.height ?? estimatedRowHeight;
		},
		[estimatedRowHeight],
	);

	// Build cumulative offsets (top positions)
	const offsets = useRef<number[]>([]);
	useEffect(() => {
		let total = 0;
		offsets.current = rows.map((row) => {
			const h = getRowHeight(row);
			const offset = total;
			total += h;
			return offset;
		});
		offsets.current.push(total); // total height sentinel
	}, [rows, getRowHeight]);

	const totalHeight = offsets.current[offsets.current.length - 1] ?? 0;

	const effectiveScrollTop = externalScrollTop ?? scrollTop;

	// Binary search to find the first visible row
	const firstVisible = (() => {
		const off = offsets.current;
		if (!off.length) return 0;
		let lo = 0;
		let hi = off.length - 1;
		while (lo < hi) {
			const mid = (lo + hi) >>> 1;
			if (off[mid] < effectiveScrollTop) lo = mid + 1;
			else hi = mid;
		}
		return Math.max(0, lo - 1);
	})();

	const lastVisible = (() => {
		const bottom = effectiveScrollTop + containerHeight;
		const off = offsets.current;
		let lo = firstVisible;
		let hi = off.length - 1;
		while (lo < hi) {
			const mid = (lo + hi) >>> 1;
			if (off[mid] < bottom) lo = mid + 1;
			else hi = mid;
		}
		return Math.min(rows.length - 1, lo);
	})();

	const startIndex = Math.max(0, firstVisible - overscan);
	const endIndex = Math.min(rows.length - 1, lastVisible + overscan);

	const visibleRows = rows.slice(startIndex, endIndex + 1);
	const topPadding = offsets.current[startIndex] ?? 0;
	const bottomPadding = totalHeight - (offsets.current[endIndex + 1] ?? offsets.current[offsets.current.length - 1] ?? 0);

	const handleScroll = useCallback(
		(e: React.UIEvent<HTMLDivElement>) => {
			const st = (e.target as HTMLDivElement).scrollTop;
			setScrollTop(st);
			onScroll?.(st);
		},
		[onScroll],
	);

	// Observe container resize
	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const ro = new ResizeObserver((entries) => {
			for (const entry of entries) {
				setContainerHeight(entry.contentRect.height);
			}
		});
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	// Measure actual row heights after render
	const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

	useEffect(() => {
		let changed = false;
		for (const [key, el] of rowRefs.current.entries()) {
			const actual = el.getBoundingClientRect().height;
			if (actual > 0 && actual !== measuredHeights.current.get(key)) {
				measuredHeights.current.set(key, actual);
				changed = true;
			}
		}
		// If heights changed, force re-render by updating offsets
		if (changed) {
			setScrollTop((prev) => prev);
		}
	});

	return (
		<div
			ref={containerRef}
			style={{
				overflowY: "auto",
				overflowX: "hidden",
				position: "relative",
				willChange: "transform",
				...containerStyle,
			}}
			onScroll={handleScroll}
		>
			<div style={{ height: totalHeight, position: "relative" }}>
				{topPadding > 0 && <div style={{ height: topPadding }} />}
				{visibleRows.map((row, i) => {
					const actualIndex = startIndex + i;
					return (
						<div
							key={row.key}
							ref={(el) => {
								if (el) rowRefs.current.set(row.key, el);
								else rowRefs.current.delete(row.key);
							}}
							style={{
								position: "absolute",
								top: (offsets.current[actualIndex] ?? 0) - effectiveScrollTop,
								left: 0,
								right: 0,
								willChange: "transform",
							}}
						>
							{renderRow(row, {}, actualIndex)}
						</div>
					);
				})}
				{bottomPadding > 0 && <div style={{ height: bottomPadding }} />}
			</div>
		</div>
	);
}