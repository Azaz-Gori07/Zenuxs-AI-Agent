#!/usr/bin/env bash
# One-shot live-provider verification. Run when a working OpenAI-compatible
# endpoint exists:
#   ZENUXS_TEST_BASE_URL=https://... ZENUXS_TEST_API_KEY=... \
#   ZENUXS_TEST_MODEL=deepseek-v4.1-flash-free bash scripts/verify-live.sh
#
# 429s are retried with exponential backoff; live scenarios get a long timeout.
# This script is the ONLY thing allowed to flip F-prov / F-toolrobust to
# VERIFIED, and only from real successful CLI evidence.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1
export PATH="$HOME/.bun/bin:$PATH"
SHA="$(git rev-parse HEAD)"
STAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
OUT="docs/evidence/live/verify-live.log"
WORK="/tmp/zenuxs-verify-live-$SHA"
mkdir -p "$(dirname "$OUT")" "$WORK"
: > "$OUT"

log() { printf '%s\n' "$*" | tee -a "$OUT"; }
log "=== LIVE PROVIDER VERIFICATION ==="
log "=== TIMESTAMP: $STAMP ==="
log "=== SHA: $SHA ==="

BASE_URL="${ZENUXS_TEST_BASE_URL:-}"
API_KEY="${ZENUXS_TEST_API_KEY:-}"
MODEL="${ZENUXS_TEST_MODEL:-deepseek-v4.1-flash-free}"
TIMEOUT_SECONDS="${ZENUXS_LIVE_TIMEOUT_SECONDS:-300}"
MAX_ATTEMPTS="${ZENUXS_LIVE_MAX_ATTEMPTS:-5}"
INITIAL_DELAY="${ZENUXS_LIVE_RETRY_INITIAL_SECONDS:-2}"

if [ -z "$BASE_URL" ] || [ -z "$API_KEY" ]; then
	log "=== LIVE_VERIFY: BLOCKED ==="
	log "ZENUXS_TEST_BASE_URL and ZENUXS_TEST_API_KEY must be exported in this shell."
	log "No matrix row was changed. Re-run this command when a working endpoint exists."
	exit 2
fi
API_BASE="${BASE_URL%/}"
case "$API_BASE" in
	*/v1) ;;
	*) API_BASE="$API_BASE/v1" ;;
esac
log "=== MODEL: $MODEL ==="
log "=== API_BASE: $API_BASE ==="
log "=== TIMEOUT_SECONDS: $TIMEOUT_SECONDS ==="

# Run a probe with exponential backoff on 429 / free-usage-limit responses.
retry_probe() {
	local label="$1"; shift
	local delay="$INITIAL_DELAY" attempt output code
	for ((attempt = 1; attempt <= MAX_ATTEMPTS; attempt++)); do
		output="$(timeout "$((TIMEOUT_SECONDS + 30))" "$@" 2>&1)"
		code=$?
		log "--- $label attempt $attempt exit=$code ---"
		log "${output:0:2000}"
		if printf '%s' "$output" | grep -qiE '"code"[[:space:]]*:[[:space:]]*429|FreeUsageLimitError|rate.?limit.*429|HTTP 429'; then
			log "429/backoff: sleeping ${delay}s"
			sleep "$delay"
			delay=$((delay * 2))
			continue
		fi
		if [ "$code" -eq 0 ]; then return 0; fi
		sleep "$delay"
		delay=$((delay * 2))
	done
	return 1
}

models_probe() {
	curl -sS --max-time "$TIMEOUT_SECONDS" -H "Authorization: Bearer $API_KEY" "$API_BASE/models"
}
completion_probe() {
	curl -sS --max-time "$TIMEOUT_SECONDS" \
		-H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
		-d "{\"model\":\"$MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"Reply with exactly PONG\"}],\"max_tokens\":32}" \
		"$API_BASE/chat/completions"
}

if ! retry_probe "models" models_probe; then
	log "=== LIVE_VERIFY: BLOCKED ==="
	log "models probe failed/retry-exhausted; no matrix row was changed."
	exit 2
fi
if ! retry_probe "tiny completion" completion_probe; then
	log "=== LIVE_VERIFY: BLOCKED ==="
	log "tiny completion probe failed/retry-exhausted; no matrix row was changed."
	exit 2
fi

printf '{"version":1,"lastUsedProvider":"openai-compatible","providers":{"openai-compatible":{"settings":{"provider":"openai-compatible","apiKey":"%s","model":"%s","baseUrl":"%s"},"updatedAt":"%s","tokenSource":"manual"}}}\n' \
	"$API_KEY" "$MODEL" "$API_BASE" "$STAMP" > "$WORK/providers.json"

run_live() {
	local name="$1" prompt="$2" pattern="$3"
	local output code
	output="$(ZENUXS_PROVIDER_SETTINGS_PATH="$WORK/providers.json" \
		ZENUXS_PROVIDER_BASE_URL="$API_BASE" CLINE_DIR="$WORK" CLINE_DATA_DIR="$WORK" \
		timeout "$((TIMEOUT_SECONDS + 60))" bun apps/cli/src/index.ts \
		-P openai-compatible -m "$MODEL" -k "$API_KEY" \
		--retries "$MAX_ATTEMPTS" --timeout "$TIMEOUT_SECONDS" --json "$prompt" 2>&1)"
	code=$?
	log "=== LIVE SCENARIO: $name (exit=$code) ==="
	log "${output:0:4000}"
	if [ "$code" -eq 0 ] && printf '%s' "$output" | grep -q "$pattern"; then
		return 0
	fi
	return 1
}

LIVE_OK=0
if run_live "F-prov streaming" "Reply with exactly LIVE_OK and nothing else." '"type":"run_result"'; then
	LIVE_OK=$((LIVE_OK + 1))
fi
if run_live "F-toolrobust tool call" "Read package.json with the file tool, then report the package name." '"type":"tool_call"'; then
	LIVE_OK=$((LIVE_OK + 1))
fi

if [ "$LIVE_OK" -eq 2 ]; then
	log "=== LIVE_VERIFY: PASS ==="
	log "Both live scenarios produced real successful CLI evidence. Regenerating the matrix."
	node scripts/reconcile-matrix.mjs
	exit 0
fi

log "=== LIVE_VERIFY: BLOCKED ==="
log "Only $LIVE_OK/2 live scenarios verified; F-prov/F-toolrobust remain BLOCKED."
log "Evidence: $OUT"
exit 2
