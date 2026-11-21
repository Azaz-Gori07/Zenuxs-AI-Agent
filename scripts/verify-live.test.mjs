#!/usr/bin/env node
// Regression: verify-live.sh must drive shell-function probes successfully and
// retry 429s with backoff. Uses a local fake endpoint; matrix regeneration is
// replaced by an echo in a temporary copy so no real row can be flipped.
import { createServer } from "node:http"
import { spawn } from "node:child_process"
import { readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const source = join(root, "scripts", "verify-live.sh")
const scenario = join(root, "scripts", ".verify-live-scenario.sh")

let modelsCalls = 0
let completionCalls = 0
const server = createServer((req, res) => {
  const url = req.url ?? ""
  if (url.includes("/models")) {
    modelsCalls += 1
    if (modelsCalls <= 2) {
      res.writeHead(429, { "content-type": "application/json" })
      res.end(JSON.stringify({ error: { message: "Free usage limit reached", code: 429 } }))
      return
    }
    res.writeHead(200, { "content-type": "application/json" })
    res.end(JSON.stringify({ object: "list", data: [{ id: "fake-model" }] }))
    return
  }
  if (url.endsWith("/chat/completions")) {
    completionCalls += 1
    if (completionCalls <= 2) {
      res.writeHead(429, { "content-type": "application/json" })
      res.end(JSON.stringify({ error: { message: "Free usage limit reached", code: 429 } }))
      return
    }
    const chunk = (content, finish = null) =>
      `data: ${JSON.stringify({
        id: "test",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "fake-model",
        choices: [{ index: 0, delta: { role: "assistant", content }, finish_reason: finish }],
      })}\n\n`
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" })
    if (completionCalls >= 5) {
      // Second live scenario asks for a tool call.
      const toolChunk = (delta, finish = null) =>
        `data: ${JSON.stringify({
          id: "test-tool",
          object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000),
          model: "fake-model",
          choices: [{ index: 0, delta, finish_reason: finish }],
        })}\n\n`
      res.write(toolChunk({ role: "assistant", tool_calls: [{ index: 0, id: "call_1", type: "function", function: { name: "read", arguments: "" } }] }))
      res.write(toolChunk({ tool_calls: [{ index: 0, function: { arguments: JSON.stringify({ path: "package.json" }) } }] }))
      res.write(toolChunk({}, "tool_calls"))
    } else {
      res.write(chunk("LIVE_OK"))
      res.write(chunk("", "stop"))
    }
    res.write("data: [DONE]\n\n")
    res.end()
    return
  }
  res.writeHead(404).end()
})

try {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  const port = server.address().port
  const patched = readFileSync(source, "utf8").replace(
    "node scripts/reconcile-matrix.mjs",
    "echo MATRIX_REGEN_SKIPPED",
  )
  if (patched === readFileSync(source, "utf8")) {
    throw new Error("could not disable matrix regeneration in test copy")
  }
  writeFileSync(scenario, patched, { mode: 0o700 })
  // Must be async: a sync child would block this process's event loop and the
  // fake HTTP server could never answer.
  const output = await new Promise((resolve, reject) => {
    const child = spawn("bash", [scenario], {
      cwd: root,
      env: {
        ...process.env,
        ZENUXS_TEST_BASE_URL: `http://127.0.0.1:${port}`,
        ZENUXS_TEST_API_KEY: "public",
        ZENUXS_TEST_MODEL: "fake-model",
        ZENUXS_LIVE_RETRY_INITIAL_SECONDS: "0",
        ZENUXS_LIVE_TIMEOUT_SECONDS: "30",
      },
    })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString()
    })
    const timer = setTimeout(() => {
      child.kill("SIGKILL")
      reject(new Error("verify-live test child timed out"))
    }, 150_000)
    child.on("close", (code) => {
      clearTimeout(timer)
      resolve({ output: stdout + stderr, code: code ?? 1 })
    })
  })
  const outputText = output.output
  const code = output.code
  if (code !== 0 || !outputText.includes("=== LIVE_VERIFY: PASS ===")) {
    throw new Error(`verify-live should PASS against retrying fake endpoint: exit=${code}\n${outputText.slice(-1500)}`)
  }
  if (modelsCalls < 3 || completionCalls < 3) {
    throw new Error(`429 backoff not exercised: models=${modelsCalls} completions=${completionCalls}`)
  }
  console.log(
    `verify-live: PASS with backoff (models 429s=${modelsCalls - 1}, completion 429s=${completionCalls - 1})`,
  )
} finally {
  server.close()
  try {
    rmSync(scenario, { force: true })
  } catch {
    /* ignore */
  }
}
