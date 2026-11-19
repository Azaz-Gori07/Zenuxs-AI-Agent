#!/usr/bin/env bash
# Drive the real CLI against one fake-provider chaos scenario and record evidence.
# Usage: bash scripts/chaos-run.sh <scenario-name> <evidence-dir>
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1
export PATH="$HOME/.bun/bin:$PATH"
SCENARIO="$1"
DIR="$2"
mkdir -p "$DIR"
PORT="${CHAOS_PORT:-4317}"
LOG="$DIR/chaos-$SCENARIO.log"

node tests/fake-provider/server.mjs "tests/fixtures/l3/scenarios/$SCENARIO.json" "$PORT" > /tmp/fp-chaos.log 2>&1 &
FP=$!
trap 'kill $FP 2>/dev/null || true' EXIT
sleep 1

{
  echo "=== COMMAND: real CLI vs fake-provider chaos scenario '$SCENARIO' ==="
  echo "=== TIMESTAMP: $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
  echo "=== SHA: $(git rev-parse HEAD) ==="
  echo "=== SCENARIO: tests/fixtures/l3/scenarios/$SCENARIO.json ==="
} > "$LOG"
timeout 60 env \
  ZENUXS_PROVIDER_SETTINGS_PATH="$ROOT/tests/fixtures/l3/providers.json" \
  CLINE_DIR="$ROOT/.tmp/chaos-$SCENARIO" \
  CLINE_DATA_DIR="$ROOT/.tmp/chaos-$SCENARIO" \
  bun apps/cli/src/index.ts -P openai-compatible -m fake-model --auto-approve true --json \
  "Handle the injected provider condition gracefully" >> "$LOG" 2>&1
CODE=$?
echo "=== EXIT: $CODE ===" >> "$LOG"
echo "$SCENARIO: exit $CODE"
grep -E '"type":"(run_result|error|agent_event)"|Recovered|Failed|error' "$LOG" | tail -6
