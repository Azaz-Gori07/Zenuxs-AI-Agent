import * as vscode from "vscode";
import { ZenuxsChatViewProvider } from "./providers/chat-view-provider.js";
import { registerCommands } from "./commands/index.js";
import { ZenuxsStatusBar } from "./status/status-bar.js";

/**
 * Extension activation entry point.
 *
 * Called by VS Code when the extension is activated (via activationEvents
 * defined in package.json).
 */
export function activate(context: vscode.ExtensionContext): void {
	// Create the chat view provider
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

	// Create status bar
	const statusBar = new ZenuxsStatusBar(context);

	// Log activation
	const outputChannel = vscode.window.createOutputChannel("Zenuxs");
	outputChannel.appendLine("Zenuxs extension activated");
	context.subscriptions.push(outputChannel);
}

/**
 * Extension deactivation.
 *
 * Called by VS Code when the extension is deactivated.
 */
export function deactivate(): void {
	// Cleanup is handled by context.subscriptions disposal
}
