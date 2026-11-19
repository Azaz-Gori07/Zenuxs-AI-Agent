# Independent adversarial review brief

**Status**: independent review NOT performed. ZCode subagents are unavailable in this
session (`model-not-found` for every configured agent; verified with `ListModels` and a
direct spawn attempt). Per the mission instruction, this brief is handed to a human so
an independent reviewer can be launched in a fresh context. Do NOT treat any self-review
as a substitute.

## What to attack
1. **Matrix honesty** — `docs/03-gap-analysis.md`. 37 rows. Re-check every row marked
   VERIFIED: does its evidence actually exist, contain a current-HEAD SHA, and exercise
   the claimed feature through the real built product (L3)? Several rows were
   downgraded to PARTIAL/MISSING in the resume run; verify the downgrades are correct.
2. **Gate integrity** — `scripts/gate.sh`, `scripts/check-matrix.mjs`,
   `.github/workflows/gate.yml`. Confirm no test was deleted, no threshold lowered, and
   no step skipped. Full post-creation diffs were reviewed in `.work/DECISIONS.md`.
   Evidence freshness now compares source-commit time vs evidence-commit time.
3. **Feature gaps** — F-rag was just implemented (`packages/core/src/extensions/rag/`);
   attack the indexer: ignore rules, chunk overlap, BM25 ranking, watcher incremental
   updates, the `codebase_search` agent tool, and the `zenuxs rag index|search` CLI.
   F-ctx compaction events were just surfaced (`apps/cli/src/utils/events.ts`) — verify
   with a real two-turn CLI run that `type:"compaction"` appears and no instruction is
   lost. F-ckpt file restore was verified once; try to break rewind/fork with multiple
   run counts, dirty/staged files, and deleted files.
4. **Extension gaps** — `tests/extension-e2e/`. Tool cards, approval Run once/Deny,
   diff application and diagnostics were driven via CDP. NOT yet covered: SecretStorage
   key inspection, reconnect after killing the core process, mode/model picker under
   load, and multi-tab sessions.
5. **Live provider** — the announced `glm-5.3-flash-free` is retired upstream; live CLI
   requests hit `FreeUsageLimitError` 429. Verify whether live L3 rows can be promoted
   after quota reset. Try `/v1/models` and a tiny completion first.
6. **Security** — `docs/recon/secrets-audit.md`. `config.json` history contains PII/paths
   but no credential values. Verify the scrub command was NOT run (mission R7).

## How to run the product
```bash
export PATH="$HOME/.bun/bin:$PATH"
cd /home/azaz/Projects/Zenuxs-AI-Agent
bun install --frozen-lockfile
bun run build && bun run build:extension
bash scripts/gate.sh

# deterministic L3 harness
node tests/fake-provider/server.mjs tests/fixtures/l3/scenarios/tool-call.json 4317 &
bash scripts/l3-headless.sh

# RAG
bun apps/cli/src/index.ts rag index --cwd /tmp/your-repo
bun apps/cli/src/index.ts rag search "needle" --cwd /tmp/your-repo

# extension E2E (@vscode/test-electron + Playwright/CDP)
node tests/extension-e2e/run.mjs
```

## Where evidence lives
- Gate: `docs/evidence/gate/latest.log`
- Re-run on HEAD: `docs/evidence/resume/`
- L3 features: `docs/evidence/F-*/`
- Live attempts + 429: `docs/evidence/live/`
- Dogfooding 10 tasks: `docs/evidence/dogfood/`
- Stress/chaos: `docs/evidence/stress/`
- Extension CDP: `docs/evidence/F-ext/`
- Tracking: `.work/STATUS.md`, `PENDING.md`, `FAILURES.md`, `BLOCKED.md`, `DECISIONS.md`

## Requested output
A short report listing any P0/P1 findings with file:line or evidence path. If none,
say so explicitly. Do not modify files.
