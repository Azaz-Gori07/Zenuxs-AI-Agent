import { useState, useRef, useEffect, useCallback } from "react";
import { useExtensionState } from "../context/ExtensionStateContext.js";
import { MarkdownBlock } from "./common/MarkdownBlock.js";
import type { AgentMode } from "../types.js";
import { postMessage } from "../vscode-api.js";
import { 
	useStore, 
	SessionStore, 
	TimelineStore, 
	ExecutionStore, 
	ToolExecutionStore 
} from "../context/stores.js";

const SLASH_COMMANDS = [
	{ cmd: "/explain", desc: "Explain the current selection or active file" },
	{ cmd: "/fix", desc: "Fix bugs or issues in the selected code" },
	{ cmd: "/test", desc: "Generate unit tests for the active selection" },
	{ cmd: "/refactor", desc: "Refactor the selection to improve quality" },
	{ cmd: "/new", desc: "Reset context and start a clean session" },
	{ cmd: "/mode", desc: "Switch agent mode (act/plan/yolo/zen)" },
];

const MODE_LABELS: Record<AgentMode, string> = {
	act: "Act",
	plan: "Plan",
	yolo: "YOLO",
	zen: "Zen",
	ask: "Ask",
	debug: "Debug",
	god: "God Mode"
};

const MODE_COLORS: Record<AgentMode, string> = {
	act: "var(--accent)",
	plan: "var(--success)",
	yolo: "var(--error)",
	zen: "var(--muted)",
	ask: "var(--warning)",
	debug: "#38bdf8",
	god: "var(--error)"
};

const STATUS_EMOJIS = {
	idle: "💤",
	thinking: "🟢",
	searching: "🔍",
	reading: "📖",
	writing: "✍️",
	calling: "🔧",
	testing: "🧪",
	finished: "✅",
	error: "❌",
};

const STATUS_LABELS = {
	idle: "Idle",
	thinking: "Thinking...",
	searching: "Searching Workspace...",
	reading: "Reading Files...",
	writing: "Writing Code...",
	calling: "Executing Tool...",
	testing: "Running Tests...",
	finished: "Finished",
	error: "Execution Error",
};

