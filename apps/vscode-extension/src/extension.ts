import * as vscode from "vscode";
import { ZenuxsChatViewProvider } from "./providers/chat-view-provider.js";
import { registerCommands } from "./commands/index.js";
import { ZenuxsStatusBar } from "./status/status-bar.js";
import { registerCodeActions } from "./providers/code-action-provider.js";
import { ZenuxsInlineCompletionProvider } from "./providers/inline-completion-provider.js";
import { devLogs } from "@cline/core";
import { AuthService } from "./services/auth-service.js";

// Global auth service instance (initialized on activation)
let authService: AuthService;

export function activate(context: vscode.ExtensionContext): void {
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

	// Initialize auth service singleton and restore on startup
	authService = AuthService.getInstance();
	authService.setSecretStorage(context.secrets);
	authService.setGlobalState(context.globalState);
	authService.onAuthStateChange((state) => {
		vscode.commands.executeCommand("setContext", "zenuxs:authenticated", state.authenticated);
		if (state.authenticated) {
			context.globalState.update("zenuxs.onboardingSkipped", true);
		}
	});
	authService.restoreOnStartup();

	// Register OAuth URI handler for callbacks (e.g., vscode://zenuxs.zenuxs-code/auth?code=...)
	const uriHandler = vscode.window.registerUriHandler({
		handleUri(uri: vscode.Uri) {
			if (uri.path === "/auth" || uri.path === "/oauth/callback") {
				const params = new URLSearchParams(uri.query);
				const code = params.get("code");
				const provider = params.get("provider") ?? "cline";
				if (code) {
					authService.handleAuthCallback(code, provider).catch((err) => {
						console.error("[extension] Auth callback error:", err);
					});
				}
			}
		},
	});
	context.subscriptions.push(uriHandler);

	// Listen for secrets changes for cross-window auth sync
	context.subscriptions.push(
		context.secrets.onDidChange(() => {
			authService.restoreOnStartup();
		})
	);

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

export function deactivate(): void {
	devLogs.extension.deactivated({ version: "0.1.0" });
}
