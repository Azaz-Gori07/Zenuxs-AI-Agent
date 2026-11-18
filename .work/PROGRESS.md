# PROGRESS (append-only)

## 2026-11-18 — Session start
- Verified environment: node v24.22.1, npm 11.19.1, pnpm 10.33.2, bun 1.4.4 (at ~/.bun/bin/bun, not on PATH), git 2.53.0, `code` CLI present (snap), tmux MISSING.
- Created branch `fix/zenuxs-recovery` from `main` (HEAD 816c9a7).
- Created tracking dirs `.work/`, `docs/evidence/`, `tests/scenarios/`.
- Noted: target `config.json` is UTF-16 with Windows user paths and looks like leaked personal config — flagged for review (must not contain secrets in commits).
- Beginning P0 reconnaissance.

## 2026-11-18 — P0 complete
- Ran real baseline: `bun install` OK (1259 pkgs); CLI `--help` and `doctor` OK; root build, CLI build, CLI typecheck, extension build, CLI unit tests and core unit tests all FAIL. Logs in docs/evidence/P0/.
- Root-caused first build failure: zod v4 installed vs v3 API (`z.record(z.unknown())`); 75 files use broken `export * as X from "."`. Logged 9 baseline defects in FAILURES.md.
- Delegated recon agents all hung; stopped them and did reference recon directly. Ran reference built CLI `zcode.cjs` (`--help`, `doctor --json`, `commands/skills/plugins list --json`, `tui --help`, `app-server --help`) — all exit 0. Logs in docs/evidence/reference/.
- Wrote docs A-F: 00-inventory, 01-as-is-hld-zenuxs, 02-reference-hld-zcode, 03-gap-analysis (37 rows), 04-target-hld, 05-phase-plan.
- Key finding: reference has NO VS Code extension (TUI + Electron + web instead); F-ext is Zenuxs-only.
- Key finding: target has two cores — CLI uses @cline/core; @zenuxs/engine is broken and unused.
- Moving to P1.
