# Secrets audit (short summary)

Scope: tracked git history of `config.json` and all tracked files at HEAD. No values are recorded here — key names only.

## `config.json` (tracked in history at commit `e2cab34`, untracked at `5559a37`)
- Encoding: UTF-16LE. Decoded JSON keys: `workflows`, `rules`, `skills`, `agents`, `mcp`, `hooks`, `plugins`, `tools`, `pluginDiagnosticsLoaded`, `workflowSlashCommands`.
- Nested key names under `tools`: `configKind`, `description`, `enabled`, `enabledState`, `id`, `kind`, `name`, `path`, `source`, `toolNames`.
- Nested key names under `skills`/`hooks`: `id`, `name`, `path`, `source`, `kind`, `instructions`, `enabled`, `enabledState`.
- Credential-shaped value scan (counts only): `sk-*` 0, Bearer 0, `AKIA*` 0, PEM private key 0, `ghp_*` 0, JWT 0.
- Content is personal editor/tool config with Windows user paths (`C:\Users\<username>\...`) and prompt text.

## Other tracked files
One test fixture contains synthetic `AKIA...` values (`packages/shared/src/remote-config/schema.test.ts`) — not live credentials. No real credential values found.

## Credentials to rotate
**None required.** No credential values were found in `config.json` or elsewhere in history. The exposure is PII/path hygiene only. If the user considers the embedded prompt text or Windows username sensitive, that is a content/history decision, not a credential rotation.

## History scrub (prepared, NOT run)
Mission R7 forbids history rewrites without explicit authorization. Command is documented in `.work/DECISIONS.md` and was deliberately not executed.
