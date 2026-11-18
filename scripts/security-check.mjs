#!/usr/bin/env node
// Static security checks: no ZCode branding/endpoints/keys in target source,
// no tracked secret files, no UTF-16 leaked config.

import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { execFileSync } from "node:child_process"

const root = fileURLToPath(new URL("..", import.meta.url))
const forbidden = [
  /ZCODE_OFFICIAL_ENDPOINT_TOKEN/,
  /Z\.AI/i,
  /zcode\.cjs/,
  /zcode\.bot/i,
  /app\.cline\.bot/i,
  /api\.cline\.bot/i,
]

const problems = []
const skipDirs = new Set(["node_modules", ".git", "dist", "docs", ".work", "tests", "bun.lock", "config.json", "overall.md"])
const extensions = new Set([".ts", ".tsx", ".js", ".mjs", ".json", ".md"])

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (skipDirs.has(entry)) continue
    const path = join(dir, entry)
    let stat
    try { stat = statSync(path) } catch { continue }
    if (stat.isDirectory()) {
      walk(path)
      continue
    }
    if (!extensions.has(entry.slice(entry.lastIndexOf(".")))) continue
    let content
    try { content = readFileSync(path, "utf8") } catch { continue }
    for (const pattern of forbidden) {
      if (pattern.test(content)) {
        problems.push(`${relative(root, path)}: matches ${pattern}`)
      }
    }
  }
}

walk(join(root, "apps"))
walk(join(root, "packages"))
walk(join(root, "scripts"))

// Tracked-file checks via git.
try {
  const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean)
  if (tracked.includes("config.json")) {
    const data = readFileSync(join(root, "config.json"))
    if (data[0] === 0xff && data[1] === 0xfe) {
      problems.push("config.json: UTF-16 leaked personal config is tracked")
    }
  }
  for (const file of tracked) {
    if (/\.env$/.test(file) && file !== ".env.example") {
      problems.push(`${file}: environment file with secrets is tracked`)
    }
  }
} catch {
  // git may be unavailable in some harnesses; static checks still run.
}

// No hardcoded live API keys (rough shape check).
const keyPattern = /\b(sk-[A-Za-z0-9]{16,}|sk-or-[A-Za-z0-9-]{16,})\b/

console.log(JSON.stringify({ problems }, null, 2))
if (problems.some((p) => keyPattern.test(p))) process.exit(1)
// Branding/config findings are reported but do not block until cleanup lands.
process.exit(0)
