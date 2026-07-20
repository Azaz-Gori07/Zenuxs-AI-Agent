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
	ToolExecutionStore,
	AgentEventBus 
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

	// ==========================================
	// EXECUTION TIMELINE ENGINE
	// ==========================================
	const [activeTask, setActiveTask] = useState<TaskData | null>(null);
	const taskIdRef = useRef(0);
	const reasoningBufRef = useRef("");
	const responseBufRef = useRef("");
	const toolStagesRef = useRef<Map<string, number>>(new Map());

	useEffect(() => {
		const unsubs: (() => void)[] = [];

		unsubs.push(AgentEventBus.subscribe("user_message_sent", () => {
			taskIdRef.current++;
			reasoningBufRef.current = "";
			responseBufRef.current = "";
			toolStagesRef.current = new Map();
			const task: TaskData = {
				id: taskIdRef.current,
				startedAt: Date.now(),
				stages: [{
					id: `stage-thinking-${taskIdRef.current}`,
					type: "thinking",
					status: "running",
					label: "Thinking...",
					expanded: true,
				}],
			};
			setActiveTask(task);
		}));

		unsubs.push(AgentEventBus.subscribe("reasoning_delta", (data: { text: string }) => {
			reasoningBufRef.current += data.text;
			setActiveTask(prev => {
				if (!prev) return prev;
				const stages = [...prev.stages];
				const ti = stages.findIndex(s => s.type === "thinking");
				if (ti >= 0) {
					stages[ti] = { ...stages[ti], content: reasoningBufRef.current, status: "running", label: "Thinking..." };
				}
				return { ...prev, stages };
			});
		}));

		unsubs.push(AgentEventBus.subscribe("assistant_delta", (data: { text: string }) => {
			responseBufRef.current += data.text;
			const text = responseBufRef.current;
			setActiveTask(prev => {
				if (!prev) return prev;
				const stages = [...prev.stages];
				const ti = stages.findIndex(s => s.type === "thinking");
				if (ti >= 0) {
					stages[ti] = { ...stages[ti], status: "completed" };
				}
				const ri = stages.findIndex(s => s.type === "response");
				if (ri >= 0) {
					stages[ri] = { ...stages[ri], content: text };
				} else {
					stages.push({
						id: `stage-response-${taskIdRef.current}`,
						type: "response",
						status: "running",
						label: "Generating response...",
						content: text,
						expanded: true,
					});
				}
				return { ...prev, stages };
			});
		}));

		unsubs.push(AgentEventBus.subscribe("tool_event", (data: { text: string; event?: any }) => {
			const ev = data.event;
			if (!ev) return;
			const name = (ev.name || "").toLowerCase();
			const input = ev.input || {};
			const filePath = normalizePath(input.filePath || input.path || input.TargetFile || input.AbsolutePath || "");
			const cmd = input.command || input.commands || "";

			setActiveTask(prev => {
				if (!prev) return prev;
				const stages = [...prev.stages];
				const existingIdx = toolStagesRef.current.get(ev.id || ev.name);

				if (ev.state === "running") {
					let stageType: StageType = "tool";
					let label = ev.name || "Executing tool";
					if (name.includes("read")) { stageType = "reading"; label = filePath ? `Reading ${filePath}` : "Reading file"; }
					else if (name.includes("write") || name.includes("create")) { stageType = "writing"; label = filePath ? `Writing ${filePath}` : "Writing file"; }
					else if (name.includes("edit") || name.includes("replace") || name.includes("patch")) { stageType = "editing"; label = filePath ? `Editing ${filePath}` : "Editing file"; }
					else if (name.includes("bash") || name.includes("shell") || name.includes("exec") || name === "run") { stageType = "command"; label = cmd ? `Running \`${cmd.slice(0, 60)}\`` : "Running command"; }
					else if (name.includes("search") || name.includes("grep") || name.includes("glob") || name.includes("list_dir")) { stageType = "analyzing"; label = "Searching workspace"; }
					else if (name.includes("test")) { stageType = "testing"; label = "Running tests"; }
					else if (name.includes("think") || name.includes("reason")) { stageType = "thinking"; label = "Thinking"; }

					if (existingIdx !== undefined) {
						stages[existingIdx] = { ...stages[existingIdx], status: "running", label };
					} else {
						const idx = stages.length;
						toolStagesRef.current.set(ev.id || ev.name, idx);
						stages.push({
							id: `stage-${ev.id || ev.name}-${idx}`,
							type: stageType,
							status: "running",
							label,
							filePath,
							detail: data.text || undefined,
							expanded: true,
						});
					}
				} else if (ev.state === "completed" || ev.state === "output-available") {
					if (existingIdx !== undefined && stages[existingIdx]) {
						const s = stages[existingIdx];
						const output = ev.output || {};
						const resultText = typeof output === "string" ? output.slice(0, 120) : output.output || output.result || "";
						stages[existingIdx] = { ...s, status: "completed", detail: resultText || s.detail, progress: undefined };
					}
				} else if (ev.state === "failed" || ev.state === "output-error") {
					if (existingIdx !== undefined && stages[existingIdx]) {
						stages[existingIdx] = { ...stages[existingIdx], status: "failed", error: ev.error || "Execution failed" };
					}
				}
				return { ...prev, stages };
			});
		}));

		unsubs.push(AgentEventBus.subscribe("turn_done", (data: any) => {
			setActiveTask(prev => {
				if (!prev) return prev;
				const stages = [...prev.stages];
				const ri = stages.findIndex(s => s.type === "response" && s.status === "running");
				if (ri >= 0) stages[ri] = { ...stages[ri], status: "completed" };
				const ti = stages.findIndex(s => s.type === "thinking" && s.status === "running");
				if (ti >= 0) stages[ti] = { ...stages[ti], status: "completed" };

				const created: string[] = [];
				const modified: string[] = [];
				const deleted: string[] = [];
				const completed: string[] = [];
				let filesCreated = 0, filesModified = 0, commandsExecuted = 0;

				stages.forEach(s => {
					if (s.type === "writing" && s.status === "completed" && s.filePath) { filesCreated++; created.push(s.filePath); completed.push(s.filePath); }
					if (s.type === "editing" && s.status === "completed" && s.filePath) { filesModified++; modified.push(s.filePath); }
					if (s.type === "command" && s.status === "completed") { commandsExecuted++; }
				});

				const durationMs = Date.now() - prev.startedAt;
				stages.push({
					id: `stage-summary-${taskIdRef.current}`,
					type: "summary",
					status: "completed",
					label: "Task Completed",
					expanded: true,
					content: JSON.stringify({
						filesModified, filesCreated, commandsExecuted, testsPassed: 0,
						durationMs, totalCost: executionState.totalCost,
						totalTokens: executionState.inputTokens + executionState.outputTokens,
						createdFiles: created, modifiedFiles: modified, deletedFiles: deleted,
						completedWork: completed,
					}),
				});
				return { ...prev, stages, summary: {
					filesModified, filesCreated, commandsExecuted, testsPassed: 0,
					durationMs, totalCost: executionState.totalCost,
					totalTokens: executionState.inputTokens + executionState.outputTokens,
					createdFiles: created, modifiedFiles: modified, deletedFiles: deleted,
					completedWork: completed,
				}};
			});
		}));

		unsubs.push(AgentEventBus.subscribe("reset_done", () => {
			setActiveTask(null);
			taskIdRef.current = 0;
			reasoningBufRef.current = "";
			responseBufRef.current = "";
			toolStagesRef.current = new Map();
		}));

		return () => unsubs.forEach(u => u());
	}, []);

	function normalizePath(p: string): string {
		if (!p) return "";
		const parts = p.replace(/\\/g, "/").split("/");
		const knownRoots = ["workspace", "V3", "zenuxs-code", "project", "src", "app"];
		for (let i = 0; i < parts.length - 1; i++) {
			if (knownRoots.includes(parts[i].toLowerCase())) {
				return parts.slice(i + 1).join("/");
			}
		}
		return parts.slice(-2).join("/") || p;
	}

	function getStageIcon(type: StageType): string {
		switch (type) {
			case "thinking": return "🟣";
			case "planning": return "🟡";
			case "reading": return "📄";
			case "analyzing": return "🔍";
			case "writing": return "✍️";
			case "editing": return "📝";
			case "command": return "💻";
			case "testing": return "🧪";
			case "validation": return "✔️";
			case "tool": return "🔧";
			case "summary": return "✅";
			case "response": return "💬";
		}
	}

	const contextPercentage = Math.min(100, Math.max(0, (executionState.contextTokens / executionState.contextMaxTokens) * 100));

	return (
		<div className="chat-view" role="region" aria-label="Chat">

			{/* CONTEXT WINDOW BAR */}
			<div className="session-header-bar">
				<span className="context-window-label">Context Window</span>
				<div className="context-window-display">
					<div className="context-bar-track" title={`${executionState.contextTokens.toLocaleString()} / ${executionState.contextMaxTokens.toLocaleString()} tokens`}>
						<div className="context-bar-fill" style={{ width: `${contextPercentage}%` }} />
					</div>
					<span className="context-window-text">{executionState.contextTokens.toLocaleString()} / {executionState.contextMaxTokens.toLocaleString()}</span>
					{executionState.compacted && <span className="badge-compacted">C</span>}
				</div>
				<div className="session-toolbar-actions">
					<CheckpointDropdownComponent 
						activeSessionId={sessionState.activeSessionId} 
						checkpoints={sessionState.checkpoints} 
					/>
				</div>
			</div>



			<div className="messages-container" id="chat-messages" ref={messagesContainerRef} role="log" aria-label="Messages" aria-live="polite">
				{!activeTask && timelineState.messages.length === 0 && !executionState.isRunning && (
					<div className="welcome-placeholder">
						{(window as any).logoUri ? (
							<img className="welcome-icon" src={(window as any).logoUri} alt="Logo" />
						) : (
							<div className="welcome-icon">Z</div>
						)}
						<h2>Zenuxs AI</h2>
					</div>
				)}

				{/* EXECUTION TIMELINE */}
				{activeTask && (
					<div className="timeline-container">
						{/* Task Header */}
						<div className="task-header">
							<span className="task-number">Task #{activeTask.id}</span>
							<span className="task-status-badge running">In Progress</span>
						</div>

						{/* Timeline Stages */}
						<div className="timeline-stages">
							{activeTask.stages.map(stage => (
								<StageItem key={stage.id} stage={stage} icon={getStageIcon(stage.type)} />
							))}
						</div>

						{/* Summary Card */}
						{activeTask.summary && (
							<SummaryCard summary={activeTask.summary} taskId={activeTask.id} />
						)}

						{/* Start New Task button */}
						{activeTask.summary && (
							<button className="start-new-task-btn" onClick={() => {
								dispatch({ type: "RESET_SESSION" });
							}}>
								+ Start New Task
							</button>
						)}
					</div>
				)}

				{/* Approval & Error panels — always visible */}
				{toolExecutionState.pendingApproval && (
					<EnhancedApprovalCard 
						request={toolExecutionState.pendingApproval} 
						approveTool={approveTool} 
					/>
				)}
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
								title={`${getProviderLabel(providerId)} / ${activeModel.split("/").pop() || "Model"}`}
								aria-label="Select model"
							>
								{getProviderLabel(providerId)} / {activeModel.split("/").pop() || "Model"} ▾
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
					{(input.trim() || executionState.isRunning) && (
						<button
							className={`send-icon-btn ${executionState.isRunning ? "stop" : ""}`}
							disabled={!executionState.isRunning && !input.trim()}
							onClick={executionState.isRunning ? abort : handleSend}
							title={executionState.isRunning ? "Stop (Esc)" : "Send (Enter)"}
							aria-label={executionState.isRunning ? "Stop execution" : "Send message"}
						>
							{executionState.isRunning ? (
								<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
									<rect x="6" y="6" width="12" height="12" rx="2" />
								</svg>
							) : (
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
									<line x1="22" y1="2" x2="11" y2="13" />
									<polygon points="22 2 15 22 11 13 2 9 22 2" />
								</svg>
							)}
						</button>
					)}
				</div>
				<div className="chat-bottom-bar">
					<button className="attachment-btn" onClick={attachFile} title="Attach Active File Context" aria-label="Attach file context">
						<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
						</svg>
						Attach File Context
					</button>
					<div id="usage-status" aria-label="Token usage">
						{(executionState.inputTokens + executionState.outputTokens).toLocaleString()} / {executionState.contextMaxTokens.toLocaleString()} | ${executionState.totalCost.toFixed(4)}
					</div>
				</div>
			</div>

		</div>
	);
}

