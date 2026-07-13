import * as vscode from "vscode";

/**
 * Resolved extension configuration for a session.
 * Mirrors the CLI's Config type from apps/cli/src/utils/types.ts
 */
export interface ExtensionConfig {
	providerId: string;
	modelId: string;
	apiKey: string;
	baseUrl: string;
	autoApproveTools: boolean;
	thinking: boolean;
	reasoningEffort: string;
	maxIterations: number;
	mode: string;
	compaction: string;
	retries: number;
	timeout: number;
	checkpointEnabled: boolean;
	systemPrompt: string;
	verbose: boolean;
}

/**
 * Reads the extension configuration from VS Code settings.
 * Mirrors the CLI's config resolution from apps/cli/src/main.ts
 */
export function resolveExtensionConfig(): ExtensionConfig {
	const config = vscode.workspace.getConfiguration("zenuxs");
	return {
		providerId: config.get<string>("providerId", "cline"),
		modelId: config.get<string>("modelId", ""),
		apiKey: config.get<string>("apiKey", ""),
		baseUrl: config.get<string>("baseUrl", ""),
		autoApproveTools: config.get<boolean>("autoApproveTools", true),
		thinking: config.get<boolean>("thinking", false),
		reasoningEffort: config.get<string>("reasoningEffort", "none"),
		maxIterations: config.get<number>("maxIterations", 100),
		mode: config.get<string>("mode", "act"),
		compaction: config.get<string>("compaction", "off"),
		retries: config.get<number>("retries", 3),
		timeout: config.get<number>("timeout", 0),
		checkpointEnabled: config.get<boolean>("checkpointEnabled", false),
		systemPrompt: config.get<string>("systemPrompt", ""),
		verbose: config.get<boolean>("verbose", false),
	};
}

/**
 * Resolves the workspace root from the current VS Code workspace.
 */
export function resolveWorkspaceRoot(): string {
	const folders = vscode.workspace.workspaceFolders;
	if (folders && folders.length > 0) {
		return folders[0].uri.fsPath;
	}
	return process.cwd();
}

/**
 * Resolves the current working directory from the active editor or workspace.
 */
export function resolveCwd(): string {
	const activeEditor = vscode.window.activeTextEditor;
	if (activeEditor) {
		const dir = vscode.Uri.joinPath(activeEditor.document.uri, "..");
		return dir.fsPath;
	}
	return resolveWorkspaceRoot();
}