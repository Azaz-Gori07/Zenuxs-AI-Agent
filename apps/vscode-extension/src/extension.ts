import * as vscode from "vscode";
import { ZenuxsChatViewProvider } from "./providers/chat-view-provider.js";
import { registerCommands } from "./commands/index.js";
import { ZenuxsStatusBar } from "./status/status-bar.js";
import { registerCodeActions } from "./providers/code-action-provider.js";
import { ZenuxsBackendBridge } from "./runtime/backend-bridge.js";
import { ZenuxsInlineCompletionProvider } from "./providers/inline-completion-provider.js";

/**
 * Extension activation entry point.
 *
 * Called by VS Code when the extension is activated (via activationEvents
 * defined in package.json).
 */
export function activate(context: vscode.ExtensionContext): void {
	// Initialize backend bridge (connects to zenuxs-code backend)
	const backendBridge = new ZenuxsBackendBridge(context);

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
	registerCommands(context, chatProvider, backendBridge);

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
	outputChannel.appendLine(`Backend URL: ${backendBridge.getBaseUrl()}`);
	context.subscriptions.push(outputChannel);

	// Check backend connection on startup
	backendBridge.checkConnection().then((connected) => {
		if (connected) {
			outputChannel.appendLine("Backend connection established");
			statusBar.setIdle();
		} else {
			outputChannel.appendLine("Backend not available - running in standalone mode");
			statusBar.setIdle();
		}
	});
}

/**
 * Extension deactivation.
 *
 * Called by VS Code when the extension is deactivated.
 */
export function deactivate(): void {
	// Cleanup is handled by context.subscriptions disposal
}