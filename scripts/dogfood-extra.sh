#!/usr/bin/env bash
# Dogfooding tasks 7-10 (extensibility + large-repo retrieval) against the fake provider.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1
export PATH="$HOME/.bun/bin:$PATH"
OUT="$ROOT/docs/evidence/dogfood"
mkdir -p "$OUT"
PORT=4321
SHA="$(git rev-parse HEAD)"

node -e '
const fs=require("fs");const p=JSON.parse(fs.readFileSync("tests/fixtures/l3/providers.json","utf8"));p.providers["openai-compatible"].settings.baseUrl="http://127.0.0.1:4321/v1";fs.writeFileSync("/tmp/dogfood-extra-providers.json",JSON.stringify(p,null,2));'

run_extra() {
  local id="$1" prompt="$2" scenario="$3"
  local ws="$ROOT/.tmp/dogfood-$id"
  rm -rf "$ws"; mkdir -p "$ws"; printf 'hello world\n' > "$ws/initial.txt"
  node tests/fake-provider/server.mjs "$scenario" "$PORT" > /tmp/dogfood-extra-fp.log 2>&1 &
  local fp=$!; sleep 0.7
  {
    echo "=== DOGFOOD TASK $id: $prompt ==="
    echo "=== TIMESTAMP: $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
    echo "=== SHA: $SHA ==="
    ZENUXS_PROVIDER_SETTINGS_PATH=/tmp/dogfood-extra-providers.json \
      CLINE_DIR="$ws/data" CLINE_DATA_DIR="$ws/data" \
      timeout 60 bun apps/cli/src/index.ts -c "$ws" -P openai-compatible -m fake-model --auto-approve true --json "$prompt" 2>&1 \
      | grep -E '"type":"(content_end|run_result)"' | head -4
    echo "=== EXIT: ${PIPESTATUS[0]} ==="
  } > "$OUT/task-$id.log" 2>&1
  kill $fp 2>/dev/null; wait $fp 2>/dev/null
  echo "task-$id: $(tail -1 "$OUT/task-$id.log")"
}

cat > /tmp/dogfood-7.json <<'EOF'
{"name":"7","steps":[{"type":"tool","tool_calls":[{"id":"call_mcp","name":"fixture__echo","arguments":{"text":"DOGFOOD_MCP"}}]},{"type":"text","content":"MCP task complete."}]}
EOF
cat > /tmp/dogfood-8.json <<'EOF'
{"name":"8","steps":[{"type":"tool","tool_calls":[{"id":"call_skill","name":"skills","arguments":{"skill":"ui-design"}}]},{"type":"text","content":"Skill task complete."}]}
EOF
cat > /tmp/dogfood-9.json <<'EOF'
{"name":"9","steps":[{"type":"tool","tool_calls":[{"id":"call_sub","name":"spawn_agent","arguments":{"systemPrompt":"Be terse","task":"Return 6*7"}}]},{"type":"text","content":"Subagent task complete."}]}
EOF

run_extra 7 "Use an MCP tool" /tmp/dogfood-7.json
run_extra 8 "Use a skill" /tmp/dogfood-8.json
run_extra 9 "Use a subagent" /tmp/dogfood-9.json

# Task 10: large indexed repo retrieval
ws="$ROOT/.tmp/dogfood-10"; rm -rf "$ws"; mkdir -p "$ws/src"
node -e 'const fs=require("fs");const r=process.argv[1];for(let i=0;i<120;i++)fs.writeFileSync(r+"/src/f"+i+".ts","export const v"+i+"="+i+";\n"+("// filler\n".repeat(10))+(i===77?"// DOGFOOD_NEEDLE_77\n":""));' "$ws"
ZENUXS_PROVIDER_SETTINGS_PATH=/tmp/dogfood-extra-providers.json CLINE_DIR="$ws/data" CLINE_DATA_DIR="$ws/data" \
  timeout 60 bun apps/cli/src/index.ts rag index --cwd "$ws" > "$OUT/task-10-index.log" 2>&1
cat > /tmp/dogfood-10.json <<'EOF'
{"name":"10","steps":[{"type":"tool","tool_calls":[{"id":"call_rag","name":"codebase_search","arguments":{"query":"DOGFOOD_NEEDLE_77","topK":2}}]},{"type":"text","content":"Large repo retrieval complete."}]}
EOF
node tests/fake-provider/server.mjs /tmp/dogfood-10.json "$PORT" > /tmp/dogfood-extra-fp.log 2>&1 &
FP=$!; sleep 0.7
{
  echo "=== DOGFOOD TASK 10: large repo retrieval ==="
  echo "=== TIMESTAMP: $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
  echo "=== SHA: $SHA ==="
  ZENUXS_PROVIDER_SETTINGS_PATH=/tmp/dogfood-extra-providers.json CLINE_DIR="$ws/data" CLINE_DATA_DIR="$ws/data" \
    timeout 60 bun apps/cli/src/index.ts -c "$ws" -P openai-compatible -m fake-model --auto-approve true --json "Search indexed repo" 2>&1 \
    | grep -E '"type":"(content_end|run_result)"' | head -4
  echo "=== EXIT: ${PIPESTATUS[0]} ==="
} > "$OUT/task-10.log" 2>&1
kill $FP 2>/dev/null; wait $FP 2>/dev/null
echo "task-10: $(tail -1 "$OUT/task-10.log")"

echo "=== DOGFOOD SUMMARY (10 tasks) ===" > "$OUT/summary.txt"
for i in 1 2 3 4 5 6 7 8 9 10; do
  echo "task-$i: $(grep -c '"type":"content_end"' "$OUT/task-$i.log" 2>/dev/null) tool results, $(tail -1 "$OUT/task-$i.log" | grep -o 'EXIT: [0-9]*')" >> "$OUT/summary.txt"
done
cat "$OUT/summary.txt"
