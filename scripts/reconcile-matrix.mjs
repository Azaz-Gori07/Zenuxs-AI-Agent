#!/usr/bin/env node
// Derive docs/03-gap-analysis.md entirely from evidence + shipped code.
// Row metadata is static; the status column is computed from real evidence.
// This is the only writer of the matrix (no hand edits).

import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const matrixPath = join(root, "docs/03-gap-analysis.md")

const ROWS = [
  ["A","F-core","Agent loop (multi-step, streaming, abort, retries, max-step, recovery)","Core loop in `apps/zcode-cli/packages/core`; retries/backoff; error recovery","P0","P2","docs/evidence/regenerated/headless.log, docs/evidence/regenerated/multitool.log"],
  ["A","F-prov","Providers (OpenAI, Anthropic, Gemini, OpenRouter, local), normalize, keys, accounting, 429/5xx, fallback, mid-session switch","`packages/provider`, `provider-node`, `adapters`; 3 API protocol types; state kept on model switch","P0","P2","docs/evidence/live/verify-live.log, .work/BLOCKED.md"],
  ["A","F-mode","Modes with per-mode prompt/tool permissions; mid-session switch; report current mode","plan/build/edit/yolo/guarded; `/mode`; default yolo for prompt","P0","P3","docs/evidence/regenerated/mode_act.log, docs/evidence/regenerated/mode_plan.log, docs/evidence/regenerated/yolo.log, docs/evidence/regenerated/guarded.log"],
  ["A","F-prompt","System prompt assembly (mode, env, AGENTS.md, global/project memory)","User `~/.zcode/AGENTS.md` then project `AGENTS.md`; memory gated","P0","P4","docs/evidence/regenerated/prompt.log"],
  ["A","F-ctx","Token count, truncation, auto compaction, `/compact`, stale-file correction","compaction + `/compact [instructions]` + memory-bench","P0","P3","docs/evidence/regenerated/compaction.log"],
  ["A","F-sess","Persist, resume, list, fork, rewind/undo, export, crash recovery, concurrent","SQLite `~/.zcode/cli/db/db.sqlite`; `--resume`, `-c`, `/fork`, `/rewind`, `/new`","P0","P3","docs/evidence/regenerated/resume.log"],
  ["A","F-tools","read, write, precise edit/patch (multi-edit, diff), glob, grep, list, bash (timeouts/stream/cwd/bg/kill), web fetch (SSRF), web search, todo, git","16 built-ins incl. Bash, KillShell, Agent, AskUserQuestion, EnterPlanMode, ExitPlanMode, Skill, Task","P0","P2","docs/evidence/regenerated/multitool.log"],
  ["A","F-toolrobust","Malformed JSON repair, parallel calls, per-tool timeouts, truncation, validation, graceful errors","Tool executor + result settlement; JSON repair from model","P0","P2","docs/evidence/live/verify-live.log, .work/BLOCKED.md"],
  ["A","F-perm","allow/ask/deny per tool/path/command; always allow; workspace boundary; dangerous detection; redaction; injection resistance","5 modes + rules + `permission.disallowedTools` + hook blocking + trust","P0","P3","docs/evidence/regenerated/boundary.log, docs/evidence/P0-symlink/l3-summary.log"],
  ["A","F-ckpt","Checkpoints and undo of file changes","`/rewind`, `/fork` checkpoints","P1","P3","docs/evidence/regenerated/checkpoint.log"],
  ["A","F-rag","Index, chunks, embeddings + BM25 fallback, watcher, ignore, symbol/AST, semantic search tool","Native search tools + `packages/core`, plugin search","P1","P4","docs/evidence/regenerated/rag.log"],
  ["A","F-mcp","MCP stdio + HTTP/SSE, tools/resources/prompts, reconnect, enable/disable, auth, isolation","`mcp.servers` type stdio/http/sse, oauth, protocolVersion, `mcp__` tools","P1","P5","docs/evidence/regenerated/mcp.log"],
  ["A","F-hooks","pre/post tool, session events","7 events, matcher, process/command, trust digest, exit 2 blocks","P1","P5","docs/evidence/regenerated/hook.log, docs/evidence/F-hook-01/l3-governance.log"],
  ["A","F-skills","Discovery, progressive loading","`.zcode/skills`, `.agents/skills`, `skills.roots`, `skills list --json`","P1","P5","docs/evidence/regenerated/skills.log"],
  ["A","F-plug","Plugins loader/lifecycle/isolation","manifest + marketplaces + install/enable/disable/update/uninstall/validate","P1","P5","docs/evidence/F-plug-01/l3-exchange.log"],
  ["A","F-cmd","Custom slash commands","markdown frontmatter, `$ARGUMENTS`, `commands list --json`","P1","P5","docs/evidence/regenerated/skills.log"],
  ["A","F-sub","Subagents with own context/tools, parallel, limits","Agent/Task tools; `features.subagent`; depth/cost limits","P1","P5","docs/evidence/regenerated/subagent.log"],
  ["A","F-auto","Headless `-p`, JSON/stream-json, exit codes, background/scheduled","`--prompt`, `--output-format`, `--workflow-mode`, `/dwf`, `/expert`, schedules","P0","P5","docs/evidence/regenerated/headless.log, docs/evidence/F-auto-01/l3-flows.log"],
  ["A","F-cli","Arg parse, subcommands, config precedence, doctor, signals, clear errors","10 commands, 20 flags, `doctor --json`, exit 1 on errors","P0","P6","docs/evidence/gate/status.json, docs/evidence/regenerated/cli-flags.log"],
  ["A","F-tui","Streaming markdown, diff, multiline, history, slash menu, approvals, status bar, session picker, keys, resize, no flicker","Full-screen TUI, `/mode`,`/model`,`/effort` pickers","P1","P6","docs/evidence/regenerated/tui-pty.log"],
  ["A","F-ext","VS Code extension: activation, webview chat, tool cards, diff apply/reject, approval UI, pickers, sessions, @file, diagnostics, terminal, SecretStorage, reconnect, .vsix","**No reference equivalent** (reference is desktop/web). Zenuxs-only surface; verify against own contract","P0","P7","docs/evidence/gate/status.json, docs/evidence/F-ext/reconnect.json"],
  ["A","F-cfg","Config global/project/env, schema validation, logging, telemetry off","2 config files + project + env; telemetry exists in target","P0","P2","docs/evidence/gate/status.json"],
  ["A","F-perf","Cold start, memory, large repo, streaming latency","SEA/bundle packaging, native search","P2","P8","docs/evidence/gate/status.json"],
  ["A","F-pkg","Build, fresh clone, packaging, docs","`build:zcode`, SEA, bootstrap, docs","P0","P1/P9","docs/evidence/gate/status.json"],
  ["B","F-cli-01","`--prompt/-p` requires value; positional prompt not used","real help + docs","P1","P6","docs/evidence/regenerated/headless.log"],
  ["B","F-cli-02","`--output-format stream-json` NDJSON + final result line","docs","P1","P6","docs/evidence/regenerated/headless.log"],
  ["B","F-cli-03","`--disallowed-tools` whole-tool removal","real help","P2","P6","docs/evidence/regenerated/cli-flags.log"],
  ["B","F-cli-04","`--attach`, `--surface`, `--browser-use`, `--locale`, `--no-color`","real help","P2","P6","docs/evidence/regenerated/cli-flags.log"],
  ["B","F-mode-01","`guarded` mode (dangerous cmds ask)","docs","P1","P3","docs/evidence/regenerated/guarded.log"],
  ["B","F-sess-01","`/fork` + `/rewind` checkpoint IDs","real help","P1","P3","docs/evidence/regenerated/resume.log, docs/evidence/regenerated/checkpoint.log"],
  ["B","F-auto-01","`--workflow-mode`, `/dwf`, `/expert`, `/goal`, `--target`","real help","P2","P5","docs/evidence/F-auto-01/l3-flows.log"],
  ["B","F-hook-01","Project hook trust review/grant/status/revoke with digest","docs","P2","P5","docs/evidence/F-hook-01/l3-governance.log"],
  ["B","F-rag-01","Native search tools + ToolSearch modes","help `--toolsearch-mode`","P2","P4","docs/evidence/regenerated/rag.log"],
  ["B","F-perm-01","`permission.disallowedTools` config","docs","P2","P3","docs/evidence/regenerated/boundary.log"],
  ["B","F-plug-01","Plugin marketplaces add/update/remove","real help","P2","P5","docs/evidence/F-plug-01/l3-exchange.log"],
  ["B","F-sys-01","One core shared by all UIs via one protocol","app-server stdio protocol for CLI/TUI; client/server for desktop/web","P0","P2","docs/evidence/gate/status.json"],
  ["B","F-sec-01","No ZCode keys/endpoints/branding/telemetry in target","reference uses Z.AI endpoints","P0","P8","docs/evidence/gate/status.json"],
]

