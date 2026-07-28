import type { TaskCompletionMetadata } from "../types.js";

interface TaskCompletionBlockProps {
	metadata?: TaskCompletionMetadata;
	text?: string;
}

export function TaskCompletionBlock({ metadata, text }: TaskCompletionBlockProps) {
	const statusText = metadata?.statusText || text || "The requested task has finished successfully.";

	return (
		<div className="task-completed-alert" role="alert" aria-label="Task Completed">
			<div className="alert-icon-badge">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
					<polyline points="20 6 9 17 4 12" />
				</svg>
			</div>
			<div className="alert-text-content">
				<span className="alert-title">Task Completed</span>
				<span className="alert-subtitle">{statusText}</span>
			</div>
		</div>
	);
}
