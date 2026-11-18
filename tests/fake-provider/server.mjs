#!/usr/bin/env node
// Deterministic OpenAI-compatible fake provider for L2/L3 verification.
// Usage: node tests/fake-provider/server.mjs [scenario.json] [port]
// Each POST /v1/chat/completions consumes one scenario step (in order, then repeats the last).

import { createServer } from "node:http"
import { readFileSync } from "node:fs"

const scenarioPath = process.argv[2] ?? new URL("./scenarios/default.json", import.meta.url).pathname
const port = Number(process.argv[3] ?? process.env.FAKE_PROVIDER_PORT ?? 4317)
const scenario = JSON.parse(readFileSync(scenarioPath, "utf8"))
const steps = scenario.steps ?? [{ type: "text", content: "ok" }]

let turn = 0
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function sseChunk(id, model, delta, finishReason = null) {
  const payload = {
    id,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, delta, ...(finishReason ? { finish_reason: finishReason } : { finish_reason: null }) }],
  }
  return `data: ${JSON.stringify(payload)}\n\n`
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`)

  if (url.pathname === "/__health") {
    res.writeHead(200, { "content-type": "application/json" })
    res.end(JSON.stringify({ ok: true, turn, steps: steps.length }))
    return
  }
  if (url.pathname === "/__reset") {
    turn = 0
    res.writeHead(200, { "content-type": "application/json" })
    res.end(JSON.stringify({ ok: true, turn }))
    return
  }
  if (url.pathname === "/__state") {
    res.writeHead(200, { "content-type": "application/json" })
    res.end(JSON.stringify({ turn, lastStep: steps[Math.max(0, turn - 1)] ?? null }))
    return
  }
  if (req.method !== "POST" || !url.pathname.endsWith("/chat/completions")) {
    res.writeHead(404).end()
    return
  }

  let body = ""
  for await (const chunk of req) body += chunk
  let request
  try {
    request = JSON.parse(body)
  } catch {
    res.writeHead(400, { "content-type": "application/json" })
    res.end(JSON.stringify({ error: { message: "invalid request JSON" } }))
    return
  }

  const step = steps[Math.min(turn, steps.length - 1)] ?? steps[0]
  turn += 1
  const id = `fake-${turn}`
  const model = request.model ?? "fake-model"

  if (step.delayMs) await sleep(step.delayMs)
  if (step.status && step.status !== 200) {
    res.writeHead(step.status, { "content-type": "application/json" })
    res.end(JSON.stringify(step.body ?? { error: { message: step.error ?? "injected failure", type: "fake" } }))
    return
  }

  if (step.raw !== undefined) {
    res.writeHead(200, { "content-type": "text/plain" })
    res.end(typeof step.raw === "string" ? step.raw : JSON.stringify(step.raw))
    return
  }

  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
  })

  if (step.tool_calls) {
    for (const call of step.tool_calls) {
      const name = call.name ?? "tool"
      const args = call.arguments_raw ?? JSON.stringify(call.arguments ?? {})
      res.write(sseChunk(id, model, {
        role: "assistant",
        tool_calls: [{ index: call.index ?? 0, id: call.id ?? `call_${turn}`, type: "function", function: { name, arguments: "" } }],
      }))
      // Emit arguments in fragments; malformed mode emits a broken fragment.
      const fragments = call.fragments ?? [args]
      for (const fragment of fragments) {
        res.write(sseChunk(id, model, {
          tool_calls: [{ index: call.index ?? 0, function: { arguments: fragment } }],
        }))
      }
    }
    res.write(sseChunk(id, model, {}, "tool_calls"))
  } else {
    const content = step.content ?? "ok"
    const size = step.chunkSize ?? Math.max(1, Math.ceil(content.length / 4))
    for (let i = 0; i < content.length; i += size) {
      res.write(sseChunk(id, model, { role: i === 0 ? "assistant" : undefined, content: content.slice(i, i + size) }))
      if (step.delayPerChunkMs) await sleep(step.delayPerChunkMs)
    }
    res.write(sseChunk(id, model, {}, "stop"))
  }
  res.write("data: [DONE]\n\n")
  res.end()
})

server.listen(port, "127.0.0.1", () => {
  console.log(JSON.stringify({ fakeProvider: "ready", port, scenario: scenarioPath, steps: steps.length }))
})