const LIVE_ROWS = new Set(["F-prov", "F-toolrobust"])

function sha() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim()
  } catch {
    return "unknown"
  }
}

function hasSha(text, currentSha) {
  return text.includes(currentSha)
}

function hasSuccess(text, path) {
  if (path.endsWith(".json")) {
    try {
      const json = JSON.parse(text)
      if (Array.isArray(json.checks)) {
        return json.checks.length > 0 && json.checks.every((check) => check.ok)
      }
      return json.ok === true || json.failures === 0
    } catch {
      return false
    }
  }
  return (
    /=== FAILURES: 0 ===/.test(text) ||
    /=== EXIT: 0 ===/.test(text) ||
    /: exit=0 guard=PASS/.test(text) ||
    /"status":"completed"/.test(text)
  )
}

function verifyEvidence(paths, currentSha) {
  if (!paths.length) return { verified: false, reason: "no evidence path" }
  for (const path of paths) {
    if (!existsSync(join(root, path))) {
      return { verified: false, reason: `missing ${path}` }
    }
  }
  for (const path of paths) {
    const text = readFileSync(join(root, path), "utf8")
    if (!hasSha(text, currentSha)) {
      return { verified: false, reason: `${path} predates current HEAD` }
    }
    if (!hasSuccess(text, path)) {
      return { verified: false, reason: `${path} has no success marker` }
    }
  }
  return { verified: true }
}

