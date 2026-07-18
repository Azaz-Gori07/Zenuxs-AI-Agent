import { basename } from "node:path";
import { type AgentMode, buildZenuxsSystemPrompt } from "@cline/shared";
import { buildWorkspaceMetadata } from "../services/workspace/workspace-manifest";
import { fetchZenuxsMemory } from "../services/zenuxs-memory";
import { mergeRulesForSystemPrompt } from "./safety/rules";

export const PLAN_MODE_INSTRUCTIONS = `# Plan Mode

You are in Plan mode. Your role is to explore, analyze, and plan -- not to execute.

- Read files, search the codebase, and gather context to understand the problem
- Ask clarifying questions when requirements are ambiguous
- Present your plan as a structured outline with clear steps
- Explain tradeoffs between different approaches when they exist
- Do NOT edit files, write code, run destructive commands, or make any changes
- Do NOT implement anything -- focus on understanding and alignment first

When the user aligns on a plan and is ready to proceed, use the switch_to_act_mode tool to switch to act mode and begin implementation.`;

export async function resolveSystemPrompt(input: {
	cwd: string;
	explicitSystemPrompt?: string;
	providerId?: string;
	rules?: string;
	mode?: AgentMode;
	/** Zenuxs AI JWT token for fetching shared memory */
	zenuxsAuthToken?: string;
	/** IDE label (e.g. "VS Code", "Terminal Shell") */
	ide?: string;
}): Promise<string> {
	const metadata = await buildWorkspaceMetadata(input.cwd);
	let rules = mergeRulesForSystemPrompt(undefined, input.rules);
	if (input.mode === "plan") {
		rules = rules
			? `${rules}\n\n${PLAN_MODE_INSTRUCTIONS}`
			: PLAN_MODE_INSTRUCTIONS;
	}
	let systemPrompt = buildZenuxsSystemPrompt({
		ide: input.ide || "VS Code",
		workspaceRoot: input.cwd,
		workspaceName: basename(input.cwd),
		metadata,
		rules,
		mode: input.mode,
		providerId: input.providerId,
		overridePrompt: input.explicitSystemPrompt,
		platform:
			(typeof process !== "undefined" && process?.platform) || "unknown",
	});

	// Inject Zenuxs AI memory context if available
	const zenuxsToken = input.zenuxsAuthToken?.trim();
	if (zenuxsToken) {
		const memoryContext = await fetchZenuxsMemory(zenuxsToken);
		if (memoryContext.hasMemories) {
			systemPrompt = systemPrompt + memoryContext.promptBlock;
		}
	}

	return systemPrompt;
}
