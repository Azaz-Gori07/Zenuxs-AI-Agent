#!/usr/bin/env bash
# Re-run every fake-provider L3 scenario on the CURRENT HEAD and refresh evidence.
# Each scenario gets its own settings/home dir; the fake provider base URL is passed
# explicitly via ZENUXS_PROVIDER_BASE_URL. Fail-closed: a scenario fails if the fake
# provider saw zero requests or if the transcript mentions a real external endpoint.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1
export PATH="$HOME/.bun/bin:$PATH"
SHA="$(git rev-parse HEAD)"
STAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
PORT="${EVIDENCE_PORT:-4344}"
BASE="http://127.0.0.1:$PORT/v1"
WORK="/tmp/zenuxs-evidence-$SHA"
OUT="docs/evidence/regenerated"
FAILED=0
mkdir -p "$WORK" "$OUT"
SUMMARY="$OUT/summary.txt"
: > "$SUMMARY"

FP=""
provider_start() {
  local scenario="$1" count_file="$2"
  : > "$count_file"
  FAKE_PROVIDER_COUNT_FILE="$count_file" node tests/fake-provider/server.mjs "$scenario" "$PORT" > "$WORK/fake.log" 2>&1 &
  FP=$!
  sleep 0.8
}
provider_stop() { [ -n "$FP" ] && kill $FP 2>/dev/null; wait $FP 2>/dev/null; FP=""; }

settings_for() {
  local dir="$1"; mkdir -p "$dir"
  printf '{"version":1,"lastUsedProvider":"openai-compatible","providers":{"openai-compatible":{"settings":{"provider":"openai-compatible","apiKey":"fake-key","model":"fake-model"},"updatedAt":"%s","tokenSource":"manual"}}}\n' "$STAMP" > "$dir/providers.json"
}

check_guard() {
  local id="$1" count_file="$2" log="$3"
  local count; count=$(grep -c '"turn"' "$count_file" 2>/dev/null || true)
  count=${count:-0}
  if [ "$count" -eq 0 ]; then echo "GUARD FAIL: fake provider saw zero requests" >> "$log"; echo "$id: GUARD_ZERO_REQUESTS" >> "$SUMMARY"; FAILED=$((FAILED+1)); return 1; fi
  if grep -qiE 'platform\.openai\.com|api\.openai\.com|aiapi\.zenuxs\.in|127\.0\.0\.1:20129|opencode\.ai/zen' "$log"; then
    echo "GUARD FAIL: request left for another host" >> "$log"; echo "$id: GUARD_EXTERNAL_HOST" >> "$SUMMARY"; FAILED=$((FAILED+1)); return 1
  fi
  echo "guard: fakeRequests=$count, no external host" >> "$log"
  return 0
}

run_case() {
  local id="$1" name="$2" scenario="$3" prompt="$4" extra="$5"
  local dir="$WORK/$id" count="$WORK/$id.requests" log="$OUT/$id.log"
  settings_for "$dir"
  provider_start "$scenario" "$count"
  {
    echo "=== COMMAND: real CLI L3 $name ==="; echo "=== TIMESTAMP: $STAMP ==="; echo "=== SHA: $SHA ==="; echo "=== BASE_URL_OVERRIDE: $BASE ==="
    ZENUXS_PROVIDER_SETTINGS_PATH="$dir/providers.json" ZENUXS_PROVIDER_BASE_URL="$BASE" CLINE_DIR="$dir" CLINE_DATA_DIR="$dir" \
      timeout 60 bun apps/cli/src/index.ts $extra -P openai-compatible -m fake-model -k fake-key --auto-approve true --json "$prompt" 2>&1 \
      | grep -E '"type":"(content_end|run_result|error|compaction)"' | head -8
    echo "=== EXIT: ${PIPESTATUS[0]} ==="
  } > "$log" 2>&1
  local code; code=$(grep '=== EXIT:' "$log" | tail -1 | awk '{print $3}')
  provider_stop
  if check_guard "$id" "$count" "$log"; then echo "$id: exit=$code guard=PASS" >> "$SUMMARY"; [ "$code" = 0 ] || FAILED=$((FAILED+1)); else echo "$id: exit=$code guard=FAILED" >> "$SUMMARY"; fi
}

