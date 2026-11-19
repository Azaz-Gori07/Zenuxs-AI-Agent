#!/usr/bin/env bash
# Focused L3 re-verification on current HEAD with reproducible in-repo fixtures.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1
export PATH="$HOME/.bun/bin:$PATH"
OUT="$ROOT/docs/evidence/resume"
mkdir -p "$OUT"
SHA="$(git rev-parse HEAD)"
PORT=4317

start_provider() {
  node tests/fake-provider/server.mjs "tests/fixtures/l3/scenarios/$1" "$PORT" > /tmp/fp-l3.log 2>&1 &
  FP=$!
  sleep 1
}
stop_provider() { kill $FP 2>/dev/null; wait $FP 2>/dev/null; }

capture() {
  local name="$1"; shift
  {
    echo "=== COMMAND: $* ==="
    echo "=== TIMESTAMP: $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
    echo "=== SHA: $SHA ==="
  } > "$OUT/$name.log"
  "$@" >> "$OUT/$name.log" 2>&1
  echo "=== EXIT: $? ===" >> "$OUT/$name.log"
}

export ZENUXS_PROVIDER_SETTINGS_PATH="$ROOT/tests/fixtures/l3/providers.json"
export CLINE_DIR="$ROOT/.tmp/l3-data"
export CLINE_DATA_DIR="$ROOT/.tmp/l3-data"
mkdir -p "$CLINE_DIR/hooks"
cp tests/fixtures/l3/hooks/PreToolUse "$CLINE_DIR/hooks/PreToolUse"
chmod +x "$CLINE_DIR/hooks/PreToolUse"

start_provider tool-call.json
capture l3-multitool bash -c "timeout 45 bun '$ROOT/apps/cli/src/index.ts' -c '$ROOT/tests/fixtures/l3/workspace' -P openai-compatible -m fake-model --auto-approve true --json 'Read the file' 2>&1 | grep -E '\"type\":\"(content_end|run_result)\"' | head -5"
rm -f "$CLINE_DIR/hook-events.log"
capture l3-hook bash -c "timeout 45 bun '$ROOT/apps/cli/src/index.ts' -c '$ROOT/tests/fixtures/l3/workspace' -P openai-compatible -m fake-model --auto-approve true --json 'Read the file' >/dev/null 2>&1; test -s '$CLINE_DIR/hook-events.log' && grep -o '\"hookName\":\"[a-z_]*\"' '$CLINE_DIR/hook-events.log' | head -2 || echo NO_HOOK_EVENTS"
stop_provider

rm -f "$ROOT/tests/fixtures/l3/OUTSIDE.txt"
start_provider outside.json
capture l3-boundary bash -c "timeout 45 bun '$ROOT/apps/cli/src/index.ts' -c '$ROOT/tests/fixtures/l3/workspace' -P openai-compatible -m fake-model --auto-approve true --json 'Write outside' 2>&1 | grep -Ei 'outside workspace|run_result' | head -4; test -f '$ROOT/tests/fixtures/l3/OUTSIDE.txt' && echo FILE_WRITTEN || echo FILE_BLOCKED"
stop_provider

for f in l3-multitool l3-hook l3-boundary; do echo "=== $f ==="; grep -E '=== SHA|=== EXIT|hookName|NO_HOOK|outside workspace|FILE_|toolName|run_result' "$OUT/$f.log" | head -5; done
