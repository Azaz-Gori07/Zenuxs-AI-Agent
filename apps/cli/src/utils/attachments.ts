import { statSync } from "node:fs";
import { resolve } from "node:path";

export class AttachmentError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "AttachmentError";
	}
}

/** Turn `--attach` paths into `@"..."` mentions handled by the prompt pipeline. */
export function resolveAttachmentMentions(
	paths: string[] | undefined,
	cwd: string,
): string[] {
	if (!paths?.length) return [];
	return paths.map((path) => {
		const absolute = resolve(cwd, path);
		let isFile = false;
		try {
			isFile = statSync(absolute).isFile();
		} catch {
			isFile = false;
		}
		if (!isFile) throw new AttachmentError(`--attach: no such file: ${path}`);
		return `@"${absolute}"`;
	});
}

export * as Attachments from "./attachments";
