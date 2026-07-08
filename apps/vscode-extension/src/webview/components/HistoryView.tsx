import { useState, useMemo, useCallback } from "react";
import { useExtensionState } from "../context/ExtensionStateContext.js";

export function HistoryView() {
	const { state, restoreSession, deleteSession, renameSession, exportSession, importSession, clearHistory, newSession, switchTab } = useExtensionState();
	const [search, setSearch] = useState("");

	const filtered = useMemo(() => {
		if (!search) return state.sessionHistories;
		const q = search.toLowerCase();
		return state.sessionHistories.filter((s) => {
			const title = (s.metadata?.title || s.prompt || s.sessionId).toLowerCase();
			return title.includes(q);
		});
	}, [state.sessionHistories, search]);

	const groups = useMemo(() => {
		const today = new Date().toDateString();
		const yesterday = new Date(Date.now() - 86400000).toDateString();
		const g: Record<string, typeof filtered> = { Today: [], Yesterday: [], Older: [] };
		for (const s of filtered) {
			const d = s.startedAt ? new Date(s.startedAt).toDateString() : "Older";
			if (d === today) g.Today.push(s);
			else if (d === yesterday) g.Yesterday.push(s);
			else g.Older.push(s);
		}
		return g;
	}, [filtered]);

	const handleDelete = useCallback(
		(sessionId: string) => {
			if (confirm("Delete this session permanently?")) deleteSession(sessionId);
		},
		[deleteSession],
	);

	const handleRename = useCallback(
		(sessionId: string, currentTitle?: string) => {
			const title = prompt("Enter new session title:", currentTitle || "");
			if (title !== null) renameSession(sessionId, title);
		},
		[renameSession],
	);

	return (
		<div className="history-view">
			<div className="selector-bar">
				<div className="row">
					<button className="btn sm secondary col" onClick={() => { newSession(); switchTab("chat"); }}>New Session</button>
					<button className="btn sm danger col" onClick={() => { if (confirm("Permanently clear all session histories? This cannot be undone.")) clearHistory(); }}>Clear History</button>
				</div>
			</div>
			<div className="history-list">
				{filtered.length === 0 ? (
					<div className="text-center text-muted" style={{ padding: 20 }}>No session history.</div>
				) : (
					Object.entries(groups).map(([groupName, items]) =>
						items.length > 0 ? (
							<div key={groupName}>
								<div className="history-group-title">{groupName}</div>
								{items.map((s) => (
									<div key={s.sessionId} className="history-item" onClick={() => restoreSession(s.sessionId)}>
										<div className="history-info">
											<div className="history-title">{s.metadata?.title || s.prompt || `Session ${s.sessionId.slice(0, 8)}`}</div>
											<div className="history-meta-row">
												<span>{s.provider}/{s.model}</span>
												<span>${(s.metadata?.totalCost || 0).toFixed(4)}</span>
											</div>
										</div>
										<div className="history-actions">
											<button className="delete-btn" title="Delete" onClick={(e) => { e.stopPropagation(); handleDelete(s.sessionId); }}>
												<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
													<polyline points="3 6 5 6 21 6"></polyline>
													<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
												</svg>
											</button>
										</div>
									</div>
								))}
							</div>
						) : null,
					)
				)}
			</div>
		</div>
	);
}
