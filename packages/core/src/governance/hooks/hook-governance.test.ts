import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	type HookDeclaration,
	hookDigest,
	parseHookDeclarations,
} from "./hook-declaration";
import { HookTrustStore } from "./hook-trust-store";
import { HookGovernance } from "./hook-governance";

function fixture(): { dir: string; workspace: string; storePath: string } {
	const dir = mkdtempSync(join(tmpdir(), "hook-governance-"));
	const workspace = join(dir, "workspace");
	mkdirSync(workspace, { recursive: true });
	const storePath = join(dir, "trust.json");
	return { dir, workspace, storePath };
}

function markerHook(marker: string): HookDeclaration {
	return {
		id: "hook-0",
		event: "PreToolUse",
		type: "process",
		command: "/bin/sh",
		args: ["-c", `printf ran > "${marker}"`],
		source: "workspace/.zenuxs/hooks.json",
	};
}

describe("hook governance (security)", () => {
	it("does not run an untrusted hook", async () => {
		const { dir, workspace, storePath } = fixture();
		try {
			const marker = join(dir, "untrusted.marker");
			const governance = new HookGovernance(new HookTrustStore(storePath));
			const result = await governance.execute(markerHook(marker), workspace);
			expect(result.ran).toBe(false);
			expect(result.state).toBe("pending");
			expect(existsSync(marker)).toBe(false);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("runs only the digest that was explicitly granted, and stops after revocation", async () => {
		const { dir, workspace, storePath } = fixture();
		try {
			const marker = join(dir, "trusted.marker");
			const declaration = markerHook(marker);
			const governance = new HookGovernance(new HookTrustStore(storePath));
			const digest = hookDigest(declaration);

			expect(governance.grantByDigest([declaration], workspace, "not-a-real-digest")).toBe(false);
			expect(governance.grantByDigest([declaration], workspace, digest)).toBe(true);

			const granted = await governance.execute(declaration, workspace);
			expect(granted.ran).toBe(true);
			expect(granted.exitCode).toBe(0);
			expect(readFileSync(marker, "utf8")).toBe("ran");

			expect(governance.revoke({ id: declaration.id, workspace })).toBe(1);
			const revoked = await governance.execute(declaration, workspace);
			expect(revoked.ran).toBe(false);
			expect(revoked.state).toBe("revoked");
			// A different declaration at the same slot is pending, not runnable.
			const replacement = markerHook(join(dir, "replacement.marker"));
			const pending = await governance.execute(replacement, workspace);
			expect(pending.ran).toBe(false);
			expect(pending.state).toBe("pending");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("blocks a stale declaration whose digest changed after the grant", async () => {
		const { dir, workspace, storePath } = fixture();
		try {
			const governance = new HookGovernance(new HookTrustStore(storePath));
			const granted = markerHook(join(dir, "first.marker"));
			governance.grantByDigest([granted], workspace, hookDigest(granted));

			const changed = markerHook(join(dir, "second.marker"));
			const result = await governance.execute(changed, workspace);
			expect(result.ran).toBe(false);
			expect(result.state).toBe("stale");
			expect(existsSync(join(dir, "second.marker"))).toBe(false);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("fails closed when the trust store is corrupt", async () => {
		const { dir, workspace, storePath } = fixture();
		try {
			writeFileSync(storePath, "{ this is not json");
			const governance = new HookGovernance(new HookTrustStore(storePath));
			const marker = join(dir, "corrupt.marker");
			const declaration = markerHook(marker);
			const result = await governance.execute(declaration, workspace);
			expect(result.ran).toBe(false);
			expect(result.state).toBe("blocked");
			expect(governance.grantByDigest([declaration], workspace, hookDigest(declaration))).toBe(false);
			expect(existsSync(marker)).toBe(false);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("honors a deny policy even for granted hooks", async () => {
		const { dir, workspace, storePath } = fixture();
		try {
			const governance = new HookGovernance(new HookTrustStore(storePath));
			const marker = join(dir, "deny.marker");
			const declaration = markerHook(marker);
			governance.grantByDigest([declaration], workspace, hookDigest(declaration));
			governance.getStore().setPolicy("deny");
			const result = await governance.execute(declaration, workspace);
			expect(result.ran).toBe(false);
			expect(result.state).toBe("blocked");
			expect(existsSync(marker)).toBe(false);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("rejects malformed declarations and reports review state", async () => {
		const { dir, workspace, storePath } = fixture();
		try {
			expect(() => parseHookDeclarations([{ event: "Bogus" }])).toThrow();
			const declaration = markerHook(join(dir, "review.marker"));
			const governance = new HookGovernance(new HookTrustStore(storePath));
			const review = governance.review([declaration], workspace);
			expect(review).toHaveLength(1);
			expect(review[0]?.state).toBe("pending");
			expect(review[0]?.runnable).toBe(false);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
