import * as vscode from "vscode";
import { resolveWorkspaceRoot } from "../runtime/config-resolver.js";

export interface LiveEditSession {
	taskId: string | number;
	sessionId: string;
	currentFile?: string;
	editedFiles: Set<string>;
	pendingFiles: Set<string>;
	completedFiles: Set<string>;
	originalContents: Map<string, string>;
	fileDocuments: Map<string, vscode.TextDocument>;
	disposables: vscode.Disposable[];
}

export interface IncrementalEditChunk {
	startLine: number;
	endLine: number;
	type: "insert" | "delete" | "replace";
	lines: string[];
}

const FILE_EDIT_TOOLS = new Set([
	"write_to_file",
	"apply_diff",
	"replace_in_file",
	"edit_file",
	"create_file",
]);

const USER_TYPING_DEBOUNCE_MS = 2000;
const FADE_DECORATION_MS = 500;
const LARGE_FILE_BYTES = 1 * 1024 * 1024; // 1MB

export class ZenuxsLiveEditService {
	private activeSession: LiveEditSession | null = null;
	private disposables: vscode.Disposable[] = [];
	private isUserTyping = false;
	private lastUserTypingTime = 0;
	private eventBus: any = null;

	// Decoration types
	private insertDecorationType: vscode.TextEditorDecorationType;
	private deleteDecorationType: vscode.TextEditorDecorationType;
	private replaceDecorationType: vscode.TextEditorDecorationType;
	private activeLineDecorationType: vscode.TextEditorDecorationType;
	private flashDecorationType: vscode.TextEditorDecorationType;

	private fadeTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

	constructor() {
		// Initialize visual decorations
		this.insertDecorationType = vscode.window.createTextEditorDecorationType({
			backgroundColor: "rgba(46, 160, 67, 0.15)",
			isWholeLine: true,
			overviewRulerColor: "rgba(46, 160, 67, 0.6)",
			overviewRulerLane: vscode.OverviewRulerLane.Left,
		});

		this.deleteDecorationType = vscode.window.createTextEditorDecorationType({
			backgroundColor: "rgba(248, 81, 73, 0.15)",
			isWholeLine: true,
			overviewRulerColor: "rgba(248, 81, 73, 0.6)",
			overviewRulerLane: vscode.OverviewRulerLane.Left,
		});

		this.replaceDecorationType = vscode.window.createTextEditorDecorationType({
			backgroundColor: "rgba(210, 153, 34, 0.15)",
			isWholeLine: true,
			overviewRulerColor: "rgba(210, 153, 34, 0.6)",
			overviewRulerLane: vscode.OverviewRulerLane.Left,
		});

		this.activeLineDecorationType = vscode.window.createTextEditorDecorationType({
			backgroundColor: "rgba(56, 139, 253, 0.2)",
			isWholeLine: true,
			gutterIconPath: new vscode.ThemeIcon("edit").id ? undefined : undefined,
		});

		this.flashDecorationType = vscode.window.createTextEditorDecorationType({
			backgroundColor: "rgba(255, 215, 0, 0.3)",
			isWholeLine: true,
		});

		// Listen to user typing to guard editor focus
		this.disposables.push(
			vscode.workspace.onDidChangeTextDocument((e) => {
				const activeEditor = vscode.window.activeTextEditor;
				if (activeEditor && activeEditor.document.uri.toString() === e.document.uri.toString()) {
					if (e.contentChanges.length > 0) {
						this.isUserTyping = true;
						this.lastUserTypingTime = Date.now();
					}
				}
			}),
		);

		// Listen to active editor changes for bi-directional synchronization
		this.disposables.push(
			vscode.window.onDidChangeTextEditorSelection((e) => {
				if (!this.activeSession || !this.eventBus) return;
				const activeDoc = e.textEditor.document;
				const filePath = activeDoc.uri.fsPath;
				if (this.activeSession.editedFiles.has(filePath)) {
					const line = e.selections[0]?.active.line ?? 0;
					this.eventBus.publish?.("editor_cursor_moved", {
						taskId: this.activeSession.taskId,
						filePath,
						line,
					});
				}
			}),
		);
	}

	setEventBus(bus: any): void {
		this.eventBus = bus;
	}

	static isFileEditTool(toolName: string): boolean {
		return FILE_EDIT_TOOLS.has(toolName);
	}

	static extractFilePath(input: unknown): string | undefined {
		if (!input || typeof input !== "object") return undefined;
		const obj = input as Record<string, unknown>;
		return (obj.path ?? obj.file_path ?? obj.filePath) as string | undefined;
	}

