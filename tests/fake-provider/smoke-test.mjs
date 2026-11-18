#!/usr/bin/env node
// L2 smoke test for the deterministic fake provider. Spawns it, verifies SSE
// text streaming, tool-call deltas, 429/500 injection and the state endpoints.

import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../..", import.meta.url))
const script = fileURLToPath(new URL("./server.mjs", import.meta.url))
const scenario = fileURLToPath(new URL("./scenarios/default.json", import.meta.url))
const port = 4391
const base = `http://127.0.0.1:${port}`

const child = spawn(process.execPath, [script, scenario, String(port)], {
  cwd: root,
  stdio: ["ignore", "pipe", "inherit"],
})

async function waitReady() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`${base}/__health`)
      if (res.ok) return
    } catch {
      // not ready
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error("fake provider did not become ready")
}

async function post(body) {
  const res = await fetch(`${base}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  return { status: res.status, text: await res.text() }
}

try {
  await waitReady()

  const text = await post({ model: "fake", messages: [] })
  if (text.status !== 200 || !text.text.includes('"content":"Hello from ')) {
    throw new Error(`text stream failed: ${text.status} ${text.text.slice(0, 200)}`)
  }

  const tool = await post({ model: "fake", messages: [] })
  if (!tool.text.includes('"tool_calls"') || !tool.text.includes('"finish_reason":"tool_calls"')) {
    throw new Error("tool-call stream failed")
  }

  const malformed = await post({ model: "fake", messages: [] })
  if (!malformed.text.includes("/tmp/broken")) {
    throw new Error("malformed tool stream failed")
  }

  const limited = await post({ model: "fake", messages: [] })
  if (limited.status !== 429) throw new Error(`expected 429, got ${limited.status}`)

  const failed = await post({ model: "fake", messages: [] })
  if (failed.status !== 500) throw new Error(`expected 500, got ${failed.status}`)

  const state = await (await fetch(`${base}/__state`)).json()
  if (state.turn !== 5) throw new Error(`unexpected turn count ${state.turn}`)

  console.log(JSON.stringify({ ok: true, turns: state.turn }))
} finally {
  child.kill("SIGTERM")
}
