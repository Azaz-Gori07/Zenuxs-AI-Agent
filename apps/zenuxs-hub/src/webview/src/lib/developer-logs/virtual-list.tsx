import { useRef, useState, type UIEvent } from "react";
import { cn } from "@/lib/utils";

const ROW_HEIGHT = 30;
const OVERSCAN = 12;

/**
 * Minimal fixed-height virtualized list. Renders only the visible window of
 * rows plus a small overscan, keeping memory and DOM node count bounded even
 * when the backing array holds millions of entries.
 */
export function VirtualList<T>({
	items,
	renderRow,
	rowHeight = ROW_HEIGHT,
	className,
	onScrollTopChange,
	overscan = OVERSCAN,
	scrollRef,
}: {
	items: T[];
	renderRow: (item: T, index: number) => React.ReactNode;
	rowHeight?: number;
	className?: string;
	onScrollTopChange?: (atTop: boolean) => void;
	overscan?: number;
	scrollRef?: React.RefObject<HTMLDivElement | null>;
}) {
	const innerRef = useRef<HTMLDivElement>(null);
	const [scrollTop, setScrollTop] = useState(0);
	const [viewportHeight, setViewportHeight] = useState(600);

	const total = items.length;
	const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
	const visibleCount = Math.ceil(viewportHeight / rowHeight) + overscan * 2;
	const endIndex = Math.min(total, startIndex + visibleCount);

	const visible = items.slice(startIndex, endIndex);

	const handleScroll = (event: UIEvent<HTMLDivElement>) => {
		const el = event.currentTarget;
		setScrollTop(el.scrollTop);
		if (onScrollTopChange) onScrollTopChange(el.scrollTop <= 4);
	};

	const setRef = (node: HTMLDivElement | null) => {
		innerRef.current = node;
		if (scrollRef) scrollRef.current = node;
		if (node) {
			setViewportHeight(node.clientHeight);
			const observer = new ResizeObserver(() => {
				setViewportHeight(node.clientHeight);
			});
			observer.observe(node);
			(node as unknown as { _ro?: ResizeObserver })._ro = observer;
		}
	};

	return (
		<div
			ref={setRef}
			className={cn("relative h-full overflow-auto", className)}
			onScroll={handleScroll}
		>
			<div style={{ height: total * rowHeight, position: "relative" }}>
				<div
					style={{
						position: "absolute",
						top: startIndex * rowHeight,
						left: 0,
						right: 0,
					}}
				>
					{visible.map((item, i) => (
						<div
							key={startIndex + i}
							style={{ height: rowHeight }}
							className="flex items-stretch"
						>
							{renderRow(item, startIndex + i)}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
