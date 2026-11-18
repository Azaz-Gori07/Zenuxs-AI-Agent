#!/usr/bin/env bash
# Zenuxs verification gate (mission section 9a).
# Runs build, typecheck, lint, unit/integration tests, L3 harnesses,
# packaging, security and matrix checks. Records each step's exit code and
# writes a summary to docs/evidence/gate/latest.log.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 1

export PATH="$HOME/.bun/bin:$PATH"
EVIDENCE_DIR="$REPO_ROOT/docs/evidence/gate"
mkdir -p "$EVIDENCE_DIR"
LOG="$EVIDENCE_DIR/latest.log"

: > "$LOG"

log() {
  printf '%s\n' "$*" | tee -a "$LOG"
}

run_step() {
  local name="$1"
  shift
  log ""
  log "=== STEP: $name ==="
  log "=== COMMAND: $* ==="
  log "=== TIMESTAMP: $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
  local out
  out="$("$@" 2>&1)"
  local code=$?
  printf '%s\n' "$out" | tail -n 40 >> "$LOG"
  log "=== EXIT: $code ==="
  RESULTS+=("$name:$code")
  if [[ $code -ne 0 ]]; then
    FAILURES=$((FAILURES + 1))
    log "FAILED: $name (exit $code)"
  else
    log "PASS: $name"
  fi
}

RESULTS=()
FAILURES=0

log "=== ZENUXS GATE ==="
log "=== TIMESTAMP: $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
log "=== SHA: $(git rev-parse HEAD 2>/dev/null || echo unknown) ==="
log "=== BRANCH: $(git branch --show-current 2>/dev/null || echo unknown) ==="

run_step "install" bun install --frozen-lockfile
run_step "build" bun run build
run_step "typecheck:cli" bun run --cwd apps/cli typecheck
run_step "typecheck:schema" bun run --cwd packages/schema typecheck
run_step "typecheck:engine" bun run --cwd packages/engine typecheck
run_step "build:extension" bun run build:extension
run_step "vsix:build-install" bash scripts/package-extension.sh
run_step "test:unit:cli" bun run --cwd apps/cli test:unit
run_step "test:unit:core" bun run --cwd packages/core test:unit
run_step "test:unit:engine" bun run --cwd packages/engine test
run_step "test:unit:schema" bun run --cwd packages/schema test
run_step "fake-provider:smoke" node tests/fake-provider/smoke-test.mjs
run_step "matrix:check" node scripts/check-matrix.mjs
run_step "security:check" node scripts/security-check.mjs

log ""
log "=== SUMMARY ==="
for result in "${RESULTS[@]}"; do
  log "$result"
done
log "=== FAILURES: $FAILURES ==="

if [[ $FAILURES -ne 0 ]]; then
  exit 1
fi
exit 0
