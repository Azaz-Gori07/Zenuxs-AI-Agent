#!/usr/bin/env bash
# Re-run every current (post-baseline) evidence command on the current HEAD.
# Results are written to docs/evidence/resume/ with command, SHA, timestamp and exit code.
# Historical P0 baseline logs are intentionally not re-run (they document pre-fix failures).

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1
export PATH="$HOME/.bun/bin:$PATH"
OUT="$ROOT/docs/evidence/resume"
mkdir -p "$OUT"
SHA="$(git rev-parse HEAD)"

run() {
  local name="$1"; shift
  local log="$OUT/$name.log"
  {
    echo "=== COMMAND: $* ==="
    echo "=== TIMESTAMP: $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
    echo "=== SHA: $SHA ==="
  } > "$log"
  local out code
  out="$("$@" 2>&1)"; code=$?
  printf '%s\n' "$out" >> "$log"
  echo "=== EXIT: $code ===" >> "$log"
  echo "$name: $code"
  RESULT["$name"]=$code
}

declare -A RESULT

# Static / build / test evidence
run install bun install --frozen-lockfile
run build bun run build
run cli-typecheck bun run --cwd apps/cli typecheck
run schema-typecheck bun run --cwd packages/schema typecheck
run engine-typecheck bun run --cwd packages/engine typecheck
run ext-build bun run build:extension
run cli-unit bun run --cwd apps/cli test:unit
run core-unit bun run --cwd packages/core test:unit
run engine-unit bun run --cwd packages/engine test
run schema-unit bun run --cwd packages/schema test
run fake-provider-smoke node tests/fake-provider/smoke-test.mjs
run security-check node scripts/security-check.mjs
run matrix-check node scripts/check-matrix.mjs

# L3 headless evidence against the fake provider
FP_PORT=4317
node tests/fake-provider/server.mjs tests/fixtures/l3/scenarios/single.json "$FP_PORT" > /tmp/reverify-fake.log 2>&1 &
FP=$!
trap 'kill $FP 2>/dev/null || true' EXIT
sleep 1

export ZENUXS_PROVIDER_SETTINGS_PATH="$ROOT/tests/fixtures/l3/providers.json"
export CLINE_DIR="$ROOT/.tmp/l3-data"
export CLINE_DATA_DIR="$ROOT/.tmp/l3-data"
mkdir -p "$CLINE_DIR/hooks"
cp "$ROOT/tests/fixtures/l3/hooks/PreToolUse" "$CLINE_DIR/hooks/PreToolUse"
chmod +x "$CLINE_DIR/hooks/PreToolUse"

run l3-headless bash -c "timeout 45 bun '$ROOT/apps/cli/src/index.ts' -P openai-compatible -m fake-model --auto-approve true --json 'Say hello' 2>&1 | grep -E '\"type\":\"(run_result|done)\"' | head -3"
run l3-output-format bash -c "timeout 45 bun '$ROOT/apps/cli/src/index.ts' -P openai-compatible -m fake-model --output-format stream-json 'hello' 2>&1 | grep -E '\"type\":\"run_result\"' | head -2"

for mode in act plan build edit guarded yolo; do
  run "l3-mode-$mode" bash -c "timeout 45 bun '$ROOT/apps/cli/src/index.ts' -P openai-compatible -m fake-model --mode $mode --auto-approve true --json 'What mode are you in?' 2>&1 | grep -E '\"type\":\"run_result\"' | head -2"
done

# Multi-tool + tool robustness chaos
kill $FP 2>/dev/null; wait $FP 2>/dev/null
node tests/fake-provider/server.mjs tests/fixtures/l3/scenarios/tool-call.json "$FP_PORT" > /tmp/reverify-fake.log 2>&1 &
FP=$!; sleep 1
run l3-multitool bash -c "timeout 45 bun '$ROOT/apps/cli/src/index.ts' -c '$ROOT/tests/fixtures/l3/workspace' -P openai-compatible -m fake-model --auto-approve true --json 'Read the file' 2>&1 | grep -E '\"type\":\"(content_end|run_result)\"' | head -5"

# Permission boundary
kill $FP 2>/dev/null; wait $FP 2>/dev/null
rm -f "$ROOT/tests/fixtures/l3/OUTSIDE.txt"
node tests/fake-provider/server.mjs tests/fixtures/l3/scenarios/outside.json "$FP_PORT" > /tmp/reverify-fake.log 2>&1 &
FP=$!; sleep 1
run l3-boundary bash -c "timeout 45 bun '$ROOT/apps/cli/src/index.ts' -c '$ROOT/tests/fixtures/l3/workspace' -P openai-compatible -m fake-model --auto-approve true --json 'Write outside' 2>&1 | grep -Ei 'outside workspace|run_result' | head -4; test -f '$ROOT/tests/fixtures/l3/OUTSIDE.txt' && echo FILE_WRITTEN || echo FILE_BLOCKED"

# Hooks
kill $FP 2>/dev/null; wait $FP 2>/dev/null
rm -f "$CLINE_DIR/hook-events.log"
node tests/fake-provider/server.mjs tests/fixtures/l3/scenarios/tool-call.json "$FP_PORT" > /tmp/reverify-fake.log 2>&1 &
FP=$!; sleep 1
run l3-hook bash -c "timeout 45 bun '$ROOT/apps/cli/src/index.ts' -c '$ROOT/tests/fixtures/l3/workspace' -P openai-compatible -m fake-model --auto-approve true --json 'Read the file' >/dev/null 2>&1; test -s '$CLINE_DIR/hook-events.log' && grep -o '\"hookName\":\"[a-z_]*\"' '$CLINE_DIR/hook-events.log' | head -2 || echo NO_HOOK_EVENTS"

echo "=== SUMMARY ==="
for k in "${!RESULT[@]}"; do echo "$k: ${RESULT[$k]}"; done | sort > "$OUT/summary.txt"
cat "$OUT/summary.txt"
