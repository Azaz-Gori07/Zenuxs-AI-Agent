import type { WorkspaceContext } from "../extensions/context";
import { isZenuxsProvider } from "../providers/utils";
import type { WorkspaceInfo } from "../session/workspace";
import {
	DEFAULT_ZENUXS_SYSTEM_PROMPT,
	YOLO_ZENUXS_SYSTEM_PROMPT,
} from "./system";
import type { SystemPart } from "../agent";
import { normalizeSystemInput, buildSystemPrompt as composeSystemParts } from "./system-part";

const WORKSPACE_CONFIGURATION_MARKER = "# Workspace Configuration";

export function processWorkspaceInfo(info: WorkspaceInfo): string {
	return JSON.stringify({
		workspaces: {
			[info.rootPath]: {
				hint: info.hint,
				associatedRemoteUrls: info.associatedRemoteUrls,
				latestGitCommitHash: info.latestGitCommitHash,
				latestGitBranchName: info.latestGitBranchName,
			},
		},
	});
}

function buildWorkspaceMetadata(
	rootPath: string,
	workspaceName?: string,
	metadata?: string,
): string {
	if (metadata?.trim()?.includes(WORKSPACE_CONFIGURATION_MARKER)) {
		return metadata.trim();
	}
	const body =
		metadata ||
		JSON.stringify({
			workspaces: {
				[rootPath]: {
					hint: workspaceName || rootPath.split("/").at(-1) || rootPath,
				},
			},
		});
	return `\n${WORKSPACE_CONFIGURATION_MARKER}\n${body}`;
}

/**
 * Options for building the Zenuxs system prompt.
 *
 * Extends WorkspaceContext so callers can spread an ExtensionContext.workspace
 * directly. `workspaceRoot` is accepted as an alias for `rootPath` to support
 * existing call sites that set it explicitly.
 */
export interface ZenuxsSystemPromptOptions
	extends Omit<WorkspaceContext, "rootPath"> {
	/**
	 * Workspace root path. Accepts either `rootPath` (from WorkspaceContext/WorkspaceInfo)
	 * or `workspaceRoot` (legacy alias) — whichever is provided will be used.
	 */
	rootPath?: string;
	/** Alias for rootPath — kept for backwards compatibility with existing call sites */
	workspaceRoot?: string;
	/** Per-request system prompt override */
	overridePrompt?: string;
	/** Provider ID — used to gate Zenuxs-specific metadata injection */
	providerId?: string;
	/**
	 * Additional system parts composed after the base prompt.
	 * Supports cache hints and metadata for advanced provider handling.
	 * Ported from OpenCode's SystemPart model.
	 */
	systemParts?: readonly SystemPart[] | string;
}

export function buildZenuxsSystemPrompt(
	options: ZenuxsSystemPromptOptions,
): string {
	const {
		ide = "Terminal Shell",
		mode,
		platform = "unknown",
		workspaceName,
		metadata,
		rules,
		overridePrompt,
		providerId,
		systemParts,
	} = options;
	const workspaceRoot = options.workspaceRoot ?? options.rootPath ?? "";
	const isZenuxs = isZenuxsProvider(providerId || "");

	let base: string;
	if (overridePrompt?.trim()) {
		const trimmed = overridePrompt.trim();
		if (
			isZenuxs &&
			metadata?.trim() &&
			!trimmed.includes(WORKSPACE_CONFIGURATION_MARKER)
		) {
			base = `${trimmed}\n\n${buildWorkspaceMetadata(workspaceRoot, workspaceName, metadata)}`.trim();
		} else {
			base = trimmed;
		}
	} else {
		const basePrompt =
			mode === "yolo" ? YOLO_ZENUXS_SYSTEM_PROMPT : DEFAULT_ZENUXS_SYSTEM_PROMPT;
		const dateStr = new Date().toLocaleDateString();
		const zenuxsMeta = isZenuxs
			? buildWorkspaceMetadata(workspaceRoot, workspaceName, metadata)
			: "";
		const zenuxsRules = rules || "";

		base = basePrompt
			.replace("{{PLATFORM_NAME}}", platform)
			.replace("{{CWD}}", workspaceRoot)
			.replace("{{CURRENT_DATE}}", dateStr)
			.replace("{{IDE_NAME}}", ide)
			.replace("{{ZENUXS_METADATA}}", zenuxsMeta)
			.replace("{{ZENUXS_RULES}}", zenuxsRules)
			.trim();
	}

	// Compose with system parts if provided
	if (systemParts) {
		const parts = normalizeSystemInput(systemParts);
		if (parts.length > 0) {
			return composeSystemParts(base, parts);
		}
	}

	return base;
}
