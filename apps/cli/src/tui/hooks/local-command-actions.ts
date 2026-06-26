import type { LocalSlashCommandInvocation } from "../utils/skill-command-input";
import type { OpenConfigOptions } from "./use-config-panel";

export interface LocalSlashCommandActionInput {
	name: string;
	openAccount: () => void;
	openConfig: (options?: OpenConfigOptions) => void;
	openMcpManager: () => Promise<boolean>;
	openModelsSelector: () => void;
	openConnectSelector: () => void;
	openSkills: (invocation?: LocalSlashCommandInvocation) => void;
	invocation?: LocalSlashCommandInvocation;
	runCompact: () => void;
	runFork: () => void;
	runUndo: () => Promise<void>;
	clearConversation: () => Promise<void>;
	logout: () => Promise<void>;
	clearData: () => Promise<void>;
	openHelp: () => void;
	openHistory: () => void;
	exitCline: () => void;
}

export function runLocalSlashCommandAction(
	input: LocalSlashCommandActionInput,
): boolean | Promise<boolean> {
	const normalized = input.name;
	if (normalized === "config" || normalized === "settings") {
		input.openConfig();
		return true;
	}
	if (normalized === "plugins") {
		input.openConfig({ initialTab: "plugins" });
		return true;
	}
	if (normalized === "skills") {
		input.openSkills(input.invocation);
		return true;
	}
	if (normalized === "mcp") {
		return input.openMcpManager().then(() => true);
	}
	if (normalized === "account") {
		input.openAccount();
		return true;
	}
	if (normalized === "models") {
		input.openModelsSelector();
		return true;
	}
	if (normalized === "connect") {
		input.openConnectSelector();
		return true;
	}
	if (normalized === "compact") {
		input.runCompact();
		return true;
	}
	if (normalized === "fork") {
		input.runFork();
		return true;
	}
	if (normalized === "undo") {
		return input.runUndo().then(() => true);
	}
	if (normalized === "clear") {
		return input.clearConversation().then(() => true);
	}
	if (normalized === "logout") {
		return input.logout().then(() => true);
	}
	if (normalized === "cleardata") {
		return input.clearData().then(() => true);
	}
	if (normalized === "help") {
		input.openHelp();
		return true;
	}
	if (normalized === "history") {
		input.openHistory();
		return true;
	}
	if (normalized === "quit") {
		setTimeout(input.exitCline, 0);
		return true;
	}
	return false;
}
