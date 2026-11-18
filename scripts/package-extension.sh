#!/usr/bin/env bash
# Build and install-check the VS Code extension package.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="$HOME/.bun/bin:$PATH"
OUT="${VSIX_OUT:-/tmp/zenuxs-code.vsix}"
cd "$ROOT/apps/vscode-extension"
bun run build
npx --yes @vscode/vsce package --no-dependencies --out "$OUT"
if command -v code >/dev/null 2>&1; then
  code --install-extension "$OUT" --force
  code --list-extensions | grep -qi zenuxs
else
  echo "VS Code CLI unavailable; install check skipped" >&2
fi
echo "VSIX_READY=$OUT"
