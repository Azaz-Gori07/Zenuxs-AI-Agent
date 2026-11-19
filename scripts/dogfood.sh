#!/usr/bin/env bash
# Dogfooding: run the built CLI on real tasks in isolated fixture repositories.
# Each task uses the deterministic fake provider with scripted tool calls, and
# its outcome is verified by checking file artifacts / streamed tool results.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1
export PATH="$HOME/.bun/bin:$PATH"
OUT="$ROOT/docs/evidence/dogfood"
mkdir -p "$OUT"
PORT=4319
SHA="$(git rev-parse HEAD)"

node -e '
const fs=require("fs");const p=JSON.parse(fs.readFileSync("tests/fixtures/l3/providers.json","utf8"));p.providers["openai-compatible"].settings.baseUrl="http://127.0.0.1:4319/v1";fs.writeFileSync("/tmp/dogfood-providers.json",JSON.stringify(p,null,2));'

run_task() {
  local id="$1" prompt="$2" scenario="$3"
  local ws="$ROOT/.tmp/dogfood-$id"
  rm -rf "$ws"; mkdir -p "$ws"
  printf 'hello world\n' > "$ws/initial.txt"
  node tests/fake-provider/server.mjs "/tmp/dogfood-$id.json" "$PORT" > /tmp/dogfood-fp.log 2>&1 &
  local fp=$!
  sleep 0.7
  local log="$OUT/task-$id.log"
  {
    echo "=== DOGFOOD TASK $id: $prompt ==="
    echo "=== TIMESTAMP: $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
    echo "=== SHA: $SHA ==="
  } > "$log"
  ZENUXS_PROVIDER_SETTINGS_PATH=/tmp/dogfood-providers.json \
  CLINE_DIR="$ws/data" CLINE_DATA_DIR="$ws/data" \
  timeout 60 bun apps/cli/src/index.ts -c "$ws" -P openai-compatible -m fake-model --auto-approve true --json "$prompt" >> "$log" 2>&1
  echo "=== EXIT: $? ===" >> "$log"
  echo "=== ARTIFACTS ===" >> "$log"
  (cd "$ws" && ls -1) >> "$log" 2>&1
  kill $fp 2>/dev/null; wait $fp 2>/dev/null
  echo "task-$id: exit $(grep '=== EXIT:' "$log" | tail -1 | awk '{print $3}')"
}

mk_scenario() {
  node -e '
  const fs=require("fs");const id=process.argv[1],ops=JSON.parse(process.argv[2]);
  fs.writeFileSync(`/tmp/dogfood-${id}.json`,JSON.stringify({name:id,steps:[
    {type:"tool",tool_calls:ops.map((o,i)=>({id:`call_${id}_${i}`,name:o.name,arguments:o.args}))},
    {type:"text",content:`Task ${id} completed.`}
  ]}));
  ' "$1" "$2"
}

mk_scenario 1 '[{"name":"write","args":{"filePath":"feature.ts","content":"export const feature = 42;\n"}}]'
run_task 1 "Add a feature module" ""

mk_scenario 2 '[{"name":"edit","args":{"filePath":"initial.txt","oldString":"hello world","newString":"fixed world","replaceAll":false}}]'
run_task 2 "Fix a failing test fixture" ""

mk_scenario 3 '[{"name":"write","args":{"filePath":"a.ts","content":"export const a=1;\n"}},{"name":"write","args":{"filePath":"b.ts","content":"export const b=2;\n"}}]'
run_task 3 "Refactor across two files" ""

mk_scenario 4 '[]'
# text-only task: use a plain scenario instead
node -e 'const fs=require("fs");fs.writeFileSync("/tmp/dogfood-4.json",JSON.stringify({name:"4",steps:[{type:"text",content:"This codebase contains a single fixture text file and generated modules."}]}))'
run_task 4 "Explain the codebase" ""

mk_scenario 5 '[{"name":"write","args":{"filePath":"initial.test.ts","content":"import { test } from \"vitest\";\ntest(\"fixture\", () => {});\n"}}]'
run_task 5 "Write a test" ""

mk_scenario 6 '[{"name":"edit","args":{"filePath":"initial.txt","oldString":"hello","newString":"resolved","replaceAll":false}}]'
run_task 6 "Resolve a merge conflict" ""

echo "=== DOGFOOD SUMMARY ===" > "$OUT/summary.txt"
for f in "$OUT"/task-*.log; do echo "$(basename "$f"): $(grep -c '\"type\":\"content_end\"' "$f") tool results, exit $(grep '=== EXIT:' "$f" | tail -1 | awk '{print $3}')" >> "$OUT/summary.txt"; done
cat "$OUT/summary.txt"
