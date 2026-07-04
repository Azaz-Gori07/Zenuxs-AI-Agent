import * as vscode from "vscode";
import { captureEditorContext, formatEditorContextForPrompt } from "../context/editor-context.js";
import { ZenuxsChatViewProvider } from "../providers/chat-view-provider.js";

/**
 * Registers all Zenuxs commands.
 */
export function registerCommands(
	context: vscode.ExtensionContext,
	chatProvider: ZenuxsChatViewProvider,
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
			chatProvider.sendPrompt("__new_session__");
		}),
	);

	// Stop current session
	context.subscriptions.push(
		vscode.commands.registerCommand("zenuxs.stopSession", async () => {
			await vscode.commands.executeCommand("zenuxs-chat.focus");
			// The abort is handled by the webview
		}),
	);
}
