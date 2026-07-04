import * as vscode from "vscode";

/**
 * Captures context from the VS Code editor to enrich prompts sent to the runtime.
 */
export interface EditorContext {
	/** The active file path, if any */
	activeFilePath?: string;
	/** The active file language ID */
	activeLanguageId?: string;
	/** The selected text in the active editor */
	selectedText?: string;
	/** The start line of the selection (1-based) */
	selectionStartLine?: number;
	/** The end line of the selection (1-based) */
	selectionEndLine?: number;
	/** All open file paths */
	openFilePaths: string[];
	/** The workspace root path */
	workspaceRoot: string;
}

/**
 * Captures the current editor context for injection into session prompts.
 */
export function captureEditorContext(): EditorContext {
	const editor = vscode.window.activeTextEditor;
	const selection = editor?.selection;
	const document = editor?.document;

	const openFilePaths = vscode.workspace.textDocuments.map(
		(doc) => doc.uri.fsPath,
	);

	const workspaceFolders = vscode.workspace.workspaceFolders;
	const workspaceRoot =
		workspaceFolders && workspaceFolders.length > 0
			? workspaceFolders[0].uri.fsPath
			: "";

	const context: EditorContext = {
		openFilePaths,
		workspaceRoot,
	};

	if (document) {
		context.activeFilePath = document.uri.fsPath;
		context.activeLanguageId = document.languageId;
	}

	if (selection && !selection.isEmpty) {
		context.selectedText = document?.getText(selection) ?? "";
		context.selectionStartLine = selection.start.line + 1;
		context.selectionEndLine = selection.end.line + 1;
	}

	return context;
}

/**
 * Formats the editor context into a text block that can be appended to a prompt.
 */
export function formatEditorContextForPrompt(ctx: EditorContext): string {
	const parts: string[] = [];

	if (ctx.activeFilePath) {
		parts.push(`Active file: ${ctx.activeFilePath}`);
		if (ctx.activeLanguageId) {
			parts.push(`Language: ${ctx.activeLanguageId}`);
		}
	}

	if (ctx.selectedText) {
		parts.push(
			`\nSelected code (lines ${ctx.selectionStartLine}-${ctx.selectionEndLine}):`,
		);
		parts.push("```" + (ctx.activeLanguageId ?? ""));
		parts.push(ctx.selectedText);
		parts.push("```");
	}

	if (ctx.openFilePaths.length > 0 && ctx.openFilePaths.length <= 20) {
		parts.push(`\nOpen files: ${ctx.openFilePaths.join(", ")}`);
	}

	return parts.join("\n");
}