export function ChatView() {
	const { 
		state, 
		dispatch, 
		sendMessage, 
		abort, 
		approveTool, 
		attachFile, 
		saveSettings, 
		switchTab, 
		restoreSession, 
		renameSession 
	} = useExtensionState();

	// Observe decoupled stores
	const sessionState = useStore(SessionStore);
	const timelineState = useStore(TimelineStore);
	const executionState = useStore(ExecutionStore);
	const toolExecutionState = useStore(ToolExecutionStore);

	const [input, setInput] = useState("");
	const [autocompleteVisible, setAutocompleteVisible] = useState(false);
	const [autocompleteIdx, setAutocompleteIdx] = useState(-1);
	const [editingIndex, setEditingIndex] = useState<number | null>(null);
	const [editText, setEditText] = useState("");
	const [showModeMenu, setShowModeMenu] = useState(false);
	const [showModelMenu, setShowModelMenu] = useState(false);
	const [showHealth, setShowHealth] = useState(false);
	const [devOpen, setDevOpen] = useState(false);

	const inputRef = useRef<HTMLTextAreaElement>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const messagesContainerRef = useRef<HTMLDivElement>(null);

	const selectMode = useCallback((m: AgentMode) => {
		dispatch({ type: "UPDATE_CONFIG", config: { mode: m } });
		saveSettings({ ...state.currentConfig, mode: m });
		setShowModeMenu(false);
	}, [state.currentConfig, saveSettings, dispatch]);

	const selectModel = useCallback((modelId: string) => {
		dispatch({ type: "UPDATE_CONFIG", config: { modelId } });
		saveSettings({ ...state.currentConfig, modelId });
		setShowModelMenu(false);
	}, [state.currentConfig, saveSettings, dispatch]);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [timelineState.messages]);

	useEffect(() => {
		const textarea = inputRef.current;
		if (textarea) {
			textarea.style.height = "auto";
			textarea.style.height = `${Math.max(80, Math.min(textarea.scrollHeight, 150))}px`;
		}
	}, [input]);

	useEffect(() => {
		if (!showModeMenu && !showModelMenu) return;
		const handleDocumentClick = (e: MouseEvent) => {
			const container = document.querySelector(".bottom-left-controls");
			if (container && !container.contains(e.target as Node)) {
				setShowModeMenu(false);
				setShowModelMenu(false);
			}
		};
		document.addEventListener("click", handleDocumentClick);
		return () => document.removeEventListener("click", handleDocumentClick);
	}, [showModeMenu, showModelMenu]);

	const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const val = e.target.value;
		setInput(val);
		if (val.startsWith("/")) {
			const matches = SLASH_COMMANDS.filter((c) => c.cmd.startsWith(val.toLowerCase()));
			setAutocompleteVisible(matches.length > 0);
			setAutocompleteIdx(matches.length > 0 ? 0 : -1);
		} else {
			setAutocompleteVisible(false);
			setAutocompleteIdx(-1);
		}
	}, []);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (autocompleteVisible) {
				const matches = SLASH_COMMANDS.filter((c) => c.cmd.startsWith(input.toLowerCase()));
				if (e.key === "ArrowDown") { e.preventDefault(); setAutocompleteIdx((i) => (i + 1) % matches.length); return; }
				if (e.key === "ArrowUp") { e.preventDefault(); setAutocompleteIdx((i) => (i - 1 + matches.length) % matches.length); return; }
				if (e.key === "Enter" && autocompleteIdx >= 0) {
					e.preventDefault();
					const cmd = matches[autocompleteIdx]?.cmd;
					setInput(cmd === "/mode" ? "/mode " : cmd + " ");
					setAutocompleteVisible(false);
					return;
				}
				if (e.key === "Escape") { setAutocompleteVisible(false); return; }
			}
			if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
		},
		[input, autocompleteVisible, autocompleteIdx],
	);

	const handleSend = useCallback(() => {
		const trimmed = input.trim();
		if (!trimmed || executionState.isRunning) return;

		if (trimmed.startsWith("/mode ")) {
			const modeStr = trimmed.replace("/mode ", "").trim().toLowerCase();
			const validModes: AgentMode[] = ["act", "plan", "yolo", "zen", "ask", "debug", "god"];
			if (validModes.includes(modeStr as AgentMode)) {
				const m = modeStr as AgentMode;
				dispatch({ type: "UPDATE_CONFIG", config: { mode: m } });
				saveSettings({ ...state.currentConfig, mode: m });
				dispatch({ type: "ADD_USER_MESSAGE", text: trimmed });
				dispatch({ type: "APPEND_ASSISTANT_TEXT", text: `Switched to **${MODE_LABELS[m]}** mode` });
			} else {
				dispatch({ type: "ADD_USER_MESSAGE", text: trimmed });
				dispatch({ type: "APPEND_ASSISTANT_TEXT", text: `Unknown mode: **${modeStr}**. Available: act, plan, yolo, zen, ask, debug, god` });
			}
			setInput("");
			return;
		}

		if (trimmed === "/new") {
			dispatch({ type: "RESET_SESSION" });
			setInput("");
			return;
		}

		setInput("");
		setAutocompleteVisible(false);
		sendMessage(trimmed, {
			providerId: state.currentConfig.providerId,
			modelId: state.currentConfig.modelId || undefined,
			thinking: state.currentConfig.thinking,
			reasoningEffort: state.currentConfig.reasoningEffort,
			mode: state.currentConfig.mode,
		});
	}, [input, executionState.isRunning, state.currentConfig, sendMessage, dispatch]);

	const copyMessage = useCallback((text: string) => {
		navigator.clipboard.writeText(text);
	}, []);

	const startEdit = useCallback((index: number, currentText: string) => {
		setEditingIndex(index);
		setEditText(currentText);
	}, []);

	const cancelEdit = useCallback(() => {
		setEditingIndex(null);
		setEditText("");
	}, []);

	const submitEdit = useCallback(() => {
		if (editingIndex === null || !editText.trim()) return;
		const msgs = [...timelineState.messages];
		msgs[editingIndex] = { ...msgs[editingIndex], text: editText.trim() };
		dispatch({ type: "SET_INITIAL_DATA", payload: { messages: msgs } });
		setEditingIndex(null);
		setEditText("");
		sendMessage(editText.trim(), {
			providerId: state.currentConfig.providerId,
			modelId: state.currentConfig.modelId || undefined,
			thinking: state.currentConfig.thinking,
			reasoningEffort: state.currentConfig.reasoningEffort,
			mode: state.currentConfig.mode,
		});
	}, [editingIndex, editText, timelineState.messages, state.currentConfig, dispatch, sendMessage]);

	const autocompleteMatches = autocompleteVisible
		? SLASH_COMMANDS.filter((c) => c.cmd.startsWith(input.toLowerCase()))
		: [];

	const mode = state.currentConfig.mode || "act";
	const providerId = state.currentConfig.providerId || "default";
	const activeModel = state.currentConfig.modelId || "default";
	const availableModels = state.models[providerId] || ["default"];

	const contextPercentage = Math.min(100, Math.max(0, (executionState.contextTokens / executionState.contextMaxTokens) * 100));

	return (
		<div className="chat-view" role="region" aria-label="Chat">
			
			{/* STICKY STATUS BAR */}
			<div className="sticky-status-bar" role="status" aria-live="polite">
				<div className="status-indicator">
					<span className={`status-dot-pulse ${executionState.isRunning ? "running" : executionState.status}`} />
					<span>{STATUS_EMOJIS[executionState.status]} {STATUS_LABELS[executionState.status]}</span>
				</div>
				{executionState.isRunning && (
					<div style={{ fontSize: "0.85em", color: "var(--muted)" }}>
						{(executionState.durationMs / 1000).toFixed(0)}s
					</div>
				)}
			</div>

			{/* SESSION HEADER & TOOLBAR */}
			<div className="session-header-bar">
				<div className="session-header-title">
					<span>{sessionState.activeSessionId ? (state.sessionHistories.find(h => h.sessionId === sessionState.activeSessionId)?.metadata?.title || "Active Chat") : "New Chat"}</span>
					{sessionState.activeSessionId && (
						<button onClick={() => {
							const t = prompt("Rename session:") || "";
							if (t.trim()) renameSession(sessionState.activeSessionId!, t.trim());
						}} title="Rename Session">✏️</button>
					)}
				</div>

				<div className="session-toolbar-actions">
					{/* Token budget meter */}
					<div className="context-meter-container" title={`Context window usage: ${executionState.contextTokens.toLocaleString()} / ${executionState.contextMaxTokens.toLocaleString()} tokens`}>
						<div className="context-bar-track">
							<div className="context-bar-fill" style={{ width: `${contextPercentage}%` }} />
						</div>
						<span>{contextPercentage.toFixed(0)}%</span>
						{executionState.compacted && <span className="badge-compacted">Compacted</span>}
					</div>

					<CheckpointDropdownComponent 
						activeSessionId={sessionState.activeSessionId} 
						checkpoints={sessionState.checkpoints} 
					/>
				</div>
			</div>

			{/* SESSION HEALTH WIDGET */}
			{sessionState.activeSessionId && (
				<div style={{ borderBottom: "1px solid var(--border)", background: "rgba(255, 255, 255, 0.005)" }}>
					<button className="link-btn" style={{ padding: "4px 16px", fontSize: "0.78em", display: "flex", alignItems: "center", gap: 4 }} onClick={() => setShowHealth(!showHealth)}>
						{showHealth ? "▼ Hide Session Info" : "▶ Show Session Info"}
					</button>
					{showHealth && (
						<div className="session-health-panel">
							<div className="health-stat">🩺 Provider: <strong>{getProviderLabel(sessionState.providerId)}</strong></div>
							<div className="health-stat">🔄 Checkpoints: <strong>{sessionState.checkpoints.length}</strong></div>
							<div className="health-stat">🧠 Memory: <strong>{sessionState.memoryLoaded ? "Loaded" : "None"}</strong></div>
							<div className="health-stat">⚡ Network: <strong style={{ color: sessionState.connected ? "var(--success)" : "var(--error)" }}>{sessionState.connected ? "Connected" : "Offline"}</strong></div>
						</div>
					)}
				</div>
			)}

			<div className="messages-container" id="chat-messages" ref={messagesContainerRef} role="log" aria-label="Messages" aria-live="polite">
				{timelineState.messages.length === 0 && !executionState.isRunning && (
					<div className="welcome-placeholder">
						{(window as any).logoUri ? (
							<img className="welcome-icon" src={(window as any).logoUri} alt="Logo" />
						) : (
							<div className="welcome-icon">Z</div>
						)}
						<h2>Zenuxs AI</h2>
						{state.sessionHistories && state.sessionHistories.length > 0 && (
							<div className="recent-chats-container" style={{ marginTop: 24, width: "100%", maxWidth: 300, display: "flex", flexDirection: "column", gap: 8, alignItems: "stretch" }}>
								<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
									<button className="link-btn" onClick={() => switchTab("history")}>
										View All
									</button>
									<span style={{ fontSize: "0.8em", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Recent Chats</span>
								</div>
								{state.sessionHistories.slice(0, 2).map((session) => {
									const title = session.metadata?.title || session.prompt || "Untitled Session";
									return (
										<button
											key={session.sessionId}
											className="recent-chat-item"
											onClick={() => restoreSession(session.sessionId)}
											title={title}
										>
											<span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{title}</span>
											<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
												<polyline points="9 18 15 12 9 6" />
											</svg>
										</button>
									);
								})}
							</div>
						)}
					</div>
				)}

				{timelineState.messages.map((msg, i) => (
					<div key={i} className={`message ${msg.role} ${editingIndex === i ? "editing" : ""}`} role="article">
						<div className="message-header">
							<span>{msg.role === "user" ? "You" : msg.role === "assistant" ? "Zenuxs" : "Error"}</span>
							<div className="message-actions">
								<button className="msg-action-btn" onClick={() => copyMessage(msg.text)} title="Copy message" aria-label="Copy message">
									<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
								</button>
								{msg.role === "user" && (
									<button className="msg-action-btn" onClick={() => startEdit(i, msg.text)} title="Edit and resend" aria-label="Edit message">
										<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
									</button>
								)}
							</div>
						</div>

						{/* ISOLATED STREAMING THOUGHTS PANEL */}
						{msg.reasoning && (
							<div className="streaming-thoughts-block">
								<div className="streaming-thoughts-header">
									<span>💭 Thinking Process</span>
								</div>
								<div className="streaming-thoughts-content">{msg.reasoning}</div>
							</div>
						)}

						{editingIndex === i ? (
							<div className="edit-box">
								<textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={3} aria-label="Edit message" />
								<div className="edit-actions">
									<button className="btn sm" onClick={submitEdit}>Save & Resend</button>
									<button className="btn sm secondary" onClick={cancelEdit}>Cancel</button>
								</div>
							</div>
						) : (
							msg.text && (
								<div className="message-text">
									<MarkdownBlock markdown={msg.text} />
								</div>
							)
						)}

						{/* LIVE TOOL TIMELINE */}
						{msg.toolEvents && msg.toolEvents.length > 0 && (
							<div className="tool-timeline" role="list">
								{msg.toolEvents.map((te, j) => (
									<TimelineStep key={te.id || j} te={te} sessionId={sessionState.activeSessionId} />
								))}
							</div>
						)}
					</div>
				))}

				{executionState.isRunning && timelineState.messages.filter(m => m.role === "assistant").length === 0 && (
					<div className="message assistant">
						<div className="message-header">Zenuxs</div>
						<div className="thinking-indicator"><span className="dot-pulse" /></div>
					</div>
				)}

				{/* TOOL PROGRESS BAR */}
				{toolExecutionState.toolProgress && (
					<div className="tool-progress-bar-container">
						<div className="tool-progress-header">
							<span>Running tool: <strong>{toolExecutionState.toolProgress.toolName}</strong></span>
							<span>{toolExecutionState.toolProgress.progressPercent}%</span>
						</div>
						<div className="tool-progress-track">
							<div className="tool-progress-fill" style={{ width: `${toolExecutionState.toolProgress.progressPercent}%` }} />
						</div>
						{toolExecutionState.toolProgress.details && (
							<div className="text-muted" style={{ fontSize: "0.8em" }}>{toolExecutionState.toolProgress.details}</div>
						)}
					</div>
				)}

				{/* ENHANCED APPROVAL CARD */}
				{toolExecutionState.pendingApproval && (
					<EnhancedApprovalCard 
						request={toolExecutionState.pendingApproval} 
						approveTool={approveTool} 
					/>
				)}

				{/* ERROR RECOVERY PANEL */}
				{toolExecutionState.lastToolError && (
					<ErrorRecoveryPanel 
						error={toolExecutionState.lastToolError} 
						onResolve={() => ToolExecutionStore.clearToolError()} 
					/>
				)}

				<div ref={messagesEndRef} />
			</div>

			<div className="input-section">
				{autocompleteVisible && autocompleteMatches.length > 0 && (
					<div className="autocomplete-list" style={{ display: "block" }} role="listbox" aria-label="Slash commands">
						{autocompleteMatches.map((m, i) => (
							<div
								key={m.cmd}
								className={`autocomplete-item ${i === autocompleteIdx ? "selected" : ""}`}
								role="option"
								aria-selected={i === autocompleteIdx}
								onClick={() => { setInput(m.cmd + " "); setAutocompleteVisible(false); inputRef.current?.focus(); }}
							>
								<span className="autocomplete-cmd">{m.cmd}</span>
								<span className="autocomplete-desc">{m.desc}</span>
							</div>
						))}
					</div>
				)}
				<div className="textarea-wrapper">
					<textarea
						ref={inputRef}
						id="prompt-textarea"
						placeholder="Ask Zenuxs... (/explain, /fix, /mode plan)"
						rows={1}
						value={input}
						onChange={handleInputChange}
						onKeyDown={handleKeyDown}
						style={{ minHeight: 80, maxHeight: 150 }}
						aria-label="Chat input"
					/>
					<div className="bottom-left-controls">
						{/* Model Switcher */}
						<div style={{ position: "relative", display: "inline-block" }}>
							<button
								className="model-switcher-btn"
								onClick={() => setShowModelMenu(!showModelMenu)}
								title={`Active Model: ${activeModel}`}
								aria-label="Select model"
							>
								{activeModel.split("/").pop() || "Model"} ▾
							</button>
							{showModelMenu && (
								<div className="model-dropdown">
									{availableModels.map((m) => (
										<div
											key={m}
											className={`model-dropdown-item ${activeModel === m ? "active" : ""}`}
											onClick={() => selectModel(m)}
											title={m}
										>
											{m}
										</div>
									))}
								</div>
							)}
						</div>

						{/* Divider */}
						<span style={{ color: "var(--border)", fontSize: "0.8em" }}>|</span>

						{/* Mode Switcher */}
						<div style={{ position: "relative", display: "inline-block" }}>
							<button
								className="mode-switcher-btn"
								onClick={() => setShowModeMenu(!showModeMenu)}
								style={{ color: MODE_COLORS[mode] || "var(--fg)" }}
								title="Select Agent Mode"
								aria-label="Select agent mode"
							>
								{MODE_LABELS[mode] || "Mode"} ▾
							</button>
							{showModeMenu && (
								<div className="mode-dropdown">
									{(["act", "plan", "ask", "debug", "god"] as AgentMode[]).map((m) => (
										<div
											key={m}
											className={`mode-dropdown-item ${mode === m ? "active" : ""}`}
											onClick={() => selectMode(m)}
											style={{ color: mode === m ? "#fff" : MODE_COLORS[m] }}
										>
											{MODE_LABELS[m]}
										</div>
									))}
								</div>
							)}
						</div>
					</div>
					{input.trim() && (
						<button className="send-icon-btn" disabled={executionState.isRunning} onClick={handleSend} title="Send (Enter)" aria-label="Send message">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
								<line x1="22" y1="2" x2="11" y2="13" />
								<polygon points="22 2 15 22 11 13 2 9 22 2" />
							</svg>
						</button>
					)}
				</div>
				<button className="stop-btn" style={{ display: executionState.isRunning ? "block" : "none" }} onClick={abort} aria-label="Stop execution">Stop Execution</button>
				<div className="chat-bottom-bar">
					<button className="attachment-btn" onClick={attachFile} title="Attach Active File Context" aria-label="Attach file context">
						<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
						</svg>
						Attach File Context
					</button>
					<div id="usage-status" aria-label="Token usage">
						{executionState.totalCost > 0 || executionState.inputTokens > 0
							? `${executionState.inputTokens} in / ${executionState.outputTokens} out | $${executionState.totalCost.toFixed(4)}`
							: "0 tokens | $0.0000"}
					</div>
				</div>
			</div>

			{/* FLOAT BUTTON FOR DEV MODE */}
			<button 
				className={`dev-badge-btn ${devOpen ? "active" : ""}`}
				onClick={() => setDevOpen(!devOpen)}
				title="Toggle Developer Overlay"
			>
				🛠️
			</button>

			{/* DEVELOPER DRAWER OVERLAY */}
			<DeveloperDrawer isOpen={devOpen} onClose={() => setDevOpen(false)} />
		</div>
	);
}

// ==========================================
// SUB-COMPONENTS
// ==========================================

function CheckpointDropdownComponent({ activeSessionId, checkpoints }: { activeSessionId: string | null; checkpoints: any[] }) {
	const [isOpen, setIsOpen] = useState(false);
	const { restoreCheckpoint, deleteCheckpoint, listCheckpoints } = useExtensionState();

	useEffect(() => {
		if (activeSessionId) {
			listCheckpoints(activeSessionId);
		}
	}, [activeSessionId]);

	if (!activeSessionId) return null;

	return (
		<div style={{ position: "relative" }}>
			<button className="toolbar-icon-btn" onClick={() => setIsOpen(!isOpen)} title="Manage Checkpoints" aria-label="Manage checkpoints">
				⏱️
			</button>
			{isOpen && (
				<div className="checkpoint-dropdown">
					<div className="checkpoint-dropdown-title">Checkpoints ({checkpoints.length})</div>
					{checkpoints.length === 0 ? (
						<div style={{ padding: "8px 12px", color: "var(--muted)", fontSize: "0.85em" }}>No checkpoints saved</div>
					) : (
						checkpoints.map((c) => (
							<div key={c.ref} className="checkpoint-dropdown-item">
								<div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
									<span style={{ fontWeight: 600 }}>Step {c.runCount}</span>
									<span style={{ fontSize: "0.75em", color: "var(--muted)" }}>
										{new Date(c.createdAt).toLocaleTimeString()}
									</span>
								</div>
								<div className="checkpoint-item-actions">
									<button className="checkpoint-item-btn" onClick={() => { restoreCheckpoint(activeSessionId, c.ref); setIsOpen(false); }} title="Restore checkpoint" aria-label="Restore checkpoint">
										🔄
									</button>
									<button className="checkpoint-item-btn delete" onClick={() => deleteCheckpoint(activeSessionId, c.ref)} title="Delete checkpoint" aria-label="Delete checkpoint">
										🗑️
									</button>
								</div>
							</div>
						))
					)}
				</div>
			)}
		</div>
	);
}

function TimelineStep({ te, sessionId }: { te: any; sessionId: string | null }) {
	const [isOpen, setIsOpen] = useState(false);
	const [showDiff, setShowDiff] = useState(false);

	const isCompleted = te.state === "completed" || te.state === "output-available";
	const isFailed = te.state === "failed" || te.state === "output-error";
	const isRunning = te.state === "running";

	const name = te.name || "Tool";
	
	const getDiffDetails = () => {
		if (!te.input) return null;
		const input = te.input as any;
		
		const isWrite = name.includes("write") || name.includes("replace") || name.includes("edit") || name.includes("patch");
		if (!isWrite) return null;
		
		const targetFile = input.TargetFile || input.AbsolutePath || input.path || "";
		const content = input.CodeContent || input.ReplacementContent || input.content || "";
		const targetContent = input.TargetContent || "";
		
		if (!targetFile) return null;
		return { targetFile, content, targetContent };
	};

	const diffInfo = getDiffDetails();

	return (
		<div className={`timeline-step ${te.state} ${isOpen ? "open" : ""}`} role="listitem">
			<div className="timeline-step-indicator">
				{isCompleted ? "✓" : isFailed ? "✗" : isRunning ? "⟳" : "•"}
			</div>
			<div className="timeline-step-body">
				<div className="timeline-step-title" onClick={() => setIsOpen(!isOpen)}>
					<span>{name}</span>
					<span className="timeline-step-expand-icon">▶</span>
				</div>
				{isOpen && (
					<div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
						{te.input && (
							<div className="tool-details">
								<strong>Arguments:</strong>
								<pre style={{ margin: 0 }}>{JSON.stringify(te.input, null, 2)}</pre>
							</div>
						)}
						{diffInfo && (
							<div style={{ marginTop: 4 }}>
								<button className="btn secondary sm" onClick={() => setShowDiff(!showDiff)}>
									{showDiff ? "Hide File Preview" : "Show File Preview (Diff)"}
								</button>
								{showDiff && (
									<FileDiffViewer 
										filename={diffInfo.targetFile} 
										targetContent={diffInfo.targetContent} 
										replacementContent={diffInfo.content} 
									/>
								)}
							</div>
						)}
						{te.output && (
							<div className="tool-details">
								<strong>Result:</strong>
								<pre style={{ margin: 0 }}>{typeof te.output === "object" ? JSON.stringify(te.output, null, 2) : String(te.output)}</pre>
							</div>
						)}
						{te.error && (
							<div className="tool-details" style={{ color: "var(--error)" }}>
								<strong>Error:</strong>
								<div>{te.error}</div>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}

function FileDiffViewer({ filename, targetContent, replacementContent }: { filename: string; targetContent?: string; replacementContent?: string }) {
	const renderDiff = () => {
		const targetLines = targetContent ? targetContent.split("\n") : [];
		const replacementLines = replacementContent ? replacementContent.split("\n") : [];

		if (targetLines.length === 0) {
			return replacementLines.map((line, idx) => (
				<div key={idx} className="diff-line diff-line-added">+ {line}</div>
			));
		}

		return (
			<>
				{targetLines.map((line, idx) => (
					<div key={`rem-${idx}`} className="diff-line diff-line-removed">- {line}</div>
				))}
				{replacementLines.map((line, idx) => (
					<div key={`add-${idx}`} className="diff-line diff-line-added">+ {line}</div>
				))}
			</>
		);
	};

	return (
		<div className="file-diff-panel">
			<div className="file-diff-header">
				<span>{filename.split(/[\\/]/).pop() || "file"}</span>
				<span style={{ fontSize: "0.85em", color: "var(--muted)" }}>Preview</span>
			</div>
			<div className="file-diff-lines">
				{renderDiff()}
			</div>
		</div>
	);
}

function EnhancedApprovalCard({ request, approveTool }: { request: any; approveTool: any }) {
	const [denyReason, setDenyReason] = useState("");
	const [showDenyForm, setShowDenyForm] = useState(false);
	const [showRawArgs, setShowRawArgs] = useState(false);
	const [showAffectedFile, setShowAffectedFile] = useState(false);
	const [editingArgs, setEditingArgs] = useState(false);
	const [editedInputStr, setEditedInputStr] = useState(JSON.stringify(request.input, null, 2));

	const toolName = request.toolName;
	const isDangerous = ["bash", "run_command", "execute", "run_terminal"].some(t => toolName.includes(t));

	const isPathOutOfWorkspace = () => {
		if (!request.input || typeof request.input !== "object") return false;
		const inputObj = request.input as Record<string, any>;
		const pathFields = ["path", "TargetFile", "AbsolutePath", "target", "file", "TargetContent"];
		for (const field of pathFields) {
			const val = inputObj[field];
			if (typeof val === "string") {
				if (val.includes("..")) return true;
				if (val.startsWith("/") && !val.startsWith("/workspace") && !val.startsWith("d:/V3") && !val.startsWith("d:\\V3")) return true;
				if (/^[a-zA-Z]:/.test(val) && !val.toLowerCase().replace(/\\/g, "/").startsWith("d:/v3")) return true;
			}
		}
		return false;
	};

	const outOfWorkspace = isPathOutOfWorkspace();

	const handleApprove = (type: "once" | "always" | "session") => {
		let finalInput = request.input;
		if (editingArgs) {
			try {
				finalInput = JSON.parse(editedInputStr);
			} catch (err) {
				alert("Invalid JSON arguments!");
				return;
			}
		}
		postMessage({
			type: "approval_response",
			approvalId: request.approvalId,
			approved: true,
			input: finalInput,
			policy: type
		});
		approveTool(request.approvalId, true);
	};

	const handleDeny = () => {
		if (!denyReason.trim()) {
			alert("Please enter a reason for denial.");
			return;
		}
		approveTool(request.approvalId, false, denyReason.trim());
	};

	const getFilePreview = () => {
		if (!request.input || typeof request.input !== "object") return null;
		const input = request.input as any;
		const filename = input.TargetFile || input.AbsolutePath || input.path || "";
		const content = input.CodeContent || input.ReplacementContent || input.content || "";
		const targetContent = input.TargetContent || "";
		if (!filename) return null;
		return { filename, content, targetContent };
	};

	const filePreview = getFilePreview();

	return (
		<div className={`approval-card ${isDangerous || outOfWorkspace ? "dangerous" : ""}`} role="alertdialog" aria-label="Tool approval required">
			<div style={{ fontWeight: 700, fontSize: "1.05em", color: isDangerous ? "var(--error)" : "#fff" }}>
				🛡️ Manual Approval Required
			</div>
			
			{isDangerous && (
				<div className="warning-banner" style={{ marginBottom: 10 }}>
					<span className="warning-banner-icon">⚠️</span>
					<div>
						<strong>Security Warning:</strong> Executing shell commands can modify your system, access network resources, or delete files. Review arguments carefully.
					</div>
				</div>
			)}

			{outOfWorkspace && (
				<div className="warning-banner" style={{ marginBottom: 10, background: "rgba(239, 68, 68, 0.12)", borderColor: "rgba(239, 68, 68, 0.3)" }}>
					<span className="warning-banner-icon">🚨</span>
					<div>
						<strong>Directory Escaping Warning:</strong> This tool is requesting access to a file path outside the workspace root.
					</div>
				</div>
			)}

			<div className="approval-card-subtitle">
				Tool <strong>{toolName}</strong> requests permission.
			</div>

			{editingArgs ? (
				<div className="form-group" style={{ margin: "6px 0" }}>
					<label>Edit Arguments (JSON):</label>
					<textarea
						className="approval-feedback-textarea"
						style={{ fontFamily: "var(--font-mono)", fontSize: "0.85em" }}
						value={editedInputStr}
						onChange={(e) => setEditedInputStr(e.target.value)}
					/>
				</div>
			) : (
				showRawArgs && (
					<pre className="approval-input">{JSON.stringify(request.input, null, 2)}</pre>
				)
			)}

			<div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "6px 0" }}>
				<button className="link-btn" onClick={() => setShowRawArgs(!showRawArgs)}>
					{showRawArgs ? "Hide arguments" : "Show raw arguments"}
				</button>
				<button className="link-btn" onClick={() => setEditingArgs(!editingArgs)}>
					{editingArgs ? "Cancel edit" : "Edit arguments"}
				</button>
				{filePreview && (
					<button className="link-btn" onClick={() => setShowAffectedFile(!showAffectedFile)}>
						{showAffectedFile ? "Hide affected files" : "Show affected files"}
					</button>
				)}
			</div>

			{showAffectedFile && filePreview && (
				<FileDiffViewer 
					filename={filePreview.filename} 
					targetContent={filePreview.targetContent} 
					replacementContent={filePreview.content} 
				/>
			)}

			{!showDenyForm ? (
				<div className="approval-actions" style={{ marginTop: 8 }}>
					<button className="btn" onClick={() => handleApprove("once")}>Run once</button>
					<button className="btn secondary sm" onClick={() => handleApprove("always")}>Always allow</button>
					<button className="btn secondary sm" onClick={() => handleApprove("session")}>Allow this session</button>
					<button className="btn danger" onClick={() => setShowDenyForm(true)}>Deny</button>
				</div>
			) : (
				<div className="approval-feedback-area">
					<textarea
						className="approval-feedback-textarea"
						placeholder="Explain why you are denying this request..."
						value={denyReason}
						onChange={(e) => setDenyReason(e.target.value)}
					/>
					<div style={{ display: "flex", gap: 8 }}>
						<button className="btn danger" onClick={handleDeny}>Submit Denial</button>
						<button className="btn secondary sm" onClick={() => setShowDenyForm(false)}>Cancel</button>
					</div>
				</div>
			)}
		</div>
	);
}

function ErrorRecoveryPanel({ error, onResolve }: { error: { toolName: string; message: string }; onResolve: () => void }) {
	const { restoreCheckpoint, switchTab } = useExtensionState();
	const session = useStore(SessionStore);

	const handleRetryFromCheckpoint = () => {
		if (session.checkpoints.length > 0) {
			const latest = session.checkpoints[session.checkpoints.length - 1];
			restoreCheckpoint(session.activeSessionId!, latest.ref);
		} else {
			alert("No checkpoints available to restore!");
		}
		onResolve();
	};

	const handleCopyStack = () => {
		navigator.clipboard.writeText(error.message + "\nStack trace: " + (error as any).stack);
		alert("Stack trace copied!");
	};

	return (
		<div className="error-recovery-card">
			<div className="error-recovery-title">
				<span>⚠️ Tool Failure in '{error.toolName}'</span>
			</div>
			<div className="error-recovery-desc">
				{error.message}
			</div>
			<div className="error-recovery-actions">
				<button className="btn sm" onClick={onResolve}>Ignore</button>
				<button className="btn sm success" onClick={() => { postMessage({ type: "run_command", command: "retry" }); onResolve(); }}>Retry</button>
				{session.checkpoints.length > 0 && (
					<button className="btn sm secondary" onClick={handleRetryFromCheckpoint}>
						Retry from checkpoint
					</button>
				)}
				<button className="btn sm secondary" onClick={() => switchTab("logs")}>View logs</button>
				<button className="btn sm secondary" onClick={handleCopyStack}>Copy stack trace</button>
			</div>
		</div>
	);
}

function DeveloperDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
	const execution = useStore(ExecutionStore);
	const session = useStore(SessionStore);
	const timeline = useStore(TimelineStore);

	const lastMessage = timeline.messages.filter(m => m.role === "user").pop();
	const lastAssistant = timeline.messages.filter(m => m.role === "assistant").pop();

	return (
		<div className={`dev-drawer-overlay ${isOpen ? "open" : ""}`}>
			<div className="dev-drawer-header">
				<h3>Developer Overlay</h3>
				<button className="checkpoint-item-btn" onClick={onClose}>✕</button>
			</div>
			<div className="dev-drawer-content">
				<div className="dev-inspect-section">
					<span className="dev-inspect-title">System Metrics</span>
					<div className="dev-inspect-box" style={{ fontSize: "0.75em" }}>
						CWD: VS Code Workspace<br />
						Session: {session.activeSessionId || "None"}<br />
						Duration: {(execution.durationMs / 1000).toFixed(0)}s<br />
						Input Tokens: {execution.inputTokens}<br />
						Output Tokens: {execution.outputTokens}<br />
						Total Cost: ${execution.totalCost.toFixed(4)}
					</div>
				</div>

				{lastMessage && (
					<div className="dev-inspect-section">
						<span className="dev-inspect-title">Last User Prompt</span>
						<div className="dev-inspect-box">{lastMessage.text}</div>
					</div>
				)}

				{lastAssistant && lastAssistant.toolEvents && lastAssistant.toolEvents.length > 0 && (
					<div className="dev-inspect-section">
						<span className="dev-inspect-title">Tool JSON</span>
						<div className="dev-inspect-box">
							{JSON.stringify(lastAssistant.toolEvents.map(e => ({ name: e.name, input: e.input })), null, 2)}
						</div>
					</div>
				)}

				<div className="dev-inspect-section">
					<span className="dev-inspect-title">Architecture Suggestions</span>
					<div className="dev-inspect-box" style={{ fontSize: "0.78em", color: "#34d399" }}>
						• Evolve Zenuxs Crew nodes using Event Streams.<br />
						• Auto-compact tokens under 60k for faster prompt processing.<br />
						• Keep file versions as Git-stashes for zero data loss.
					</div>
				</div>
			</div>
		</div>
	);
}

function getProviderLabel(id: string): string {
	const labels: Record<string, string> = {
		cline: "Zenuxs", anthropic: "Anthropic", openrouter: "OpenRouter",
		"openai-compatible": "OpenAI Compatible", gemini: "Gemini",
		vertex: "Google Vertex AI", bedrock: "AWS Bedrock",
		azure: "Azure OpenAI", sap: "SAP AI Core", oca: "OCA",
	};
	return labels[id] || id;
}
