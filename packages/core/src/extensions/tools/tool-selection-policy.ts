/**
 * Intelligent Tool Selection Policy & Preference Router
 *
 * Implements dynamic, context-aware tool selection hierarchy:
 * Priority Order:
 * 1. Native Zenuxs tools (default preference weight = 1.0)
 * 2. Recommended MCP tools (Serena, Playwright, Context7, Git) with a ~60–70% preference bias
 *    when user task intent explicitly matches MCP domain capability.
 * 3. Normal LLM fallback reasoning.
 */

export interface ToolRoutingCandidate {
	toolName: string;
	serverName?: string;
	isNative: boolean;
	isMcp: boolean;
	mcpName?: string;
	category?: string;
}

export interface SelectedToolDecision {
	selectedTool: ToolRoutingCandidate;
	preferenceScore: number;
	reasoning: string;
	matchedDomain?: string;
}

export interface IntentContext {
	userPrompt: string;
	fileExtensions?: string[];
	activeTaskType?: "code_search" | "browser_test" | "doc_lookup" | "git_ops" | "general";
}

/**
 * Domain capability patterns for boosting recommended MCP tools
 */
const MCP_PREFERENCE_RULES = [
	{
		mcpName: "serena",
		pattern: /\b(call graph|symbol reference|references to|rename symbol|hover doc|outline|go to def|type hierarchy)\b/i,
		nonTsPattern: /\.(py|rs|go|cpp|c|java|rb|php|swift|kt|cs)\b/i,
		boostScore: 0.68,
		domain: "Multi-Language AST & Code Intelligence",
	},
	{
		mcpName: "playwright",
		pattern: /\b(click|fill|screenshot|browser|dom|ui test|web page|render js|playwright|scrape spa)\b/i,
		boostScore: 0.70,
		domain: "Browser Automation & Visual Verification",
	},
	{
		mcpName: "context7",
		pattern: /\b(docs for|documentation|api reference|library docs|lookup api|framework docs)\b/i,
		boostScore: 0.65,
		domain: "External Library Documentation",
	},
	{
		mcpName: "git",
		pattern: /\b(git log|git blame|git branch|git history|git commit history|git checkout|git merge|git stash)\b/i,
		boostScore: 0.60,
		domain: "Structured Local Git Operations",
	},
];

/**
 * Evaluate tool routing score for a given candidate against the user intent context
 */
export function evaluateToolSelection(
	candidates: ToolRoutingCandidate[],
	context: IntentContext,
): SelectedToolDecision {
	let bestCandidate = candidates[0];
	let maxScore = -1;
	let selectionReason = "Default native tool selection";
	let matchedDomain: string | undefined;

	for (const candidate of candidates) {
		let score = candidate.isNative ? 1.0 : 0.4;

		if (candidate.isMcp && candidate.mcpName) {
			for (const rule of MCP_PREFERENCE_RULES) {
				if (rule.mcpName === candidate.mcpName) {
					const textMatch = rule.pattern.test(context.userPrompt);
					const fileMatch = rule.nonTsPattern
						? (context.fileExtensions || []).some((ext) => rule.nonTsPattern?.test(`.${ext}`))
						: false;

					if (textMatch || fileMatch) {
						// Boost recommended MCP score to 1.25+ to prioritize over native default tools (score 1.0)
						score = 1.25 + (textMatch ? 0.15 : 0.05);
						if (score > maxScore) {
							maxScore = score;
							bestCandidate = candidate;
							selectionReason = `Recommended MCP '${candidate.mcpName}' selected for ${rule.domain} (bias weight: ${score.toFixed(2)})`;
							matchedDomain = rule.domain;
						}
					}
				}
			}
		}

		if (score > maxScore) {
			maxScore = score;
			bestCandidate = candidate;
			if (candidate.isNative) {
				selectionReason = `Native tool '${candidate.toolName}' selected for standard operation`;
			}
		}
	}

	return {
		selectedTool: bestCandidate || { toolName: "read_files", isNative: true, isMcp: false },
		preferenceScore: maxScore,
		reasoning: selectionReason,
		matchedDomain,
	};
}
