import * as path from "node:path";
import * as fs from "node:fs/promises";
import os from "node:os";

const DARWIN_HOME = [
	"Music",
	"Pictures",
	"Movies",
	"Downloads",
	"Desktop",
	"Documents",
	"Public",
	"Applications",
	"Library",
];

const DARWIN_LIBRARY = [
	"Application Support/AddressBook",
	"Calendars",
	"Mail",
	"Messages",
	"Safari",
	"Cookies",
	"Application Support/com.apple.TCC",
	"PersonalizationPortrait",
	"Metadata/CoreSpotlight",
	"Suggestions",
];

const DARWIN_ROOT = ["/.DocumentRevisions-V100", "/.Spotlight-V100", "/.Trashes", "/.fseventsd"];
const WIN32_HOME = ["AppData", "Downloads", "Desktop", "Documents", "Pictures", "Music", "Videos", "OneDrive"];


/**
 * Gets names of directory basenames to skip when scanning the home directory.
 */
export function getProtectedNames(): Set<string> {
	if (process.platform === "darwin") return new Set(DARWIN_HOME);
	if (process.platform === "win32") return new Set(WIN32_HOME);
	return new Set();
}

/**
 * Gets absolute paths of system directories that should be protected.
 */
export function getProtectedPaths(): string[] {
	const home = os.homedir();
	if (process.platform === "darwin") {
		return [
			...DARWIN_HOME.map((name) => path.join(home, name)),
			...DARWIN_LIBRARY.map((name) => path.join(home, "Library", name)),
			...DARWIN_ROOT,
		];
	}
	if (process.platform === "win32") {
		return WIN32_HOME.map((name) => path.join(home, name));
	}
	return [];
}

/**
 * Determines if a resolved path is protected based on workspace context.
 */
export function isPathProtected(resolvedPath: string, workspaceRoot: string): boolean {
	const protectedPaths = getProtectedPaths();
	const normalizedPath = path.normalize(resolvedPath).toLowerCase();
	const normalizedWorkspace = path.normalize(workspaceRoot).toLowerCase();

	// Check if the resolved path is inside or equal to the workspaceRoot
	const relToWorkspace = path.relative(normalizedWorkspace, normalizedPath);
	const isInsideWorkspace =
		relToWorkspace === "" ||
		(!relToWorkspace.startsWith("..") && !path.isAbsolute(relToWorkspace));

	// If resolved path is not inside workspace, it escapes workspace and will be blocked by isPathSafe.
	// If it is inside workspace, check if we should block it because it lies inside a protected folder
	// which is a descendant of the workspace.
	for (const p of protectedPaths) {
		const normalizedProtected = path.normalize(p).toLowerCase();
		const relToProtected = path.relative(normalizedProtected, normalizedPath);
		const isInsideProtected =
			relToProtected === "" ||
			(!relToProtected.startsWith("..") && !path.isAbsolute(relToProtected));

		if (isInsideProtected) {
			const workspaceRelToProtected = path.relative(
				normalizedProtected,
				normalizedWorkspace,
			);
			const workspaceInsideProtected =
				workspaceRelToProtected === "" ||
				(!workspaceRelToProtected.startsWith("..") &&
					!path.isAbsolute(workspaceRelToProtected));

			if (workspaceInsideProtected) {
				// Workspace is inside or equal to the protected folder, so we allow it if it's inside the workspace
				if (isInsideWorkspace) {
					continue;
				}
			} else {
				// Protected folder is a descendant of the workspace, so we must block access
				return true;
			}
		}
	}
	return false;
}

/**
 * Robustly resolves a target path to its real absolute path, handling non-existent files
 * by finding the nearest existing ancestor directory first.
 */
export async function getRealPath(targetPath: string): Promise<string> {
	try {
		return await fs.realpath(targetPath);
	} catch (error: any) {
		if (error.code === "ENOENT") {
			let current = path.dirname(targetPath);
			while (current !== path.dirname(current)) {
				try {
					const resolvedParent = await fs.realpath(current);
					return path.join(resolvedParent, path.relative(current, targetPath));
				} catch (parentError: any) {
					if (parentError.code !== "ENOENT") {
						throw parentError;
					}
				}
				current = path.dirname(current);
			}
		}
		throw error;
	}
}

/**
 * Asserts that a target path lies within the workspace root directory and is not inside a protected system folder.
 * Throws an Error if validation fails.
 */
export async function assertPathSafe(targetPath: string, workspaceRoot: string): Promise<string> {
	const resolvedWorkspace = await fs.realpath(workspaceRoot);
	const resolvedTarget = await getRealPath(path.resolve(workspaceRoot, targetPath));

	const relative = path.relative(resolvedWorkspace, resolvedTarget);
	const isSafe =
		relative === "" ||
		(!relative.startsWith("..") && !path.isAbsolute(relative));

	if (!isSafe) {
		throw new Error(`Access denied: path escapes the workspace root: ${targetPath}`);
	}

	if (isPathProtected(resolvedTarget, resolvedWorkspace)) {
		throw new Error(`Access denied: path is within a protected system directory: ${targetPath}`);
	}

	return resolvedTarget;
}
