#!/usr/bin/env node
// Verifies docs/03-gap-analysis.md: every non-excluded feature row must be
// VERIFIED on current code and must have an existing evidence file.

import { readFileSync, existsSync, statSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join, dirname } from "node:path"
import { execFileSync } from "node:child_process"

// Evidence freshness: a VERIFIED row's evidence must not predate the last
// modification of the source files that implement that feature.
const SOURCE_PATHS = {
  "F-core": ["packages/core/src", "apps/cli/src/runtime"],
  "F-prov": ["packages/llms/src", "packages/core/src/services"],
  "F-mode": ["packages/core/src/extensions/modes", "apps/cli/src/commands/program.ts"],
  "F-prompt": ["packages/core/src/runtime/prompt.ts", "apps/cli/src/runtime/prompt.ts"],
  "F-ctx": ["packages/core/src/extensions/context", "apps/cli/src/utils/events.ts"],
  "F-sess": ["packages/core/src/session", "apps/cli/src/session"],
  "F-tools": ["packages/core/src/extensions/tools", "apps/cli/src/runtime/tools.ts"],
  "F-toolrobust": ["packages/agents/src/agent-runtime.ts"],
  "F-perm": ["packages/core/src/extensions/tools", "packages/core/src/runtime/safety"],
  "F-ckpt": ["packages/core/src/hooks/checkpoint-hooks.ts", "packages/core/src/session/checkpoint-restore.ts"],
  "F-rag": ["packages/core/src/extensions/rag", "apps/cli/src/main.ts"],
  "F-mcp": ["packages/core/src/extensions/mcp"],
  "F-hooks": ["packages/core/src/hooks"],
  "F-skills": ["packages/core/src/extensions/skills", "packages/core/src/skills"],
  "F-plug": ["apps/cli/src/commands/plugin.ts"],
  "F-cmd": ["apps/cli/src/utils/plugin-chat-commands.ts", "apps/cli/src/tui/commands"],
  "F-sub": ["packages/core/src/extensions/tools/team"],
  "F-auto": ["apps/cli/src/commands/program.ts", "apps/cli/src/runtime/run-agent.ts"],
  "F-cli": ["apps/cli/src"],
  "F-tui": ["apps/cli/src/tui"],
  "F-ext": ["apps/vscode-extension/src"],
  "F-cfg": ["packages/schema/src", "apps/cli/src/utils/types.ts"],
  "F-perf": ["apps/cli/src/index.ts"],
  "F-pkg": ["package.json", "scripts"],
}

function lastCommitTime(paths) {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%ct", "--", ...paths], { cwd: root, encoding: "utf8" }).trim()
    return out ? Number(out) : 0
  } catch { return 0 }
}

const root = fileURLToPath(new URL("..", import.meta.url))
const matrixPath = join(root, "docs/03-gap-analysis.md")
const text = readFileSync(matrixPath, "utf8")
const rows = text.split("\n").filter((line) => /^\| F-/.test(line))

const problems = []
let verified = 0

for (const row of rows) {
  const cells = row.split("|").map((cell) => cell.trim()).filter(Boolean)
  const [id, , , statusCell, , , evidence] = cells
  // Status cells may carry an annotation in parentheses, e.g. "VERIFIED (L3 ...)".
  const status = (statusCell ?? "").split("(")[0].trim()
  if (!id) continue
  if (status === "EXCLUDED" && /intentionally excluded/i.test(evidence ?? "")) continue
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
      continue
    }
    const sourcePaths = SOURCE_PATHS[id]
    if (!sourcePaths) continue
    const sourceTs = lastCommitTime(sourcePaths)
    const evidenceTs = lastCommitTime(paths)
    if (sourceTs > evidenceTs && sourceTs > 0) {
      problems.push(`${id}: stale evidence (source changed after evidence)`)
    }
  }
  verified += 1
}

console.log(JSON.stringify({ rows: rows.length, verified, problems }, null, 2))
if (problems.length > 0) process.exit(1)
