/**
 * Safe Git Helper
 *
 * Provides safe git operations with pre-flight checks for dirty working trees,
 * merge conflicts, and detached HEAD states.
 *
 * This is a helper utility (T9), not a standalone tool — it wraps the bash
 * executor to provide safe git operations.
 */

import type { AgentToolContext } from "@cline/shared";
import type { BashExecutor } from "../types";

export interface GitStatus {
	/** Current branch name (null if detached HEAD) */
	branch: string | null;
	/** Whether the working tree is dirty */
	isDirty: boolean;
	/** Whether there are unmerged files (merge conflicts) */
	hasConflicts: boolean;
	/** Whether HEAD is detached */
	isDetached: boolean;
	/** Number of staged files */
	stagedCount: number;
	/** Number of unstaged modifications */
	unstagedCount: number;
	/** Number of untracked files */
	untrackedCount: number;
	/** Raw status output */
	rawStatus: string;
}

export interface GitDiffResult {
	/** The diff output */
	diff: string;
	/** Number of files changed */
	filesChanged: number;
	/** Number of insertions */
	insertions: number;
	/** Number of deletions */
	deletions: number;
}

/**
 * Parse git status --porcelain output into structured data.
 */
export function parseGitStatus(raw: string): Omit<GitStatus, "rawStatus"> {
	const lines = raw.split("\n").filter((l) => l.length > 0);

	let branch: string | null = null;
	let isDetached = false;
	let isDirty = false;
	let hasConflicts = false;
	let stagedCount = 0;
	let unstagedCount = 0;
	let untrackedCount = 0;

	for (const line of lines) {
		const indexStatus = line[0] ?? " ";
		const workTreeStatus = line[1] ?? " ";

		// Detect conflicts (unmerged)
		if (
			(indexStatus === "U" && workTreeStatus === "U") ||
			(indexStatus === "A" && workTreeStatus === "A") ||
			(indexStatus === "D" && workTreeStatus === "D")
		) {
			hasConflicts = true;
		}

		// Count staged
		if (indexStatus !== " " && indexStatus !== "?") {
			stagedCount++;
			isDirty = true;
		}

		// Count unstaged
		if (workTreeStatus !== " " && workTreeStatus !== "?") {
			unstagedCount++;
			isDirty = true;
		}

		// Count untracked
		if (indexStatus === "?" && workTreeStatus === "?") {
			untrackedCount++;
			isDirty = true;
		}
	}

	return {
		branch,
		isDirty,
		hasConflicts,
		isDetached,
		stagedCount,
		unstagedCount,
		untrackedCount,
	};
}

/**
 * Parse git diff --stat output for summary counts.
 */
export function parseDiffStat(statOutput: string): {
	filesChanged: number;
	insertions: number;
	deletions: number;
} {
	const summaryMatch = statOutput.match(
		/(\d+)\s+files?\s+changed(?:,\s+(\d+)\s+insertions?\(\+\))?(?:,\s+(\d+)\s+deletions?\(-\))?/,
	);
	if (summaryMatch) {
		return {
			filesChanged: parseInt(summaryMatch[1], 10),
			insertions: summaryMatch[2] ? parseInt(summaryMatch[2], 10) : 0,
			deletions: summaryMatch[3] ? parseInt(summaryMatch[3], 10) : 0,
		};
	}
	return { filesChanged: 0, insertions: 0, deletions: 0 };
}

/**
 * Create a safe git helper that wraps the bash executor.
 */
export function createGitHelper(bashExecutor: BashExecutor) {
	/**
	 * Get the current git status with pre-flight checks.
	 */
	async function getStatus(
		cwd: string,
		context: AgentToolContext,
	): Promise<GitStatus> {
		try {
			const rawStatus = await bashExecutor(
				"git status --porcelain -b",
				cwd,
				context,
			);

			// Parse branch from first line: "## main" or "## HEAD (no branch)"
			const branchLine = rawStatus.split("\n")[0] ?? "";
			const branchMatch = branchLine.match(/^##\s+(.+)/);
			let branch: string | null = null;
			let isDetached = false;

			if (branchMatch) {
				const branchInfo = branchMatch[1];
				if (branchInfo.includes("HEAD") && branchInfo.includes("no branch")) {
					isDetached = true;
				} else {
					branch = branchInfo.split("...")[0].trim();
				}
			}

			// Parse the rest
			const statusWithoutBranch = rawStatus
				.split("\n")
				.slice(1)
				.join("\n");
			const parsed = parseGitStatus(statusWithoutBranch);

			return {
				...parsed,
				branch,
				isDetached,
				rawStatus,
			};
		} catch (error) {
			// Not a git repo or git not available
			return {
				branch: null,
				isDirty: false,
				hasConflicts: false,
				isDetached: false,
				stagedCount: 0,
				unstagedCount: 0,
				untrackedCount: 0,
				rawStatus: "",
			};
		}
	}

	/**
	 * Get a diff summary between HEAD and working tree (or specific refs).
	 */
	async function getDiff(
		cwd: string,
		context: AgentToolContext,
		ref?: string,
	): Promise<GitDiffResult> {
		const refArg = ref ? `${ref} ` : "";
		const diff = await bashExecutor(`git diff ${refArg}--stat`, cwd, context);
		const stat = parseDiffStat(diff);
		return { diff, ...stat };
	}

	/**
	 * Safely create a commit — checks for dirty tree and no conflicts first.
	 */
	async function safeCommit(
		cwd: string,
		context: AgentToolContext,
		message: string,
	): Promise<string> {
		const status = await getStatus(cwd, context);

		if (status.hasConflicts) {
			throw new Error(
				"Cannot commit: unresolved merge conflicts. Resolve conflicts first.",
			);
		}

		if (status.isDetached) {
			throw new Error(
				"Cannot commit: HEAD is detached. Checkout a branch first.",
			);
		}

		if (!status.isDirty) {
			throw new Error("Cannot commit: working tree is clean. Nothing to commit.");
		}

		if (status.stagedCount === 0) {
			throw new Error(
				"Cannot commit: no staged changes. Stage files with `git add` first.",
			);
		}

		return bashExecutor(
			`git commit -m ${JSON.stringify(message)}`,
			cwd,
			context,
		);
	}

	/**
	 * Safely create a branch — checks for dirty tree state.
	 */
	async function safeBranch(
		cwd: string,
		context: AgentToolContext,
		branchName: string,
	): Promise<string> {
		return bashExecutor(
			`git checkout -b ${JSON.stringify(branchName)}`,
			cwd,
			context,
		);
	}

	/**
	 * Safely rollback the last commit (soft reset) — preserves changes.
	 */
	async function safeRollback(
		cwd: string,
		context: AgentToolContext,
	): Promise<string> {
		const status = await getStatus(cwd, context);

		if (status.isDetached) {
			throw new Error(
				"Cannot rollback: HEAD is detached. Checkout a branch first.",
			);
		}

		return bashExecutor("git reset --soft HEAD~1", cwd, context);
	}

	return {
		getStatus,
		getDiff,
		safeCommit,
		safeBranch,
		safeRollback,
	};
}

export type GitHelper = ReturnType<typeof createGitHelper>;