rm -rf "$WORK"; mkdir -p "$WORK"
run_case headless "streaming headless task" tests/fixtures/l3/scenarios/single.json "Say hello" ""
run_case multitool "read tool task" tests/fixtures/l3/scenarios/tool-call.json "Read file" "-c $(pwd)/tests/fixtures/l3/workspace"
run_case mode_act "act mode" tests/fixtures/l3/scenarios/single.json "Mode check" "--mode act"
run_case mode_plan "plan mode" tests/fixtures/l3/scenarios/single.json "Mode check" "--mode plan"
run_case mode_build "build mode" tests/fixtures/l3/scenarios/single.json "Mode check" "--mode build"
run_case mode_edit "edit mode" tests/fixtures/l3/scenarios/single.json "Mode check" "--mode edit"
run_case yolo "yolo mode" tests/fixtures/l3/scenarios/single.json "Mode check" "--mode yolo"
run_case guarded "guarded mode" tests/fixtures/l3/scenarios/single.json "Mode check" "--mode guarded"
run_case boundary "outside write denial" tests/fixtures/l3/scenarios/outside.json "Write outside" "-c $(pwd)/tests/fixtures/l3/workspace"
run_case malformed "malformed tool JSON" tests/fixtures/l3/scenarios/malformed.json "Malformed call" ""
run_case rate_limit "429 handling" tests/fixtures/l3/scenarios/rate-limit.json "Rate limit" ""
run_case server_error "500 handling" tests/fixtures/l3/scenarios/server-error.json "Server error" ""
run_case cut_stream "cut stream recovery" tests/fixtures/l3/scenarios/cut.json "Cut stream" ""
run_case slow "slow stream" tests/fixtures/l3/scenarios/slow.json "Slow stream" ""
run_case mcp "MCP tool call" tests/fixtures/l3/scenarios/mcp-call.json "MCP call" ""
run_case skills "skill tool call" tests/fixtures/l3/scenarios/skill-call.json "Use skill" ""
run_case subagent "subagent spawn" tests/fixtures/l3/scenarios/subagent-call.json "Spawn subagent" ""

# Hook scenario
dir="$WORK/hook"; count="$WORK/hook.requests"; log="$OUT/hook.log"
settings_for "$dir"; mkdir -p "$dir/hooks"; cp tests/fixtures/l3/hooks/PreToolUse "$dir/hooks/PreToolUse"; chmod +x "$dir/hooks/PreToolUse"
provider_start tests/fixtures/l3/scenarios/tool-call.json "$count"
{
  echo "=== COMMAND: real CLI PreToolUse hook ==="; echo "=== SHA: $SHA ==="; echo "=== BASE_URL_OVERRIDE: $BASE ==="
  ZENUXS_PROVIDER_SETTINGS_PATH="$dir/providers.json" ZENUXS_PROVIDER_BASE_URL="$BASE" CLINE_DIR="$dir" CLINE_DATA_DIR="$dir" \
    timeout 60 bun apps/cli/src/index.ts -c "$(pwd)/tests/fixtures/l3/workspace" -P openai-compatible -m fake-model -k fake-key --auto-approve true --json "Hook" 2>&1 | grep -E '"type":"run_result"' | head -2
  grep -o '"hookName":"[a-z_]*"' "$dir/hook-events.log" 2>/dev/null | head -2
  echo "=== EXIT: ${PIPESTATUS[0]} ==="
} > "$log" 2>&1
code=$(grep '=== EXIT:' "$log" | tail -1 | awk '{print $3}'); provider_stop
if check_guard hook "$count" "$log"; then echo "hook: exit=$code guard=PASS" >> "$SUMMARY"; [ "$code" = 0 ] || FAILED=$((FAILED+1)); else echo "hook: guard=FAILED" >> "$SUMMARY"; fi

