import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useExtensionState } from "../context/ExtensionStateContext.js";
import { MarkdownBlock } from "./common/MarkdownBlock.js";
import { TaskCompletionBlock } from "./TaskCompletionBlock.js";
import type { AgentMode, TaskDataV2, TaskFsmState, TimelineEvent, TaskSummaryV2, FileChangesV2, PersistedTaskExecution, ProviderModel } from "../types.js";
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
		renameSession,
		newSession 
	} = useExtensionState();

	// Observe decoupled stores
	const sessionState = useStore(SessionStore);
	const timelineState = useStore(TimelineStore);
	const executionState = useStore(ExecutionStore);
	const toolExecutionState = useStore(ToolExecutionStore);
	const isExecutionActive = executionState.isRunning || state.isRunning;
	const lastMsg = timelineState.messages.length > 0 ? timelineState.messages[timelineState.messages.length - 1] : undefined;
	const isTaskCompleted = lastMsg?.role === "completion";

	const [input, setInput] = useState("");
	const [autocompleteVisible, setAutocompleteVisible] = useState(false);
	const [autocompleteIdx, setAutocompleteIdx] = useState(-1);
	const [editingIndex, setEditingIndex] = useState<number | null>(null);
	const [editText, setEditText] = useState("");
	const [showModeMenu, setShowModeMenu] = useState(false);
	const [showModelMenu, setShowModelMenu] = useState(false);
	const [modelSearchQuery, setModelSearchQuery] = useState("");

	const inputRef = useRef<HTMLTextAreaElement>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const messagesContainerRef = useRef<HTMLDivElement>(null);
	const executionStateRef = useRef(executionState);
	executionStateRef.current = executionState;

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
		if (showModelMenu) setModelSearchQuery("");
	}, [showModelMenu]);

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

	// Model context window lookup — updates ExecutionStore with real model capacity
	const getModelContextWindow = useCallback((providerId: string, modelId: string): number => {
		const cleanId = modelId.split("/").pop() || modelId;
		const known: Record<string, number> = {
			"gpt-5.5": 1_050_000, "gpt-5.4": 1_050_000, "gpt-5.4-mini": 400_000,
			"gpt-5.3": 1_050_000, "gpt-5.3-codex": 200_000, "gpt-5.2": 1_050_000,
			"gpt-5.1": 1_050_000, "gpt-5": 1_050_000,
			"claude-3-5-sonnet": 200_000, "claude-3-7-sonnet": 200_000,
			"claude-3-5-haiku": 200_000, "claude-3-opus": 200_000,
			"gpt-4o": 128_000, "gpt-4o-mini": 128_000, "o1": 200_000, "o3-mini": 200_000,
			"gemini-3.1-flash": 1_048_576, "gemini-3.1-flash-lite": 1_048_576,
			"gemini-3.1-pro": 1_048_576, "gemini-2.5-pro": 1_048_576,
			"gemini-2.5-flash": 1_048_576, "gemini-2.0-flash": 1_048_576,
			"deepseek-v4-flash": 1_000_000, "deepseek-v4-pro": 1_000_000,
			"deepseek-v4-flash-free": 128_000, "deepseek-v3": 64_000,
		};
		for (const [key, val] of Object.entries(known)) {
			if (cleanId.toLowerCase().includes(key.toLowerCase())) return val;
		}
		if (providerId.includes("openai")) return 128_000;
		if (providerId.includes("anthropic") || providerId === "cline") return 200_000;
		if (providerId.includes("gemini") || providerId === "google") return 1_048_576;
		if (providerId.includes("deepseek")) return 1_000_000;
		return 128_000;
	}, []);

	useEffect(() => {
		const pid = state.currentConfig.providerId;
		const mid = state.currentConfig.modelId;
		const ctx = getModelContextWindow(pid, mid);
		if (executionState.contextMaxTokens !== ctx) {
			ExecutionStore.updateContextWindow(ctx);
		}
	}, [state.currentConfig.providerId, state.currentConfig.modelId, getModelContextWindow]);

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

	const handleSend = useCallback(() => {
		const trimmed = input.trim();
		if (!trimmed || isExecutionActive) return;

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
	}, [input, isExecutionActive, state.currentConfig, sendMessage, dispatch, scrollToBottom]);

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
			if (e.key === "Escape" && isExecutionActive) {
				e.preventDefault();
				abort();
				return;
			}
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				if (!isExecutionActive) {
					handleSend();
				}
			}
		},
		[input, autocompleteVisible, autocompleteIdx, handleSend, isExecutionActive, abort],
	);

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
	const rawModels: ProviderModel[] = state.models[providerId] || [];
	const availableModels = rawModels.length > 0 ? rawModels : [{ id: "default", name: "Default" }];

	const filteredModels = useMemo(() => {
		if (!modelSearchQuery) return availableModels;
		const q = modelSearchQuery.toLowerCase();
		return availableModels.filter((m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q));
	}, [availableModels, modelSearchQuery]);

	const groupedModels = useMemo(() => {
		const groups: { label: string; key: string; models: ProviderModel[] }[] = [];
		const fav = filteredModels.filter((m) => m.isFavorite);
		if (fav.length > 0) groups.push({ label: "Favorites", key: "favorites", models: fav });
		const rec = filteredModels.filter((m) => m.category === "recommended" && !m.isFavorite);
		if (rec.length > 0) groups.push({ label: "Recommended", key: "recommended", models: rec });
		const free = filteredModels.filter((m) => m.category === "free" && !m.isFavorite);
		if (free.length > 0) groups.push({ label: "Free", key: "free", models: free });
		const paid = filteredModels.filter((m) => m.category === "paid" && !m.isFavorite);
		if (paid.length > 0) groups.push({ label: "Paid", key: "paid", models: paid });
		const other = filteredModels.filter((m) => !m.category && !m.isFavorite);
		if (other.length > 0) groups.push({ label: "Other", key: "other", models: other });
		return groups;
	}, [filteredModels]);

	// ==========================================
	// TASK MANAGEMENT: auto-create on tool use, no fixed phases
	// ==========================================
	const taskIdRef = useRef(0);

	function newTaskExecution(id: number): TaskDataV2 {
		const now = Date.now();
		return {
			schemaVersion: SCHEMA_VERSION,
			taskId: id,
			title: `Task #${id}`,
			startedAt: now,
			state: "running",
			liveStatus: "Running...",
			collapsed: false,
			events: [],
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
					if (task.state === "running" || task.state === "idle") {
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
			requestAnimationFrame(() => {
				const savedScroll = sessionStorage.getItem(`zenuxs-scroll-${data.sessionId}`);
				if (savedScroll && messagesContainerRef.current) {
					messagesContainerRef.current.scrollTop = parseInt(savedScroll, 10);
				}
			});
		}));

		// Create task on first tool event of a user turn
		unsubs.push(AgentEventBus.subscribe("tool_event", (data: { text: string; event?: any }) => {
			const ev = data.event;
			if (!ev) return;

			const name = (ev.name || "").toLowerCase();
			const input = ev.input || {};
			const filePath = normalizePath(input.filePath || input.path || input.TargetFile || input.AbsolutePath || "");
			const cmd = input.command || input.commands || "";
			const cwd = input.cwd || input.Cwd || "workspace";

			let eventType: TimelineEvent["eventType"] = "tool";
			let title = "";

			if (name.includes("read")) { eventType = "reading"; title = `Reading ${filePath || "file"}`; }
			else if (name.includes("write") || name.includes("create")) { eventType = "writing"; title = `Writing ${filePath || "file"}`; }
			else if (name.includes("edit") || name.includes("replace") || name.includes("patch")) { eventType = "editing"; title = `Editing ${filePath || "file"}`; }
			else if (name.includes("bash") || name.includes("shell") || name.includes("exec") || name === "run") { eventType = "command"; title = `Executing Command`; }
			else if (name.includes("test")) { eventType = "testing"; title = `Running test`; }
			else { eventType = "tool"; title = ev.name || "Executing tool"; }

			setActiveTask((prev: TaskDataV2 | null) => {
				const now = Date.now();

				// Auto-create task if no active task exists
				if (!prev) {
					taskIdRef.current++;
					const newTask: TaskDataV2 = {
						schemaVersion: SCHEMA_VERSION,
						taskId: taskIdRef.current,
						title: `Task #${taskIdRef.current}`,
						startedAt: now,
						state: "running",
						liveStatus: "Running...",
						collapsed: false,
						events: [{
							id: ev.id || `evt-${now}-0`,
							sequence: 1,
							version: SCHEMA_VERSION,
							timestamp: now,
							startedAt: now,
							phase: "execution",
							eventType,
							status: ev.state === "running" ? "running" : "completed",
							title,
							origin: "tool",
							metadata: {
								cwd,
								command: cmd || undefined,
								filePath: filePath || undefined,
								stdout: data.text,
							}
						}]
					};
					return newTask;
				}

				// Update existing task
				const events = [...prev.events];
				const eventId = ev.id || `${name}-${events.length}`;
				const existingIdx = events.findIndex((e: TimelineEvent) => e.id === eventId);

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
							phase: "execution",
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

				return {
					...prev,
					state: "running",
					liveStatus: "Running...",
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
						testsPassed: updatedEvents.filter(e => e.eventType === "testing" && e.status === "completed").length,
						durationMs,
						tokensUsed: executionStateRef.current.inputTokens + executionStateRef.current.outputTokens,
						cost: executionStateRef.current.totalCost,
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
			setTimeout(() => queueSaveExecutionData(), 0);
			setActiveTask(null);
			taskIdRef.current = 0;
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
							if (msg.role === "completion") {
								return <TaskCompletionBlock key={idx} metadata={msg.completionMetadata} text={msg.text} />;
							}

							const isUser = msg.role === "user";
							const isAssistant = msg.role === "assistant";
							const isError = msg.role === "error";
							const isEditing = editingIndex === idx;
							const isLastMessage = idx === timelineState.messages.length - 1;
							const isStreamingThis = isAssistant && isLastMessage && isExecutionActive;

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
												<div className={`reasoning-block ${isStreamingThis ? "reasoning-live" : ""}`}>
													<div className="reasoning-header" onClick={(e) => { const el = e.currentTarget.nextElementSibling as HTMLElement | null; if (el) { el.style.display = el.style.display === "none" ? "block" : "none"; } }}>
														<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
														Reasoning
													</div>
													<div className="reasoning-content" style={{ display: isStreamingThis ? "block" : "none" }}><MarkdownBlock markdown={(msg as any).reasoning} /></div>
												</div>
											) : null}
										</>
									)}
								</div>
							);
						})}

						{/* Thinking Animation — shown when model is thinking before any response text */}
						{isExecutionActive && executionState.status === "thinking" && 
						 timelineState.messages.length > 0 && 
						 timelineState.messages[timelineState.messages.length - 1].role === "user" && (
							<div key="thinking-block" className="message assistant" style={{ padding: "8px 12px 4px" }}>
								<ThinkingAnimation />
							</div>
						)}
					</div>
				)}

				{activeTask && (
					<TaskExecutionPanel
						task={activeTask}
						onToggleCollapse={() => setActiveTask(prev => prev ? { ...prev, collapsed: !prev.collapsed } : prev)}
						onStop={abort}
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
				{isTaskCompleted && (
					<div className="task-completed-banner">
						<button className="start-new-task-btn" onClick={() => newSession()}>
							<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
								<line x1="12" y1="5" x2="12" y2="19" />
								<line x1="5" y1="12" x2="19" y2="12" />
							</svg>
							<span>Start New Task</span>
						</button>
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
								<div className="model-dropdown enhanced">
									<div className="model-search-wrapper">
										<input
											className="model-search-input"
											type="text"
											placeholder="Search models..."
											value={modelSearchQuery}
											onChange={(e) => setModelSearchQuery(e.target.value)}
											onClick={(e) => e.stopPropagation()}
											autoFocus
										/>
									</div>
									<div className="model-dropdown-items">
										{groupedModels.length === 0 ? (
											<div className="model-dropdown-empty">No models match</div>
										) : (
											groupedModels.map((group) => (
												<div key={group.key}>
													<div className="model-group-header">{group.label}</div>
													{group.models.map((m) => (
														<div
															key={m.id}
															className={`model-dropdown-item ${activeModel === m.id ? "active" : ""}`}
															onClick={() => selectModel(m.id)}
															title={m.id}
														>
															<span className="model-item-name">{m.name}</span>
															<span className="model-item-badges">
																{m.supportsReasoning && <span className="model-badge reasoning">R</span>}
																{m.supportsVision && <span className="model-badge vision">V</span>}
																{m.supportsAttachments && <span className="model-badge files">F</span>}
																{m.contextWindow && <span className="model-badge ctx">{(m.contextWindow / 1000).toFixed(0)}K</span>}
															</span>
														</div>
													))}
												</div>
											))
										)}
									</div>
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
					<button
						className={`send-icon-btn ${isExecutionActive ? "stop" : ""}`}
						disabled={!isExecutionActive && !input.trim()}
						onClick={isExecutionActive ? abort : handleSend}
						title={isExecutionActive ? "Stop (Esc)" : "Send (Enter)"}
						aria-label={isExecutionActive ? "Stop execution" : "Send message"}
					>
						{isExecutionActive ? (
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
// TASK EXECUTION PANEL (flat event timeline, no fixed phases)
// ==========================================

function TaskExecutionPanel({ task, onToggleCollapse, onStop }: {
	task: TaskDataV2;
	onToggleCollapse: () => void;
	onStop: () => void;
}) {
	const isCompleted = task.state === "completed";
	const isCancelled = task.state === "cancelled";
	const isInterrupted = task.state === "interrupted";
	const isRunning = task.state === "running";
	const completedEvents = task.events.filter(e => e.status === "completed" || e.status === "failed");

	return (
		<div className={`exec-panel ${task.collapsed ? "collapsed" : ""} ${task.state}`}>
			<TaskHeader task={task} onToggleCollapse={onToggleCollapse} onStop={onStop} />

			{!task.collapsed && (
				<div className="exec-body">
					{/* Event Timeline */}
					{task.events.length > 0 && (
						<div className="vertical-timeline">
							{task.events.map(evt => (
								<ExecEventRow key={evt.id} event={evt} />
							))}
						</div>
					)}
					{isRunning && task.events.length === 0 && (
						<div className="phase-pending-row"><span className="dot-pulse" /> Working...</div>
					)}

					{/* SUMMARY CARD */}
					{task.summary && (
						<SummaryCard summary={task.summary} taskId={task.taskId} />
					)}

					{/* VIEW CHANGES */}
					{task.fileChanges && (
						<ViewChangesPanel fileChanges={task.fileChanges} />
					)}

					{/* CANCELLED / INTERRUPTED */}
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
						</div>
					)}

					{/* COMPLETED — simple indicator, no button */}
					{isCompleted && (
						<div className="exec-completed-indicator">✓ Task Completed</div>
					)}
				</div>
			)}
		</div>
	);
}

function TaskHeader({ task, onToggleCollapse, onStop }: { task: TaskDataV2; onToggleCollapse: () => void; onStop: () => void }) {
	const isRunning = task.state === "running";
	const completedEventsCount = task.events.filter(e => e.status === "completed").length;
	const totalEventsCount = task.events.length;
	const startTimeStr = new Date(task.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

	return (
		<div className="exec-header" onClick={onToggleCollapse}>
			<span className="exec-toggle">{task.collapsed ? "▶" : "▼"}</span>
			<span className="exec-task-id">Task #{task.taskId} • {task.title}</span>
			{task.collapsed && (
				<span className="exec-live-status">
					{isRunning && <span>Running • {completedEventsCount} / {totalEventsCount}</span>}
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

function ExecEventRow({ event }: { event: TimelineEvent }) {
	const isCommand = event.eventType === "command";
	const isRunning = event.status === "running";
	const isCompleted = event.status === "completed";
	const isFailed = event.status === "failed";

	return (
		<div className={`vertical-timeline-item ${event.status}`}>
			<div style={{ display: "flex", alignItems: "center", gap: 6 }}>
				<span className="step-icon">
					{isRunning ? <span className="dot-pulse" /> : isCompleted ? "✓" : isFailed ? "✗" : "○"}
				</span>
				<span style={{ fontSize: "0.82em", color: isFailed ? "var(--error)" : "#fff", fontWeight: 500 }}>
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

	const renderGroup = (label: string, files: string[], icon: string, cls: string) => {
		if (files.length === 0) return null;
		return (
			<div className="changes-group">
				<div className="changes-group-label">{label}</div>
				{files.map(f => (
					<div key={f} className="changes-file-row">
						<span className={`changes-file-icon ${cls}`}>{icon}</span>
						<span className="changes-file-path">{f}</span>
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

// ==========================================
// THINKING ANIMATION (ChatGPT-o3 / Codex style)
// ==========================================

function ThinkingAnimation({ label = "Thinking" }: { label?: string }) {
	return (
		<div className="thinking-container">
			<div className="thinking-dots">
				<div className="thinking-dot" />
				<div className="thinking-dot" />
				<div className="thinking-dot" />
			</div>
			<span className="thinking-label">{label}...</span>
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
