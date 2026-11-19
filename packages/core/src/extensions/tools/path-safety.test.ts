import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync, linkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assertSafePath, openSafeFile, WorkspaceBoundaryError } from "./path-safety";

let root: string;
let outside: string;

beforeEach(() => {
  root = mkdtemp(join(tmpdir(), "safe-root-"));
  outside = mkdtemp(join(tmpdir(), "safe-outside-"));
  writeFileSync(join(root, "inside.txt"), "INSIDE");
  writeFileSync(join(outside, "secret.txt"), "SECRET");
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(outside, { recursive: true, force: true });
});

function mkdtemp(prefix: string): string {
  const dir = join(tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("workspace path safety", () => {
  it("allows a normal file inside the workspace", async () => {
    const safe = await assertSafePath(root, "inside.txt");
    expect(safe.realPath).toBe(join(root, "inside.txt"));
  });

  it("rejects a symlink as the final path component", async () => {
    symlinkSync(join(outside, "secret.txt"), join(root, "link.txt"));
    await expect(assertSafePath(root, "link.txt")).rejects.toThrow(WorkspaceBoundaryError);
  });

  it("rejects a symlink as a parent directory", async () => {
    symlinkSync(outside, join(root, "escape"));
    await expect(assertSafePath(root, "escape/secret.txt")).rejects.toThrow(WorkspaceBoundaryError);
  });

  it("rejects a dangling symlink write target (nearest existing ancestor)", async () => {
    symlinkSync(join(outside, "not-there.txt"), join(root, "dangling.txt"));
    await expect(assertSafePath(root, "dangling.txt")).rejects.toThrow(WorkspaceBoundaryError);
  });

  it("rejects symlink chains", async () => {
    symlinkSync(join(outside, "secret.txt"), join(outside, "chain2.txt"));
    symlinkSync(join(outside, "chain2.txt"), join(root, "chain1.txt"));
    await expect(assertSafePath(root, "chain1.txt")).rejects.toThrow(WorkspaceBoundaryError);
  });

  it("rejects hardlinks to outside files", async () => {
    linkSync(join(outside, "secret.txt"), join(root, "hard.txt"));
    await expect(assertSafePath(root, "hard.txt")).rejects.toThrow(WorkspaceBoundaryError);
  });

  it("rejects .. traversal outside the workspace", async () => {
    await expect(assertSafePath(root, "../outside/secret.txt")).rejects.toThrow(WorkspaceBoundaryError);
  });

  it("rejects absolute paths outside the workspace", async () => {
    await expect(assertSafePath(root, join(outside, "secret.txt"))).rejects.toThrow(WorkspaceBoundaryError);
  });

  it("openSafeFile refuses to follow a swapped symlink", async () => {
    symlinkSync(join(outside, "secret.txt"), join(root, "openlink.txt"));
    await expect(openSafeFile(root, "openlink.txt", 0)).rejects.toThrow(WorkspaceBoundaryError);
  });
});
