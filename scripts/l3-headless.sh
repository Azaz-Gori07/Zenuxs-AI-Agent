#!/usr/bin/env bash
# Run a real headless CLI task against the deterministic fake provider.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="$HOME/.bun/bin:$PATH"
PORT="${FAKE_PROVIDER_PORT:-4317}"
SCENARIO="${1:-$ROOT/tests/fake-provider/scenarios/default.json}"
PROMPT="${2:-Say hello}"
node "$ROOT/tests/fake-provider/server.mjs" "$SCENARIO" "$PORT" > /tmp/zenuxs-fake-provider.log 2>&1 &
FP=$!
trap 'kill $FP 2>/dev/null || true' EXIT
sleep 1
ZENUXS_PROVIDER_SETTINGS_PATH="${ZENUXS_PROVIDER_SETTINGS_PATH:-/tmp/zenuxs-l3/providers.json}" \
CLINE_DATA_DIR="${CLINE_DATA_DIR:-/tmp/zenuxs-l3/data-l3}" \
timeout 90 bun "$ROOT/apps/cli/src/index.ts" -P openai-compatible -m fake-model --auto-approve true --json "$PROMPT"
