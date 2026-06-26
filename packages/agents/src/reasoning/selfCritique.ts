import type { AgentMessage, AgentMessagePart } from "@cline/shared";
import type { AgentRuntime } from "../agent-runtime";
import type { AgentRole } from "../subagents/types";

const CRITIC_SYSTEM_PROMPT = `You are a Critical Reviewer. Your role is to find bugs, logic errors, edge cases, and quality issues in code or plans.

Your responsibilities:
1. Analyze the provided code or plan for correctness, completeness, and quality
2. Check for:
   - Bugs and logic errors
   - Edge cases not handled
   - Security vulnerabilities
   - Code style and convention compliance
   - Missing error handling
   - Performance issues
3. Assign a confidence score (0.0–1.0) where 1.0 means the output is perfect and ready to use
4. Output structured feedback

Output your critique in this format:
CRITIQUE:
Issues:
- [Severity: HIGH/MEDIUM/LOW] Description of each issue
Confidence: 0.XX

Be specific about what needs to change. Reference exact lines or sections.`;

const REFINER_SYSTEM_PROMPT = `You are a Code and Plan Refiner. Your role is to fix all issues identified by the critic and produce an improved version.

Your responsibilities:
1. Carefully consider each issue raised by the critic
2. Fix every issue without introducing new problems
3. Produce the complete improved output — not just the changed parts
4. Keep the same format and structure as the original
5. Do NOT add commentary or explanations — the output itself is the improvement

Output ONLY the improved code or plan. No prefixes, no explanations, no markdown wrappers.`;

function extractText(message: AgentMessage): string {
	return message.content
		.filter((p: AgentMessagePart): boolean => p.type === "text")
		.map((p: any) => p.text)
		.join("\n")
		.trim();
}

function parseConfidence(text: string): number | null {
	// Match "Confidence: 0.XX" or "Confidence: 0.XX" in the text
	const match = text.match(/Confidence:\s*([01]\.\d+)/i);
	if (match) {
		const val = parseFloat(match[1]);
		if (!isNaN(val) && val >= 0 && val <= 1) {
			return val;
		}
	}
	// Fallback: look for a standalone decimal between 0 and 1
	const fallback = text.match(/([01]\.\d{2})/);
	if (fallback) {
		const val = parseFloat(fallback[1]);
		if (!isNaN(val) && val >= 0 && val <= 1) {
			return val;
		}
	}
	return null;
}

export interface SelfCritiqueResult {
	refinedText: string;
	confidence: number;
	loopsUsed: number;
}

export async function runSelfCritique(
	runtime: AgentRuntime,
	role: AgentRole,
	initialText: string,
	task: string,
): Promise<SelfCritiqueResult> {
	const rt = runtime as any;
	const originalPrompt = rt.config.systemPrompt;

	let currentText = initialText;
	let confidence = 0;
	const MAX_LOOPS = 3;
	const CONFIDENCE_THRESHOLD = 0.7;
	let loopsUsed = 0;

	for (let loop = 0; loop < MAX_LOOPS; loop++) {
		loopsUsed++;
		const beforeLen = rt.state.messages.length;

		// -- Critic turn --
		rt.config.systemPrompt = CRITIC_SYSTEM_PROMPT;

		const criticContextMsg: AgentMessage = {
			id: `critic_ctx_${loop}`,
			role: "user",
			content: [
				{
					type: "text",
					text: `Task: ${task}\n\nOutput from ${role} agent to review:\n${currentText}`,
				} as any,
			],
			createdAt: Date.now(),
		};
		rt.state.messages.push(criticContextMsg);

		console.log(`[CRITIC TURN ${loop + 1}]`);
		const criticRes = await rt.generateAssistantMessage();
		const criticText = extractText(criticRes.message);

		const parsedConfidence = parseConfidence(criticText);
		if (parsedConfidence !== null) {
			confidence = parsedConfidence;
		}

		// -- Refiner turn --
		rt.config.systemPrompt = REFINER_SYSTEM_PROMPT;

		const refinerContextMsg: AgentMessage = {
			id: `refiner_ctx_${loop}`,
			role: "user",
			content: [
				{
					type: "text",
					text: `Task: ${task}\n\nOriginal output:\n${currentText}\n\nCritique:\n${criticText}\n\nImprove the output above to fix all issues raised in the critique. Output ONLY the improved version.`,
				} as any,
			],
			createdAt: Date.now(),
		};
		rt.state.messages.push(refinerContextMsg);

		console.log(`[REFINER TURN ${loop + 1}]`);
		const refinerRes = await rt.generateAssistantMessage();
		const refinerText = extractText(refinerRes.message);

		// Restore messages to before this loop
		rt.state.messages.splice(beforeLen);

		if (refinerText) {
			currentText = refinerText;
		}

		console.log(`[ASSISTANT TURN ${loop + 1}] confidence=${confidence.toFixed(2)}`);

		if (confidence >= CONFIDENCE_THRESHOLD) {
			break;
		}
	}

	rt.config.systemPrompt = originalPrompt;

	return { refinedText: currentText, confidence, loopsUsed };
}
