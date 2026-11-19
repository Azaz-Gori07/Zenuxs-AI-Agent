# Secrets audit — resume triage (2026-11-19)

## What `config.json` contained (key names only; no values)
- File: root `config.json`, UTF-16LE, ~137k decoded characters.
- Present in history at commit `e2cab34` ("i dont know") until untracked in `5559a37`.
- Top-level JSON keys: `workflows`, `rules`, `skills`, `agents`, `mcp`, `hooks`, `plugins`, `tools`, `pluginDiagnosticsLoaded`, `workflowSlashCommands`.
- Nested keys observed under `tools` entries: `configKind`, `description`, `enabled`, `enabledState`, `id`, `kind`, `name`, `path`, `source`, `toolNames`. Under `skills`/`hooks`: `id`, `name`, `path`, `source`, `kind`, `instructions`, `enabled`, `enabledState`.
- `mcp`, `plugins`, `hooks`, `agents`, `rules`, `workflows`, `workflowSlashCommands` were empty arrays.
- Content is personal editor/tool configuration with Windows user paths (`C:\Users\<username>\...`) and embedded skill/command prompt text.

## Credential-shaped value scan (counts only)
| Pattern | Count |
|---|---|
| `sk-...` style key | 0 |
| Bearer token value | 0 |
| AWS `AKIA...` access key id | 0 |
| PEM private key header | 0 |
| GitHub `ghp_/gho_/...` token | 0 |
| JWT | 0 |

A repo-wide scan of tracked files at HEAD found one file with credential-shaped fixture values: `packages/shared/src/remote-config/schema.test.ts` (synthetic `AKIA...` test fixtures, not live credentials).

## Keys to rotate
**None.** No credential values were found in `config.json` or elsewhere in history. The exposure is PII/config-path hygiene, not a credential leak. If the user considers the embedded prompt text or Windows username sensitive, rotate nothing technically but scrub history (below).

## History-scrub command — PREPARED, NOT RUN
Per mission rule R7 (never rewrite history) this command was **not executed**. It requires explicit user authorization before running. It will rewrite all commits after the file was introduced, so coordinate with collaborators and force-push is required.

```sh
# Requires: pip install git-filter-repo  (or apt install git-filter-repo)
cd /home/azaz/Projects/Zenuxs-AI-Agent
git filter-repo --path config.json --invert-paths --force
# Then (only with user approval) force-push the rewritten branch:
# git push --force-with-lease origin fix/zenuxs-recovery
```

Fallback if `git-filter-repo` is unavailable:
```sh
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch config.json' \
  --prune-empty -- --all
```

After a scrub, re-clone fresh and re-run `bash scripts/gate.sh` (mission completion condition requires a clean fresh-clone run).
