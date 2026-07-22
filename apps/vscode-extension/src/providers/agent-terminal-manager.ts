import * as vscode from "vscode";

export type TerminalState =
	| "Created"
	| "Starting"
	| "Running"
	| "Waiting"
	| "Completed"
	| "Cancelled"
	| "Failed"
	| "Disposed";

export interface TerminalSession {
	terminal: vscode.Terminal;
	taskId: number;
	state: TerminalState;
	busy: boolean;
	outputHistory: string[];
	commandQueue: CommandQueueItem[];
	currentExecution?: {
		command: string;
		startTime: number;
		promise: Promise<string>;
	};
}

export interface CommandQueueItem {
	id: string;
	command: string;
	cwd?: string;
	resolve: (output: string) => void;
	reject: (error: Error) => void;
}

const CLEANUP_TIMEOUT_MS = 60_000;
const SHELL_INTEGRATION_TIMEOUT_MS = 4000;
const MARKERLESS_IDLE_TIMEOUT_MS = 2000;
const MAX_QUIET_TIME_MS = 10_000;
const MAX_HISTORY_LINES = 5000;

export class AgentTerminalService {
	private terminals: Map<number, TerminalSession> = new Map();
	private eventBus: any = null;
	private disposables: vscode.Disposable[] = [];

	constructor(private taskNamePrefix = "Zenuxs") {
		// Listen for terminal execution end events to capture exit codes reliably
		try {
			if (vscode.window.onDidEndTerminalShellExecution) {
				this.disposables.push(
					vscode.window.onDidEndTerminalShellExecution((e) => {
						for (const [, session] of this.terminals) {
							if (session.terminal === e.terminal) {
								const exitCode = e.exitCode;
								if (exitCode === 0) {
									this.setTerminalState(session, "Completed");
								} else if (exitCode !== undefined) {
									this.setTerminalState(session, "Failed");
								}
							}
						}
					}),
				);
			}
		} catch (error) {
			console.warn("[AgentTerminalService] Shell integration execution end listener error:", error);
		}

		// Listen to terminal closures
		this.disposables.push(
			vscode.window.onDidCloseTerminal((closed) => {
				for (const [taskId, session] of this.terminals) {
					if (session.terminal === closed) {
						this.setTerminalState(session, "Disposed");
						this.terminals.delete(taskId);
						break;
					}
				}
			}),
		);
	}

	setEventBus(bus: any): void {
		this.eventBus = bus;
	}

	getOrCreateFor(taskId: number, cwd?: string): TerminalSession {
		const existing = this.terminals.get(taskId);
		if (existing && !this.isTerminalClosed(existing.terminal)) {
			return existing;
		}

		if (existing) {
			this.terminals.delete(taskId);
		}

		const terminal = vscode.window.createTerminal({
			name: `${this.taskNamePrefix} • Task #${taskId}`,
			cwd,
			env: {
				ZENUXS_ACTIVE: "true",
				ZENUXS_TASK_ID: String(taskId),
			},
		});

		terminal.show(true);

		const session: TerminalSession = {
			terminal,
			taskId,
			state: "Created",
			busy: false,
			outputHistory: [],
			commandQueue: [],
		};

		this.terminals.set(taskId, session);
		this.setTerminalState(session, "Starting");

		return session;
	}

