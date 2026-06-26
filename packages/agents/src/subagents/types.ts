export type AgentRole = "planner" | "coder" | "reviewer" | "researcher" | "browser" | "";

export interface AgentHandoff {
	from: AgentRole;
	to: AgentRole;
	task: string;
	context: string;
	result: string;
}

export interface SubAgentConfig {
	role: AgentRole;
	systemPrompt: string;
	allowedMcpServers: string[];
}
