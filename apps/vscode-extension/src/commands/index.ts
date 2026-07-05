import * as vscode from "vscode";
import { captureEditorContext, formatEditorContextForPrompt } from "../context/editor-context.js";
import { ZenuxsChatViewProvider } from "../providers/chat-view-provider.js";
import { ZenuxsBackendBridge } from "../runtime/backend-bridge.js";
import { resolveExtensionConfig } from "../runtime/config-resolver.js";

/**
 * Registers all Zenuxs commands.
 */
export function registerCommands(
	context: vscode.ExtensionContext,
	chatProvider: ZenuxsChatViewProvider,
	backendBridge: ZenuxsBackendBridge,
): void {
	// Open chat panel
	context.subscriptions.push(
		vscode.commands.registerCommand("zenuxs.chat", async () => {
			// Focus the chat view
			await vscode.commands.executeCommand("zenuxs-chat.focus");
		}),
	);

	// Explain selected code
	context.subscriptions.push(
		vscode.commands.registerCommand("zenuxs.explain", async () => {
			const editorCtx = captureEditorContext();
			const selection = editorCtx.selectedText;
			if (!selection) {
				vscode.window.showInformationMessage(
					"Zenuxs: Please select some code to explain.",
				);
				return;
			}
			const filePath = editorCtx.activeFilePath ?? "the selected code";
			const prompt = `Explain the following code from ${filePath}:\n\n\`\`\`${editorCtx.activeLanguageId ?? ""}\n${selection}\n\`\`\``;
			await vscode.commands.executeCommand("zenuxs-chat.focus");
			chatProvider.sendPrompt(prompt);
		}),
	);

	// Fix selected code
	context.subscriptions.push(
		vscode.commands.registerCommand("zenuxs.fix", async () => {
			const editorCtx = captureEditorContext();
			const selection = editorCtx.selectedText;
			if (!selection) {
				vscode.window.showInformationMessage(
					"Zenuxs: Please select some code to fix.",
				);
				return;
			}
			const filePath = editorCtx.activeFilePath ?? "the selected code";
			const prompt = `Fix any issues in the following code from ${filePath}:\n\n\`\`\`${editorCtx.activeLanguageId ?? ""}\n${selection}\n\`\`\``;
			await vscode.commands.executeCommand("zenuxs-chat.focus");
			chatProvider.sendPrompt(prompt);
		}),
	);

	// Generate tests
	context.subscriptions.push(
		vscode.commands.registerCommand("zenuxs.test", async () => {
			const editorCtx = captureEditorContext();
			const selection = editorCtx.selectedText;
			if (!selection) {
				vscode.window.showInformationMessage(
					"Zenuxs: Please select some code to generate tests for.",
				);
				return;
			}
			const filePath = editorCtx.activeFilePath ?? "the selected code";
			const prompt = `Generate comprehensive tests for the following code from ${filePath}:\n\n\`\`\`${editorCtx.activeLanguageId ?? ""}\n${selection}\n\`\`\``;
			await vscode.commands.executeCommand("zenuxs-chat.focus");
			chatProvider.sendPrompt(prompt);
		}),
	);

	// Refactor selected code
	context.subscriptions.push(
		vscode.commands.registerCommand("zenuxs.refactor", async () => {
			const editorCtx = captureEditorContext();
			const selection = editorCtx.selectedText;
			if (!selection) {
				vscode.window.showInformationMessage(
					"Zenuxs: Please select some code to refactor.",
				);
				return;
			}
			const filePath = editorCtx.activeFilePath ?? "the selected code";
			const prompt = `Refactor the following code from ${filePath}. Improve readability, performance, and maintainability while preserving behavior:\n\n\`\`\`${editorCtx.activeLanguageId ?? ""}\n${selection}\n\`\`\``;
			await vscode.commands.executeCommand("zenuxs-chat.focus");
			chatProvider.sendPrompt(prompt);
		}),
	);

	// Ask Zenuxs about a file (from explorer context)
	context.subscriptions.push(
		vscode.commands.registerCommand("zenuxs.askAboutFile", async (uri: vscode.Uri) => {
			if (!uri) {
				const activeEditor = vscode.window.activeTextEditor;
				if (!activeEditor) {
					vscode.window.showInformationMessage("Zenuxs: No file selected.");
					return;
				}
				uri = activeEditor.document.uri;
			}
			const input = await vscode.window.showInputBox({
				prompt: `Ask Zenuxs about ${uri.fsPath.split(/[\\/]/).pop()}`,
				placeHolder: "e.g., explain this file, find bugs, optimize...",
			});
			if (!input) return;
			const prompt = `${input}\n\nFile: ${uri.fsPath}`;
			await vscode.commands.executeCommand("zenuxs-chat.focus");
			chatProvider.sendPrompt(prompt);
		}),
	);

	// Inline chat (placeholder for future implementation)
	context.subscriptions.push(
		vscode.commands.registerCommand("zenuxs.inlineChat", async () => {
			const input = await vscode.window.showInputBox({
				prompt: "Ask Zenuxs about the current selection",
				placeHolder: "e.g., refactor this to use async/await",
			});
			if (!input) return;

			const editorCtx = captureEditorContext();
			const contextText = formatEditorContextForPrompt(editorCtx);
			const prompt = `${input}\n\n${contextText}`;
			await vscode.commands.executeCommand("zenuxs-chat.focus");
			chatProvider.sendPrompt(prompt);
		}),
	);

	// New session
	context.subscriptions.push(
		vscode.commands.registerCommand("zenuxs.newSession", async () => {
			await vscode.commands.executeCommand("zenuxs-chat.focus");
			chatProvider.newSession();
		}),
	);

	// Stop current session
	context.subscriptions.push(
		vscode.commands.registerCommand("zenuxs.stopSession", async () => {
			chatProvider.stopSession();
		}),
	);

	// Toggle settings panel
	context.subscriptions.push(
		vscode.commands.registerCommand("zenuxs.toggleSettings", async () => {
			await vscode.commands.executeCommand("zenuxs-chat.focus");
			chatProvider.toggleSettings();
		}),
	);

	// Quick ask - quick question without opening chat
	context.subscriptions.push(
		vscode.commands.registerCommand("zenuxs.quickAsk", async () => {
			const input = await vscode.window.showInputBox({
				prompt: "Ask Zenuxs a quick question",
				placeHolder: "Type your question...",
				ignoreFocusOut: true,
			});
			if (!input) return;

			// Show progress notification
			await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: "Zenuxs",
					cancellable: true,
				},
				async (progress, token) => {
					progress.report({ message: "Thinking..." });

					try {
						const extConfig = resolveExtensionConfig();
						const { Llms } = await import("@cline/core");
						const handler = await Llms.createHandlerAsync({
							providerId: extConfig.providerId,
							modelId: extConfig.modelId || "anthropic/claude-sonnet-4.6",
							apiKey: extConfig.apiKey,
							baseUrl: extConfig.baseUrl || undefined,
						});

						const stream = handler.createMessage(
							"You are a helpful software engineering assistant. Keep your answer under 200 characters.",
							[{ role: "user", content: input }]
						);

						let answer = "";
						for await (const chunk of stream) {
							if (token.isCancellationRequested) break;
							if (chunk.type === "text") {
								answer += chunk.text;
							}
						}

						if (answer.trim()) {
							vscode.window.showInformationMessage(
								answer.length > 200 ? answer.substring(0, 200) + "..." : answer
							);
							return;
						}

						// Fallback to chat if empty response
						await vscode.commands.executeCommand("zenuxs-chat.focus");
						chatProvider.sendPrompt(input);
					} catch {
						await vscode.commands.executeCommand("zenuxs-chat.focus");
						chatProvider.sendPrompt(input);
					}
				},
			);
		}),
	);

	// Fix diagnostic - fix errors in the current file
	context.subscriptions.push(
		vscode.commands.registerCommand("zenuxs.fixDiagnostic", async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				vscode.window.showInformationMessage("Zenuxs: No active editor.");
				return;
			}

			const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
			const errors = diagnostics.filter((d) => d.severity === vscode.DiagnosticSeverity.Error);
			const warnings = diagnostics.filter((d) => d.severity === vscode.DiagnosticSeverity.Warning);

			if (errors.length === 0 && warnings.length === 0) {
				vscode.window.showInformationMessage("Zenuxs: No diagnostics found in the current file.");
				return;
			}

			// Build diagnostic context
			const lines: string[] = [];
			if (errors.length > 0) {
				lines.push("Errors:");
				errors.slice(0, 5).forEach((d) => {
					lines.push(`  - Line ${d.range.start.line + 1}: ${d.message}`);
				});
			}
			if (warnings.length > 0) {
				lines.push("Warnings:");
				warnings.slice(0, 5).forEach((d) => {
					lines.push(`  - Line ${d.range.start.line + 1}: ${d.message}`);
				});
			}

			const fileContent = editor.document.getText();
			const prompt = `Fix the following issues in this file:\n\n${lines.join("\n")}\n\nFile: ${editor.document.fileName}\n\n\`\`\`${editor.document.languageId}\n${fileContent}\n\`\`\``;

			await vscode.commands.executeCommand("zenuxs-chat.focus");
			chatProvider.sendPrompt(prompt);
		}),
	);
}