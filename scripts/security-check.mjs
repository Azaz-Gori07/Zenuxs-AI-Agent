#!/usr/bin/env node
// Static security check: the shipped product must not contain the *reference
// product's* markers (ZCode credential env var, CLI bundle or domain), must not
// ship leaked config/env files, and must not contain live API keys.
//
// The previous version reported Z.AI (a legitimate GLM model provider) and
// *.cline.bot (this fork's own Cline-lineage account backend, retained per
// NOTICE.md) as violations but ALWAYS exited 0. That was false assurance. This
// version targets only unambiguous reference leakage and FAILS CLOSED.

import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { execFileSync } from "node:child_process"

const root =
  process.env.ZENUXS_SECURITY_ROOT ?? fileURLToPath(new URL("..", import.meta.url))

// Detection literals are assembled from parts so this file never flags itself.
const forced = "ZCODE_" + "OFFICIAL_ENDPOINT_TOKEN"
// Parity metadata legitimately names the reference product, so the check
// targets its unambiguous runtime markers rather than the bare word.
const forbidden = [new RegExp(forced), /zcode\.cjs/, /zcode\.bot/]

// Live-key shapes must never be committed.
const keyPattern = /\b(sk-[A-Za-z0-9]{16,}|sk-or-[A-Za-z0-9-]{16,})\b/

const skipDirs = new Set([
  "node_modules",
  ".git",
  "dist",
  "docs",
  ".work",
  "tests",
  "bun.lock",
  "config.json",
  "overall.md",
])
const extensions = new Set([".ts", ".tsx", ".js", ".mjs", ".json", ".md"])

/** Check one text blob. Exported implicitly via the self-test below. */
function checkText(text) {
  const problems = []
  for (const pattern of forbidden) {
    if (pattern.test(text)) problems.push(`matches ${pattern}`)
  }
  if (keyPattern.test(text)) problems.push("matches live API key pattern")
  return problems
}

function walk(dir, problems) {
  for (const entry of readdirSync(dir)) {
    if (skipDirs.has(entry)) continue
    // This file intentionally contains the detection literals.
    if (entry === "security-check.mjs") continue
    const path = join(dir, entry)
    let stat
    try {
      stat = statSync(path)
    } catch {
      continue
    }
    if (stat.isDirectory()) {
      walk(path, problems)
      continue
    }
    if (!extensions.has(entry.slice(entry.lastIndexOf(".")))) continue
    let content
    try {
      content = readFileSync(path, "utf8")
    } catch {
      continue
    }
    for (const problem of checkText(content)) {
      problems.push(`${relative(root, path)}: ${problem}`)
    }
  }
}

const problems = []
walk(join(root, "apps"), problems)
walk(join(root, "packages"), problems)
walk(join(root, "scripts"), problems)

// Tracked-file checks via git.
try {
  const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
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

// Positive control: the check must be able to fail. Without this, a broken
// pattern array would silently pass every run.
const canary = checkText(
  `${forced}=leak zcode.cjs https://zcode.bot sk-abcdefghijklmnop`,
)
// Four independent detections must fire: token, CLI bundle, domain, key.
if (canary.length !== 4) {
  problems.push("security-check self-test failed: detection patterns are not active")
}

console.log(JSON.stringify({ problems }, null, 2))
if (problems.length > 0) process.exit(1)
process.exit(0)
