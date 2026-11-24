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
FP=""
HOST=""
FIXTURE=""
READY=""
CDP_PORT=""
PROV_PORT=""

cleanup() {
  [ -n "$FP" ] && kill "$FP" 2>/dev/null
  [ -n "$HOST" ] && kill "$HOST" 2>/dev/null
  [ -n "$CDP_PORT" ] && pkill -f "remote-debugging-port=$CDP_PORT" 2>/dev/null || true
  [ -n "$FIXTURE" ] && rm -rf "$FIXTURE"
  [ -n "$READY" ] && rm -f "$READY"
}
trap cleanup EXIT

attempt_run() {
  local attempt="$1"
  CDP_PORT="${ZENUXS_EXT_CDP_PORT:-$((9250 + ($$ % 200) + attempt * 3))}"
  PROV_PORT="${ZENUXS_EXT_PROVIDER_PORT:-$((4500 + ($$ % 300) + attempt * 3))}"
  FIXTURE="$(mktemp -d /tmp/zenuxs-ext-fixture-XXXXXX)"
  READY="/tmp/zenuxs-ext-ready-reconnect-$$-$attempt"
  mkdir -p "$FIXTURE/.vscode"
  printf 'const answer = 42;\nexport default answer;\n' > "$FIXTURE/sample.ts"
  cat > "$FIXTURE/.vscode/settings.json" <<EOF
{
  "zenuxs.providerId": "openai-compatible",
  "zenuxs.baseUrl": "http://127.0.0.1:$PROV_PORT/v1",
  "zenuxs.apiKey": "fake-key",
  "zenuxs.modelId": "fake-model",
  "zenuxs.mode": "act",
  "zenuxs.autoApproveTools": true,
  "zenuxs.compaction": "basic"
}
EOF
  rm -f "$READY"
  FAKE_PROVIDER_COUNT_FILE="/tmp/zenuxs-ext-reconnect-$$.requests" \
    node tests/fake-provider/server.mjs tests/fixtures/l3/scenarios/single.json "$PROV_PORT" > "$OUT/reconnect-provider.log" 2>&1 &
  FP=$!
  local ready_provider=0
  for _ in $(seq 1 40); do
    if curl -sf "http://127.0.0.1:$PROV_PORT/__health" >/dev/null 2>&1; then ready_provider=1; break; fi
    sleep 0.25
  done
  if [ "$ready_provider" -ne 1 ]; then
    echo "provider on $PROV_PORT never became healthy (attempt $attempt)" > "$OUT/reconnect-run.log"
    return 1
  fi
  curl -sf -X POST "http://127.0.0.1:$PROV_PORT/__reset" >/dev/null 2>&1 || true
  ZENUXS_EXT_FIXTURE="$FIXTURE" ZENUXS_CDP_PORT="$CDP_PORT" ZENUXS_READY_FILE="$READY" \
    node tests/extension-e2e/run-keepalive.mjs > "$OUT/reconnect-host.log" 2>&1 &
  HOST=$!
  ZENUXS_EXT_PROVIDER_PORT="$PROV_PORT" ZENUXS_CDP_PORT="$CDP_PORT" ZENUXS_READY_FILE="$READY" \
    ZENUXS_EXT_E2E_OUT_DIR="$OUT" node tests/extension-e2e/reconnect.cjs \
    > "$OUT/reconnect-run.log" 2>&1
  local code=$?
  [ "$code" -eq 0 ] && return 0
  cleanup
  FP=""; HOST=""; FIXTURE=""; READY=""; CDP_PORT=""; PROV_PORT=""
  return 1
}

CODE=1
for attempt in 1 2 3; do
  echo "=== reconnect attempt $attempt $(date -u +%FT%TZ) ===" >> "$OUT/reconnect-attempts.log"
  if attempt_run "$attempt"; then CODE=0; break; fi
done

{
  echo "=== COMMAND: VS Code extension reconnect after core dispose ==="
  echo "=== SHA: $SHA ==="
  echo "=== TIMESTAMP: $STAMP ==="
  echo "=== CDP_PORT: $CDP_PORT PROVIDER_PORT: $PROV_PORT ==="
  cat "$OUT/reconnect-run.log"
  echo "=== EXIT: $CODE ==="
} > "$OUT/reconnect.log"

exit "$CODE"