export function buildMatrix() {
  const currentSha = sha()
  const statusById = new Map()
  const body = { A: [], B: [] }
  for (const [section, id, feature, reference, pri, phase, evidence] of ROWS) {
    let status
    let note = ""
    if (LIVE_ROWS.has(id)) {
      const livePath = "docs/evidence/live/verify-live.log"
      const live =
        existsSync(join(root, livePath)) &&
        readFileSync(join(root, livePath), "utf8").includes("=== LIVE_VERIFY: PASS ===") &&
        hasSha(readFileSync(join(root, livePath), "utf8"), currentSha)
      if (live) {
        status = "VERIFIED"
        note = " (live)"
      } else {
        status = "BLOCKED"
        note = " (externally gated; `bash scripts/verify-live.sh`)"
      }
    } else {
      const paths = evidence.split(/[,;]/).map((p) => p.trim()).filter(Boolean)
      const check = verifyEvidence(paths, currentSha)
      if (check.verified) {
        status = "VERIFIED"
        note = " (L3 evidence on HEAD)"
      } else {
        status = "MISSING"
        note = ` (evidence: ${check.reason})`
      }
    }
    statusById.set(id, status)
    body[section].push(
      `| ${id} | ${feature} | ${reference} | ${status}${note} | ${pri} | ${phase} | ${evidence} |`,
    )
  }

  const text = `# 03 — Gap analysis / feature parity matrix

Status values: MISSING, BROKEN, PARTIAL, IMPLEMENTED, VERIFIED (VERIFIED requires L3 evidence on current code).
Evidence paths are relative to repo root. This file is GENERATED by \`node scripts/reconcile-matrix.mjs\` from evidence and code — do not hand-edit.

## A. Seeded feature catalog (mission section 4)

| ID | Feature | Reference behavior | Zenuxs status | Pri | Phase | Evidence path |
|----|---------|-------------------|---------------|-----|-------|---------------|
${body.A.join("\n")}

## B. Additional features found in reference (not in seed)

| ID | Feature | Reference behavior | Zenuxs status | Pri | Phase | Evidence |
|----|---------|-------------------|---------------|-----|-------|----------|
${body.B.join("\n")}

## C. Intentionally excluded

None currently. "Not implemented in the target" is a gap, not an exclusion. A valid
exclusion requires a written reason why the capability makes no sense for Zenuxs.
`
  return { text, statusById, sha: currentSha }
}

function main() {
  const { text, statusById, sha: currentSha } = buildMatrix()
  const checkOnly = process.argv.includes("--check")
  if (checkOnly) {
    const existing = readFileSync(matrixPath, "utf8")
    if (existing !== text) {
      console.error("matrix is stale or hand-edited; run node scripts/reconcile-matrix.mjs")
      process.exit(1)
    }
  } else {
    writeFileSync(matrixPath, text)
  }
  const counts = {}
  for (const status of statusById.values()) counts[status] = (counts[status] ?? 0) + 1
  console.log(JSON.stringify({ sha: currentSha, rows: statusById.size, counts }, null, 2))
  const open = [...statusById.values()].filter((s) => s === "MISSING" || s === "PARTIAL")
  if (open.length > 0 && !checkOnly) process.exitCode = 1
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
