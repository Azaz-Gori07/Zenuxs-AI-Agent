#!/usr/bin/env node
// Verifies docs/03-gap-analysis.md: every non-excluded feature row must be
// VERIFIED on current code and must have an existing evidence file.

import { readFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"

const root = fileURLToPath(new URL("..", import.meta.url))
const matrixPath = join(root, "docs/03-gap-analysis.md")
const text = readFileSync(matrixPath, "utf8")
const rows = text.split("\n").filter((line) => /^\| F-/.test(line))

const problems = []
let verified = 0

for (const row of rows) {
  const cells = row.split("|").map((cell) => cell.trim()).filter(Boolean)
  const [id, , , status, , , evidence] = cells
  if (!id || status === "MISSING" && /excluded/i.test(evidence ?? "")) continue
  if (status !== "VERIFIED") {
    problems.push(`${id}: status ${status} (expected VERIFIED)`)
    continue
  }
  const paths = (evidence ?? "").split(/[,;]/).map((p) => p.trim()).filter(Boolean)
  if (paths.length === 0) {
    problems.push(`${id}: no evidence path`)
    continue
  }
  for (const path of paths) {
    if (!existsSync(join(root, path))) {
      problems.push(`${id}: evidence missing: ${path}`)
    }
  }
  verified += 1
}

console.log(JSON.stringify({ rows: rows.length, verified, problems }, null, 2))
if (problems.length > 0) process.exit(1)
