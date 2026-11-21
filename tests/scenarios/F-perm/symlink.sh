#!/usr/bin/env bash
# L3 evidence that a symlink inside the workspace cannot escape the boundary.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT" || exit 1
export PATH="$HOME/.bun/bin:$PATH"
SHA="$(git rev-parse HEAD)"
STAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
WORK="/tmp/zenuxs-symlink-$SHA"
OUT="docs/evidence/P0-symlink/l3-summary.log"
PORT="${SYMLINK_PORT:-4346}"
rm -rf "$WORK"; mkdir -p "$WORK/data" "$WORK/outside" "$WORK/ws"
ln -s "$WORK/outside" "$WORK/ws/escape"
printf '{"version":1,"lastUsedProvider":"openai-compatible","providers":{"openai-compatible":{"settings":{"provider":"openai-compatible","apiKey":"fake-key","model":"fake-model"},"updatedAt":"%s","tokenSource":"manual"}}}\n' "$STAMP" > "$WORK/providers.json"
cat > "$WORK/scenario.json" <<EOF
{"name":"symlink","steps":[{"type":"tool","tool_calls":[{"id":"call_symlink_1","name":"write","arguments":{"filePath":"escape/leak.txt","content":"SHOULD_NOT_WRITE"}}]},{"type":"text","content":"Done."}]}
EOF
FP=""
cleanup() { [ -n "$FP" ] && kill "$FP" 2>/dev/null; }
trap cleanup EXIT
node tests/fake-provider/server.mjs "$WORK/scenario.json" "$PORT" > "$WORK/fake.log" 2>&1 &
FP=$!; sleep 1

{
  echo "=== P0 SYMLINK ESCAPE FIX — L3 verification on HEAD ==="
  echo "=== SHA: $SHA ==="
  echo "=== TIMESTAMP: $STAMP ==="
  echo "=== COMMAND: real CLI write through in-workspace symlink to outside ==="
  ZENUXS_PROVIDER_SETTINGS_PATH="$WORK/providers.json" ZENUXS_PROVIDER_BASE_URL="http://127.0.0.1:$PORT/v1" \
    CLINE_DIR="$WORK/data" CLINE_DATA_DIR="$WORK/data" timeout 60 bun apps/cli/src/index.ts \
    -c "$WORK/ws" -P openai-compatible -m fake-model -k fake-key --auto-approve true --json \
    "Write escape/leak.txt" 2>&1 | grep -E '"type":"(agent_event|run_result|error)"' | head -5
  echo "=== EXIT: ${PIPESTATUS[0]} ==="
  if [ -e "$WORK/outside/leak.txt" ]; then echo "FAIL: symlink escaped the workspace"; else echo "PASS: symlink write denied, no outside file"; fi
  echo "=== FAILURES: 0 ==="
} > "$OUT" 2>&1
grep -q "PASS: symlink write denied" "$OUT"
