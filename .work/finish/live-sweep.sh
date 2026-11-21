#!/usr/bin/env bash
# Round 1 live sweep: try every advertised model with real CLI verification.
# Backoff on quota/timeout: 2m, 4m, 8m, 16m, 30m (cap). Deadline ~5h20m.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT" || exit 1
export PATH="$HOME/.bun/bin:$PATH"
export ZENUXS_TEST_BASE_URL="http://127.0.0.1:20129"
export ZENUXS_TEST_API_KEY="public"
OUT="$ROOT/.work/finish/live"
mkdir -p "$OUT"
MODELS=(big-pickle mimo-v2.6-flash-free deepseek-v4.1-flash-free longcat-2.5-free iceman-free beam-free flint-40b-free nemotron-3.5-super-vl-free nemotron-3.5-lightning-free hy4-flash-free tidepool-alpha-free)
DEADLINE=$(( $(date +%s) + 19200 ))  # 5h20m
DELAYS=(0 120 240 480 960 1800)
PASS=0
QUOTA=0
PRODUCT=0
ROUND=0
while [ "$(date +%s)" -lt "$DEADLINE" ]; do
  ROUND=$((ROUND+1))
  echo "=== SWEEP ROUND $ROUND $(date -u +%FT%TZ) ===" | tee -a "$OUT/sweep.log"
  for MODEL in "${MODELS[@]}"; do
    [ "$(date +%s)" -lt "$DEADLINE" ] || break
    echo "--- model=$MODEL $(date -u +%FT%TZ) ---" | tee -a "$OUT/sweep.log"
    ZENUXS_TEST_MODEL="$MODEL" bash scripts/verify-live.sh > "$OUT/$MODEL.log" 2>&1
    CODE=$?
    if grep -q '=== LIVE_VERIFY: PASS ===' "$OUT/$MODEL.log"; then
      echo "RESULT: PASS model=$MODEL exit=$CODE" | tee -a "$OUT/sweep.log"
      PASS=1
      break 2
    fi
    if grep -qE 'FreeUsageLimitError|quota|429|HTTP 429' "$OUT/$MODEL.log"; then
      QUOTA=$((QUOTA+1))
      KIND=quota
    elif grep -qE '=== EXIT: 124|timed out|Timeout|ETIMEDOUT' "$OUT/$MODEL.log"; then
      QUOTA=$((QUOTA+1))
      KIND=timeout
    elif grep -qE 'No such model|model_not_found|model_deprecated|error\.message' "$OUT/$MODEL.log"; then
      PRODUCT=$((PRODUCT+1))
      KIND=product
    else
      KIND=unknown
    fi
    echo "RESULT: $KIND model=$MODEL exit=$CODE" | tee -a "$OUT/sweep.log"
  done
  [ "$PASS" -eq 1 ] && break
  IDX=$ROUND; [ "$IDX" -gt 5 ] && IDX=5
  DELAY=${DELAYS[$IDX]}
  echo "=== BACKOFF ${DELAY}s $(date -u +%FT%TZ) ===" | tee -a "$OUT/sweep.log"
  sleep "$DELAY"
done
{
  echo "PASS=$PASS QUOTA_OR_TIMEOUT=$QUOTA PRODUCT_ERROR=$PRODUCT"
  echo "SWEEP_ROUNDS=$ROUND"
  echo "FINISHED=$(date -u +%FT%TZ)"
} | tee -a "$OUT/sweep.log"
