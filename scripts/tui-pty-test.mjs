#!/usr/bin/env node
// PTY end-to-end harness for the Zenuxs TUI. Spawns the real CLI in a pseudo
// terminal, drives it with keystrokes and records the rendered transcript.
// tmux is unavailable in this environment, so node-pty is used instead.

import * as pty from "node-pty"
import { writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"

const root = fileURLToPath(new URL("..", import.meta.url))
const out = process.argv[2] ?? join(root, "docs/evidence/F-tui/pty-transcript.log")
const env = {
  ...process.env,
  TERM: "xterm-256color",
  CI: "1",
  ZENUXS_PROVIDER_SETTINGS_PATH: process.env.ZENUXS_PROVIDER_SETTINGS_PATH ?? "/tmp/zenuxs-l3/providers.json",
  CLINE_DATA_DIR: process.env.CLINE_DATA_DIR ?? "/tmp/zenuxs-l3/tui",
}

const child = pty.spawn(
  process.env.BUN_PATH ?? `${process.env.HOME}/.bun/bin/bun`,
  [fileURLToPath(new URL("../apps/cli/src/index.ts", import.meta.url)), "--tui"],
  { cwd: root, env, cols: 120, rows: 32 },
)

let transcript = ""
child.onData((data) => {
  transcript += data
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const steps = [
  { at: 1500, keys: "" }, // let the TUI render
  { at: 2500, keys: "/help\r" }, // open slash-command help
  { at: 4000, keys: "\u0003" }, // Ctrl-C to abort/exit
]

let timerStart = Date.now()
for (const step of steps) {
  await sleep(Math.max(0, step.at - (Date.now() - timerStart)))
  if (step.keys) child.write(step.keys)
}
await sleep(1000)
child.kill()
await sleep(300)

const header = [
  "=== COMMAND: node scripts/tui-pty-test.mjs ===",
  `=== TIMESTAMP: ${new Date().toISOString()} ===`,
  `=== TERM: ${env.TERM} ===`,
  "=== EXIT: harness completed ===",
  "",
].join("\n")
writeFileSync(out, header + transcript)
console.log(JSON.stringify({ ok: true, transcriptBytes: transcript.length, out }))
