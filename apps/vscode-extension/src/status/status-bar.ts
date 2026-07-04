import * as vscode from "vscode";
import { resolveExtensionConfig } from "../runtime/config-resolver.js";

/**
 * Manages the Zenuxs status bar item in the VS Code window.
 */
export class ZenuxsStatusBar {
	private statusBarItem: vscode.StatusBarItem;
	private state: "idle" | "running" | "error" = "idle";

	constructor(context: vscode.ExtensionContext) {
		this.statusBarItem = vscode.window.createStatusBarItem(
			vscode.StatusBarAlignment.Right,
			100,
		);
		this.statusBarItem.command = "zenuxs.chat";
		context.subscriptions.push(this.statusBarItem);

		this.update();
		this.statusBarItem.show();

		// Watch for config changes
		context.subscriptions.push(
			vscode.workspace.onDidChangeConfiguration((e) => {
				if (e.affectsConfiguration("zenuxs")) {
					this.update();
				}
			}),
		);
	}

	/**
	 * Updates the status bar with the current provider/model and state.
	 */
	update(): void {
		const config = resolveExtensionConfig();
		const provider = config.providerId;
		const model = config.modelId || "default";

		let icon: string;
		let tooltip: string;

		switch (this.state) {
			case "running":
				icon = "$(loading~spin)";
				tooltip = "Zenuxs: Processing...";
				break;
			case "error":
				icon = "$(error)";
				tooltip = "Zenuxs: Error";
				break;
			case "idle":
			default:
				icon = "$(zap)";
				tooltip = `Zenuxs: ${provider}/${model}`;
				break;
		}

		this.statusBarItem.text = `${icon} Zenuxs`;
		this.statusBarItem.tooltip = tooltip;
	}

	/**
	 * Sets the running state.
	 */
	setRunning(): void {
		this.state = "running";
		this.update();
	}

	/**
	 * Sets the idle state.
	 */
	setIdle(): void {
		this.state = "idle";
		this.update();
	}

	/**
	 * Sets the error state.
	 */
	setError(): void {
		this.state = "error";
		this.update();
	}

	/**
	 * Disposes the status bar item.
	 */
	dispose(): void {
		this.statusBarItem.dispose();
	}
}
