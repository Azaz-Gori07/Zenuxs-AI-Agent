#!/usr/bin/env bash
# L3 evidence for the clean-room hook-governance, plugin-exchange and
# flow-automation features. Every assertion runs the real built CLI.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT" || exit 1
export PATH="$HOME/.bun/bin:$PATH"
SHA="$(git rev-parse HEAD)"
STAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
WORK="/tmp/zenuxs-governance-$SHA"
PORT="${GOV_PORT:-4345}"
BASE="http://127.0.0.1:$PORT/v1"
HOOK_LOG="docs/evidence/F-hook-01/l3-governance.log"
PLUG_LOG="docs/evidence/F-plug-01/l3-exchange.log"
FLOW_LOG="docs/evidence/F-auto-01/l3-flows.log"
rm -rf "$WORK"
mkdir -p "$(dirname "$HOOK_LOG")" "$(dirname "$PLUG_LOG")" "$(dirname "$FLOW_LOG")" \
  "$WORK/ws/.zenuxs" "$WORK/plugin" "$WORK/data"
for f in "$HOOK_LOG" "$PLUG_LOG" "$FLOW_LOG"; do
  { echo "=== TIMESTAMP: $STAMP ==="; echo "=== SHA: $SHA ==="; } > "$f"
done

FP=""
cleanup() { [ -n "$FP" ] && kill "$FP" 2>/dev/null; }
trap cleanup EXIT

# Fixtures.
cat > "$WORK/ws/.zenuxs/hooks.json" <<EOF
[{"event":"PreToolUse","type":"process","command":"/bin/sh","args":["-c","printf ran > $WORK/ws/hook.marker"]}]
EOF
cat > "$WORK/plugin/plugin.json" <<'EOF'
{"name":"hello","version":"1.0.0","hooks":[{"event":"PreToolUse","type":"process","command":"/bin/true","args":[]}]}
EOF
cat > "$WORK/marketplace.json" <<'EOF'
{"name":"community-market","publisherType":"community","plugins":[{"name":"hello","path":"plugin","version":"1.0.0"}]}
EOF
cat > "$WORK/flow.json" <<'EOF'
{"id":"demo","name":"demo","steps":[{"id":"hook","kind":"hook","hookIndex":0},{"id":"plugin","kind":"plugin","pluginId":"hello@community-market"},{"id":"agent","kind":"agent","prompt":"hello from flow"}]}
EOF
cat > "$WORK/flow-denied.json" <<'EOF'
{"id":"denied","name":"denied","steps":[{"id":"hook","kind":"hook","hookIndex":0}]}
EOF
printf '{"version":1,"lastUsedProvider":"openai-compatible","providers":{"openai-compatible":{"settings":{"provider":"openai-compatible","apiKey":"fake-key","model":"fake-model"},"updatedAt":"%s","tokenSource":"manual"}}}\n' "$STAMP" > "$WORK/providers.json"
E=(env CLINE_DATA_DIR="$WORK/data" CLINE_DIR="$WORK/data" ZENUXS_PROVIDER_SETTINGS_PATH="$WORK/providers.json" ZENUXS_PROVIDER_BASE_URL="$BASE")
CLI=(bun apps/cli/src/index.ts)

node tests/fake-provider/server.mjs tests/fixtures/l3/scenarios/single.json "$PORT" > "$WORK/fake.log" 2>&1 &
FP=$!
sleep 1

FAILED=0
run() {
  local log="$1"; shift
  { echo "=== COMMAND: $* ==="; "${E[@]}" "${CLI[@]}" "$@" 2>&1; echo "=== EXIT: $? ==="; } >> "$log"
}
assert() {
  local log="$1" label="$2" pattern="$3"
  if grep -Eq "$pattern" "$log"; then echo "PASS: $label" >> "$log"; else echo "FAIL: $label" >> "$log"; FAILED=$((FAILED+1)); fi
}

