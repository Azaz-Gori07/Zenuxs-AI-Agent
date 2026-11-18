# 00 — Inventory: both repositories (real builds and tests)

Captured 2026-11-18, target SHA `816c9a7`.

## Environment
- node v24.22.1, npm 11.19.1, pnpm 10.33.2, bun 1.4.4 (`~/.bun/bin`, not on PATH by default), git 2.53.0, `code` CLI present (snap).
- tmux MISSING → PTY harness must use node-pty or similar (see BLOCKED).
- Only API-key-shaped env var: `ZCODE_OFFICIAL_ENDPOINT_TOKEN` (reference product credential — MUST NOT be used by target per mission rules). No provider keys for Zenuxs → live-provider checks BLOCKED.

## Target: /home/azaz/Projects/Zenuxs-AI-Agent

### Structure
- Root: bun workspaces (`packages/*`, `apps/*`, `apps/zenuxs-hub/src/webview`).
- Apps: `cli` (`zenuxs-code`), `vscode-extension`, `zenuxs-hub`.
- Packages: `core` (`@cline/core`), `shared` (`@cline/shared`), `llms` (`@cline/llms`), `agents` (`@cline/agents`), `schema`, `engine`, `providers`, `lsp`, `plugin-sdk`, `studio`, `zenuxs-hub`.
- Languages: TypeScript (ESM), React (TUI via OpenTUI, webview), SQLite.

### Entry points
- CLI: `apps/cli/src/index.ts` (bin `zenuxs-code`, `zenuxs` → source, not dist).
- Extension: `apps/vscode-extension/src/extension.ts` → `dist/extension.js`; webview `src/webview/index.tsx` → `dist/webview.js`.
- Core: `packages/core/src/ZenuxsCore.ts` facade over `@cline/core`.
- Alternative engine: `packages/engine/src/engine.ts` (not used by CLI).

### Build/run/test commands (declared)
- `bun install --frozen-lockfile` ✅ (1259 packages)
- `bun run build` = build:sdk + CLI build ❌ exit 2
- `bun run build:extension` ❌ exit 2
- `bun --cwd apps/cli dev`, `bun --cwd apps/cli typecheck` ❌ exit 2
- Tests: `bun --cwd apps/cli test:unit` ❌ (30 failed/744), `bun --cwd packages/core test:unit` ❌ (34 failed/1278), plus e2e configs.

### What works
- `bun apps/cli/src/index.ts --help` ✅ exit 0 (rich command surface incl. doctor, mcp, plugin, skill, hook, schedule, hub, dashboard, ACP, serve, api, migrate, service).
- `bun apps/cli/src/index.ts doctor` ✅ exit 0 (hub unhealthy).
- `@cline/core`, `@cline/shared`, `@cline/llms`, `@cline/agents` compile ✅.

### What does not
- Root build, CLI build, CLI typecheck, extension build, both unit suites — see `docs/evidence/P0/`.
- Root causes: Zod v3 API used with v4 installed; 75 `export * as X from "."`; browser bundle missing exports; 15 CLI type errors; 64 failing unit tests.

## Reference: /home/azaz/reference-outside-workspace/ZCode (read-only)

### Structure
- pnpm workspace: `packages/*`, `apps/dev-docs`, `apps/zcode-cli`, `apps/zcode-cli/packages/*`, `apps/zcode-cli/tools/*`.
- Root packages: `rpc`, `provider`, `provider-node`, `services`, `client`, `server`, `zcode-server-cli`, `ui`, `web`, `web-share`, `desktop` (Electron), `e2e-report`, `zcode-cua`, `shared`, `model-option-map`, `formal-proof`, etc.
- CLI subpackages under `apps/zcode-cli/packages/`: `cli`, `bootstrap`, `core`, `adapters`, `contracts`, `tui`, `shared-types`, dynamic-workflow(+runtime), plugin packages (pdf, presentations, spreadsheets, documents, browser-use, computer-use, android/ios-simulator, plugin-creator, etc.), `bundled-skills`, `i18n`, `debug`, `node-repl-host`, `office-runtime`.

### Build/run/test commands (declared)
- pnpm scripts: `build` (`pnpm -r build`), `build:zcode`, `build:sea`, `build:bootstrap`, `typecheck`, `lint` (oxlint), `fmt` (oxfmt), `test` (vitest exclude desktop e2e), `test:e2e` (desktop @playwright/test), `test:unit`, `architecture:check`, `db:schema:check`, `verify:pre-push`.
- CLI subproject: turbo `build`, `typecheck`, `test`, `lint`, `registry:check`.

### Real runs performed on reference
- `node apps/zcode-cli/packages/cli/dist/zcode.cjs --help` ✅ exit 0 (zcode 0.17.0).
- `doctor --json`, `commands list --json`, `skills list --json`, `plugins list --json`, `app-server --help`, `tui --help` ✅ all exit 0.
- Evidence in `docs/evidence/reference/`.

### Feature surface (summary)
20 CLI flags, 10 commands, 15 slash commands, 16 built-in tools, 5 modes, 7 hook events, MCP stdio/http/sse, plugins with marketplaces, skills/custom commands, sessions with checkpoints/fork/rewind, workflow/goal/expert automation, memory + AGENTS.md assembly, desktop + web + app-server RPC (stdio).
See `docs/recon/ref-features.md` for the full inventory.

### No VS Code extension
Verified: no `*vscode*` directories (other than `.vscode` config) and no `"vscode"` in package.json dependency lists. F-ext is a Zenuxs-only surface; verify against its own contract, not a reference counterpart.

## Side-by-side notes
| Aspect | Zenuxs target | ZCode reference |
|---|---|---|
| Primary UI | Cline-derived CLI + TUI + VS Code extension + hub | TUI + Electron desktop + web + stdio app-server |
| Core | `@cline/core` (used) + `@zenuxs/engine` (broken, unused) | `packages/rpc` + `apps/zcode-cli/packages/core` + services |
| Headless | positional prompt, `-p` means plan, `--json` | `-p/--prompt <text>`, `--output-format stream-json` |
| Modes | act/plan (plus provider settings) | build/edit/plan/yolo/guarded |
| Config | `~/.cline`, env `LLM_API_KEY` etc. | `~/.zcode/v2/provider_config.json`, `~/.zcode/cli/config.json` |
| Branding | Zenuxs (with Cline leftovers) | ZCode |
