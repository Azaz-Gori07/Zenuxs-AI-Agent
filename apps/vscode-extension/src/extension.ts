import * as vscode from "vscode";
import { ZenuxsChatViewProvider } from "./providers/chat-view-provider.js";
import { registerCommands } from "./commands/index.js";
import { ZenuxsStatusBar } from "./status/status-bar.js";
import { registerCodeActions } from "./providers/code-action-provider.js";
import { ZenuxsInlineCompletionProvider } from "./providers/inline-completion-provider.js";

/**
 * Extension activation entry point.
 *
 * Called by VS Code when the extension is activated (via activationEvents
 * defined in package.json).
 *
 * Uses the same ZenuxsCore runtime as the CLI - no separate backend bridge.
 * All provider, model, session, and tool operations go through @cline/core
 * directly, ensuring feature parity with the CLI.
 */
export function activate(context: vscode.ExtensionContext): void {
	// Create the chat view provider (manages its own ExtensionCoreBridge)
	const chatProvider = new ZenuxsChatViewProvider(context);

	// Register the webview view provider for the sidebar chat panel
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			ZenuxsChatViewProvider.viewType,
			chatProvider,
			{
				webviewOptions: {
					retainContextWhenHidden: true,
				},
			},
		),
	);

	// Register commands
	registerCommands(context, chatProvider);

	// Register code actions (quick fixes, refactor)
	registerCodeActions(context, chatProvider);

	// Register inline completion provider (autocomplete)
	const inlineProvider = new ZenuxsInlineCompletionProvider();
	context.subscriptions.push(
		vscode.languages.registerInlineCompletionItemProvider(
			{ pattern: "**" },
			inlineProvider,
		),
	);

	// Create status bar
	const statusBar = new ZenuxsStatusBar(context);

	// Log activation
	const outputChannel = vscode.window.createOutputChannel("Zenuxs");
	outputChannel.appendLine("Zenuxs extension activated");
	outputChannel.appendLine("Runtime: @cline/core (shared with CLI)");
	context.subscriptions.push(outputChannel);

	// Set idle status
	statusBar.setIdle();
}

/**
 * Extension deactivation.
 *
 * Called by VS Code when the extension is deactivated.
 */
export function deactivate(): void {
	// Cleanup is handled by context.subscriptions disposal
}