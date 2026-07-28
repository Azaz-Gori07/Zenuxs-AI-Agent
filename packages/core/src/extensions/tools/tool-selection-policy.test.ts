import { describe, expect, it } from "vitest";
import { evaluateToolSelection, type ToolRoutingCandidate } from "./tool-selection-policy";

describe("evaluateToolSelection (Intelligent Tool Selection Policy)", () => {
	const candidates: ToolRoutingCandidate[] = [
		{ toolName: "search_codebase", isNative: true, isMcp: false },
		{ toolName: "serena_find_symbols", serverName: "serena", mcpName: "serena", isNative: false, isMcp: true },
		{ toolName: "playwright_click", serverName: "playwright", mcpName: "playwright", isNative: false, isMcp: true },
		{ toolName: "context7_get_docs", serverName: "context7", mcpName: "context7", isNative: false, isMcp: true },
		{ toolName: "git_log", serverName: "git", mcpName: "git", isNative: false, isMcp: true },
	];

	it("defaults to native tool when no specific MCP domain intent matches", () => {
		const result = evaluateToolSelection(candidates, {
			userPrompt: "Find all occurrences of constant FOO_BAR",
		});
		expect(result.selectedTool.isNative).toBe(true);
		expect(result.selectedTool.toolName).toBe("search_codebase");
		expect(result.preferenceScore).toBe(1.0);
	});

	it("boosts Serena MCP when call graph or symbol references are requested", () => {
		const result = evaluateToolSelection(candidates, {
			userPrompt: "Generate a call graph for the processPayment function",
		});
		expect(result.selectedTool.isMcp).toBe(true);
		expect(result.selectedTool.mcpName).toBe("serena");
		expect(result.preferenceScore).toBeGreaterThan(1.0);
		expect(result.reasoning.toLowerCase()).toContain("serena");
	});

	it("boosts Playwright MCP when browser UI interactions or screenshots are requested", () => {
		const result = evaluateToolSelection(candidates, {
			userPrompt: "Take a screenshot of the login web page after clicking the submit button",
		});
		expect(result.selectedTool.isMcp).toBe(true);
		expect(result.selectedTool.mcpName).toBe("playwright");
		expect(result.preferenceScore).toBeGreaterThan(1.0);
		expect(result.reasoning.toLowerCase()).toContain("playwright");
	});

	it("boosts Context7 MCP when external documentation lookup is requested", () => {
		const result = evaluateToolSelection(candidates, {
			userPrompt: "Lookup docs for React 19 useActionState hook",
		});
		expect(result.selectedTool.isMcp).toBe(true);
		expect(result.selectedTool.mcpName).toBe("context7");
		expect(result.reasoning).toContain("context7");
	});

	it("boosts Git MCP when structured git history or git log is requested", () => {
		const result = evaluateToolSelection(candidates, {
			userPrompt: "Show me the git log and commit history for this file",
		});
		expect(result.selectedTool.isMcp).toBe(true);
		expect(result.selectedTool.mcpName).toBe("git");
		expect(result.reasoning).toContain("git");
	});
});
