import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { resolvePathInfo } from "./path-kind"

const original = process.env.ZENUXS_ALLOW_OUTSIDE_WORKSPACE

describe("filesystem workspace boundary", () => {
  afterEach(() => {
    if (original === undefined) delete process.env.ZENUXS_ALLOW_OUTSIDE_WORKSPACE
    else process.env.ZENUXS_ALLOW_OUTSIDE_WORKSPACE = original
  })

  it("rejects paths outside the workspace by default", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "path-boundary-"))
    const outside = mkdtempSync(join(tmpdir(), "path-outside-"))
    writeFileSync(join(outside, "secret.txt"), "secret")
    delete process.env.ZENUXS_ALLOW_OUTSIDE_WORKSPACE
    await expect(resolvePathInfo(cwd, join(outside, "secret.txt"))).rejects.toThrow(
      /outside the workspace/,
    )
  })

  it("allows outside paths when explicitly opted in", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "path-boundary-"))
    const outside = mkdtempSync(join(tmpdir(), "path-outside-"))
    writeFileSync(join(outside, "secret.txt"), "secret")
    process.env.ZENUXS_ALLOW_OUTSIDE_WORKSPACE = "1"
    await expect(resolvePathInfo(cwd, join(outside, "secret.txt"))).resolves.toMatchObject({
      kind: "file",
    })
  })
})