	startSession(taskId: string | number, sessionId: string): LiveEditSession {
		if (this.activeSession) {
			this.endSession();
		}

		this.activeSession = {
			taskId,
			sessionId,
			editedFiles: new Set(),
			pendingFiles: new Set(),
			completedFiles: new Set(),
			originalContents: new Map(),
			fileDocuments: new Map(),
			disposables: [],
		};

		this.publishSessionEvent("session:started", { taskId, sessionId });
		return this.activeSession;
	}

	async openForEdit(filePath: string): Promise<vscode.TextDocument | undefined> {
		if (!this.activeSession) {
			this.startSession("default", `session-${Date.now()}`);
		}

		const session = this.activeSession!;
		session.currentFile = filePath;
		session.editedFiles.add(filePath);
		session.pendingFiles.delete(filePath);

		const workspaceRoot = resolveWorkspaceRoot();
		const absPath = vscode.Uri.file(
			filePath.startsWith("/") || filePath.startsWith("\\\\") || /^[A-Za-z]:/.test(filePath)
				? filePath
				: workspaceRoot + "/" + filePath,
		);

		let document: vscode.TextDocument;
		try {
			document = await vscode.workspace.openTextDocument(absPath);
			if (!session.originalContents.has(filePath)) {
				session.originalContents.set(filePath, document.getText());
			}
			session.fileDocuments.set(filePath, document);
		} catch (error) {
			console.error(`[ZenuxsLiveEditService] Failed to open document ${filePath}:`, error);
			return undefined;
		}

		// User Typing Focus Guard check
		const now = Date.now();
		const isUserActivelyTyping = this.isUserTyping && now - this.lastUserTypingTime < USER_TYPING_DEBOUNCE_MS;

		if (!isUserActivelyTyping) {
			try {
				await vscode.window.showTextDocument(document, { preserveFocus: true, preview: false });
			} catch {}
		}

		this.publishSessionEvent("file:active_changed", {
			taskId: session.taskId,
			filePath,
			editedFiles: Array.from(session.editedFiles),
		});

		return document;
	}

