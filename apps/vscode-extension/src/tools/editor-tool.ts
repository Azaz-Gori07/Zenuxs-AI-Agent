import * as vscode from "vscode";
import * as path from "path";

export interface TextEditChunk {
	/** 1-based start line number (inclusive) */
	startLine: number;
	/** 1-based end line number (inclusive) */
	endLine: number;
	/** Replacement text content */
	replacement: string;
	/** Optional exact target content to verify before replacing */
	targetContent?: string;
}

export interface EditFileOptions {
	/** Target file path (relative to workspace or absolute) */
	filePath: string;
	/** List of edit chunks to apply */
	edits: TextEditChunk[];
	/** Automatically save file after edits (default: true) */
	autoSave?: boolean;
	/** Show file live in editor window (default: true) */
	showEditor?: boolean;
	/** Workspace root directory */
	workspaceRoot?: string;
}

export interface EditorEditResult {
	success: boolean;
	filePath: string;
	lineCount: number;
	linesAdded: number;
	linesDeleted: number;
	summary: string;
	error?: string;
}

/**
 * VsCodeEditorTool — Performs live file editing inside VS Code.
 * Inspired by Cline's VscodeDiffViewProvider.ts and showTextDocument.ts.
 */
export class VsCodeEditorTool {
	/**
	 * Open a target document, show it live in the VS Code editor, and apply range edits.
	 */
	async editFile(options: EditFileOptions): Promise<EditorEditResult> {
		const { filePath, edits, autoSave = true, showEditor = true, workspaceRoot } = options;

		try {
			// Resolve absolute URI
			let fileUri: vscode.Uri;
			if (path.isAbsolute(filePath)) {
				fileUri = vscode.Uri.file(filePath);
			} else if (workspaceRoot) {
				fileUri = vscode.Uri.file(path.join(workspaceRoot, filePath));
			} else if (vscode.workspace.workspaceFolders?.[0]) {
				fileUri = vscode.Uri.file(path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, filePath));
			} else {
				fileUri = vscode.Uri.file(filePath);
			}

			// Open text document
			const document = await vscode.workspace.openTextDocument(fileUri);
			const initialLineCount = document.lineCount;

			// Show document in editor
			let editor: vscode.TextEditor | undefined;
			if (showEditor) {
				editor = await vscode.window.showTextDocument(document, {
					preview: false,
					preserveFocus: false,
				});
			}

			// Sort edits in descending order by startLine to prevent line offset shifts
			const sortedEdits = [...edits].sort((a, b) => b.startLine - a.startLine);

			let linesAdded = 0;
			let linesDeleted = 0;

			// Apply edits
			if (editor) {
				const success = await editor.edit((editBuilder) => {
					for (const chunk of sortedEdits) {
						// Convert 1-based line numbers to 0-based VS Code line numbers
						const startLineIdx = Math.max(0, chunk.startLine - 1);
						const endLineIdx = Math.min(document.lineCount - 1, chunk.endLine - 1);

						const startPos = new vscode.Position(startLineIdx, 0);
						const endLineObj = document.lineAt(endLineIdx);
						const endPos = endLineObj.range.end;

						const replaceRange = new vscode.Range(startPos, endPos);

						// Verify targetContent if provided
						if (chunk.targetContent) {
							const currentText = document.getText(replaceRange);
							if (currentText.trim() !== chunk.targetContent.trim()) {
								throw new Error(
									`Target content mismatch at lines ${chunk.startLine}-${chunk.endLine}. Expected:\n${chunk.targetContent}\nGot:\n${currentText}`,
								);
							}
						}

						const deletedCount = endLineIdx - startLineIdx + 1;
						const addedCount = chunk.replacement.split(/\r?\n/).length;

						linesDeleted += deletedCount;
						linesAdded += addedCount;

						editBuilder.replace(replaceRange, chunk.replacement);
					}
				});

				if (!success) {
					return {
						success: false,
						filePath: fileUri.fsPath,
						lineCount: document.lineCount,
						linesAdded: 0,
						linesDeleted: 0,
						summary: `Failed to apply edits to ${path.basename(fileUri.fsPath)}.`,
						error: "TextEditor.edit returned false.",
					};
				}
			} else {
				// Fallback using WorkspaceEdit if no active editor
				const workspaceEdit = new vscode.WorkspaceEdit();
				for (const chunk of sortedEdits) {
					const startLineIdx = Math.max(0, chunk.startLine - 1);
					const endLineIdx = Math.min(document.lineCount - 1, chunk.endLine - 1);

					const startPos = new vscode.Position(startLineIdx, 0);
					const endLineObj = document.lineAt(endLineIdx);
					const endPos = endLineObj.range.end;

					const replaceRange = new vscode.Range(startPos, endPos);
					workspaceEdit.replace(fileUri, replaceRange, chunk.replacement);

					linesDeleted += endLineIdx - startLineIdx + 1;
					linesAdded += chunk.replacement.split(/\r?\n/).length;
				}
				await vscode.workspace.applyEdit(workspaceEdit);
			}

			// Auto save if requested
			if (autoSave) {
				await document.save();
			}

			const finalLineCount = document.lineCount;
			const relPath = vscode.workspace.asRelativePath(fileUri);

			return {
				success: true,
				filePath: relPath,
				lineCount: finalLineCount,
				linesAdded,
				linesDeleted,
				summary: `Successfully applied ${edits.length} edit(s) to ${relPath} (+${linesAdded} lines, -${linesDeleted} lines, total: ${finalLineCount} lines).`,
			};
		} catch (err: any) {
			const errorMsg = err instanceof Error ? err.message : String(err);
			return {
				success: false,
				filePath,
				lineCount: 0,
				linesAdded: 0,
				linesDeleted: 0,
				summary: `Failed to edit ${filePath}: ${errorMsg}`,
				error: errorMsg,
			};
		}
	}
}

export const vsCodeEditorTool = new VsCodeEditorTool();
