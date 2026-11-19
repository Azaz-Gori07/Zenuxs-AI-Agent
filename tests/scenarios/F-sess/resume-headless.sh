#!/usr/bin/env bash
# Regression: two headless runs with the same --id must use ONE session and
# preserve the previous turn's messages. Requires a fake provider on $PORT.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT" || exit 1
export PATH="$HOME/.bun/bin:$PATH"
PORT="${RESUME_PORT:-4331}"
DATA="${RESUME_DATA:-/tmp/zenuxs-resume-regression}"
rm -rf "$DATA"
E=(env ZENUXS_PROVIDER_SETTINGS_PATH=/tmp/review-providers.json CLINE_DIR="$DATA" CLINE_DATA_DIR="$DATA")
"${E[@]}" timeout 45 bun apps/cli/src/index.ts -P openai-compatible -m fake-model --json "first turn" > "$DATA-1.log" 2>&1
SID=$(ls "$DATA/sessions" 2>/dev/null | head -1)
[ -n "$SID" ] || { echo "FAIL: no session"; exit 1; }
"${E[@]}" timeout 45 bun apps/cli/src/index.ts -P openai-compatible -m fake-model --id "$SID" --json "second turn" > "$DATA-2.log" 2>&1
COUNT=$(ls "$DATA/sessions" 2>/dev/null | wc -l)
MESSAGES=$(node -e 'const d=require(process.argv[1]);console.log(d.messages.length)' "$DATA/sessions/$SID/$SID.messages.json" 2>/dev/null || echo 0)
echo "sessionCount=$COUNT messageCount=$MESSAGES sessionId=$SID"
[ "$COUNT" -eq 1 ] && [ "$MESSAGES" -ge 3 ]
