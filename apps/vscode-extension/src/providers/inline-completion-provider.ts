import * as vscode from "vscode";
import { resolveExtensionConfig } from "../runtime/config-resolver.js";
import { Llms } from "@cline/core";

/**
 * Provides inline code completions (autocomplete) using the Zenuxs backend.
 * Similar to how Blackbox, Cline, and Continue.dev provide inline suggestions.
 */
export class ZenuxsInlineCompletionProvider
	implements vscode.InlineCompletionItemProvider
{
	private debounceTimer: ReturnType<typeof setTimeout> | undefined;
	private lastRequestId = 0;

	constructor() {}

	async provideInlineCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position,
		context: vscode.InlineCompletionContext,
		token: vscode.CancellationToken,
	): Promise<vscode.InlineCompletionItem[] | vscode.InlineCompletionList | undefined> {
		// Check if autocomplete is enabled
		const config = vscode.workspace.getConfiguration("zenuxs");
		if (!config.get<boolean>("enableAutocomplete", true)) {
			return undefined;
		}

		// Only trigger on explicit request or after typing
		if (
			context.triggerKind !== vscode.InlineCompletionTriggerKind.Automatic &&
			context.triggerKind !== vscode.InlineCompletionTriggerKind.Invoke
		) {
			return undefined;
		}

		// Debounce automatic triggers
		if (context.triggerKind === vscode.InlineCompletionTriggerKind.Automatic) {
			return new Promise((resolve) => {
				if (this.debounceTimer) {
					clearTimeout(this.debounceTimer);
				}
				this.debounceTimer = setTimeout(() => {
					resolve(this.getCompletion(document, position, token));
				}, 300);
			});
		}

		return this.getCompletion(document, position, token);
	}

	private async getCompletion(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken,
	): Promise<vscode.InlineCompletionItem[] | undefined> {
		const requestId = ++this.lastRequestId;

		const fileContent = document.getText();
		const cursorOffset = document.offsetAt(position);

		// Get context before cursor (up to 2000 chars)
		const beforeCursor = fileContent.substring(
			Math.max(0, cursorOffset - 2000),
			cursorOffset,
		);

		// Get context after cursor (up to 500 chars)
		const afterCursor = fileContent.substring(
			cursorOffset,
			Math.min(fileContent.length, cursorOffset + 500),
		);

		try {
			const extConfig = resolveExtensionConfig();
			const handler = await Llms.createHandlerAsync({
				providerId: extConfig.providerId,
				modelId: extConfig.modelId || "anthropic/claude-sonnet-4.6",
				apiKey: extConfig.apiKey,
				baseUrl: extConfig.baseUrl || undefined,
			});

			const prompt = `Complete the code at cursor position. Return ONLY the completion text, no explanations. Do not include markdown code block formatting in your output.\n\nFile: ${document.fileName}\nLanguage: ${document.languageId}\n\nBefore cursor:\n\`\`\`\n${beforeCursor}\n\`\`\`\n\nAfter cursor:\n\`\`\`\n${afterCursor}\n\`\`\`\n\nCompletion:`;

			const systemPrompt = "You are a professional code autocomplete engine. Your task is to output only the immediate code completion text that should follow the text before the cursor, fitting cleanly into the surrounding code context. Never output any markdown blocks, descriptions, conversational replies, or headers. Output ONLY the code.";
			const stream = handler.createMessage(systemPrompt, [
				{
					role: "user",
					content: prompt,
				},
			]);

			let completionText = "";
			for await (const chunk of stream) {
				if (token.isCancellationRequested) {
					break;
				}
				if (chunk.type === "text") {
					completionText += chunk.text;
				}
			}

			// Check if this request is still relevant
			if (requestId !== this.lastRequestId || token.isCancellationRequested) {
				return undefined;
			}

			if (!completionText.trim()) {
				return undefined;
			}

			// Calculate the range for the completion
			const startPosition = position;
			const endPosition = document.lineAt(position.line).range.end;

			const item = new vscode.InlineCompletionItem(
				completionText,
				new vscode.Range(startPosition, endPosition),
			);

			return [item];
		} catch {
			return undefined;
		}
	}
}