	async executeCommand(taskId: number, command: string, cwd?: string): Promise<string> {
		const session = this.getOrCreateFor(taskId, cwd);

		return new Promise<string>((resolve, reject) => {
			const queueItem: CommandQueueItem = {
				id: `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
				command,
				cwd,
				resolve,
				reject,
			};

			session.commandQueue.push(queueItem);
			this.processQueue(session);
		});
	}

	private async processQueue(session: TerminalSession): Promise<void> {
		if (session.busy || session.commandQueue.length === 0) {
			return;
		}

		session.busy = true;
		const item = session.commandQueue.shift()!;

		this.setTerminalState(session, "Running");
		const outputLines: string[] = [];

		const publishLine = (line: string) => {
			outputLines.push(line);
			session.outputHistory.push(line);

			if (session.outputHistory.length > MAX_HISTORY_LINES) {
				session.outputHistory.shift();
			}

			if (this.eventBus && typeof this.eventBus.publish === "function") {
				this.eventBus.publish("terminal_line", {
					taskId: session.taskId,
					line,
					state: session.state,
				});
			}
		};

		const terminal = session.terminal;

		try {
			if (terminal.shellIntegration?.executeCommand) {
				const execution = terminal.shellIntegration.executeCommand(item.command);
				const stream = execution.read();
				let didSeeC = false;
				let quietMs = 0;

				const iterator = stream[Symbol.asyncIterator]();
				let pendingRead: Promise<IteratorResult<string>> | undefined;

				const readNext = async (): Promise<{ data: string } | { end: true } | { idle: true }> => {
					pendingRead ??= iterator.next();
					const result = await Promise.race([
						pendingRead.then((r) => (r.done ? { end: true as const } : { data: r.value as string })),
						new Promise<{ idle: true }>((r) =>
							setTimeout(() => r({ idle: true }), MARKERLESS_IDLE_TIMEOUT_MS),
						),
					]);
					if ("data" in result || "end" in result) pendingRead = undefined;
					return result;
				};

				while (true) {
					if (session.state === "Cancelled") {
						publishLine("[command cancelled by user]");
						break;
					}

					const outcome = await readNext();
					if ("end" in outcome) break;
					if ("idle" in outcome) {
						quietMs += MARKERLESS_IDLE_TIMEOUT_MS;
						if (!didSeeC && quietMs >= MAX_QUIET_TIME_MS) break;
						this.setTerminalState(session, "Waiting");
						continue;
					}

					this.setTerminalState(session, "Running");
					quietMs = 0;
					const data = outcome.data;
					const segments = parseOsc633(data);

					let chunk = "";
					for (const seg of segments) {
						if (seg.kind === "marker" && seg.markerType === "C") {
							didSeeC = true;
						} else {
							chunk += seg.text;
						}
					}

					if (chunk) {
						const cleaned = chunk
							.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "")
							.replace(/\r/g, "");
						if (cleaned) {
							for (const line of cleaned.split("\n")) {
								const trimmed = line.trim();
								if (trimmed) publishLine(trimmed);
							}
						}
					}
				}

				try {
					iterator.return?.()?.catch?.(() => {});
				} catch {}
			} else {
				// Fallback command execution
				terminal.sendText(item.command, true);
				await new Promise((r) => setTimeout(r, SHELL_INTEGRATION_TIMEOUT_MS));
				publishLine(`[command executed: ${item.command}]`);
			}

			if (session.state !== "Failed" && session.state !== "Cancelled") {
				this.setTerminalState(session, "Completed");
			}

			item.resolve(outputLines.join("\n"));
		} catch (error) {
			this.setTerminalState(session, "Failed");
			const err = error instanceof Error ? error : new Error(String(error));
			publishLine(`[command error: ${err.message}]`);
			item.reject(err);
		} finally {
			session.busy = false;
			this.processQueue(session);
		}
	}

	getTerminalHistory(taskId: number): string[] {
		const session = this.terminals.get(taskId);
		return session ? session.outputHistory : [];
	}

	cancelTask(taskId: number): void {
		const session = this.terminals.get(taskId);
		if (session && !this.isTerminalClosed(session.terminal)) {
			this.setTerminalState(session, "Cancelled");
			session.terminal.sendText("\x03", false);

			// Clear queued commands
			for (const item of session.commandQueue) {
				item.reject(new Error("Task cancelled"));
			}
			session.commandQueue = [];
		}
	}

	cleanupTask(taskId: number): void {
		const session = this.terminals.get(taskId);
		if (session) {
			setTimeout(() => {
				if (!this.isTerminalClosed(session.terminal)) {
					this.setTerminalState(session, "Disposed");
					session.terminal.dispose();
				}
				this.terminals.delete(taskId);
			}, CLEANUP_TIMEOUT_MS);
		}
	}

	private setTerminalState(session: TerminalSession, state: TerminalState): void {
		session.state = state;
		if (this.eventBus && typeof this.eventBus.publish === "function") {
			this.eventBus.publish("terminal_state_changed", {
				taskId: session.taskId,
				state,
			});
		}
	}

	private isTerminalClosed(terminal: vscode.Terminal): boolean {
		return terminal.exitStatus !== undefined;
	}

	disposeAll(): void {
		for (const [, session] of this.terminals) {
			if (!this.isTerminalClosed(session.terminal)) {
				this.setTerminalState(session, "Disposed");
				session.terminal.dispose();
			}
		}
		this.terminals.clear();
		for (const d of this.disposables) d.dispose();
		this.disposables = [];
	}
}

interface OscSegment {
	kind: "text" | "marker";
	text: string;
	markerType?: string;
}

function parseOsc633(data: string): OscSegment[] {
	const segments: OscSegment[] = [];
	const regex = /\x1b\]633;([PADCE]);[^\x1b]*\x1b\\/g;
	let lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = regex.exec(data)) !== null) {
		if (match.index > lastIndex) {
			segments.push({ kind: "text", text: data.slice(lastIndex, match.index) });
		}
		lastIndex = regex.lastIndex;
	}
	if (lastIndex < data.length) {
		segments.push({ kind: "text", text: data.slice(lastIndex) });
	}
	return segments;
}

// Backward compatibility alias
export const AgentTerminalManager = AgentTerminalService;
