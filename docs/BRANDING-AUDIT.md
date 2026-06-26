# ZENUXS_BRANDING_AUDIT

## Renamed to Zenuxs (Category A â€” Safe Branding)

All userâ€‘facing strings and documentation have been renamed:

- **Documentation** â€” README.md, CHANGELOG.md, VERIFIED_ZENUXS_DOCUMENTATION.md
- **CLI help descriptions** â€” `apps/cli/src/main.ts`: "Manage Zenuxs Plugins", "Manage Zenuxs Skills", "Start the Zenuxs Hub dashboard" etc.
- **UI error messages** â€” cline-account.ts, notice.ts, schedule/index.ts, session.ts, run-zen.ts, zenuxs-hub server files, cline-account-service.ts, run-interactive.ts
- **UI labels/tooltips** â€” account-dialog.tsx ("Zenuxs Account"), inline-tool-response.tsx ("Zenuxs needs permission"), terminal-title.ts (APP_TITLE = "Zenuxs")
- **Hub display strings** â€” App.tsx ("Zenuxs Hub"), sessions.ts, approvals.ts, http.ts, utils.ts, marketplace-view.tsx, extensions-view.tsx, account-view.tsx
- **Provider display names** â€” `packages/llms/src/providers/builtins.ts`: name changed from "Cline" to "Zenuxs"
- **Robot animation** â€” replaced robot-frames.generated.json with 4-frame Z-enuxs animation (big Z draws top-to-bottom, "enuxs" static)

## Retained For Compatibility (Category B â€” Internal Identifiers)

These **must not** be renamed:

- **Package scopes & import paths** â€” all `@cline/*` packages (module resolution would break)
- **File and directory names containing "cline"** â€” cline-account.ts, cline-account-service.ts, cline-environment.ts, cline-pass-errors.ts, cline-model-picker.tsx, cline-logo-filled.svg, cline_mcp_settings.json, cline-anthropic-sonnet.json, catalog-cline-recommended.ts, cline-recommended-models.ts, etc.
- **Provider IDs** â€” `"cline"`, `"cline-pass"` (used in routing/config)
- **Environment variables** â€” `CLINE_*` prefixed env vars
- **HTTP headers** â€” `X-Title: Cline` in `packages/shared/src/llms/requests.ts` (telemetry)
- **OAuth client_name** â€” `client_name: "Cline"` in `packages/core/src/extensions/mcp/oauth.ts`
- **Error class names** â€” `ClineNotSubscribedError` and similar
- **CLI binary name** â€” `cline` command name (actual npm package); kept in backtick examples
- **Test file descriptions** â€” test descriptions that reference "Cline OAuth" etc. as historical context

## Internal Legacy References (Category C)

Comments, TODOs, and test-only strings that reference "Cline" but are not user-visible:

- Comment references in test files and source code (~31 lines identified by grep)
- These are harmless and may be cleaned up opportunistically
