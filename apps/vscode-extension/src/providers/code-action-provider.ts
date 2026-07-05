import * as vscode from "vscode";
import { ZenuxsChatViewProvider } from "../providers/chat-view-provider.js";

/**
 * Provides Zenuxs code actions (quick fixes) in the editor.
 *
 * When the user selects code, Zenuxs offers actions like:
 * - Explain this code
 * - Fix issues in this code
 * - Generate tests for this code
 * - Refactor this code
 *
 * These actions delegate to the chat panel by sending pre-filled prompts.
 */
export class ZenuxsCodeActionProvider implements vscode.CodeActionProvider {
	public static readonly providedKinds = [
		vscode.CodeActionKind.QuickFix,
		vscode.CodeActionKind.Refactor,
	];

	constructor(private readonly chatProvider: ZenuxsChatViewProvider) {}

	provideCodeActions(
		document: vscode.TextDocument,
		range: vscode.Range | vscode.Selection,
		_context: vscode.CodeActionContext,
		_token: vscode.CancellationToken,
	): vscode.CodeAction[] {
		const selection = document.getText(range);
		if (!selection || selection.trim().length === 0) {
			return [];
		}

		const filePath = document.uri.fsPath;
		const languageId = document.languageId;
		const actions: vscode.CodeAction[] = [];

		// Explain
		const explainAction = new vscode.CodeAction(
			"Zenuxs: Explain this code",
			vscode.CodeActionKind.QuickFix,
		);
		explainAction.command = {
			command: "zenuxs.explain",
			title: "Zenuxs: Explain Selection",
		};
		actions.push(explainAction);

		// Fix
		const fixAction = new vscode.CodeAction(
			"Zenuxs: Fix issues",
			vscode.CodeActionKind.QuickFix,
		);
		fixAction.command = {
			command: "zenuxs.fix",
			title: "Zenuxs: Fix Selection",
		};
		actions.push(fixAction);

		// Generate tests
		const testAction = new vscode.CodeAction(
			"Zenuxs: Generate tests",
			vscode.CodeActionKind.QuickFix,
		);
		testAction.command = {
			command: "zenuxs.test",
			title: "Zenuxs: Generate Tests",
		};
		actions.push(testAction);

		// Refactor
		const refactorAction = new vscode.CodeAction(
			"Zenuxs: Refactor this code",
			vscode.CodeActionKind.Refactor,
		);
		refactorAction.command = {
			command: "zenuxs.refactor",
			title: "Zenuxs: Refactor Selection",
		};
		actions.push(refactorAction);

		return actions;
	}
}

/**
 * Registers the code action provider for all supported languages.
 */
export function registerCodeActions(
	context: vscode.ExtensionContext,
	chatProvider: ZenuxsChatViewProvider,
): void {
	const provider = new ZenuxsCodeActionProvider(chatProvider);

	// Register for all languages
	context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider(
			{ scheme: "file" },
			provider,
			{
				providedCodeActionKinds: ZenuxsCodeActionProvider.providedKinds,
			},
		),
	);
}
