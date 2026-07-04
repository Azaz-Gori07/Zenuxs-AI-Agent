import * as vscode from "vscode";
import { ExtensionCoreBridge } from "../runtime/core-bridge.js";
import { mapCoreEventToWebview } from "../runtime/event-mapper.js";
import type { WebviewOutboundMessage } from "../runtime/event-mapper.js";
import { resolveExtensionConfig, resolveWorkspaceRoot, resolveCwd } from "../runtime/config-resolver.js";
import { captureEditorContext, formatEditorContextForPrompt } from "../context/editor-context.js";
import type { AgentResult, CoreSessionEvent, ToolApprovalRequest, ToolApprovalResult } from "@cline/core";
import { SessionSource } from "@cline/core";
import { createSessionId } from "@cline/shared";

/**
 * Webview inbound message types from the chat panel.
 */
type WebviewInboundMessage =
	| { type: "ready" }
	| {
			type: "send";
			prompt: string;
			config?: Record<string, unknown>;
	  }
	| { type: "abort" }
	| { type: "new_session" }
	| {
			type: "approval_response";
			approvalId: string;
			approved: boolean;
			reason?: string;
	  };

/**
 * Provides the Zenuxs chat webview in the VS Code sidebar.
 */
export class ZenuxsChatViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = "zenuxs-chat";

	private webviewView: vscode.WebviewView | undefined;
	private coreBridge: ExtensionCoreBridge | undefined;
	private activeSessionId: string | undefined;
	private pendingApprovalResolve:
		| ((result: ToolApprovalResult) => void)
		| undefined;
	private isRunning = false;

	constructor(private readonly extensionContext: vscode.ExtensionContext) {}

	resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	): void {
		this.webviewView = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.extensionContext.extensionUri],
		};

		webviewView.webview.html = this.getHtmlForWebview(
			webviewView.webview,
		);

		webviewView.webview.onDidReceiveMessage(
			async (message: WebviewInboundMessage) => {
				await this.handleWebviewMessage(message);
			},
		);
	}

	/**
	 * Send a message to the webview UI.
	 */
	private postToWebview(message: WebviewOutboundMessage): void {
		this.webviewView?.webview.postMessage(message);
	}

	/**
	 * Send a pre-filled prompt from a command to the chat panel.
	 */
	public sendPrompt(prompt: string): void {
		this.postToWebview({ type: "status", text: "Prompt ready" });
		// Trigger the send via the webview
		this.handleWebviewMessage({ type: "send", prompt });
	}

	/**
	 * Handles messages from the webview.
	 */
	private async handleWebviewMessage(
		message: WebviewInboundMessage,
	): Promise<void> {
		switch (message.type) {
			case "ready":
				this.postToWebview({
					type: "status",
					text: "Zenuxs runtime ready",
				});
				break;

			case "send":
				await this.handleSend(message.prompt);
				break;

			case "abort":
				await this.handleAbort();
				break;

			case "new_session":
				this.activeSessionId = undefined;
				this.postToWebview({ type: "reset_done" });
				break;

			case "approval_response":
				this.handleApprovalResponse(message);
				break;
		}
	}

	/**
	 * Handles a send message from the webview.
	 */
	private async handleSend(prompt: string): Promise<void> {
		if (this.isRunning) {
			this.postToWebview({
				type: "error",
				text: "A turn is already in progress. Use abort to cancel it.",
			});
			return;
		}

		this.isRunning = true;

		try {
			// Ensure the core bridge is initialized
			if (!this.coreBridge) {
				const workspaceRoot = resolveWorkspaceRoot();
				const cwd = resolveCwd();
				this.coreBridge = new ExtensionCoreBridge({
					cwd,
					workspaceRoot,
					onToolApprovalRequest: (request: ToolApprovalRequest) =>
						this.requestToolApproval(request),
				});
			}

			const core = await this.coreBridge.getCore();
			const extConfig = resolveExtensionConfig();
			const editorCtx = captureEditorContext();
			const editorContextText = formatEditorContextForPrompt(editorCtx);

			// Build the full prompt with editor context
			const fullPrompt = editorContextText
				? `${prompt}\n\n${editorContextText}`
				: prompt;

			// Subscribe to events for this turn
			const unsubscribe = this.coreBridge.subscribe((event: CoreSessionEvent) => {
				const messages = mapCoreEventToWebview(event);
				for (const msg of messages) {
					this.postToWebview(msg);
				}
			});

			try {
				const plannedSessionId = createSessionId();
				const workspaceRoot = resolveWorkspaceRoot();
				const cwd = resolveCwd();

				const toolPolicies: Record<string, { autoApprove: boolean }> = {
					"*": { autoApprove: extConfig.autoApproveTools },
				};

				// Start or send to session
				if (!this.activeSessionId) {
					// New session
					const started = await core.start({
						source: SessionSource.CLI,
						config: {
							providerId: extConfig.providerId,
							modelId:
								extConfig.modelId || "anthropic/claude-sonnet-4.6",
							apiKey: extConfig.apiKey,
							baseUrl: extConfig.baseUrl || undefined,
							systemPrompt: "",
							enableTools: true,
							enableSpawnAgent: true,
							enableAgentTeams: true,
							defaultToolAutoApprove: extConfig.autoApproveTools,
							toolPolicies,
							thinking: extConfig.thinking,
							reasoningEffort:
								extConfig.reasoningEffort !== "none"
									? extConfig.reasoningEffort
									: undefined,
							execution: {
								maxConsecutiveMistakes: 3,
							},
							cwd,
							workspaceRoot,
							extensionContext: {
								client: { name: "vscode-extension" },
								workspace: {
									rootPath: workspaceRoot,
									cwd,
									workspaceName:
										workspaceRoot.split(/[\\/]/).pop() ?? "",
									ide: "VS Code",
									platform: process.platform,
								},
							},
						},
						prompt: fullPrompt,
						interactive: false,
						sessionId: plannedSessionId,
					});

					this.activeSessionId = started.sessionId;
					this.postToWebview({
						type: "session_started",
						sessionId: started.sessionId,
					});

					// If start() already returned a result (non-interactive), use it
					if (started.result) {
						this.handleAgentResult(started.result);
					} else {
						// Wait for the session to complete via events
						await this.waitForSessionEnd(core, started.sessionId);
					}
				} else {
					// Continue existing session
					const result = await core.send({
						sessionId: this.activeSessionId,
						prompt: fullPrompt,
					});

					if (result) {
						this.handleAgentResult(result);
					} else {
						await this.waitForSessionEnd(
							core,
							this.activeSessionId,
						);
					}
				}
			} finally {
				unsubscribe();
			}
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			this.postToWebview({ type: "error", text: message });
		} finally {
			this.isRunning = false;
		}
	}

	/**
	 * Handles an agent result.
	 */
	private handleAgentResult(result: AgentResult): void {
		this.postToWebview({
			type: "turn_done",
			finishReason: result.finishReason ?? "completed",
			iterations: result.iterations ?? 0,
			usage: result.usage
				? {
						inputTokens: result.usage.inputTokens,
						outputTokens: result.usage.outputTokens,
						cacheReadInputTokens: result.usage.cacheReadTokens,
						cacheCreationInputTokens: result.usage.cacheWriteTokens,
						totalCost: result.usage.totalCost,
					}
				: undefined,
		});
	}

	/**
	 * Waits for the session to end via events.
	 */
	private waitForSessionEnd(
		core: Awaited<ReturnType<ExtensionCoreBridge["getCore"]>>,
		sessionId: string,
	): Promise<void> {
		return new Promise<void>((resolve) => {
			const unsubscribe = core.subscribe((event: CoreSessionEvent) => {
				if (
					event.type === "ended" &&
					event.payload.sessionId === sessionId
				) {
					unsubscribe();
					resolve();
				}
			});
		});
	}

	/**
	 * Handles abort request.
	 */
	private async handleAbort(): Promise<void> {
		if (this.coreBridge && this.activeSessionId) {
			try {
				const core = await this.coreBridge.getCore();
				await core.abort(this.activeSessionId);
				this.postToWebview({
					type: "status",
					text: "Session aborted",
				});
			} catch {
				// Abort is best-effort
			}
		}
		this.isRunning = false;
	}

	/**
	 * Requests tool approval from the user via VS Code quick pick.
	 */
	private async requestToolApproval(
		request: ToolApprovalRequest,
	): Promise<ToolApprovalResult> {
		// Send approval request to webview
		this.postToWebview({
			type: "approval_request",
			approvalId: request.toolCallId,
			sessionId: request.sessionId ?? "",
			agentId: request.agentId ?? "",
			conversationId: request.conversationId ?? "",
			iteration: request.iteration ?? 0,
			toolCallId: request.toolCallId,
			toolName: request.toolName,
			input: request.input,
		});

		// Also show a VS Code notification for visibility
		const result = await vscode.window.showWarningMessage(
			`Tool "${request.toolName}" wants to execute. Approve?`,
			{ modal: false },
			"Allow",
			"Deny",
		);

		return {
			approved: result === "Allow",
			reason: result === "Allow" ? undefined : "Denied by user",
		};
	}

	/**
	 * Handles an approval response from the webview.
	 */
	private handleApprovalResponse(message: {
		approvalId: string;
		approved: boolean;
		reason?: string;
	}): void {
		this.postToWebview({
			type: "approval_resolved",
			approvalId: message.approvalId,
			approved: message.approved,
			reason: message.reason,
		});

		this.pendingApprovalResolve?.({
			approved: message.approved,
			reason: message.reason,
		});
		this.pendingApprovalResolve = undefined;
	}

	/**
	 * Generates the HTML content for the chat webview.
	 */
	private getHtmlForWebview(webview: vscode.Webview): string {
		const nonce = getNonce();

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
	<title>Zenuxs Chat</title>
	<style>
		:root {
			--bg: var(--vscode-editor-background);
			--fg: var(--vscode-editor-foreground);
			--border: var(--vscode-panel-border);
			--input-bg: var(--vscode-input-background);
			--input-fg: var(--vscode-input-foreground);
			--input-border: var(--vscode-input-border);
			--button-bg: var(--vscode-button-background);
			--button-fg: var(--vscode-button-foreground);
			--button-hover: var(--vscode-button-hoverBackground);
			--accent: var(--vscode-focusBorder);
			--muted: var(--vscode-descriptionForeground);
			--error: var(--vscode-errorForeground);
			--success: var(--vscode-testing-iconPassed);
		}
		* { box-sizing: border-box; margin: 0; padding: 0; }
		body {
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-font-size);
			color: var(--fg);
			background: var(--bg);
			height: 100vh;
			display: flex;
			flex-direction: column;
		}
		#messages {
			flex: 1;
			overflow-y: auto;
			padding: 12px;
			display: flex;
			flex-direction: column;
			gap: 8px;
		}
		.message {
			padding: 8px 12px;
			border-radius: 6px;
			max-width: 100%;
			word-wrap: break-word;
			white-space: pre-wrap;
		}
		.message.user {
			background: var(--input-bg);
			align-self: flex-end;
			max-width: 85%;
		}
		.message.assistant {
			background: color-mix(in srgb, var(--accent) 10%, transparent);
			border-left: 2px solid var(--accent);
		}
		.message.error {
			background: color-mix(in srgb, var(--error) 10%, transparent);
			border-left: 2px solid var(--error);
			color: var(--error);
		}
		.message.tool {
			background: color-mix(in srgb, var(--muted) 10%, transparent);
			border-left: 2px solid var(--muted);
			font-size: 0.9em;
		}
		.message.system {
			color: var(--muted);
			font-style: italic;
			font-size: 0.85em;
			text-align: center;
		}
		.message.reasoning {
			color: var(--muted);
			font-style: italic;
			border-left-color: var(--muted);
		}
		#input-area {
			padding: 8px 12px;
			border-top: 1px solid var(--border);
			display: flex;
			gap: 8px;
		}
		#prompt-input {
			flex: 1;
			background: var(--input-bg);
			color: var(--input-fg);
			border: 1px solid var(--input-border);
			border-radius: 4px;
			padding: 8px;
			font-family: inherit;
			font-size: inherit;
			resize: none;
			min-height: 36px;
			max-height: 200px;
		}
		#prompt-input:focus {
			outline: 1px solid var(--accent);
		}
		.btn {
			background: var(--button-bg);
			color: var(--button-fg);
			border: none;
			border-radius: 4px;
			padding: 6px 12px;
			cursor: pointer;
			font-size: inherit;
		}
		.btn:hover { background: var(--button-hover); }
		.btn:disabled { opacity: 0.5; cursor: not-allowed; }
		.btn.danger { background: var(--error); }
		#status-bar {
			padding: 4px 12px;
			font-size: 0.8em;
			color: var(--muted);
			border-top: 1px solid var(--border);
		}
		.tool-events { margin-top: 4px; }
		.tool-event {
			padding: 2px 0;
			font-size: 0.85em;
			color: var(--muted);
		}
		.tool-event.running { color: var(--accent); }
		.tool-event.completed { color: var(--success); }
		.tool-event.failed { color: var(--error); }
	</style>
