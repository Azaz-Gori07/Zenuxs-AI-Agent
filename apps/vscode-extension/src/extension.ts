import * as vscode from "vscode";
import { ZenuxsChatViewProvider } from "./providers/chat-view-provider.js";
import { registerCommands } from "./commands/index.js";
import { ZenuxsStatusBar } from "./status/status-bar.js";
import { registerCodeActions } from "./providers/code-action-provider.js";
import { ZenuxsInlineCompletionProvider } from "./providers/inline-completion-provider.js";
import { devLogs } from "@cline/core";

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
	// Log extension lifecycle event
	devLogs.extension.activated({ version: "0.1.0", mode: "vscode-extension" });

	// Intercept console functions to mirror to developer logs
	const originalLog = console.log;
	const originalInfo = console.info;
	const originalWarn = console.warn;
	const originalError = console.error;
	const originalDebug = console.debug;

	console.log = (...args: unknown[]) => {
		originalLog.apply(console, args);
		devLogs.console.log(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "), args);
	};
	console.info = (...args: unknown[]) => {
		originalInfo.apply(console, args);
		devLogs.console.info(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "), args);
	};
	console.warn = (...args: unknown[]) => {
		originalWarn.apply(console, args);
		devLogs.console.warn(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "), args);
	};
	console.error = (...args: unknown[]) => {
		originalError.apply(console, args);
		devLogs.console.error(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "), args);
	};
	console.debug = (...args: unknown[]) => {
		originalDebug.apply(console, args);
		devLogs.console.debug(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "), args);
	};

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

	// Clean up chat provider (disposes bridge and MCP manager) on extension deactivation
	context.subscriptions.push({
		dispose: () => {
			chatProvider.newSession();
		},
	});

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

	// Restore original console functions on deactivation
	context.subscriptions.push({
		dispose: () => {
			console.log = originalLog;
			console.info = originalInfo;
			console.warn = originalWarn;
			console.error = originalError;
			console.debug = originalDebug;
		},
	});
}

/**
 * Extension deactivation.
 *
 * Called by VS Code when the extension is deactivated.
 */
export function deactivate(): void {
	devLogs.extension.deactivated({ version: "0.1.0" });
	// Cleanup is handled by context.subscriptions disposal
}
