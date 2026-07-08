import { useState, useRef, useEffect, useCallback } from "react";
import { useExtensionState } from "../context/ExtensionStateContext.js";
import { MarkdownBlock } from "./common/MarkdownBlock.js";
import type { AgentMode } from "../types.js";

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

export function ChatView() {
	const { state, dispatch, sendMessage, abort, approveTool, attachFile, saveSettings, switchTab, restoreSession } = useExtensionState();
	if (typeof window !== "undefined") {
		(window as any).logStartup?.("WEBVIEW", state.activeSessionId || "None", "React", "ChatView_render", "EVENT", "N/A", "SUCCESS");
	}
	const [input, setInput] = useState("");
	const [autocompleteVisible, setAutocompleteVisible] = useState(false);
	const [autocompleteIdx, setAutocompleteIdx] = useState(-1);
	const [editingIndex, setEditingIndex] = useState<number | null>(null);
	const [editText, setEditText] = useState("");
	const [showModeMenu, setShowModeMenu] = useState(false);
	const [showModelMenu, setShowModelMenu] = useState(false);
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
	}, [state.messages]);

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
		if (!trimmed || state.isRunning) return;

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
	}, [input, state.isRunning, state.currentConfig, sendMessage, dispatch]);

	const changeProvider = useCallback((providerId: string) => {
		dispatch({ type: "UPDATE_CONFIG", config: { providerId, modelId: "" } });
	}, [dispatch]);

	const changeModel = useCallback((modelId: string) => {
		dispatch({ type: "UPDATE_CONFIG", config: { modelId } });
	}, [dispatch]);

	const changeThinking = useCallback((thinking: boolean) => {
		dispatch({ type: "UPDATE_CONFIG", config: { thinking } });
	}, [dispatch]);

	const changeReasoningEffort = useCallback((reasoningEffort: string) => {
		dispatch({ type: "UPDATE_CONFIG", config: { reasoningEffort } });
	}, [dispatch]);

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
		const msgs = [...state.messages];
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
	}, [editingIndex, editText, state.messages, state.currentConfig, dispatch, sendMessage]);

	const copyMessage = useCallback((text: string) => {
		navigator.clipboard.writeText(text);
	}, []);

	const autocompleteMatches = autocompleteVisible
		? SLASH_COMMANDS.filter((c) => c.cmd.startsWith(input.toLowerCase()))
		: [];

	const mode = state.currentConfig.mode || "act";
	const providerId = state.currentConfig.providerId || "default";
	const activeModel = state.currentConfig.modelId || "default";
	const availableModels = state.models[providerId] || ["default"];

	return (
		<div className="chat-view" role="region" aria-label="Chat">

			<div className="messages-container" id="chat-messages" ref={messagesContainerRef} role="log" aria-label="Messages" aria-live="polite">
				{state.messages.length === 0 && !state.isRunning && (
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
				{state.messages.map((msg, i) => (
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
						{msg.reasoning && <ReasoningBlock text={msg.reasoning} />}
						{editingIndex === i ? (
							<div className="edit-box">
								<textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={3} aria-label="Edit message" />
								<div className="edit-actions">
									<button className="btn sm" onClick={submitEdit}>Save & Resend</button>
									<button className="btn sm secondary" onClick={cancelEdit}>Cancel</button>
								</div>
							</div>
						) : (
							<div className="message-text"><MarkdownBlock markdown={msg.text} /></div>
						)}
						{msg.toolEvents && msg.toolEvents.length > 0 && (
							<div className="tool-timeline">
								{msg.toolEvents.map((te, j) => (
									<div key={te.id || j} className="tool-node">
										<div className="tool-node-header">
											<span>{te.name || "Tool"}</span>
											<span className={`tool-status-badge ${te.state}`}>{te.state}</span>
										</div>
										{te.input !== undefined && te.input !== null && <div className="tool-details">Input: {typeof te.input === "object" ? JSON.stringify(te.input, null, 2) : String(te.input)}</div>}
										{te.output !== undefined && te.output !== null && <div className="tool-details">Output: {typeof te.output === "object" ? JSON.stringify(te.output, null, 2) : String(te.output)}</div>}
										{te.error && <div className="tool-details" style={{ color: "var(--error)" }}>Error: {te.error}</div>}
									</div>
								))}
							</div>
						)}
					</div>
				))}
				{state.isRunning && (
					<div className="message assistant">
						<div className="message-header">Zenuxs</div>
						<div className="thinking-indicator"><span className="dot-pulse" /></div>
					</div>
				)}
				{state.pendingApproval && (
					<div className="approval-card" id={`approval-${state.pendingApproval.approvalId}`} role="alertdialog" aria-label="Tool approval required">
						<div style={{ fontWeight: 600 }}>Manual Approval Required</div>
						<div className="text-muted">Tool <strong>{state.pendingApproval.toolName}</strong> requests permission.</div>
						<pre className="approval-input">{JSON.stringify(state.pendingApproval.input, null, 2)}</pre>
						<div className="approval-actions">
							<button className="btn" onClick={() => approveTool(state.pendingApproval!.approvalId, true)}>Approve</button>
							<button className="btn danger" onClick={() => {
								const reason = prompt("Reason for denial:") || "Denied";
								approveTool(state.pendingApproval!.approvalId, false, reason);
							}}>Deny</button>
						</div>
					</div>
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
						<button className="send-icon-btn" disabled={state.isRunning} onClick={handleSend} title="Send (Enter)" aria-label="Send message">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
								<line x1="22" y1="2" x2="11" y2="13" />
								<polygon points="22 2 15 22 11 13 2 9 22 2" />
							</svg>
						</button>
					)}
				</div>
				<button className="stop-btn" style={{ display: state.isRunning ? "block" : "none" }} onClick={abort} aria-label="Stop execution">Stop Execution</button>
				<div className="chat-bottom-bar">
					<button className="attachment-btn" onClick={attachFile} title="Attach Active File Context" aria-label="Attach file context">
						<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
						</svg>
						Attach File Context
					</button>
					<div id="usage-status" aria-label="Token usage">
						{state.usage
							? `${state.usage.inputTokens || 0} in / ${state.usage.outputTokens || 0} out${state.usage.totalCost ? ` | $${state.usage.totalCost.toFixed(4)}` : ""}`
							: "0 tokens | $0.0000"}
					</div>
				</div>
			</div>
		</div>
	);
}

function ReasoningBlock({ text }: { text: string }) {
	const [collapsed, setCollapsed] = useState(true);
	return (
		<div className="reasoning-block" role="region" aria-label="Thinking process">
			<div className="reasoning-header" onClick={() => setCollapsed(!collapsed)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setCollapsed(!collapsed); } }} aria-expanded={!collapsed}>
				<span>Thinking Process</span>
				<span>{collapsed ? "▶" : "▼"}</span>
			</div>
			{!collapsed && <div className="reasoning-content">{text}</div>}
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