</head>
<body>
	<div id="messages"></div>
	<div id="status-bar">Ready</div>
	<div id="input-area">
		<textarea id="prompt-input" placeholder="Ask Zenuxs..." rows="1"></textarea>
		<button class="btn" id="send-btn" title="Send">Send</button>
		<button class="btn danger" id="abort-btn" title="Abort" style="display:none">Stop</button>
	</div>
	<script nonce="${nonce}">
		const vscode = acquireVsCodeApi();
		const messagesEl = document.getElementById('messages');
		const statusBar = document.getElementById('status-bar');
		const promptInput = document.getElementById('prompt-input');
		const sendBtn = document.getElementById('send-btn');
		const abortBtn = document.getElementById('abort-btn');

		let currentAssistantEl = null;
		let currentReasoningEl = null;
		let isRunning = false;

		// Auto-resize textarea
		promptInput.addEventListener('input', () => {
			promptInput.style.height = 'auto';
			promptInput.style.height = Math.min(promptInput.scrollHeight, 200) + 'px';
		});

		// Enter to send (Shift+Enter for newline)
		promptInput.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				send();
			}
		});

		sendBtn.addEventListener('click', send);
		abortBtn.addEventListener('click', () => {
			vscode.postMessage({ type: 'abort' });
		});

		function send() {
			const prompt = promptInput.value.trim();
			if (!prompt) return;
			addMessage('user', prompt);
			promptInput.value = '';
			promptInput.style.height = 'auto';
			currentAssistantEl = null;
			currentReasoningEl = null;
			vscode.postMessage({ type: 'send', prompt });
			setRunning(true);
		}

		function setRunning(running) {
			isRunning = running;
			sendBtn.disabled = running;
			abortBtn.style.display = running ? '' : 'none';
		}

		function addMessage(role, text) {
			const el = document.createElement('div');
			el.className = 'message ' + role;
			el.textContent = text;
			messagesEl.appendChild(el);
			messagesEl.scrollTop = messagesEl.scrollHeight;
			return el;
		}

		function appendToAssistant(text) {
			if (!currentAssistantEl) {
				currentAssistantEl = addMessage('assistant', '');
			}
			currentAssistantEl.textContent += text;
			messagesEl.scrollTop = messagesEl.scrollHeight;
		}

		function appendToReasoning(text, redacted) {
			if (!currentReasoningEl) {
				currentReasoningEl = addMessage('assistant reasoning', '');
			}
			currentReasoningEl.textContent += text;
			messagesEl.scrollTop = messagesEl.scrollHeight;
		}

		window.addEventListener('message', (event) => {
			const msg = event.data;
			switch (msg.type) {
				case 'assistant_delta':
					appendToAssistant(msg.text);
					break;
				case 'reasoning_delta':
					appendToReasoning(msg.text, msg.redacted);
					break;
				case 'tool_event':
					addMessage('tool', msg.text || 'Tool event');
					break;
				case 'turn_done':
					setRunning(false);
					currentAssistantEl = null;
					currentReasoningEl = null;
					if (msg.usage) {
						statusBar.textContent = 'Done | ' +
							(msg.usage.inputTokens || 0) + ' in / ' +
							(msg.usage.outputTokens || 0) + ' out' +
							(msg.usage.totalCost ? ' | $' + msg.usage.totalCost.toFixed(4) : '');
					} else {
						statusBar.textContent = 'Done';
					}
					break;
				case 'error':
					addMessage('error', msg.text);
					setRunning(false);
					statusBar.textContent = 'Error';
					break;
				case 'status':
					statusBar.textContent = msg.text;
					break;
				case 'session_started':
					statusBar.textContent = 'Session: ' + msg.sessionId.slice(0, 8);
					break;
				case 'reset_done':
					messagesEl.innerHTML = '';
					currentAssistantEl = null;
					currentReasoningEl = null;
					statusBar.textContent = 'New session';
					break;
				case 'approval_request':
					addMessage('tool', 'Tool "' + msg.toolName + '" requests approval');
					break;
			}
		});

		// Notify extension that webview is ready
		vscode.postMessage({ type: 'ready' });
	</script>
</body>
</html>`;
	}
}

/**
 * Generates a random nonce for CSP.
 */
function getNonce(): string {
	let text = "";
	const possible =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
