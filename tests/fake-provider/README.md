# Deterministic fake provider

An OpenAI-compatible SSE endpoint used by L2/L3 verification. No network or API key required.

```sh
node tests/fake-provider/server.mjs tests/fake-provider/scenarios/default.json 4317
```

Endpoints:
- `POST /v1/chat/completions` — consumes the next scenario step (then repeats the last).
- `GET /__health` — `{ok, turn, steps}`.
- `GET /__state` — last consumed step.
- `GET /__reset` — reset turn counter.

Step types: `text` (streamed content), `tool` (streamed tool-call deltas), `status` (429/500/etc), `raw` (non-SSE body), plus `delayMs`/`delayPerChunkMs`/`chunkSize` for slow-stream tests. `arguments_raw`/`fragments` produce malformed tool JSON.

Set `FAKE_PROVIDER_PORT` or pass the port as the second argument.
