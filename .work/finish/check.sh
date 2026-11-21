#!/usr/bin/env bash
# Log a check's command, timestamp and real exit code, then return that code.
LOG="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/run.log"
printf '\n=== CHECK ===\n' >> "$LOG"
printf 'TIMESTAMP: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$LOG"
printf 'COMMAND:'; printf ' %q' "$@" >> "$LOG"
printf '\n' >> "$LOG"
"$@"
CODE=$?
printf 'EXIT: %s\n' "$CODE" >> "$LOG"
exit "$CODE"
