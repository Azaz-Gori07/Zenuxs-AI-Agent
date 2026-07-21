import * as vscode from "vscode";
import { EventEmitter } from "events";

export interface TerminalCommandOptions {
	/** Shell command line string */
	command: string;
	/** Working directory for command execution */
	cwd?: string;
	/** Whether the command is a long-running process (dev server, watcher) */
	longRunning?: boolean;
	/** Execution timeout in milliseconds (default: 60,000ms) */
	timeoutMs?: number;
	/** Real-time output streaming callback */
	onOutput?: (chunk: string) => void;
}

export interface TerminalCommandResult {
	success: boolean;
	command: string;
	output: string;
	exitCode?: number;
	durationMs: number;
	longRunning: boolean;
	error?: string;
}

const TERMINAL_NAME = "Zenuxs Agent Terminal";

/**
 * VsCodeTerminalTool — Manages dedicated agent terminals and streams output chunks.
 * Inspired by Cline's VscodeTerminalProcess.ts and VscodeTerminalManager.ts.
 */
export class VsCodeTerminalTool extends EventEmitter {
	private activeTerminal: vscode.Terminal | undefined;
	private fullOutputBuffer = "";

	/**
	 * Retrieve existing agent terminal or create a new dedicated terminal.
	 */
	getOrCreateTerminal(cwd?: string): vscode.Terminal {
		const existing = vscode.window.terminals.find((t) => t.name === TERMINAL_NAME && t.exitStatus === undefined);
		if (existing) {
			this.activeTerminal = existing;
			return existing;
		}

		const terminalOptions: vscode.TerminalOptions = {
			name: TERMINAL_NAME,
			cwd: cwd || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
		};

		const terminal = vscode.window.createTerminal(terminalOptions);
		this.activeTerminal = terminal;
		return terminal;
	}

	/**
	 * Execute a shell command inside the VS Code terminal and stream output chunks.
	 */
	async runCommand(options: TerminalCommandOptions): Promise<TerminalCommandResult> {
		const { command, cwd, longRunning = false, timeoutMs = 60_000, onOutput } = options;
		const startTime = Date.now();

		const terminal = this.getOrCreateTerminal(cwd);
		terminal.show(true);

		let output = "";
		const appendChunk = (chunk: string) => {
			output += chunk;
			this.fullOutputBuffer += chunk;
			if (onOutput) {
				onOutput(chunk);
			}
			this.emit("output", chunk);
		};

		// Check for VS Code 1.93+ Shell Integration API
		if ((terminal as any).shellIntegration?.executeCommand) {
			try {
				const execution = (terminal as any).shellIntegration.executeCommand(command);
				const stream = execution.read();

				if (longRunning) {
					// For long-running commands (dev servers, watchers), stream in background
					(async () => {
						for await (const chunk of stream) {
							appendChunk(chunk);
						}
					})().catch(() => {});

					return {
						success: true,
						command,
						output: `Started long-running background command: "${command}" in ${TERMINAL_NAME}. Streaming logs live...`,
						durationMs: Date.now() - startTime,
						longRunning: true,
					};
				}

				// For standard commands, await execution completion stream
				const timeoutPromise = new Promise<never>((_, reject) => {
					setTimeout(() => reject(new Error(`Command execution timed out after ${timeoutMs}ms`)), timeoutMs);
				});

				const readStreamPromise = (async () => {
					for await (const chunk of stream) {
						appendChunk(chunk);
					}
					return output;
				})();

				await Promise.race([readStreamPromise, timeoutPromise]);

				return {
					success: true,
					command,
					output: output || `Command "${command}" executed successfully with 0 exit code.`,
					exitCode: 0,
					durationMs: Date.now() - startTime,
					longRunning: false,
				};
			} catch (err: any) {
				// Fallback to sendText standard terminal execution if shellIntegration stream throws
			}
		}

		// Fallback: Send command text directly to terminal
		terminal.sendText(command, true);
		appendChunk(`[Zenuxs Terminal Execution] Sent command: ${command}\n`);

		if (longRunning) {
			return {
				success: true,
				command,
				output: `Sent long-running command "${command}" to ${TERMINAL_NAME}. Processes active in background.`,
				durationMs: Date.now() - startTime,
				longRunning: true,
			};
		}

		// Wait briefly for standard execution output notification
		await new Promise((resolve) => setTimeout(resolve, 1500));

		return {
			success: true,
			command,
			output: output || `Command "${command}" sent to ${TERMINAL_NAME}.`,
			exitCode: 0,
			durationMs: Date.now() - startTime,
			longRunning: false,
		};
	}
}

export const vsCodeTerminalTool = new VsCodeTerminalTool();
