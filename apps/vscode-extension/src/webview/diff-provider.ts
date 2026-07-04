import * as vscode from "vscode";

/**
 * Provides diff preview for file changes made by the Zenuxs runtime.
 *
 * When the runtime modifies files, this provider can show a diff view
 * between the original and modified content using VS Code's built-in
 * diff editor.
 */
export class ZenuxsDiffProvider {
	/**
	 * Shows a diff between original and modified content for a file.
	 */
	static async showDiff(
		filePath: string,
		originalContent: string,
		modifiedContent: string,
		title?: string,
	): Promise<void> {
		const uri = vscode.Uri.file(filePath);
		const originalUri = vscode.Uri.parse(
			`zenuxs-original:${uri.path}`,
		).with({
			query: encodeURIComponent(originalContent),
		});
		const modifiedUri = vscode.Uri.parse(
			`zenuxs-modified:${uri.path}`,
		).with({
			query: encodeURIComponent(modifiedContent),
		});

		const diffTitle =
			title ?? `${vscode.workspace.asRelativePath(uri)} (Zenuxs)`;

		// Register content providers for the diff
		const originalProvider = vscode.workspace.registerTextDocumentContentProvider(
			"zenuxs-original",
			{
				provideTextDocumentContent: (uri: vscode.Uri) =>
					decodeURIComponent(uri.query),
			},
		);

		const modifiedProvider = vscode.workspace.registerTextDocumentContentProvider(
			"zenuxs-modified",
			{
				provideTextDocumentContent: (uri: vscode.Uri) =>
					decodeURIComponent(uri.query),
			},
		);

		await vscode.commands.executeCommand(
			"vscode.diff",
			originalUri,
			modifiedUri,
			diffTitle,
		);

		// Clean up providers after a delay
		setTimeout(() => {
			originalProvider.dispose();
			modifiedProvider.dispose();
		}, 60_000);
	}

	/**
	 * Opens a file in the editor.
	 */
	static async openFile(
		filePath: string,
		line?: number,
	): Promise<void> {
		const uri = vscode.Uri.file(filePath);
		const options: vscode.TextDocumentShowOptions = {};
		if (line !== undefined) {
			options.selection = new vscode.Range(
				new vscode.Position(line - 1, 0),
				new vscode.Position(line - 1, 0),
			);
		}
		await vscode.window.showTextDocument(uri, options);
	}
}
