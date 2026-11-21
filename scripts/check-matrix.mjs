#!/usr/bin/env node
// Gate check for docs/03-gap-analysis.md. The matrix is generated from
// evidence by reconcile-matrix.mjs; this check rejects hand edits, open rows,
// stale evidence and undocumented BLOCKED rows.

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { buildMatrix } from "./reconcile-matrix.mjs"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const matrixPath = join(root, "docs/03-gap-analysis.md")
const generated = buildMatrix()
const existing = readFileSync(matrixPath, "utf8")

const problems = []
if (existing !== generated.text) {
  problems.push("matrix is stale or hand-edited (run node scripts/reconcile-matrix.mjs)")
}
for (const [id, status] of generated.statusById) {
  if (status === "MISSING" || status === "PARTIAL") {
    problems.push(`${id}: status ${status} (no current-HEAD L3 evidence)`)
  }
  if (status === "BLOCKED") {
    const row = generated.text.split("\n").find((line) => line.startsWith(`| ${id} |`))
    if (!row?.includes(".work/BLOCKED.md")) {
      problems.push(`${id}: BLOCKED without .work/BLOCKED.md pointer`)
    }
  }
}

console.log(
  JSON.stringify(
    {
      sha: generated.sha,
      rows: generated.statusById.size,
      statuses: Object.fromEntries(generated.statusById),
      problems,
    },
    null,
    2,
  ),
)
if (problems.length > 0) process.exit(1)
