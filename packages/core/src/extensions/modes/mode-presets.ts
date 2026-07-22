import type { AgentMode } from "@cline/shared";

export interface ModeBehavior {
	id: AgentMode;
	label: string;
	description: string;
	systemPromptTag: string;
	toolPreset: string;
	executionStrategy: "sequential" | "parallel" | "auto";
	autonomyLevel: "minimal" | "moderate" | "high" | "full";
	approvalDefault: boolean;
	maxIterations?: number;
	enablePlanning: boolean;
	enableSelfCritique: boolean;
	enableSubAgents: boolean;
}

export const MODE_BEHAVIORS: Record<AgentMode, ModeBehavior> = {
	act: {
		id: "act",
		label: "Act",
		description: "Fast execution with minimal planning. Best for coding tasks and automation.",
		systemPromptTag: "act",
		toolPreset: "act",
		executionStrategy: "sequential",
		autonomyLevel: "high",
		approvalDefault: true,
		enablePlanning: false,
		enableSelfCritique: true,
		enableSubAgents: true,
	},
	plan: {
		id: "plan",
		label: "Plan",
		description: "Read-only analysis with structured planning. No file modifications.",
		systemPromptTag: "plan",
		toolPreset: "plan",
		executionStrategy: "sequential",
		autonomyLevel: "moderate",
		approvalDefault: true,
		enablePlanning: true,
		enableSelfCritique: true,
		enableSubAgents: true,
	},
	yolo: {
		id: "yolo",
		label: "YOLO",
		description: "Maximum autonomy with all tools auto-approved. Use only in trusted environments.",
		systemPromptTag: "yolo",
		toolPreset: "yolo",
		executionStrategy: "auto",
		autonomyLevel: "full",
		approvalDefault: false,
		enablePlanning: false,
		enableSelfCritique: false,
		enableSubAgents: false,
	},
	ask: {
		id: "ask",
		label: "Ask",
		description: "Conversation-first mode. Prefers explanation and questions over autonomous actions. Never executes tools without explicit user approval for each step.",
		systemPromptTag: "ask",
		toolPreset: "minimal",
		executionStrategy: "sequential",
		autonomyLevel: "minimal",
		approvalDefault: false,
		maxIterations: 50,
		enablePlanning: true,
		enableSelfCritique: true,
		enableSubAgents: false,
	},
	debug: {
		id: "debug",
		label: "Debug",
		description: "Diagnostic-first mode. Automatically gathers logs, inspects failures, collects system info before suggesting or applying fixes.",
		systemPromptTag: "debug",
		toolPreset: "search",
		executionStrategy: "sequential",
		autonomyLevel: "moderate",
		approvalDefault: true,
		maxIterations: 100,
		enablePlanning: true,
		enableSelfCritique: true,
		enableSubAgents: true,
	},
	god: {
		id: "god",
		label: "God",
		description: "Maximum capability mode. Full planning, parallel tool execution, multi-step reasoning, aggressive optimization. Minimal interruptions.",
		systemPromptTag: "god",
		toolPreset: "act",
		executionStrategy: "parallel",
		autonomyLevel: "full",
		approvalDefault: true,
		maxIterations: 200,
		enablePlanning: true,
		enableSelfCritique: true,
		enableSubAgents: true,
	},
	zen: {
		id: "zen",
		label: "Zen",
		description: "Balanced mode. Moderate autonomy with thoughtful execution and measured responses.",
		systemPromptTag: "zen",
		toolPreset: "act",
		executionStrategy: "sequential",
		autonomyLevel: "moderate",
		approvalDefault: true,
		enablePlanning: true,
		enableSelfCritique: true,
		enableSubAgents: true,
	},
};

export function getModeBehavior(mode: AgentMode): ModeBehavior {
	return MODE_BEHAVIORS[mode] ?? MODE_BEHAVIORS.act;
}

export function buildModeSystemPromptTag(mode: AgentMode): string {
	const behavior = getModeBehavior(mode);
	return [
		`[Mode: ${behavior.label}]`,
		behavior.description,
		`Execution: ${behavior.executionStrategy}`,
		`Autonomy: ${behavior.autonomyLevel}`,
		behavior.enablePlanning ? "Planning: enabled" : "Planning: disabled",
		behavior.enableSelfCritique ? "Self-critique: enabled" : "Self-critique: disabled",
		behavior.enableSubAgents ? "Sub-agents: allowed" : "Sub-agents: disabled",
	].join("\n");
}
