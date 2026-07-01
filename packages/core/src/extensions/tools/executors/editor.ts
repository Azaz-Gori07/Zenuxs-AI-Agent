/**
 * Editor Executor
 *
 * Built-in implementation for filesystem editing operations.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { AgentToolContext } from "@cline/shared";
import type { EditFileInput } from "../schemas";
import type { EditorExecutor } from "../types";
import { assertPathSafe } from "./safety";

/**
 * Options for the editor executor
 */
export interface EditorExecutorOptions {
	/**
	 * File encoding used for read/write operations
	 * @default "utf-8"
	 */
	encoding?: BufferEncoding;

	/**
	 * Restrict relative-path file operations to paths inside cwd.
	 * Absolute paths are always accepted as-is.
	 * @default true
	 */
	restrictToCwd?: boolean;

	/**
	 * Maximum number of diff lines in str_replace output
	 * @default 200
	 */
	maxDiffLines?: number;

	/**
	 * Whether to create .bak backups before overwriting existing files.
	 * Used by the T6 full-file-rewrite fallback chain.
	 * @default false
	 */
	createBackupBeforeRewrite?: boolean;
}

async function resolveFilePath(
	cwd: string,
	inputPath: string,
	restrictToCwd: boolean,
): Promise<string> {
	const isAbsoluteInput = path.isAbsolute(inputPath);
	const resolved = isAbsoluteInput
		? path.normalize(inputPath)
		: path.resolve(cwd, inputPath);
	if (!restrictToCwd) {
		return resolved;
	}

	return await assertPathSafe(resolved, cwd);
}

function countOccurrences(content: string, needle: string): number {
	if (needle.length === 0) return 0;
	return content.split(needle).length - 1;
}

function createLineDiff(
	oldContent: string,
	newContent: string,
	maxLines: number,
): string {
	const oldLines = oldContent.split("\n");
	const newLines = newContent.split("\n");
	const max = Math.max(oldLines.length, newLines.length);
	const out: string[] = ["```diff"];
	let emitted = 0;

	for (let i = 0; i < max; i++) {
		if (emitted >= maxLines) {
			out.push("... diff truncated ...");
			break;
		}

		const oldLine = oldLines[i];
		const newLine = newLines[i];

		if (oldLine === newLine) {
			continue;
		}

		const lineNo = i + 1;
		if (oldLine !== undefined) {
			out.push(`-${lineNo}: ${oldLine}`);
			emitted++;
		}
		if (newLine !== undefined && emitted < maxLines) {
			out.push(`+${lineNo}: ${newLine}`);
			emitted++;
		}
	}

	out.push("```");
	return out.join("\n");
}

async function createFile(
	filePath: string,
	fileText: string,
	encoding: BufferEncoding,
): Promise<string> {
	await fs.mkdir(path.dirname(filePath), { recursive: true });
	await fs.writeFile(filePath, fileText, { encoding });
	return `File created successfully at: ${filePath}`;
}

async function backupFile(
	filePath: string,
	_encoding: BufferEncoding,
): Promise<string | null> {
	try {
		const stat = await fs.stat(filePath);
		if (!stat.isFile()) return null;
		const backupPath = `${filePath}.bak`;
		await fs.copyFile(filePath, backupPath);
		return backupPath;
	} catch {
		return null;
	}
}

async function getPathKind(
	filePath: string,
): Promise<"missing" | "file" | "directory" | "other"> {
	try {
		const stat = await fs.stat(filePath);
		if (stat.isFile()) return "file";
		if (stat.isDirectory()) return "directory";
		return "other";
	} catch (error) {
		if (
			error instanceof Error &&
			"code" in error &&
			((error as NodeJS.ErrnoException).code === "ENOENT" ||
				(error as NodeJS.ErrnoException).code === "ENOTDIR")
		) {
			return "missing";
		}
		throw error;
	}
}

async function replaceInFile(
	filePath: string,
	oldStr: string,
	newStr: string | null | undefined,
	encoding: BufferEncoding,
	maxDiffLines: number,
	createBackup: boolean,
): Promise<string> {
	const content = await fs.readFile(filePath, encoding);
	const occurrences = countOccurrences(content, oldStr);

	if (occurrences === 0) {
		throw new Error(`No replacement performed: text not found in ${filePath}.`);
	}

	if (occurrences > 1) {
		throw new Error(
			`No replacement performed: multiple occurrences of text found in ${filePath}.`,
		);
	}

	let backupPath: string | null = null;
	if (createBackup) {
		backupPath = await backupFile(filePath, encoding);
	}

	const updated = content.replace(oldStr, newStr ?? "");
	await fs.writeFile(filePath, updated, { encoding });

	const diff = createLineDiff(content, updated, maxDiffLines);
	const lines = [`Edited ${filePath}`, diff];
	if (backupPath) {
		lines.push(`Backup saved at: ${backupPath}`);
	}
	return lines.join("\n");
}

async function insertInFile(
	filePath: string,
	insertLineOneBased: number,
	newStr: string,
	encoding: BufferEncoding,
): Promise<string> {
	const content = await fs.readFile(filePath, encoding);
	const lines = content.split("\n");
	const maxBoundaryLine = lines.length + 1;

	if (insertLineOneBased < 1 || insertLineOneBased > maxBoundaryLine) {
		throw new Error(
			`Invalid insert_line: ${insertLineOneBased}. insert_line must be a positive one-based boundary line in the range 1-${maxBoundaryLine}. Use ${maxBoundaryLine} to append at EOF.`,
		);
	}

	const insertLine = insertLineOneBased - 1;
	lines.splice(insertLine, 0, ...newStr.split("\n"));
	await fs.writeFile(filePath, lines.join("\n"), { encoding });

	return `Inserted content at line ${insertLineOneBased} in ${filePath}.`;
}

/**
 * Create an editor executor using Node.js fs module
 */
export function createEditorExecutor(
	options: EditorExecutorOptions = {},
): EditorExecutor {
	const {
		encoding = "utf-8",
		restrictToCwd = true,
		maxDiffLines = 200,
		createBackupBeforeRewrite = false,
	} = options;

	return async (
		input: EditFileInput,
		cwd: string,
		_context: AgentToolContext,
	): Promise<string> => {
		const filePath = await resolveFilePath(cwd, input.path, restrictToCwd);
		const pathKind = await getPathKind(filePath);

		if (pathKind === "directory") {
			throw new Error(`Path is a directory, not a file: ${filePath}`);
		}
		if (pathKind === "other") {
			throw new Error(`Unsupported path type: ${filePath}`);
		}

		if (input.insert_line != null) {
			if (pathKind === "missing") {
				throw new Error(`File not found: ${filePath}`);
			}
			return insertInFile(
				filePath,
				input.insert_line, // One-based index
				input.new_text,
				encoding,
			);
		}

		if (pathKind === "missing") {
			return createFile(filePath, input.new_text, encoding);
		}
		if (input.old_text == null) {
			throw new Error(
				"Parameter `old_text` is required when editing an existing file without `insert_line`",
			);
		}

		return replaceInFile(
			filePath,
			input.old_text,
			input.new_text,
			encoding,
			maxDiffLines,
			createBackupBeforeRewrite,
		);
	};
}
