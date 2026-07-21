import { useState, useRef, useEffect, useCallback } from "react";
import { useExtensionState } from "../context/ExtensionStateContext.js";
import { MarkdownBlock } from "./common/MarkdownBlock.js";
import type { AgentMode, TaskDataV2, TaskFsmState, TimelineEvent, TaskSummaryV2, FileChangesV2, PersistedTaskExecution } from "../types.js";
import { SCHEMA_VERSION } from "../types.js";
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

	const [activeTask, setActiveTask] = useState<TaskDataV2 | null>(null);
	const userScrolledUpRef = useRef(false);
	const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
	const activeSessionIdRef = useRef<string | null>(null);
	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Debounced save of execution state to extension
	const queueSaveExecutionData = useCallback(() => {
		if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
		saveTimerRef.current = setTimeout(() => {
			setActiveTask((currentTask: TaskDataV2 | null) => {
				if (!currentTask || !activeSessionIdRef.current) return currentTask;
				postMessage({
					type: "save_execution_data",
					sessionId: activeSessionIdRef.current,
					tasks: [currentTask],
				});
				return currentTask;
			});
		}, 500);
	}, []);

	const handleScroll = useCallback(() => {
		const container = messagesContainerRef.current;
		if (!container) return;
		const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
		const scrolledUp = distanceFromBottom > 120;
		userScrolledUpRef.current = scrolledUp;
		setShowScrollBottomBtn(scrolledUp);
	}, []);

	const scrollToBottom = useCallback(() => {
		const container = messagesContainerRef.current;
		if (!container) return;
		container.scrollTop = container.scrollHeight;
		userScrolledUpRef.current = false;
		setShowScrollBottomBtn(false);
	}, []);

	useEffect(() => {
		if (!userScrolledUpRef.current) {
			scrollToBottom();
		}
	}, [timelineState.messages, activeTask, executionState.isRunning, scrollToBottom]);

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
		scrollToBottom();
		sendMessage(trimmed, {
			providerId: state.currentConfig.providerId,
			modelId: state.currentConfig.modelId || undefined,
			thinking: state.currentConfig.thinking,
			reasoningEffort: state.currentConfig.reasoningEffort,
			mode: state.currentConfig.mode,
		});
	}, [input, executionState.isRunning, state.currentConfig, sendMessage, dispatch, scrollToBottom]);

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
	// TASK EXECUTION PANEL (3-Phase Model)
	// ==========================================
	const taskIdRef = useRef(0);
	const planReasoningBuf = useRef("");
	const buildStepMap = useRef<Map<string, number>>(new Map());
	const hasSeenToolRef = useRef(false);
	const hasSeenTestRef = useRef(false);

	function newTaskExecution(id: number, promptText: string = ""): TaskDataV2 {
		const now = Date.now();
		return {
			schemaVersion: SCHEMA_VERSION,
			taskId: id,
			title: promptText.trim().slice(0, 45) || `Task #${id}`,
			startedAt: now,
			state: "planning",
			liveStatus: "Planning...",
			collapsed: false,
			phaseExpanded: { planning: true, building: true, testing: true },
			events: [
				{
					id: `evt-${now}-1`,
					sequence: 1,
					version: SCHEMA_VERSION,
					timestamp: now,
					startedAt: now,
					phase: "planning",
					eventType: "planning",
					status: "running",
					title: "Analyzing prompt & requirements",
					origin: "user",
					metadata: {
						planningDetails: {
							goal: promptText,
							approach: "Deconstruct goal, plan strategy, and execute building tasks",
						}
					}
				}
			]
		};
	}

	useEffect(() => {
		const unsubs: (() => void)[] = [];

		unsubs.push(AgentEventBus.subscribe("session_started", (data: any) => {
			activeSessionIdRef.current = data.sessionId;
			queueSaveExecutionData();
		}));

		unsubs.push(AgentEventBus.subscribe("session_hydrated", (data: any) => {
			activeSessionIdRef.current = data.sessionId;
			if (data.executionTasks && data.executionTasks.length > 0) {
				const restored = data.executionTasks.map((t: TaskDataV2) => {
					const task = { ...t };
					if (task.state === "planning" || task.state === "building" || task.state === "testing") {
						task.state = "interrupted";
						task.liveStatus = "Interrupted";
						task.interrupted = true;
						task.interruptedReason = "VSCode Reloaded";
					}
					return task;
				});
				setActiveTask(restored[0]);
				taskIdRef.current = restored[0]?.taskId || 0;
			}
			// Restore scroll position
			requestAnimationFrame(() => {
				const savedScroll = sessionStorage.getItem(`zenuxs-scroll-${data.sessionId}`);
				if (savedScroll && messagesContainerRef.current) {
					messagesContainerRef.current.scrollTop = parseInt(savedScroll, 10);
				}
			});
		}));

		unsubs.push(AgentEventBus.subscribe("user_message_sent", (data: any) => {
			taskIdRef.current++;
			planReasoningBuf.current = "";
			buildStepMap.current = new Map();
			hasSeenToolRef.current = false;
			hasSeenTestRef.current = false;
			setActiveTask(newTaskExecution(taskIdRef.current, data.text || ""));
		}));

		unsubs.push(AgentEventBus.subscribe("reasoning_delta", (data: { text: string }) => {
			planReasoningBuf.current += data.text;
			setActiveTask((prev: TaskDataV2 | null) => {
				if (!prev || prev.state !== "planning") return prev;
				const events = prev.events.map((e: TimelineEvent) => e.phase === "planning" ? { ...e, title: planReasoningBuf.current.slice(0, 100) } : e);
				return {
					...prev,
					liveStatus: "Planning...",
					events,
				};
			});
			queueSaveExecutionData();
		}));

		unsubs.push(AgentEventBus.subscribe("tool_event", (data: { text: string; event?: any }) => {
			const ev = data.event;
			if (!ev) return;
			const name = (ev.name || "").toLowerCase();
			const input = ev.input || {};
			const filePath = normalizePath(input.filePath || input.path || input.TargetFile || input.AbsolutePath || "");
			const cmd = input.command || input.commands || "";
			const cwd = input.cwd || input.Cwd || "workspace";

			let eventType: TimelineEvent["eventType"] = "tool";
			let phase: TimelineEvent["phase"] = "building";
			let title = "";

			if (name.includes("read")) { eventType = "reading"; title = `Reading ${filePath || "file"}`; }
			else if (name.includes("write") || name.includes("create")) { eventType = "writing"; title = `Writing ${filePath || "file"}`; }
			else if (name.includes("edit") || name.includes("replace") || name.includes("patch")) { eventType = "editing"; title = `Editing ${filePath || "file"}`; }
			else if (name.includes("bash") || name.includes("shell") || name.includes("exec") || name === "run") { eventType = "command"; title = `Executing Command`; }
			else if (name.includes("test")) { eventType = "testing"; phase = "testing"; title = `Running test`; }
			else { eventType = "tool"; title = ev.name || "Executing tool"; }

			setActiveTask((prev: TaskDataV2 | null) => {
				if (!prev) return prev;
				const events = [...prev.events];
				const eventId = ev.id || `${name}-${events.length}`;
				const existingIdx = events.findIndex((e: TimelineEvent) => e.id === eventId);
				const now = Date.now();

				if (ev.state === "running") {
					if (existingIdx !== -1) {
						events[existingIdx] = { ...events[existingIdx], status: "running" };
					} else {
						events.push({
							id: eventId,
							sequence: events.length + 1,
							version: SCHEMA_VERSION,
							timestamp: now,
							startedAt: now,
							phase,
							eventType,
							status: "running",
							title,
							origin: "tool",
							metadata: {
								cwd,
								command: cmd || undefined,
								filePath: filePath || undefined,
								stdout: data.text,
							}
						});
					}
				} else if (ev.state === "completed" || ev.state === "output-available") {
					if (existingIdx !== -1) {
						const output = ev.output || {};
						const outputText = typeof output === "string" ? output : output.output || output.result || "";
						events[existingIdx] = {
							...events[existingIdx],
							status: "completed",
							finishedAt: now,
							duration: now - events[existingIdx].startedAt,
							metadata: {
								...events[existingIdx].metadata,
								stdout: outputText || events[existingIdx].metadata?.stdout,
							}
						};
					}
				} else if (ev.state === "failed" || ev.state === "output-error") {
					if (existingIdx !== -1) {
						events[existingIdx] = {
							...events[existingIdx],
							status: "failed",
							finishedAt: now,
							metadata: {
								...events[existingIdx].metadata,
								stderr: ev.error || "Failed",
							}
						};
					}
				}

				const nextState = phase === "testing" ? "testing" : "building";
				return {
					...prev,
					state: nextState,
					liveStatus: `${nextState.charAt(0).toUpperCase() + nextState.slice(1)}...`,
					events,
				};
			});
			queueSaveExecutionData();
		}));

		unsubs.push(AgentEventBus.subscribe("turn_done", (data: any) => {
			setActiveTask((prev: TaskDataV2 | null) => {
				if (!prev) return prev;
				const created: string[] = [];
				const modified: string[] = [];
				let commandsExecuted = 0;

				for (const evt of prev.events) {
					if (evt.status !== "completed") continue;
					if (evt.metadata?.filePath && (evt.eventType === "writing")) created.push(evt.metadata.filePath);
					if (evt.metadata?.filePath && (evt.eventType === "editing")) modified.push(evt.metadata.filePath);
					if (evt.eventType === "command") commandsExecuted++;
				}

				const isCancelled = data.finishReason === "aborted" || data.finishReason === "cancelled";
				const durationMs = Date.now() - prev.startedAt;
				const finalState: TaskFsmState = isCancelled ? "cancelled" : "completed";

				const updatedEvents = prev.events.map((e: TimelineEvent) => e.status === "running" ? { ...e, status: isCancelled ? ("cancelled" as const) : ("completed" as const), finishedAt: Date.now() } : e);

				return {
					...prev,
					state: finalState,
					liveStatus: isCancelled ? "Cancelled" : "Completed",
					finishedAt: Date.now(),
					events: updatedEvents,
					summary: {
						overview: isCancelled ? "Task cancelled by user" : "Task completed successfully",
						purpose: prev.title,
						completedFeatures: [prev.title],
						warnings: [],
						errors: [],
						filesChanged: created.length + modified.length,
						commandsExecuted,
						testsPassed: updatedEvents.filter(e => e.phase === "testing" && e.status === "completed").length,
						durationMs,
						tokensUsed: executionState.inputTokens + executionState.outputTokens,
						cost: executionState.totalCost,
						finalStatus: isCancelled ? "Cancelled" : "Completed",
					},
					fileChanges: {
						created,
						modified,
						deleted: [],
						renamed: [],
					}
				};
			});
			setTimeout(() => queueSaveExecutionData(), 0);
			if (activeSessionIdRef.current && messagesContainerRef.current) {
				sessionStorage.setItem(
					`zenuxs-scroll-${activeSessionIdRef.current}`,
					String(messagesContainerRef.current.scrollTop)
				);
			}
		}));

		unsubs.push(AgentEventBus.subscribe("reset_done", () => {
			// Save final state before clearing
			setTimeout(() => queueSaveExecutionData(), 0);
			setActiveTask(null);
			taskIdRef.current = 0;
			planReasoningBuf.current = "";
			buildStepMap.current = new Map();
			hasSeenToolRef.current = false;
			hasSeenTestRef.current = false;
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

	function getCollapsedStatusText(task: TaskDataV2): string {
		return task.liveStatus;
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



			<div className="messages-container" id="chat-messages" ref={messagesContainerRef} onScroll={handleScroll} role="log" aria-label="Messages" aria-live="polite">
				{activeTask && <StickyActivityBar task={activeTask} />}
				{!activeTask && timelineState.messages.length === 0 && !executionState.isRunning && (
					<div className="welcome-placeholder">
						{(window as any).logoUri ? (
							<img className="welcome-icon" src={(window as any).logoUri} alt="Logo" />
						) : (
							<div className="welcome-icon">Z</div>
						)}
						<h2>Zenuxs AI</h2>
						{state.sessionHistories.length > 0 && (
							<div className="welcome-recent-sessions">
								<p className="welcome-recent-label">Recent sessions</p>
								{state.sessionHistories.slice(0, 5).map((s) => (
									<button
										className="recent-chat-item"
										key={s.sessionId}
										onClick={() => restoreSession(s.sessionId)}
										type="button"
									>
										<span className="welcome-session-title">
											{s.metadata?.title || s.prompt?.slice(0, 60) || s.sessionId.slice(0, 12)}
										</span>
										<span className="welcome-session-meta">
											{s.provider || ""}{s.model ? ` / ${s.model}` : ""}
										</span>
									</button>
								))}
							</div>
						)}
					</div>
				)}

				{/* Chat Messages */}
				{timelineState.messages.length > 0 && (
					<div className="chat-messages-list">
						{timelineState.messages.map((msg, idx) => {
							const isUser = msg.role === "user";
							const isAssistant = msg.role === "assistant";
							const isError = msg.role === "error";
							const isEditing = editingIndex === idx;
							const isLastMessage = idx === timelineState.messages.length - 1;
							const isStreamingThis = isAssistant && isLastMessage && executionState.isRunning;

							return (
								<div key={idx} className={`message ${isUser ? "user" : isAssistant ? "assistant" : isError ? "error" : ""}`}>
									<div className="message-header">
										<span className="brand-zenuxs">{isUser ? "You" : "Zenuxs AI"}</span>
										<div className="message-actions">
											{isAssistant && !isEditing && (
												<button className="msg-action-btn" onClick={() => copyMessage(msg.text)} title="Copy">
													<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
												</button>
											)}
											{!isError && !isEditing && (
												<button className="msg-action-btn" onClick={() => startEdit(idx, msg.text)} title="Edit">
													<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
												</button>
											)}
										</div>
									</div>
									{isEditing ? (
										<div className="edit-box">
											<textarea value={editText} onChange={(e) => setEditText(e.target.value)} />
											<div className="edit-actions">
												<button className="btn sm" onClick={submitEdit}>Save & Resend</button>
												<button className="btn secondary sm" onClick={cancelEdit}>Cancel</button>
											</div>
										</div>
									) : (
										<>
											<div className="message-text">
												<MarkdownBlock markdown={msg.text} />
												{isStreamingThis && <span className="streaming-cursor" aria-hidden="true" />}
											</div>
											{(msg as any).reasoning ? (
												<div className="reasoning-block">
													<div className="reasoning-header" onClick={(e) => { const el = e.currentTarget.nextElementSibling as HTMLElement | null; if (el) el.style.display = el.style.display === "none" ? "block" : "none"; }}>
														<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
														Reasoning
													</div>
													<div className="reasoning-content" style={{ display: "none" }}>{(msg as any).reasoning}</div>
												</div>
											) : null}
										</>
									)}
								</div>
							);
						})}
					</div>
				)}

				{/* TASK EXECUTION PANEL */}
				{activeTask && (
					<TaskExecutionPanel
						task={activeTask}
						onToggleCollapse={() => setActiveTask(prev => prev ? { ...prev, collapsed: !prev.collapsed } : prev)}
						onStop={abort}
						onNewTask={() => dispatch({ type: "RESET_SESSION" })}
					/>
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

				{showScrollBottomBtn && (
					<button className="scroll-to-bottom-btn" onClick={() => scrollToBottom()} title="Scroll to bottom" aria-label="Scroll to bottom">
						↓ Scroll to bottom
					</button>
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
// TASK EXECUTION PANEL (FSM + Component Architecture)
// ==========================================

function StickyActivityBar({ task }: { task: TaskDataV2 }) {
	if (task.state === "completed" || task.state === "cancelled" || task.state === "interrupted") return null;
	const runningEvt = [...task.events].reverse().find(e => e.status === "running");
	return (
		<div className="sticky-activity-bar">
			<div className="sticky-activity-title">
				<span className="dot-pulse" />
				<span>{runningEvt ? runningEvt.title : `${task.state}...`}</span>
			</div>
			<span style={{ fontSize: "0.78em", color: "var(--muted)" }}>Task #{task.taskId}</span>
		</div>
	);
}

function TaskExecutionPanel({ task, onToggleCollapse, onStop, onNewTask }: {
	task: TaskDataV2;
	onToggleCollapse: () => void;
	onStop: () => void;
	onNewTask: () => void;
}) {
	const isCompleted = task.state === "completed";
	const isCancelled = task.state === "cancelled";
	const isInterrupted = task.state === "interrupted";
	const isRunning = task.state === "planning" || task.state === "building" || task.state === "testing";

	const [expandedPhases, setExpandedPhases] = useState({
		planning: task.phaseExpanded?.planning ?? true,
		building: task.phaseExpanded?.building ?? true,
		testing: task.phaseExpanded?.testing ?? true,
	});

	const togglePhase = (phase: "planning" | "building" | "testing") => {
		setExpandedPhases(prev => ({ ...prev, [phase]: !prev[phase] }));
	};

	return (
		<div className={`exec-panel ${task.collapsed ? "collapsed" : ""} ${task.state}`}>
			<TaskHeader task={task} onToggleCollapse={onToggleCollapse} onStop={onStop} />

			{!task.collapsed && (
				<div className="exec-body">
					{/* 1. PLANNING PANEL */}
					<PlanningPanel
						events={task.events}
						expanded={expandedPhases.planning}
						onToggle={() => togglePhase("planning")}
					/>

					{/* 2. BUILDING PANEL */}
					<BuildingPanel
						events={task.events}
						expanded={expandedPhases.building}
						onToggle={() => togglePhase("building")}
					/>

					{/* 3. TESTING PANEL */}
					<TestingPanel
						events={task.events}
						expanded={expandedPhases.testing}
						onToggle={() => togglePhase("testing")}
					/>

					{/* SUMMARY CARD */}
					{task.summary && (
						<SummaryCard summary={task.summary} taskId={task.taskId} />
					)}

					{/* VIEW CHANGES */}
					{task.fileChanges && (
						<ViewChangesPanel fileChanges={task.fileChanges} />
					)}

					{/* CANCELLED / INTERRUPTED BLOCK */}
					{(isCancelled || isInterrupted) && (
						<div className="exec-cancelled-block">
							{isInterrupted ? (
								<>
									<div className="cancelled-title">⚠ Task Interrupted</div>
									<div className="cancelled-before">{task.interruptedReason || "VSCode Reloaded"}</div>
								</>
							) : (
								<div className="cancelled-title">Task Cancelled</div>
							)}
							<button className="exec-new-task-btn" onClick={onNewTask}>Start New Task</button>
						</div>
					)}

					{/* COMPLETED BLOCK */}
					{isCompleted && (
						<button className="exec-new-task-btn" onClick={onNewTask}>Start New Task</button>
					)}
				</div>
			)}
		</div>
	);
}

function TaskHeader({ task, onToggleCollapse, onStop }: { task: TaskDataV2; onToggleCollapse: () => void; onStop: () => void }) {
	const isRunning = task.state === "planning" || task.state === "building" || task.state === "testing";
	const completedEventsCount = task.events.filter(e => e.status === "completed").length;
	const totalEventsCount = task.events.length;
	const startTimeStr = new Date(task.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

	return (
		<div className="exec-header" onClick={onToggleCollapse}>
			<span className="exec-toggle">{task.collapsed ? "▶" : "▼"}</span>
			<span className="exec-task-id">Task #{task.taskId} • {task.title}</span>
			{task.collapsed && (
				<span className="exec-live-status">
					{task.state === "planning" && <AnimatedDots text="Planning" />}
					{task.state === "building" && <span style={{ color: "#fff" }}>Building • {completedEventsCount} / {totalEventsCount}</span>}
					{task.state === "testing" && <AnimatedDots text="Testing" />}
					{task.state === "completed" && <span className="exec-status-done">Completed ✓</span>}
					{task.state === "cancelled" && <span className="exec-status-cancelled">Cancelled</span>}
					{task.state === "interrupted" && <span className="exec-status-interrupted">⚠ Interrupted</span>}
				</span>
			)}
			{isRunning && (
				<button className="exec-stop-btn" onClick={(e) => { e.stopPropagation(); onStop(); }} title="Stop execution" type="button">
					🛑 Stop
				</button>
			)}
		</div>
	);
}

function PlanningPanel({ events, expanded, onToggle }: { events: TimelineEvent[]; expanded: boolean; onToggle: () => void }) {
	const planningEvents = events.filter(e => e.phase === "planning");
	const isDone = planningEvents.some(e => e.status === "completed") || events.some(e => e.phase === "building" || e.phase === "testing");
	const isRunning = !isDone && planningEvents.some(e => e.status === "running");

	return (
		<div className={`phase-section ${isRunning ? "running" : isDone ? "completed" : "pending"}`}>
			<div className="phase-header" onClick={onToggle}>
				<span className="phase-icon">{isRunning ? <span className="dot-pulse" /> : isDone ? "✓" : "○"}</span>
				<span className={`phase-label ${isRunning ? "running thinking-text-shimmer" : isDone ? "done" : "pending"}`}>
					{isRunning ? "Planning..." : isDone ? "Planning ✓" : "Planning"}
				</span>
				<span className="phase-expand">{expanded ? "▾" : "▸"}</span>
			</div>
			{expanded && (
				<div className="phase-body">
					{planningEvents.map(evt => (
						<div key={evt.id} style={{ display: "flex", flexDirection: "column", gap: 4, margin: "2px 0" }}>
							{evt.metadata?.planningDetails?.goal && (
								<div style={{ fontSize: "0.82em", color: "#fff" }}><strong>Goal:</strong> {evt.metadata.planningDetails.goal}</div>
							)}
							{evt.metadata?.planningDetails?.approach && (
								<div style={{ fontSize: "0.82em", color: "var(--muted)" }}><strong>Approach:</strong> {evt.metadata.planningDetails.approach}</div>
							)}
							<div className="phase-reasoning">{evt.title}</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

function BuildingPanel({ events, expanded, onToggle }: { events: TimelineEvent[]; expanded: boolean; onToggle: () => void }) {
	const buildingEvents = events.filter(e => e.phase === "building");
	const completedCount = buildingEvents.filter(e => e.status === "completed").length;
	const totalCount = buildingEvents.length;
	const isDone = buildingEvents.length > 0 && buildingEvents.every(e => e.status === "completed" || e.status === "failed");
	const isRunning = buildingEvents.some(e => e.status === "running");

	return (
		<div className={`phase-section ${isRunning ? "running" : isDone ? "completed" : "pending"}`}>
			<div className="phase-header" onClick={onToggle}>
				<span className="phase-icon">{isRunning ? <span className="dot-pulse" /> : isDone ? "✓" : "○"}</span>
				<span className={`phase-label ${isRunning ? "running thinking-text-shimmer" : isDone ? "done" : "pending"}`}>
					Building {totalCount > 0 ? `• ${completedCount} / ${totalCount}` : ""}
				</span>
				<span className="phase-expand">{expanded ? "▾" : "▸"}</span>
			</div>
			{expanded && (
				<div className="phase-body">
					<div className="vertical-timeline">
						{buildingEvents.map(evt => (
							<TimelineEventRow key={evt.id} event={evt} />
						))}
					</div>
				</div>
			)}
		</div>
	);
}

function TimelineEventRow({ event }: { event: TimelineEvent }) {
	const isCommand = event.eventType === "command";
	return (
		<div className={`vertical-timeline-item ${event.status}`}>
			<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
				<span style={{ fontSize: "0.82em", color: event.status === "failed" ? "var(--error)" : "#fff", fontWeight: 500 }}>
					{event.title}
				</span>
				{event.metadata?.filePath && (
					<span className="step-path">{event.metadata.filePath}</span>
				)}
			</div>
			{isCommand && (
				<CommandCard metadata={event.metadata} status={event.status} durationMs={event.duration} />
			)}
		</div>
	);
}

function CommandCard({ metadata, status, durationMs }: { metadata?: TimelineEvent["metadata"]; status: string; durationMs?: number }) {
	if (!metadata) return null;
	const durationStr = durationMs ? `${(durationMs / 1000).toFixed(1)}s` : undefined;
	return (
		<div className="command-card">
			<div className="command-card-header">
				<span className="command-card-cwd">📂 {metadata.cwd || "."}</span>
				{durationStr && <span>⏱ {durationStr}</span>}
				{metadata.exitCode !== undefined && <span>Exit: {metadata.exitCode}</span>}
			</div>
			{metadata.command && (
				<div className="command-card-cmd">$ {metadata.command}</div>
			)}
			{metadata.stdout && (
				<div className="command-card-stream">{metadata.stdout}</div>
			)}
			{metadata.stderr && (
				<div className="command-card-stderr">ERR: {metadata.stderr}</div>
			)}
		</div>
	);
}

function TestingPanel({ events, expanded, onToggle }: { events: TimelineEvent[]; expanded: boolean; onToggle: () => void }) {
	const testEvents = events.filter(e => e.phase === "testing" || e.eventType === "testing");
	const isDone = testEvents.length > 0 && testEvents.every(e => e.status === "completed" || e.status === "failed");
	const isRunning = testEvents.some(e => e.status === "running");

	return (
		<div className={`phase-section ${isRunning ? "running" : isDone ? "completed" : "pending"}`}>
			<div className="phase-header" onClick={onToggle}>
				<span className="phase-icon">{isRunning ? <span className="dot-pulse" /> : isDone ? "✓" : "○"}</span>
				<span className={`phase-label ${isRunning ? "running thinking-text-shimmer" : isDone ? "done" : "pending"}`}>
					Testing {testEvents.length > 0 ? `(${testEvents.filter(e=>e.status==="completed").length}/${testEvents.length})` : ""}
				</span>
				<span className="phase-expand">{expanded ? "▾" : "▸"}</span>
			</div>
			{expanded && (
				<div className="phase-body">
					{testEvents.length > 0 ? (
						<div className="test-results">
							{testEvents.map(t => (
								<div key={t.id} className={`test-row ${t.status}`}>
									<span className="test-icon">{t.status === "running" ? <span className="dot-pulse" /> : t.status === "completed" ? "✓" : "✗"}</span>
									<span className="test-name">{t.title}</span>
									{t.description && <span className="test-detail">{t.description}</span>}
								</div>
							))}
						</div>
					) : (
						<div className="phase-pending-row"><span className="phase-pending-dot">○</span> No active tests</div>
					)}
				</div>
			)}
		</div>
	);
}

function SummaryCard({ summary, taskId }: { summary: TaskSummaryV2; taskId: number }) {
	const durationStr = summary.durationMs >= 60000
		? `${Math.floor(summary.durationMs / 60000)}m ${Math.floor((summary.durationMs % 60000) / 1000)}s`
		: `${Math.floor(summary.durationMs / 1000)}s`;

	return (
		<div className="exec-summary">
			<div className="summary-title-row">
				<span className="summary-check">✓</span>
				<span className="summary-title-text">Task #{taskId} Completed</span>
			</div>
			<div className="summary-stats">
				<div className="summary-stat"><span>Files Changed</span><span>{summary.filesChanged}</span></div>
				<div className="summary-stat"><span>Commands Executed</span><span>{summary.commandsExecuted}</span></div>
				<div className="summary-stat"><span>Tests Passed</span><span>{summary.testsPassed}</span></div>
				<div className="summary-stat"><span>Duration</span><span>{durationStr}</span></div>
				<div className="summary-stat"><span>Tokens</span><span>{(summary.tokensUsed / 1000).toFixed(1)}k</span></div>
				<div className="summary-stat"><span>Cost</span><span>${summary.cost.toFixed(4)}</span></div>
			</div>
		</div>
	);
}

function ViewChangesPanel({ fileChanges }: { fileChanges: FileChangesV2 }) {
	const [showChanges, setShowChanges] = useState(false);
	const [expandedFile, setExpandedFile] = useState<string | null>(null);

	const renderGroup = (label: string, files: string[], icon: string, cls: string) => {
		if (files.length === 0) return null;
		return (
			<div className="changes-group">
				<div className="changes-group-label">{label}</div>
				{files.map(f => (
					<div key={f} className="changes-file-row" onClick={() => setExpandedFile(expandedFile === f ? null : f)}>
						<span className={`changes-file-icon ${cls}`}>{icon}</span>
						<span className="changes-file-path">{f}</span>
						<span className="changes-expand">{expandedFile === f ? "▾" : "▸"}</span>
					</div>
				))}
			</div>
		);
	};

	const hasFiles = fileChanges.created.length > 0 || fileChanges.modified.length > 0 || fileChanges.deleted.length > 0;
	if (!hasFiles) return null;

	return (
		<div className="exec-summary" style={{ marginTop: 4 }}>
			<button className="summary-changes-btn" onClick={() => setShowChanges(!showChanges)}>
				{showChanges ? "▾" : "▸"} View Changes
			</button>
			{showChanges && (
				<div className="view-changes-panel">
					{renderGroup("Created", fileChanges.created, "+", "created")}
					{renderGroup("Modified", fileChanges.modified, "~", "modified")}
					{renderGroup("Deleted", fileChanges.deleted, "-", "deleted")}
				</div>
			)}
		</div>
	);
}

function AnimatedDots({ text }: { text: string }) {
	const [dots, setDots] = useState(0);
	useEffect(() => {
		const interval = setInterval(() => setDots(d => (d + 1) % 4), 450);
		return () => clearInterval(interval);
	}, []);
	return <>{text}{".".repeat(dots)}</>;
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
