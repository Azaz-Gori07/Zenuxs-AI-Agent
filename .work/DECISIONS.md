# DECISIONS (every decision and why)

## 2026-11-18 — Subagent model whitelist vs. actually configured models
- **Decision**: Use only subagents whose model was valid at session start (`vision-inspector`, model `new-provider/deepseek-v4.1-flash-free`) for delegated recon; do all other work in the primary session.
- **Why**: The global AGENTS.md whitelists six 9router models (`big-pickle`, `deepseek-v4.1-flash`, `gemini`, `glm-5.3-flash-free`, `zlm`, `nemotron-3.5-super-vl-free`). `ListModels` shows NONE of them exist in this environment. Available models are `mimo-v2.6-flash-free`, `deepseek-v4.1-flash-free`, `beam-free`, `hy4-flash-free`, `gemini-4-carbon-high`, `gemini-3.8-flash-medium`. All other agents fail to spawn with `model-not-found`. Agent definitions are cached at session start, so editing them mid-session does not take effect (verified: edited `project-architect.md` and `api-auditor.md`, re-spawn still used the old model).
- **How to apply**: Record this as an environment constraint. Do not waste time trying to spawn agents with unavailable models. If new sessions are started later, agent definitions can be updated to valid models.

## 2026-11-18 — Branch
- Created `fix/zenuxs-recovery` from `main` @ `816c9a7` per R7. All work commits here.

## 2026-11-18 — config.json
- Root `config.json` is UTF-16LE encoded and contains Windows user paths (`C:\Users\azazk\...`) plus a large agent config dump. It appears to be accidentally committed personal state, not a legitimate project config. Scanned with Python: no API keys or Authorization values; "token" occurrences are prompt text. Decision: untrack it and add to `.gitignore` (no history rewrite per R7), keeping the working-copy file untouched.

## 2026-11-18 — Delegated recon agents hung; P0 done in primary session
- **Decision**: Stop all four background recon agents after 12+ minutes of zero progress; perform reference recon directly in the primary session.
- **Why**: Only `vision-inspector` had a valid model, and all four instances stalled immediately (last_progress_at unchanged for >12 min) despite a nudge message. Direct reads of the reference's built CLI (`zcode.cjs --help`, `doctor --json`, `commands/skills/plugins list --json`) and its `docs/usage/*.md` produced concrete, evidence-backed results quickly.
- **How to apply**: Do not depend on subagents for critical-path work in this session. Record all findings in `docs/recon/` and `docs/evidence/reference/`.

## 2026-11-18 — Reference has no VS Code extension
- **Decision**: Treat F-ext as a Zenuxs-only surface; verify it against its own contract rather than a reference counterpart.
- **Why**: Verified no `*vscode*` directories (excluding `.vscode` config) and no `"vscode"` dependency in any reference package.json. Reference UI surfaces are TUI, Electron desktop, web and stdio app-server.

## 2026-11-19 — Gate integrity (resume run)
- **Gate script changes since creation** (`git diff b658202..HEAD -- scripts/gate.sh`): added two steps only — `vsix:build-install` (packages and installs the .vsix) and `tui:pty` (drives the real TUI in a pseudo-terminal). No step was removed, no threshold lowered, no exit code ignored. Both additions strengthen the gate.
- **Matrix checker changes** (`git diff b658202..HEAD -- scripts/check-matrix.mjs`): (1) parse status annotations in parentheses so a row like `VERIFIED (L3 ...)` is read as VERIFIED; (2) skip only rows explicitly marked EXCLUDED with the phrase "intentionally excluded" in the evidence cell; (3) added evidence-freshness enforcement: a VERIFIED row fails if the last commit touching its source paths is newer than the last commit touching its evidence. The required status (VERIFIED) and evidence-existence checks were not weakened.
- **Why**: the previous matrix checker compared the whole annotated status string against "VERIFIED" and therefore mis-reported real rows; the freshness check prevents stale evidence from counting after source changes.

## 2026-11-19 — Live provider model substitution
- **Decision**: use `mimo-v2.6-flash-free` instead of the announced `glm-5.3-flash-free`.
- **Why**: `/v1/models` on the live endpoint does not list `glm-5.3-flash-free`; a tiny completion returned `model_deprecated` ("has been retired upstream"). `mimo-v2.6-flash-free` is listed and answered `PONG`. The deepseek model was usable initially but later returned `FreeUsageLimitError` (per-model free quota exhausted).
- **How to apply**: live scenarios are bounded with timeouts and retries; when a live request fails, replay on the fake provider first, then retry live up to 3 times; classify model-quality failures separately from product defects.

## 2026-11-20 — Live verification and matrix derivation
- **Decision**: F-prov/F-toolrobust stay BLOCKED. `scripts/verify-live.sh` probes `/v1/models` and a tiny completion, retries 429 with exponential backoff (`ZENUXS_LIVE_RETRY_INITIAL_SECONDS`, doubling, `ZENUXS_LIVE_MAX_ATTEMPTS`), uses a long `ZENUXS_LIVE_TIMEOUT_SECONDS` (default 300), and writes `=== LIVE_VERIFY: PASS ===` only after two real CLI scenarios succeed. Only then does it call the matrix regenerator; otherwise it writes `=== LIVE_VERIFY: BLOCKED ===` and exits 2 without touching the matrix.
- **Decision**: `docs/03-gap-analysis.md` is generated by `scripts/reconcile-matrix.mjs` from evidence files (SHA + success marker) and code-facing row metadata; `scripts/check-matrix.mjs` rejects hand edits, open rows, stale evidence and undocumented BLOCKED rows. No matrix status is hand-edited.
- **Why**: the user required externally blocked rows to be flipped only by real evidence, and the matrix to be evidence-derived.
- **How to apply**: run `bash scripts/verify-live.sh` with working endpoint env vars; afterwards rerun the gate.

## 2026-11-20 — Continuation from HEAD 49f8f42 (single writer, clean-room)
- **Decision**: Work proceeds in the user's fixed order (settings root fix already committed at 49f8f42 and verified by `provider-settings-roundtrip.test.ts`: 2/2 pass). I am the only code writer; read-only exploration is delegated to subagents. New features F-hook-01/F-plug-01/F-auto-01 are built clean-room: reference is studied for behavior only (behavior specs recorded in `docs/recon/clean-room-specs.md`), with original module names/structure, no copied code/UI/branding.
- **Why**: the user explicitly ordered the work and forbade mid-run decisions; a single writer avoids the collision hazard documented in the orchestration skill.
- **How to apply**: log each new decision here. Do not claim completion until gate is green, no MISSING/PARTIAL rows, the independent reviewer on final HEAD has zero P0/P1, and blocked live rows have evidence + `scripts/verify-live.sh`.
