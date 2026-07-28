import { useExtensionState } from "../context/ExtensionStateContext.js";
import type { TaskCompletionMetadata } from "../types.js";

interface TaskCompletionBlockProps {
	metadata?: TaskCompletionMetadata;
	text?: string;
}

export function TaskCompletionBlock({ metadata, text }: TaskCompletionBlockProps) {
	const { newSession } = useExtensionState();
	const completedAt = metadata?.completedAtFormatted || (metadata?.timestamp ? new Date(metadata.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined);
	const durationText = formatDuration(metadata?.durationMs);
	const toolsCount = metadata?.toolsUsed;
	const filesCount = metadata?.filesModified;
	const inputTokens = metadata?.inputTokens;
	const outputTokens = metadata?.outputTokens;
	const model = metadata?.model;
	const statusText = metadata?.statusText || text || "The requested task has finished successfully.";

	return (
		<div className="task-completion-card" role="region" aria-label="Task Completed">
			<div className="completion-header">
				<div className="completion-icon-badge">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
						<polyline points="20 6 9 17 4 12" />
					</svg>
				</div>
				<div className="completion-header-text">
					<span className="completion-title">Task Completed</span>
					<span className="completion-subtitle">{statusText}</span>
				</div>
			</div>

			{/* Metrics Grid */}
			{(completedAt || durationText || toolsCount !== undefined || filesCount !== undefined || (inputTokens && outputTokens) || model) && (
				<div className="completion-metrics">
					{completedAt && (
						<div className="completion-metric-item" title="Completion Time">
							<span className="metric-icon">🕒</span>
							<span className="metric-label">Completed:</span>
							<span className="metric-value">{completedAt}</span>
						</div>
					)}
					{durationText && (
						<div className="completion-metric-item" title="Duration">
							<span className="metric-icon">⏱</span>
							<span className="metric-label">Duration:</span>
							<span className="metric-value">{durationText}</span>
						</div>
					)}
					{toolsCount !== undefined && toolsCount > 0 && (
						<div className="completion-metric-item" title="Tools Executed">
							<span className="metric-icon">🛠</span>
							<span className="metric-label">Tools Used:</span>
							<span className="metric-value">{toolsCount}</span>
						</div>
					)}
					{filesCount !== undefined && filesCount > 0 && (
						<div className="completion-metric-item" title="Files Modified">
							<span className="metric-icon">📄</span>
							<span className="metric-label">Files Modified:</span>
							<span className="metric-value">{filesCount}</span>
						</div>
					)}
					{inputTokens !== undefined && outputTokens !== undefined && (inputTokens > 0 || outputTokens > 0) && (
						<div className="completion-metric-item" title="Tokens Consumed">
							<span className="metric-icon">🔤</span>
							<span className="metric-label">Tokens:</span>
							<span className="metric-value">{formatTokenCount(inputTokens)} in / {formatTokenCount(outputTokens)} out</span>
						</div>
					)}
					{model && (
						<div className="completion-metric-item" title="Model Used">
							<span className="metric-icon">🤖</span>
							<span className="metric-label">Model:</span>
							<span className="metric-value">{model.split("/").pop()}</span>
						</div>
					)}
				</div>
			)}

			<div className="completion-action-bar">
				<button className="start-new-task-btn" onClick={newSession}>
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
						<line x1="12" y1="5" x2="12" y2="19" />
						<line x1="5" y1="12" x2="19" y2="12" />
					</svg>
					<span>Start New Task</span>
				</button>
			</div>
		</div>
	);
}

function formatDuration(ms?: number): string | undefined {
	if (!ms || ms <= 0) return undefined;
	const seconds = Math.floor(ms / 1000);
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	const remSeconds = seconds % 60;
	return `${minutes}m ${remSeconds}s`;
}

function formatTokenCount(num: number): string {
	if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
	if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
	return String(num);
}