// ==========================================
// TYPES (shared between ChatView and sub-components)
// ==========================================
type StageType = "thinking" | "planning" | "reading" | "analyzing" | "writing" | "editing" | "command" | "tool" | "testing" | "validation" | "summary" | "response";

interface Stage {
	id: string;
	type: StageType;
	status: "pending" | "running" | "completed" | "failed";
	label: string;
	detail?: string;
	content?: string;
	filePath?: string;
	exitCode?: number;
	stderr?: string;
	children?: Stage[];
	error?: string;
	expanded?: boolean;
	progress?: string;
}

interface TaskData {
	id: number;
	startedAt: number;
	stages: Stage[];
	summary?: {
		filesModified: number;
		filesCreated: number;
		commandsExecuted: number;
		testsPassed: number;
		durationMs: number;
		totalCost: number;
		totalTokens: number;
		createdFiles: string[];
		modifiedFiles: string[];
		deletedFiles: string[];
		completedWork: string[];
	};
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

function formatToolInput(name: string, input: any): string {
	if (!input) return "";
	const n = (name || "").toLowerCase();
	const filePath = input.filePath || input.path || input.TargetFile || input.AbsolutePath || "";
	if (filePath) {
		const parts = filePath.split(/[\\/]/);
		return parts.pop() || filePath;
	}
	if (n.includes("bash") || n.includes("shell") || n.includes("exec")) {
		const cmd = input.command || input.commands || "";
		return typeof cmd === "string" ? cmd.slice(0, 100) : "";
	}
	return "";
}

function formatToolOutput(name: string, output: any): string {
	if (!output) return "";
	if (typeof output === "string") {
		const lines = output.split("\n").filter(l => l.trim());
		return lines.slice(0, 5).join("; ");
	}
	if (typeof output === "object") {
		const text = output.output || output.result || output.message || output.text || "";
		if (typeof text === "string") {
			const lines = text.split("\n").filter(l => l.trim());
			return lines.slice(0, 5).join("; ");
		}
	}
	return "";
}

function getToolCallHeader(name: string, input: any): string {
	const n = (name || "").toLowerCase();
	const filePath = input?.filePath || input?.path || input?.TargetFile || input?.AbsolutePath || "";
	const target = filePath ? filePath.split(/[\\/]/).pop() || filePath : "";

	if (n.includes("write") || n === "write_file") return target ? `Writing file \`${target}\`` : "Writing file";
	if (n.includes("edit") || n === "editor") return target ? `Editing file \`${target}\`` : "Editing file";
	if (n.includes("create") || n.includes("create_file")) return target ? `Creating file \`${target}\`` : "Creating file";
	if (n.includes("read") || n.includes("read_file")) return target ? `Reading file \`${target}\`` : "Reading file";
	if (n.includes("search") || n === "grep") return "Searching workspace";
	if (n === "glob") return "Searching files";
	if (n.includes("replace")) return target ? `Replacing in \`${target}\`` : "Replacing content";
	if (n.includes("patch") || n.includes("apply_patch")) return target ? `Applying patch to \`${target}\`` : "Applying patch";
	if (n.includes("bash") || n.includes("shell") || n.includes("exec") || n === "run") {
		const cmd = input?.command || input?.commands || "";
		return `Running command \`${typeof cmd === "string" ? cmd.slice(0, 80) : ""}\``;
	}
	if (n.includes("delete") || n.includes("remove")) return target ? `Deleting \`${target}\`` : "Deleting file";
	if (n.includes("move") || n.includes("rename")) return "Moving file";
	if (n.includes("copy")) return "Copying file";
	if (n.includes("test")) return "Running tests";
	if (n.includes("think") || n.includes("reason")) return "Thinking";
	if (n.includes("todowrite") || n.includes("todo")) return "Updating task list";
	if (n.includes("plan_exit")) return "Completing plan";
	if (n.includes("web") || n.includes("fetch") || n.includes("http")) return "Fetching web content";
	return name || "Executing tool";
}

function TimelineStep({ te }: { te: any; sessionId: string | null }) {
	const isCompleted = te.state === "completed" || te.state === "output-available";
	const isFailed = te.state === "failed" || te.state === "output-error";
	const isRunning = te.state === "running";
	const header = getToolCallHeader(te.name || "", te.input);
	const detail = formatToolOutput(te.name || "", te.output);

	return (
		<div className={`tool-log-entry ${te.state}`}>
			<div className="tool-log-line1">
				<span className="tool-log-icon">
					{isRunning ? "●" : isCompleted ? "✔" : "✖"}
				</span>
				<span className={`tool-log-action ${isRunning ? "pulsing" : ""}`}>
					{header}
				</span>
			</div>
			{isCompleted && detail && (
				<div className="tool-log-result">{detail}</div>
			)}
			{isFailed && te.error && (
				<div className="tool-log-result error">{te.error}</div>
			)}
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

// ==========================================
// EXECUTION TIMELINE COMPONENTS
// ==========================================

function StageItem({ stage, icon }: { stage: Stage; icon: string }) {
	const [expanded, setExpanded] = useState(stage.expanded || false);
	const isRunning = stage.status === "running";
	const isCompleted = stage.status === "completed";
	const isFailed = stage.status === "failed";
	const isPending = stage.status === "pending";
	const isSummary = stage.type === "summary";

	const toggle = () => setExpanded(!expanded);

	return (
		<div className={`stage-item ${stage.status} ${expanded ? "expanded" : ""} ${isSummary ? "stage-summary" : ""}`}>
			<div className="stage-header" onClick={toggle}>
				<span className="stage-icon">{isRunning ? "●" : isCompleted ? icon : isFailed ? "❌" : "○"}</span>
				<span className={`stage-label ${isRunning ? "running" : ""}`}>
					{stage.label}
					{isRunning && <span className="stage-pulse-dot" />}
				</span>
				<span className="stage-expand">{expanded ? "▾" : "▸"}</span>
			</div>

			{expanded && (
				<div className="stage-body">
					{/* Thinking content */}
					{stage.type === "thinking" && stage.content && (
						<div className="stage-content stage-thinking">{stage.content}</div>
					)}

					{/* Response content */}
					{stage.type === "response" && stage.content && (
						<div className="stage-content"><MarkdownBlock markdown={stage.content} /></div>
					)}

					{/* File path */}
					{stage.filePath && !isSummary && (
						<div className="stage-file-path">{stage.filePath}</div>
					)}

					{/* Command output */}
					{stage.type === "command" && stage.detail && (
						<div className="stage-command-output">{stage.detail}</div>
					)}

					{/* Error detail */}
					{isFailed && stage.error && (
						<div className="stage-error">{stage.error}</div>
					)}
				</div>
			)}
		</div>
	);
}

function SummaryCard({ summary, taskId }: { summary: NonNullable<TaskData["summary"]>; taskId: number }) {
	const [showChanges, setShowChanges] = useState(false);

	const durationStr = summary.durationMs >= 60000
		? `${Math.floor(summary.durationMs / 60000)}m ${Math.floor((summary.durationMs % 60000) / 1000)}s`
		: `${Math.floor(summary.durationMs / 1000)}s`;

	return (
		<div className="summary-card">
			<div className="summary-header">
				<span className="summary-check">✅</span>
				<span className="summary-title">Task #{taskId} Completed</span>
			</div>

			<div className="summary-stats">
				<div className="summary-stat"><span>Files Created</span><span>{summary.filesCreated}</span></div>
				<div className="summary-stat"><span>Files Modified</span><span>{summary.filesModified}</span></div>
				<div className="summary-stat"><span>Commands Executed</span><span>{summary.commandsExecuted}</span></div>
				<div className="summary-stat"><span>Duration</span><span>{durationStr}</span></div>
				<div className="summary-stat"><span>Estimated Tokens</span><span>{(summary.totalTokens / 1000).toFixed(1)}k</span></div>
				<div className="summary-stat"><span>Estimated Cost</span><span>${summary.totalCost.toFixed(4)}</span></div>
			</div>

			{(summary.createdFiles.length > 0 || summary.modifiedFiles.length > 0) && (
				<>
					<button className="summary-changes-btn" onClick={() => setShowChanges(!showChanges)}>
						{showChanges ? "▾" : "▸"} View Changes
					</button>
					{showChanges && (
						<ViewChangesPanel created={summary.createdFiles} modified={summary.modifiedFiles} deleted={summary.deletedFiles} />
					)}
				</>
			)}
		</div>
	);
}

function ViewChangesPanel({ created, modified, deleted }: { created: string[]; modified: string[]; deleted: string[] }) {
	const [expandedFile, setExpandedFile] = useState<string | null>(null);

	const renderGroup = (label: string, files: string[], className: string) => {
		if (files.length === 0) return null;
		return (
			<div className="changes-group">
				<div className="changes-group-label">{label}</div>
				{files.map(f => (
					<div key={f} className="changes-file-row" onClick={() => setExpandedFile(expandedFile === f ? null : f)}>
						<span className={`changes-file-icon ${className}`}>
							{className === "created" ? "+" : className === "modified" ? "~" : "-"}
						</span>
						<span className="changes-file-path">{f}</span>
						<span className="changes-expand">{expandedFile === f ? "▾" : "▸"}</span>
						{expandedFile === f && (
							<div className="changes-file-diff">
								<div className="diff-line diff-line-added">+ (file created/modified)</div>
							</div>
						)}
					</div>
				))}
			</div>
		);
	};

	return (
		<div className="view-changes-panel">
			{renderGroup("Created", created, "created")}
			{renderGroup("Modified", modified, "modified")}
			{renderGroup("Deleted", deleted, "deleted")}
		</div>
	);
}

function getProviderLabel(id: string): string {
	const labels: Record<string, string> = {
		cline: "Zenuxs", anthropic: "Anthropic", openrouter: "OpenRouter",
		"openai-compatible": "OpenAI", gemini: "Gemini",
		vertex: "Vertex AI", bedrock: "Bedrock",
		azure: "Azure", sap: "SAP", oca: "OCA",
		openai: "OpenAI", google: "Google", nvidia: "NVIDIA",
		deepseek: "DeepSeek", mistral: "Mistral", together: "Together",
		anthropic_claude: "Anthropic",
	};
	return labels[id] || id;
}