# --- F-hook-01 ---
run "$HOOK_LOG" hooks review --workspace "$WORK/ws"
assert "$HOOK_LOG" "hook is pending and not runnable" '"state":"pending"[^}]*"runnable":false|"runnable":false,"state":"pending"'
rm -f "$WORK/ws/hook.marker"
run "$HOOK_LOG" hooks run --workspace "$WORK/ws" --index 0
assert "$HOOK_LOG" "untrusted hook did not run" '"ran":false'
if [ -e "$WORK/ws/hook.marker" ]; then echo "FAIL: untrusted hook wrote a marker" >> "$HOOK_LOG"; FAILED=$((FAILED+1)); else echo "PASS: untrusted hook wrote no marker" >> "$HOOK_LOG"; fi
DIGEST=$("${E[@]}" "${CLI[@]}" hooks review --workspace "$WORK/ws" 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).hooks[0].digest))")
run "$HOOK_LOG" hooks grant --workspace "$WORK/ws" --digest "$DIGEST"
assert "$HOOK_LOG" "grant recorded for reviewed digest" '"granted":1'
rm -f "$WORK/ws/hook.marker"
run "$HOOK_LOG" hooks run --workspace "$WORK/ws" --index 0
assert "$HOOK_LOG" "granted hook ran" '"ran":true[^}]*"state":"trusted"'
if [ -f "$WORK/ws/hook.marker" ]; then echo "PASS: granted hook wrote marker" >> "$HOOK_LOG"; else echo "FAIL: granted hook wrote no marker" >> "$HOOK_LOG"; FAILED=$((FAILED+1)); fi
run "$HOOK_LOG" hooks revoke --workspace "$WORK/ws" --digest "$DIGEST"
rm -f "$WORK/ws/hook.marker"
run "$HOOK_LOG" hooks run --workspace "$WORK/ws" --index 0
assert "$HOOK_LOG" "revoked hook did not run" '"state":"revoked"'
if [ -e "$WORK/ws/hook.marker" ]; then echo "FAIL: revoked hook wrote a marker" >> "$HOOK_LOG"; FAILED=$((FAILED+1)); else echo "PASS: revoked hook wrote no marker" >> "$HOOK_LOG"; fi
run "$FLOW_LOG" flow run --file "$WORK/flow-denied.json" --workspace "$WORK/ws"
assert "$FLOW_LOG" "flow cannot bypass hook revocation" 'hook step denied'
run "$PLUG_LOG" plugins marketplace add --descriptor "$WORK/marketplace.json" --id zenuxs-official
assert "$PLUG_LOG" "reserved official id rejected" 'reserved for official sources'
run "$PLUG_LOG" plugins marketplace add --descriptor "$WORK/marketplace.json"
assert "$PLUG_LOG" "community marketplace added" '"publisherType":"community"'
run "$PLUG_LOG" plugins available
assert "$PLUG_LOG" "plugin listed as available" '"id":"hello@community-market"'
run "$PLUG_LOG" plugins install --id hello@community-market
assert "$PLUG_LOG" "installed plugin starts disabled" '"enabled":false'
run "$PLUG_LOG" plugins enable --id hello@community-market
run "$PLUG_LOG" plugins list
assert "$PLUG_LOG" "plugin enable is explicit" '"enabled":true'
run "$PLUG_LOG" plugins hooks --id hello@community-market
assert "$PLUG_LOG" "community plugin hooks exposed" '"publisherType":"community"'
run "$PLUG_LOG" plugins validate --path "$WORK/plugin"
assert "$PLUG_LOG" "validate succeeds without side effects" '"ok":true'

# --- F-auto-01 ---
# Re-grant the hook so the happy-path flow can complete.
"${E[@]}" "${CLI[@]}" hooks grant --workspace "$WORK/ws" --digest "$DIGEST" > /dev/null 2>&1
rm -f "$WORK/ws/hook.marker"
run "$FLOW_LOG" flow run --file "$WORK/flow.json" --workspace "$WORK/ws"
assert "$FLOW_LOG" "flow completed with hook, plugin and agent steps" '"status":"completed"'

# Resume: completed steps are reused from the journal.
RUN_ID=$(grep '"stepId":"agent"' "$FLOW_LOG" | grep -o '"runId":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -n "$RUN_ID" ]; then
  run "$FLOW_LOG" flow run --file "$WORK/flow.json" --workspace "$WORK/ws" --resume "$RUN_ID"
  assert "$FLOW_LOG" "resume reuses completed steps" 'reused-from-journal'
else
  echo "FAIL: no run id captured" >> "$FLOW_LOG"; FAILED=$((FAILED+1))
fi

echo "=== FAILURES: $FAILED ===" >> "$HOOK_LOG"
echo "=== FAILURES: $FAILED ===" >> "$PLUG_LOG"
echo "=== FAILURES: $FAILED ===" >> "$FLOW_LOG"
exit "$FAILED"
