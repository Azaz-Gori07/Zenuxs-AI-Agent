#!/usr/bin/env node
// Confirms scripts/security-check.mjs fails closed on disabled detection.
import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const script = join(root, "scripts", "security-check.mjs")

// Clean tree must pass.
execFileSync("node", [script], { cwd: root, stdio: "pipe" })

// A checker with its patterns disabled must fail its own self-test.
const tampered = mkdtempSync(join(tmpdir(), "security-check-"))
try {
  const copy = join(tampered, "security-check.mjs")
  const source = readFileSync(script, "utf8").replace(
    "const forbidden = [new RegExp(forced), /zcode\\.cjs/, /zcode\\.bot/]",
    "const forbidden = []",
  )
  if (source === readFileSync(script, "utf8")) {
    throw new Error("test could not tamper with the checker source")
  }
  writeFileSync(copy, source)
  let code = 0
  let output = ""
  try {
    output = execFileSync("node", [copy], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, ZENUXS_SECURITY_ROOT: root },
    })
  } catch (error) {
    code = error.status ?? 1
    output = String(error.stdout ?? "")
  }
  if (code === 0 || !output.includes("self-test failed")) {
    throw new Error(`checker with disabled patterns must fail: code=${code} ${output.slice(0, 300)}`)
  }
  console.log("security-check: clean tree passes, disabled patterns fail closed")
} finally {
  rmSync(tampered, { recursive: true, force: true })
}
