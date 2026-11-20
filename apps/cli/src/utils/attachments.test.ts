import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AttachmentError, resolveAttachmentMentions } from "./attachments";

describe("resolveAttachmentMentions", () => {
	it("resolves existing files to absolute @mentions", () => {
		const dir = mkdtempSync(join(tmpdir(), "zenuxs-attach-"));
		try {
			writeFileSync(join(dir, "note.txt"), "hello");
			expect(resolveAttachmentMentions(["note.txt"], dir)).toEqual([
				`@"${join(dir, "note.txt")}"`,
			]);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("fails closed on a missing file", () => {
		expect(() => resolveAttachmentMentions(["missing.txt"], "/tmp")).toThrow(
			AttachmentError,
		);
	});

	it("returns nothing when no paths were supplied", () => {
		expect(resolveAttachmentMentions(undefined, "/tmp")).toEqual([]);
	});
});
