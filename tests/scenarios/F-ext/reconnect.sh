#!/usr/bin/env bash
# L3 evidence: dispose the extension core, then verify the webview reconnects
# (fresh core init + successful turn) through the real VS Code extension host.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT" || exit 1
export PATH="$HOME/.bun/bin:$PATH"
SHA="$(git rev-parse HEAD)"
STAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
OUT="docs/evidence/F-ext"
PORT="${ZENUXS_EXT_CDP_PORT:-9242}"
READY="/tmp/zenuxs-ext-ready-reconnect"
FP=""
HOST=""
mkdir -p "$OUT" "$(dirname "$READY")"

cleanup() {
  [ -n "$FP" ] && kill "$FP" 2>/dev/null
  [ -n "$HOST" ] && kill "$HOST" 2>/dev/null
  pkill -f "remote-debugging-port=$PORT" 2>/dev/null || true
}
trap cleanup EXIT

rm -f "$READY"
FAKE_PROVIDER_COUNT_FILE="/tmp/zenuxs-ext-reconnect.requests" \
  node tests/fake-provider/server.mjs tests/fixtures/l3/scenarios/single.json 4317 > "$OUT/reconnect-provider.log" 2>&1 &
FP=$!
sleep 1

ZENUXS_CDP_PORT="$PORT" ZENUXS_READY_FILE="$READY" node tests/extension-e2e/run-keepalive.mjs \
  > "$OUT/reconnect-host.log" 2>&1 &
HOST=$!

ZENUXS_CDP_PORT="$PORT" ZENUXS_READY_FILE="$READY" \
  ZENUXS_EXT_E2E_OUT_DIR="$OUT" node tests/extension-e2e/reconnect.cjs \
  > "$OUT/reconnect-run.log" 2>&1
CODE=$?

{
  echo "=== COMMAND: VS Code extension reconnect after core dispose ==="
  echo "=== SHA: $SHA ==="
  echo "=== TIMESTAMP: $STAMP ==="
  echo "=== CDP_PORT: $PORT ==="
  cat "$OUT/reconnect-run.log"
  echo "=== EXIT: $CODE ==="
} > "$OUT/reconnect.log"

exit "$CODE"
