import type { ToolPolicy } from "@cline/shared";
import {
	getAutoApprovals,
	setAutoApproval,
} from "./global-settings";

export type PermissionCategory =
	| "read"
	| "read-out-of-workspace"
	| "write"
	| "write-out-of-workspace"
	| "mcp"
	| "mode"
	| "subtasks"
	| "execute"
	| "questions";

export const APPROVAL_PERMISSIONS: Record<
	PermissionCategory,
	{ label: string; description: string; toolNames: string[] }
> = {
	read: {
		label: "Read",
		description: "Allow reading files within workspace",
		toolNames: ["read_files", "read", "glob"],
	},
	"read-out-of-workspace": {
		label: "Read out of workspace",
		description: "Allow reading files outside workspace",
		toolNames: ["read_files", "read"],
	},
	write: {
		label: "Write",
		description: "Allow writing files within workspace",
		toolNames: ["write_file", "write", "edit", "editor", "create_file", "replace_in_file", "apply_patch"],
	},
	"write-out-of-workspace": {
		label: "Write out of workspace",
		description: "Allow writing files outside workspace",
		toolNames: ["write_file", "write", "edit", "editor"],
	},
	mcp: {
		label: "MCP",
		description: "Allow MCP server operations",
		toolNames: ["mcp_tool_call", "call_mcp_tool"],
	},
	mode: {
		label: "Mode",
		description: "Allow switching between plan/act modes",
		toolNames: ["mode_switch", "switch_mode"],
	},
	subtasks: {
		label: "Subtasks",
		description: "Allow creating and managing subtasks",
		toolNames: ["spawn_agent", "subtask", "create_subtask"],
	},
	execute: {
		label: "Execute",
		description: "Allow executing commands",
		toolNames: ["run_commands", "bash", "shell", "execute_command"],
	},
	questions: {
		label: "Questions",
		description: "Allow asking clarifying questions",
		toolNames: ["ask_question", "ask_followup_question"],
	},
};

export class AutoApprovalService {
	getAllPermissions(): Record<string, boolean> {
		return getAutoApprovals();
	}

	setPermission(permission: string, enabled: boolean): Record<string, boolean> {
		return setAutoApproval(permission, enabled);
	}

	isApproved(permission: PermissionCategory): boolean {
		const approvals = getAutoApprovals();
		return approvals[permission] === true;
	}

	getToolPolicyOverrides(): Record<string, Partial<ToolPolicy>> {
		const approvals = getAutoApprovals();
		const overrides: Record<string, Partial<ToolPolicy>> = {};

		for (const [category, enabled] of Object.entries(approvals)) {
			if (!enabled) continue;
			const config = APPROVAL_PERMISSIONS[category as PermissionCategory];
			if (!config) continue;
			for (const toolName of config.toolNames) {
				overrides[toolName] = { autoApprove: true };
			}
		}

		return overrides;
	}

	applyToToolPolicies(
		policies: Record<string, ToolPolicy>,
	): Record<string, ToolPolicy> {
		const overrides = this.getToolPolicyOverrides();
		const result: Record<string, ToolPolicy> = { ...policies };

		for (const [toolName, override] of Object.entries(overrides)) {
			result[toolName] = { ...result[toolName], ...override };
		}

		return result;
	}
}

export function createAutoApprovalService(): AutoApprovalService {
	return new AutoApprovalService();
}