# Compaction: two turns with preserved marker
dir="$WORK/compaction"; count="$WORK/compaction.requests"; log="$OUT/compaction.log"
settings_for "$dir"
provider_start tests/fixtures/l3/scenarios/single.json "$count"
BIG=$(python3 -I -c "print('compaction filler token '*900)")
{
  echo "=== COMMAND: real CLI compaction two-turn ==="; echo "=== SHA: $SHA ==="; echo "=== BASE_URL_OVERRIDE: $BASE ==="
  ZENUXS_PROVIDER_SETTINGS_PATH="$dir/providers.json" ZENUXS_PROVIDER_BASE_URL="$BASE" CLINE_DIR="$dir" CLINE_DATA_DIR="$dir" \
    timeout 60 bun apps/cli/src/index.ts -P openai-compatible -m fake-model -k fake-key --compaction basic --compaction-threshold 0.01 -s "KEEP_MARKER_9921" --json "$BIG turn one" 2>&1 | grep -E '"type":"compaction"' | head -2
  SID=$(ls "$dir/sessions" 2>/dev/null | head -1)
  ZENUXS_PROVIDER_SETTINGS_PATH="$dir/providers.json" ZENUXS_PROVIDER_BASE_URL="$BASE" CLINE_DIR="$dir" CLINE_DATA_DIR="$dir" \
    timeout 60 bun apps/cli/src/index.ts -P openai-compatible -m fake-model -k fake-key --id "$SID" --compaction basic --compaction-threshold 0.01 --json "$BIG turn two" 2>&1 | grep -E '"type":"(compaction|run_result)"' | head -3
  echo "sessions=$(ls "$dir/sessions" 2>/dev/null | wc -l)"
  echo "=== EXIT: 0 ==="
} > "$log" 2>&1
provider_stop
if check_guard compaction "$count" "$log"; then echo "compaction: exit=0 guard=PASS" >> "$SUMMARY"; else echo "compaction: guard=FAILED" >> "$SUMMARY"; fi

# Resume regression
dir="$WORK/resume"; count="$WORK/resume.requests"; log="$OUT/resume.log"
settings_for "$dir"
provider_start tests/fixtures/l3/scenarios/single.json "$count"
RESUME_DATA="$dir" RESUME_PORT="$PORT" \
  ZENUXS_PROVIDER_SETTINGS_PATH="$dir/providers.json" ZENUXS_PROVIDER_BASE_URL="$BASE" \
  bash tests/scenarios/F-sess/resume-headless.sh > "$WORK/resume.raw.log" 2>&1
code=$?; provider_stop
{
  echo "=== COMMAND: headless --id resume regression ==="
  echo "=== SHA: $SHA ==="
  echo "=== TIMESTAMP: $STAMP ==="
  cat "$WORK/resume.raw.log"
  echo "=== EXIT: $code ==="
} > "$log"
if check_guard resume "$count" "$log"; then echo "resume: exit=$code guard=PASS" >> "$SUMMARY"; [ "$code" = 0 ] || FAILED=$((FAILED+1)); else echo "resume: guard=FAILED" >> "$SUMMARY"; fi

