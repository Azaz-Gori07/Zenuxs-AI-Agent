# DECISIONS (every decision and why)

## 2026-11-18 — Subagent model whitelist vs. actually configured models
- **Decision**: Use only subagents whose model was valid at session start (`vision-inspector`, model `new-provider/deepseek-v4.1-flash-free`) for delegated recon; do all other work in the primary session.
- **Why**: The global AGENTS.md whitelists six 9router models (`big-pickle`, `deepseek-v4.1-flash`, `gemini`, `glm-5.3-flash-free`, `zlm`, `nemotron-3.5-super-vl-free`). `ListModels` shows NONE of them exist in this environment. Available models are `mimo-v2.6-flash-free`, `deepseek-v4.1-flash-free`, `beam-free`, `hy4-flash-free`, `gemini-4-carbon-high`, `gemini-3.8-flash-medium`. All other agents fail to spawn with `model-not-found`. Agent definitions are cached at session start, so editing them mid-session does not take effect (verified: edited `project-architect.md` and `api-auditor.md`, re-spawn still used the old model).
- **How to apply**: Record this as an environment constraint. Do not waste time trying to spawn agents with unavailable models. If new sessions are started later, agent definitions can be updated to valid models.

## 2026-11-18 — Branch
- Created `fix/zenuxs-recovery` from `main` @ `816c9a7` per R7. All work commits here.

## 2026-11-18 — config.json
- Root `config.json` is UTF-16LE encoded and contains Windows user paths (`C:\Users\azazk\...`) plus a large agent config dump. It appears to be accidentally committed personal state, not a legitimate project config. WILL BE FLAGGED. Must verify it contains no secrets; if it does, remove from tracking (do not rewrite history per R7 — add to .gitignore and a removal commit, or redact in a new commit).

## 2026-11-18 — Delegated recon agents hung; P0 done in primary session
- **Decision**: Stop all four background recon agents after 12+ minutes of zero progress; perform reference recon directly in the primary session.
- **Why**: Only `vision-inspector` had a valid model, and all four instances stalled immediately (last_progress_at unchanged for >12 min) despite a nudge message. Direct reads of the reference's built CLI (`zcode.cjs --help`, `doctor --json`, `commands/skills/plugins list --json`) and its `docs/usage/*.md` produced concrete, evidence-backed results quickly.
- **How to apply**: Do not depend on subagents for critical-path work in this session. Record all findings in `docs/recon/` and `docs/evidence/reference/`.

## 2026-11-18 — Reference has no VS Code extension
- **Decision**: Treat F-ext as a Zenuxs-only surface; verify it against its own contract rather than a reference counterpart.
- **Why**: Verified no `*vscode*` directories (excluding `.vscode` config) and no `"vscode"` dependency in any reference package.json. Reference UI surfaces are TUI, Electron desktop, web and stdio app-server.
