import { useState, useMemo, useCallback } from "react";
import { useExtensionState } from "../context/ExtensionStateContext.js";

export function HistoryView() {
	const { state, restoreSession, deleteSession, renameSession, clearHistory, newSession, switchTab } = useExtensionState();
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
			deleteSession(sessionId);
		},
		[deleteSession],
	);

	const handleRename = useCallback(
		(sessionId: string, currentTitle?: string) => {
			renameSession(sessionId, currentTitle || "");
		},
		[renameSession],
	);

	return (
		<div className="history-view">
			<div className="history-header">
				<h2>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
						<circle cx="12" cy="12" r="10"/>
						<polyline points="12 6 12 12 16 14"/>
					</svg>
					Session History
				</h2>
				<p>Manage and restore your past conversations</p>
			</div>

			<div className="history-toolbar">
				<div className="history-search-wrapper">
					<span className="history-search-icon">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
							<circle cx="11" cy="11" r="8"/>
							<line x1="21" y1="21" x2="16.65" y2="16.65"/>
						</svg>
					</span>
					<input
						type="text"
						className="history-search-input"
						placeholder="Search sessions..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
				</div>
				<div className="history-toolbar-actions">
					<button className="history-toolbar-btn" onClick={() => switchTab("chat")} title="Back to Chat">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
							<line x1="19" y1="12" x2="5" y2="12"/>
							<polyline points="12 19 5 12 12 5"/>
						</svg>
					</button>
					<button className="history-toolbar-btn primary" onClick={() => { newSession(); switchTab("chat"); }} title="New Chat">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
							<line x1="12" y1="5" x2="12" y2="19"/>
							<line x1="5" y1="12" x2="19" y2="12"/>
						</svg>
					</button>
					<button className="history-toolbar-btn danger" onClick={clearHistory} title="Clear All History">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
							<polyline points="3 6 5 6 21 6"/>
							<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
						</svg>
					</button>
				</div>
			</div>

			<div className="history-list">
				{filtered.length === 0 ? (
					<div className="text-center text-muted" style={{ padding: "40px 20px" }}>
						<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12 }}>
							<circle cx="12" cy="12" r="10"/>
							<line x1="8" y1="12" x2="16" y2="12"/>
						</svg>
						<div>No session history found.</div>
					</div>
				) : (
					Object.entries(groups).map(([groupName, items]) =>
						items.length > 0 ? (
							<div key={groupName} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
								<div className="history-group-title">{groupName}</div>
								{items.map((s) => {
									const title = s.metadata?.title || s.prompt || `Session ${s.sessionId.slice(0, 8)}`;
									const provider = (s.provider || "cline").toLowerCase();
									const badgeLetter = (s.provider || "Z").charAt(0).toUpperCase();
									return (
										<div key={s.sessionId} className="history-item" onClick={() => restoreSession(s.sessionId)}>
											<div className={`provider-icon-badge ${provider}`} title={`Provider: ${s.provider}`}>
												{badgeLetter}
											</div>
											<div className="history-info">
												<div className="history-title" title={title}>{title}</div>
												<div className="history-meta-row">
													<span className="history-meta-item">
														<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
															<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
															<path d="M7 11V7a5 5 0 0 1 10 0v4"/>
														</svg>
														{(s.model || "default").split("/").pop()}
													</span>
													<span className="history-meta-item">
														<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
															<line x1="12" y1="1" x2="12" y2="23"/>
															<path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
														</svg>
														{(s.metadata?.totalCost || 0).toFixed(4)}
													</span>
												</div>
											</div>
											<div className="history-actions">
												<button className="history-action-btn" title="Rename Session" onClick={(e) => { e.stopPropagation(); handleRename(s.sessionId, s.metadata?.title || s.prompt); }}>
													<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
														<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
														<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
													</svg>
												</button>
												<button className="history-action-btn delete" title="Delete Session" onClick={(e) => { e.stopPropagation(); handleDelete(s.sessionId); }}>
													<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
														<polyline points="3 6 5 6 21 6"/>
														<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
													</svg>
												</button>
											</div>
										</div>
									);
								})}
							</div>
						) : null,
					)
				)}
			</div>
		</div>
	);
}