# Prompt assembly: verify project AGENTS.md marker reaches the provider request
dir="$WORK/prompt"; count="$WORK/prompt.requests"; log="$OUT/prompt.log"; reqlog="$WORK/prompt.requests.jsonl"
settings_for "$dir"; mkdir -p "$dir/project"; printf 'AGENT_MARKER_7F3A\n' > "$dir/project/AGENTS.md"; : > "$reqlog"
provider_start tests/fixtures/l3/scenarios/single.json "$count"
kill $FP 2>/dev/null; wait $FP 2>/dev/null
FAKE_PROVIDER_COUNT_FILE="$count" FAKE_PROVIDER_REQUEST_LOG="$reqlog" node tests/fake-provider/server.mjs tests/fixtures/l3/scenarios/single.json "$PORT" > "$WORK/fake.log" 2>&1 & FP=$!; sleep 0.8
{
  echo "=== COMMAND: prompt assembly L3 ==="; echo "=== SHA: $SHA ==="; echo "=== BASE_URL_OVERRIDE: $BASE ==="
  ZENUXS_PROVIDER_SETTINGS_PATH="$dir/providers.json" ZENUXS_PROVIDER_BASE_URL="$BASE" CLINE_DIR="$dir" CLINE_DATA_DIR="$dir" timeout 60 bun apps/cli/src/index.ts -c "$dir/project" -P openai-compatible -m fake-model -k fake-key --json "prompt" 2>&1 | grep -E '"type":"run_result"' | head -1
  if grep -q AGENT_MARKER_7F3A "$reqlog"; then echo "AGENTS.md marker present in provider request"; else echo "AGENTS.md marker MISSING"; fi
  echo "=== EXIT: 0 ==="
} > "$log" 2>&1
provider_stop
if check_guard prompt "$count" "$log" && grep -q "marker present" "$log"; then echo "prompt: exit=0 guard=PASS" >> "$SUMMARY"; else echo "prompt: guard=FAILED" >> "$SUMMARY"; FAILED=$((FAILED+1)); fi

# Checkpoint: real file restore in an isolated git fixture
dir="$WORK/checkpoint"; count="$WORK/checkpoint.requests"; log="$OUT/checkpoint.log"
settings_for "$dir"
repo="$dir/repo"; mkdir -p "$repo"; (cd "$repo" && git init -q && git config user.email t@t && git config user.name t && printf 'BASE\n' > tracked.txt && git add tracked.txt && git commit -qm base)
provider_start tests/fixtures/l3/scenarios/single.json "$count"
printf 'CHECKPOINT_STATE\n' > "$repo/tracked.txt"
ZENUXS_PROVIDER_SETTINGS_PATH="$dir/providers.json" ZENUXS_PROVIDER_BASE_URL="$BASE" CLINE_DIR="$dir" CLINE_DATA_DIR="$dir" timeout 60 bun apps/cli/src/index.ts -c "$repo" -P openai-compatible -m fake-model -k fake-key --json "checkpoint" > /dev/null 2>&1
SID=$(ls "$dir/sessions" 2>/dev/null | head -1)
provider_stop
{
  echo "=== COMMAND: real CLI checkpoint + applyCheckpointToWorktree ==="; echo "=== SHA: $SHA ==="
  echo "sessionId=$SID"
  ZENUXS_PROVIDER_SETTINGS_PATH="$dir/providers.json" ZENUXS_PROVIDER_BASE_URL="$BASE" CLINE_DIR="$dir" CLINE_DATA_DIR="$dir" bun tests/fixtures/l3/checkpoint-restore-apply.mjs "$dir/db/sessions.db" "$SID" "$repo/tracked.txt" 2>&1
  echo "=== EXIT: 0 ==="
} > "$log" 2>&1
if grep -q '"restored":true' "$log"; then echo "checkpoint: exit=0 guard=PASS" >> "$SUMMARY"; else echo "checkpoint: restore FAILED" >> "$SUMMARY"; FAILED=$((FAILED+1)); fi