	async applyIncrementalEdit(
		filePath: string,
		newContent: string,
		isFinal = false,
	): Promise<boolean> {
		const document = await this.openForEdit(filePath);
		if (!document) return false;

		const currentText = document.getText();
		if (currentText === newContent && !isFinal) return true;

		// Large file check: skip expensive decoration animation for large files > 1MB
		const isLargeFile = document.getText().length > LARGE_FILE_BYTES;

		const currentLines = currentText.split("\n");
		const newLines = newContent.split("\n");

		// Compute line diff
		const chunks = computeLineChunks(currentLines, newLines);

		const edit = new vscode.WorkspaceEdit();
		const fullRange = new vscode.Range(
			0,
			0,
			document.lineCount,
			document.lineAt(Math.max(0, document.lineCount - 1)).text.length,
		);

		// Atomic WorkspaceEdit for preserved undo history
		edit.replace(document.uri, fullRange, newContent);

		const success = await vscode.workspace.applyEdit(edit);
		if (!success) {
			return false;
		}

		// Apply transient decorations if document editor is active and not a large file
		const editor = vscode.window.visibleTextEditors.find(
			(e) => e.document.uri.toString() === document.uri.toString(),
		);

		if (editor && !isLargeFile) {
			const insertRanges: vscode.Range[] = [];
			const deleteRanges: vscode.Range[] = [];
			const replaceRanges: vscode.Range[] = [];
			let lastEditedLine = 0;

			for (const chunk of chunks) {
				const range = new vscode.Range(chunk.startLine, 0, chunk.endLine, 0);
				lastEditedLine = chunk.endLine;

				if (chunk.type === "insert") insertRanges.push(range);
				else if (chunk.type === "delete") deleteRanges.push(range);
				else if (chunk.type === "replace") replaceRanges.push(range);
			}

			editor.setDecorations(this.insertDecorationType, insertRanges);
			editor.setDecorations(this.deleteDecorationType, deleteRanges);
			editor.setDecorations(this.replaceDecorationType, replaceRanges);

			if (!isFinal && lastEditedLine >= 0) {
				const activeRange = new vscode.Range(lastEditedLine, 0, lastEditedLine, 0);
				editor.setDecorations(this.activeLineDecorationType, [activeRange]);

				// Reveal range safely without stealing user cursor
				const now = Date.now();
				if (!this.isUserTyping || now - this.lastUserTypingTime > USER_TYPING_DEBOUNCE_MS) {
					editor.revealRange(activeRange, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
				}
			}
		}

		this.publishSessionEvent("file:incremental_chunk", {
			taskId: this.activeSession?.taskId,
			filePath,
			lineCount: newLines.length,
			isFinal,
		});

		if (isFinal) {
			await this.finalizeFileEdit(filePath, document);
		}

		return true;
	}

	private async finalizeFileEdit(filePath: string, document: vscode.TextDocument): Promise<void> {
		if (this.activeSession) {
			this.activeSession.completedFiles.add(filePath);
		}

		// Schedule 500ms auto-fade of line decorations
		if (this.fadeTimers.has(filePath)) {
			clearTimeout(this.fadeTimers.get(filePath)!);
		}

		const timer = setTimeout(() => {
			const editor = vscode.window.visibleTextEditors.find(
				(e) => e.document.uri.toString() === document.uri.toString(),
			);
			if (editor) {
				editor.setDecorations(this.insertDecorationType, []);
				editor.setDecorations(this.deleteDecorationType, []);
				editor.setDecorations(this.replaceDecorationType, []);
				editor.setDecorations(this.activeLineDecorationType, []);
			}
			this.fadeTimers.delete(filePath);
		}, FADE_DECORATION_MS);

		this.fadeTimers.set(filePath, timer);

		this.publishSessionEvent("file:edit_completed", {
			taskId: this.activeSession?.taskId,
			filePath,
		});
	}

	async revealEditLocation(filePath: string, startLine: number, endLine?: number): Promise<void> {
		const workspaceRoot = resolveWorkspaceRoot();
		const absPath = vscode.Uri.file(
			filePath.startsWith("/") || filePath.startsWith("\\\\") || /^[A-Za-z]:/.test(filePath)
				? filePath
				: workspaceRoot + "/" + filePath,
		);

		try {
			const document = await vscode.workspace.openTextDocument(absPath);
			const editor = await vscode.window.showTextDocument(document, { preserveFocus: false, preview: false });

			const targetRange = new vscode.Range(startLine, 0, endLine ?? startLine, 0);
			editor.revealRange(targetRange, vscode.TextEditorRevealType.InCenter);
			editor.setDecorations(this.flashDecorationType, [targetRange]);

			setTimeout(() => {
				editor.setDecorations(this.flashDecorationType, []);
			}, 1000);
		} catch (error) {
			console.error(`[ZenuxsLiveEditService] Failed to reveal location in ${filePath}:`, error);
		}
	}

	closeEdit(): void {
		if (!this.activeSession) return;

		this.fadeTimers.forEach((timer) => clearTimeout(timer));
		this.fadeTimers.clear();

		for (const editor of vscode.window.visibleTextEditors) {
			editor.setDecorations(this.insertDecorationType, []);
			editor.setDecorations(this.deleteDecorationType, []);
			editor.setDecorations(this.replaceDecorationType, []);
			editor.setDecorations(this.activeLineDecorationType, []);
		}
	}

	endSession(): void {
		if (!this.activeSession) return;

		this.fadeTimers.forEach((timer) => clearTimeout(timer));
		this.fadeTimers.clear();

		for (const d of this.activeSession.disposables) {
			d.dispose();
		}

		this.publishSessionEvent("session:completed", {
			taskId: this.activeSession.taskId,
			sessionId: this.activeSession.sessionId,
		});

		this.activeSession = null;
	}

	private publishSessionEvent(type: string, data: Record<string, unknown>): void {
		if (this.eventBus && typeof this.eventBus.publish === "function") {
			this.eventBus.publish(type, data);
		}
	}

	dispose(): void {
		this.endSession();
		for (const d of this.disposables) d.dispose();
		this.disposables = [];
		this.insertDecorationType.dispose();
		this.deleteDecorationType.dispose();
		this.replaceDecorationType.dispose();
		this.activeLineDecorationType.dispose();
		this.flashDecorationType.dispose();
	}
}

// Helper to compute minimal line-level diff chunks
function computeLineChunks(oldLines: string[], newLines: string[]): IncrementalEditChunk[] {
	const chunks: IncrementalEditChunk[] = [];
	let i = 0;
	let j = 0;

	while (i < oldLines.length || j < newLines.length) {
		if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
			i++;
			j++;
		} else {
			const startLine = j;
			const addedLines: string[] = [];

			while (j < newLines.length && (i >= oldLines.length || oldLines[i] !== newLines[j])) {
				addedLines.push(newLines[j]);
				j++;
			}

			if (addedLines.length > 0) {
				chunks.push({
					startLine,
					endLine: j,
					type: i < oldLines.length ? "replace" : "insert",
					lines: addedLines,
				});
			}

			if (i < oldLines.length && (j >= newLines.length || oldLines[i] !== newLines[j])) {
				i++;
			}
		}
	}

	return chunks;
}

// Backward compatibility alias
export const ZenuxsLiveEditProvider = ZenuxsLiveEditService;