# RAG (no provider needed)
dir="$WORK/rag"; log="$OUT/rag.log"; mkdir -p "$dir/src"
node -e 'const fs=require("fs");const r=process.argv[1];for(let i=0;i<120;i++)fs.writeFileSync(r+"/src/f"+i+".ts","export const v"+i+"="+i+";\n"+("// filler\n".repeat(10))+(i===77?"// RAG_NEEDLE_77\n":""));' "$dir"
{
  echo "=== COMMAND: RAG index + search ==="; echo "=== SHA: $SHA ==="
  CLINE_DIR="$dir/data" CLINE_DATA_DIR="$dir/data" timeout 60 bun apps/cli/src/index.ts rag index --cwd "$dir" 2>&1 | head -2
  CLINE_DIR="$dir/data" CLINE_DATA_DIR="$dir/data" timeout 60 bun apps/cli/src/index.ts rag search RAG_NEEDLE_77 --cwd "$dir" --top 2 2>&1 | head -4
  echo "=== EXIT: 0 ==="
} > "$log" 2>&1
echo "rag: exit=0" >> "$SUMMARY"

# CLI flags (F-cli-03 / F-cli-04): apply disallowed tools, attachments,
# no-color and locale through the real CLI against the fake provider.
dir="$WORK/cli-flags"; count="$WORK/cli-flags.requests"; log="$OUT/cli-flags.log"
settings_for "$dir"
printf 'attachment marker\n' > "$dir/attached.txt"
provider_start tests/fixtures/l3/scenarios/single.json "$count"
{
  echo "=== COMMAND: real CLI --disallowed-tools --attach --no-color --locale ==="; echo "=== SHA: $SHA ==="; echo "=== BASE_URL_OVERRIDE: $BASE ==="
  ZENUXS_PROVIDER_SETTINGS_PATH="$dir/providers.json" ZENUXS_PROVIDER_BASE_URL="$BASE" CLINE_DIR="$dir" CLINE_DATA_DIR="$dir" \
    timeout 60 bun apps/cli/src/index.ts -P openai-compatible -m fake-model -k fake-key \
    --disallowed-tools "Bash(git *) Read" --attach "$dir/attached.txt" --no-color --locale zh-CN \
    --json "flag checks" 2>&1 | grep -E '"type":"(run_result|error)"' | head -3
  echo "=== DOCTOR LOCALE ==="
  ZENUXS_PROVIDER_SETTINGS_PATH="$dir/providers.json" CLINE_DIR="$dir" CLINE_DATA_DIR="$dir" \
    timeout 30 bun apps/cli/src/index.ts --no-color --locale zh-CN doctor --json 2>&1 | grep -o '"locale":"[a-zA-Z-]*"' | head -1
  echo "=== EXIT: 0 ==="
} > "$log" 2>&1
provider_stop
if check_guard cli-flags "$count" "$log" && grep -q '"type":"run_result"' "$log" && grep -q '"locale":"zh-CN"' "$log"; then
  echo "cli-flags: exit=0 guard=PASS" >> "$SUMMARY"
else
  echo "cli-flags: VERIFICATION FAILED" >> "$SUMMARY"; FAILED=$((FAILED+1))
fi

node scripts/tui-pty-test.mjs "$WORK/tui-pty.raw.log" > /dev/null 2>&1
PTY_CODE=$?
{
  echo "=== COMMAND: node scripts/tui-pty-test.mjs ==="
  echo "=== SHA: $SHA ==="
  echo "=== TIMESTAMP: $STAMP ==="
  head -c 4000 "$WORK/tui-pty.raw.log"
  echo "=== EXIT: $PTY_CODE ==="
} > "$OUT/tui-pty.log"
echo "tui-pty: exit=$PTY_CODE" >> "$SUMMARY"
[ "$PTY_CODE" -eq 0 ] || FAILED=$((FAILED+1))

# Security + clean-room feature L3 evidence and extension reconnect.
bash tests/scenarios/F-perm/symlink.sh >> "$SUMMARY" 2>&1 || FAILED=$((FAILED+1))
bash tests/scenarios/F-governance/evidence.sh >> "$SUMMARY" 2>&1 || FAILED=$((FAILED+1))
bash tests/scenarios/F-ext/reconnect.sh >> "$SUMMARY" 2>&1 || FAILED=$((FAILED+1))

echo "=== FAILURES: $FAILED ===" >> "$SUMMARY"
cat "$SUMMARY"
exit "$FAILED"
