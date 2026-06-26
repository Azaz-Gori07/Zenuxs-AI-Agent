# Zenuxs AI Agent - Project Structure

```
zenuxs-code/
â”œâ”€â”€ .env.example
â”œâ”€â”€ .gitignore
â”œâ”€â”€ .zenuxs-user-config.json
â”œâ”€â”€ bun.lock
â”œâ”€â”€ docker-compose.yml
â”œâ”€â”€ package.json
â”œâ”€â”€ README.md
â”œâ”€â”€ docs/
â”‚   â”œâ”€â”€ BRANDING-AUDIT.md
â”‚   â”œâ”€â”€ COMPARISON-REPORT.md
â”‚   â”œâ”€â”€ KEYMAP-SPECIFICATION.md
â”‚   â”œâ”€â”€ PORTING-NOTES.md
â”‚   â”œâ”€â”€ STRATEGIC-IMPROVEMENTS.md
â”‚   â””â”€â”€ VERIFIED-DOCUMENTATION.md
â”‚
â”œâ”€â”€ apps/
â”‚   â”œâ”€â”€ tsconfig.apps.json
â”‚   â”‚
â”‚   â”œâ”€â”€ cli/                              # CLI application
â”‚   â”‚   â”œâ”€â”€ .gitignore
â”‚   â”‚   â”œâ”€â”€ bun.mts
â”‚   â”‚   â”œâ”€â”€ CHANGELOG.md
â”‚   â”‚   â”œâ”€â”€ DEVELOPMENT.md
â”‚   â”‚   â”œâ”€â”€ DISTRIBUTION.md
â”‚   â”‚   â”œâ”€â”€ package.json
â”‚   â”‚   â”œâ”€â”€ README.md
â”‚   â”‚   â”œâ”€â”€ skills-lock.json
â”‚   â”‚   â”œâ”€â”€ tsconfig.json
â”‚   â”‚   â”œâ”€â”€ vitest.config.ts
â”‚   â”‚   â”œâ”€â”€ vitest.e2e.config.ts
â”‚   â”‚   â”œâ”€â”€ vitest.interactive.e2e.config.ts
â”‚   â”‚   â”œâ”€â”€ bin/
â”‚   â”‚   â”‚   â””â”€â”€ zenuxs
â”‚   â”‚   â”œâ”€â”€ script/
â”‚   â”‚   â”‚   â”œâ”€â”€ build-options.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ build.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ guard-direct-publish.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ postinstall.mjs
â”‚   â”‚   â”‚   â””â”€â”€ publish-npm.ts
â”‚   â”‚   â””â”€â”€ src/
â”‚   â”‚       â”œâ”€â”€ cli.e2e.test.ts
â”‚   â”‚       â”œâ”€â”€ cli.interactive.e2e.test.ts
â”‚   â”‚       â”œâ”€â”€ index.ts
â”‚   â”‚       â”œâ”€â”€ main.test.ts
â”‚   â”‚       â”œâ”€â”€ main.ts
â”‚   â”‚       â”œâ”€â”€ acp/                       # ACP (Agent Communication Protocol)
â”‚   â”‚       â”‚   â”œâ”€â”€ acpAgent.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ auth.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ index.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ index.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ permissions.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ session-updates.ts
â”‚   â”‚       â”‚   â””â”€â”€ tool-utils.ts
â”‚   â”‚       â”œâ”€â”€ commands/                  # CLI Commands
â”‚   â”‚       â”‚   â”œâ”€â”€ auth.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ auth.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ bin-wrapper.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ build-options.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ config.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ connect.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ dashboard.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ dashboard.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ distribution-package.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ doctor.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ doctor.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ help.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ history.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ history.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ hook.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ hub.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ hub.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ kanban.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ kanban.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ mcp.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ mcp.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ plugin.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ plugin.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ program.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ schedule.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ schedule.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ skill.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ skill.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ update.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ update.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ rpc-runtime/
â”‚   â”‚       â”‚   â””â”€â”€ schedule/
â”‚   â”‚       â”œâ”€â”€ connectors/                # Connectors (chat, session, stores, adapters)
â”‚   â”‚       â”‚   â”œâ”€â”€ base.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ catalog.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ chat-runtime.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ common.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ common.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ connector-host.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ connector-host.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ hooks.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ registry.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ registry.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ runtime-turn.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ runtime-turn.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ session-runtime.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ session-runtime.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ status.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ task-updates.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ task-updates.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ thread-bindings.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ thread-bindings.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ types.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ adapters/
â”‚   â”‚       â”‚   â””â”€â”€ stores/
â”‚   â”‚       â”œâ”€â”€ kanban-migration/          # Kanban migration notice
â”‚   â”‚       â”‚   â”œâ”€â”€ notice-dialog.tsx
â”‚   â”‚       â”‚   â”œâ”€â”€ notice.test.ts
â”‚   â”‚       â”‚   â””â”€â”€ notice.ts
â”‚   â”‚       â”œâ”€â”€ logging/                   # Logging system
â”‚   â”‚       â”‚   â”œâ”€â”€ adapter.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ adapter.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ errors.ts
â”‚   â”‚       â”‚   â””â”€â”€ process.ts
â”‚   â”‚       â”œâ”€â”€ runtime/                   # Runtime (active, interactive, tools, zen)
â”‚   â”‚       â”‚   â”œâ”€â”€ active-runtime.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ active-runtime.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ defaults.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ format.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ prompt.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ prompt.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ run-agent.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ run-agent.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ run-interactive.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ run-zen.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ run-zen.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ session-events.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ session-events.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ tool-policies.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ tool-policies.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ tools.ts
â”‚   â”‚       â”‚   â””â”€â”€ interactive/
â”‚   â”‚       â”œâ”€â”€ session/                   # Session export
â”‚   â”‚       â”‚   â”œâ”€â”€ export.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ session.test.ts
â”‚   â”‚       â”‚   â””â”€â”€ session.ts
â”‚   â”‚       â”œâ”€â”€ tests/                     # Test configurations & fixtures
â”‚   â”‚       â”‚   â”œâ”€â”€ flags.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ help.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ interactive.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ package.json
â”‚   â”‚       â”‚   â”œâ”€â”€ tui-test.config.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ version.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ cli/
â”‚   â”‚       â”‚   â”œâ”€â”€ configs/
â”‚   â”‚       â”‚   â”œâ”€â”€ fixtures/
â”‚   â”‚       â”‚   â”œâ”€â”€ headless/
â”‚   â”‚       â”‚   â”œâ”€â”€ helpers/
â”‚   â”‚       â”‚   â””â”€â”€ interactive/
â”‚   â”‚       â”œâ”€â”€ tui/                       # Terminal UI (TUI)
â”‚   â”‚       â”‚   â”œâ”€â”€ cline-account.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ cline-account.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ history-standalone.tsx
â”‚   â”‚       â”‚   â”œâ”€â”€ index.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ index.tsx
â”‚   â”‚       â”‚   â”œâ”€â”€ interactive-config.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ interactive-welcome.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ interactive-welcome.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ opentui-env.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ palette.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ palette.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ root.tsx
â”‚   â”‚       â”‚   â”œâ”€â”€ stdio-capture.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ stdio-capture.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ types.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ commands/
â”‚   â”‚       â”‚   â”œâ”€â”€ components/
â”‚   â”‚       â”‚   â”œâ”€â”€ contexts/
â”‚   â”‚       â”‚   â”œâ”€â”€ hooks/
â”‚   â”‚       â”‚   â”œâ”€â”€ utils/
â”‚   â”‚       â”‚   â””â”€â”€ views/
â”‚   â”‚       â”œâ”€â”€ utils/                     # Utilities
â”‚   â”‚       â”‚   â”œâ”€â”€ approval.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ aws-region.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ aws-region.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ chat-commands.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ chat-commands.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ cline-pass-errors.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ cline-pass-errors.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ codex-cli.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ common.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ compaction-mode.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ compaction-mode.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ enterprise.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ events.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ events.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ feature-flags.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ feature-flags.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ free-model-cost.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ free-model-cost.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ helpers.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ helpers.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ history-format.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ history-resume.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ history-resume.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ hooks.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ hooks.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ hub-runtime.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ image-attachments.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ input-history.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ input-history.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ internal-launch.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ internal-launch.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ output.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ output.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ plugin-chat-commands.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ plugin-chat-commands.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ provider-auth.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ provider-auth.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ provider-catalog.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ provider-catalog.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ provider-readiness.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ provider-readiness.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ repo-status.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ resume.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ resume.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ team-command.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ team-command.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ telemetry.activation-gate.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ telemetry.activation.test.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ telemetry.test-helpers.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ telemetry.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ types.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ usage-cost-display.ts
â”‚   â”‚       â”‚   â”œâ”€â”€ worktree.test.ts
â”‚   â”‚       â”‚   â””â”€â”€ worktree.ts
â”‚   â”‚       â””â”€â”€ wizards/                   # Setup wizards
â”‚   â”‚           â”œâ”€â”€ connect/
â”‚   â”‚           â”œâ”€â”€ mcp/
â”‚   â”‚           â””â”€â”€ schedule/
â”‚   â”‚
â”‚   â””â”€â”€ zenuxs-hub/                         # Cline Hub server & webview
â”‚       â”œâ”€â”€ package.json
â”‚       â”œâ”€â”€ README.md
â”‚       â”œâ”€â”€ tsconfig.json
â”‚       â”œâ”€â”€ vitest.config.ts
â”‚       â””â”€â”€ src/
â”‚           â”œâ”€â”€ dev.ts
â”‚           â”œâ”€â”€ options.ts
â”‚           â”œâ”€â”€ server.ts
â”‚           â”œâ”€â”€ validate-options.ts
â”‚           â”œâ”€â”€ webview-protocol.ts
â”‚           â”œâ”€â”€ server/                    # Hub server (backend)
â”‚           â”‚   â”œâ”€â”€ agent-events.ts
â”‚           â”‚   â”œâ”€â”€ approvals.ts
â”‚           â”‚   â”œâ”€â”€ connectors.ts
â”‚           â”‚   â”œâ”€â”€ deps.ts
â”‚           â”‚   â”œâ”€â”€ desktop-commands.ts
â”‚           â”‚   â”œâ”€â”€ http.test.ts
â”‚           â”‚   â”œâ”€â”€ http.ts
â”‚           â”‚   â”œâ”€â”€ hub.ts
â”‚           â”‚   â”œâ”€â”€ marketplace.test.ts
â”‚           â”‚   â”œâ”€â”€ marketplace.ts
â”‚           â”‚   â”œâ”€â”€ mcp.ts
â”‚           â”‚   â”œâ”€â”€ providers.ts
â”‚           â”‚   â”œâ”€â”€ schedules.ts
â”‚           â”‚   â”œâ”€â”€ session-mapping.ts
â”‚           â”‚   â”œâ”€â”€ sessions.ts
â”‚           â”‚   â”œâ”€â”€ state-payloads.ts
â”‚           â”‚   â”œâ”€â”€ state.ts
â”‚           â”‚   â”œâ”€â”€ types.ts
â”‚           â”‚   â”œâ”€â”€ user-instructions.test.ts
â”‚           â”‚   â”œâ”€â”€ user-instructions.ts
â”‚           â”‚   â””â”€â”€ utils.ts
â”‚           â””â”€â”€ webview/                   # Hub webview (frontend)
â”‚               â”œâ”€â”€ .gitignore
â”‚               â”œâ”€â”€ components.json
â”‚               â”œâ”€â”€ eslint.config.js
â”‚               â”œâ”€â”€ index.html
â”‚               â”œâ”€â”€ package.json
â”‚               â”œâ”€â”€ tsconfig.app.json
â”‚               â”œâ”€â”€ tsconfig.json
â”‚               â”œâ”€â”€ tsconfig.node.json
â”‚               â”œâ”€â”€ vite.config.ts
â”‚               â”œâ”€â”€ public/
â”‚               â””â”€â”€ src/
â”‚                   â”œâ”€â”€ App.tsx
â”‚                   â”œâ”€â”€ Chat.tsx
â”‚                   â”œâ”€â”€ index.css
â”‚                   â”œâ”€â”€ main.tsx
â”‚                   â”œâ”€â”€ vscode.ts
â”‚                   â”œâ”€â”€ components/
â”‚                   â”‚   â”œâ”€â”€ Composer.tsx
â”‚                   â”‚   â”œâ”€â”€ TeamTasks.tsx
â”‚                   â”‚   â”œâ”€â”€ ai-elements/
â”‚                   â”‚   â”œâ”€â”€ ui/
â”‚                   â”‚   â””â”€â”€ views/
â”‚                   â””â”€â”€ lib/
â”‚                       â”œâ”€â”€ desktop-client.test.ts
â”‚                       â”œâ”€â”€ desktop-client.ts
â”‚                       â”œâ”€â”€ marketplace.ts
â”‚                       â”œâ”€â”€ model-selection.ts
â”‚                       â”œâ”€â”€ provider-id.ts
â”‚                       â”œâ”€â”€ provider-model-catalog.ts
â”‚                       â”œâ”€â”€ provider-schema.ts
â”‚                       â”œâ”€â”€ theme.ts
â”‚                       â””â”€â”€ utils.ts
â”‚
â””â”€â”€ packages/
    â”œâ”€â”€ tsconfig.base.json
    â”‚
    â”œâ”€â”€ agents/                            # Agent runtime package
    â”‚   â”œâ”€â”€ .zenuxs-user-config.json
    â”‚   â”œâ”€â”€ bun.mts
    â”‚   â”œâ”€â”€ package.json
    â”‚   â”œâ”€â”€ README.md
    â”‚   â”œâ”€â”€ tsconfig.build.json
    â”‚   â”œâ”€â”€ tsconfig.dev.json
    â”‚   â”œâ”€â”€ tsconfig.json
    â”‚   â”œâ”€â”€ vitest.config.ts
    â”‚   â””â”€â”€ src/
    â”‚       â”œâ”€â”€ agent-graph.ts
    â”‚       â”œâ”€â”€ agent-runtime.provider-form.test.ts
    â”‚       â”œâ”€â”€ agent-runtime.test.ts
    â”‚       â”œâ”€â”€ agent-runtime.ts
    â”‚       â”œâ”€â”€ cleanup.ps1
    â”‚       â”œâ”€â”€ index.ts
    â”‚       â”œâ”€â”€ integrations.test.ts
    â”‚       â”œâ”€â”€ mcp/                       # MCP client & tool registry
    â”‚       â”‚   â”œâ”€â”€ mcpClient.ts
    â”‚       â”‚   â”œâ”€â”€ toolRegistry.ts
    â”‚       â”‚   â””â”€â”€ types.ts
    â”‚       â”œâ”€â”€ reasoning/                 # Reasoning (self-critique)
    â”‚       â”‚   â””â”€â”€ selfCritique.ts
    â”‚       â””â”€â”€ subagents/                 # Sub-agent orchestration
    â”‚           â”œâ”€â”€ roles.ts
    â”‚           â”œâ”€â”€ subAgentNode.ts
    â”‚           â””â”€â”€ types.ts
    â”‚
    â”œâ”€â”€ core/                              # Core engine package
    â”‚   â”œâ”€â”€ bun.mts
    â”‚   â”œâ”€â”€ package.json
    â”‚   â”œâ”€â”€ README.md
    â”‚   â”œâ”€â”€ tsconfig.build.json
    â”‚   â”œâ”€â”€ tsconfig.dev.json
    â”‚   â”œâ”€â”€ tsconfig.json
    â”‚   â”œâ”€â”€ tsconfig.smoke.json
    â”‚   â”œâ”€â”€ vitest.config.ts
    â”‚   â”œâ”€â”€ vitest.e2e.config.ts
    â”‚   â”œâ”€â”€ docs/
    â”‚   â”‚   â””â”€â”€ messages-contract-v1.md
    â”‚   â”œâ”€â”€ fixtures/
    â”‚   â”‚   â””â”€â”€ messages/
    â”‚   â”œâ”€â”€ scripts/
    â”‚   â”‚   â”œâ”€â”€ telemetry-smoke-host.ts
    â”‚   â”‚   â””â”€â”€ telemetry-smoke.ts
    â”‚   â””â”€â”€ src/
    â”‚       â”œâ”€â”€ ClineCore.test.ts
    â”‚       â”œâ”€â”€ ClineCore.ts
    â”‚       â”œâ”€â”€ index.ts
    â”‚       â”œâ”€â”€ types.ts
    â”‚       â”œâ”€â”€ version.ts
    â”‚       â”œâ”€â”€ account/                   # Cline account service
    â”‚       â”‚   â”œâ”€â”€ cline-account-service.test.ts
    â”‚       â”‚   â”œâ”€â”€ cline-account-service.ts
    â”‚       â”‚   â”œâ”€â”€ featurebase-token.test.ts
    â”‚       â”‚   â”œâ”€â”€ index.ts
    â”‚       â”‚   â”œâ”€â”€ rpc.test.ts
    â”‚       â”‚   â”œâ”€â”€ rpc.ts
    â”‚       â”‚   â””â”€â”€ types.ts
    â”‚       â”œâ”€â”€ auth/                      # Authentication (client, server, OCA, Codex)
    â”‚       â”‚   â”œâ”€â”€ bounded-ttl-cache.test.ts
    â”‚       â”‚   â”œâ”€â”€ bounded-ttl-cache.ts
    â”‚       â”‚   â”œâ”€â”€ client.test.ts
    â”‚       â”‚   â”œâ”€â”€ client.ts
    â”‚       â”‚   â”œâ”€â”€ cline.test.ts
    â”‚       â”‚   â”œâ”€â”€ cline.ts
    â”‚       â”‚   â”œâ”€â”€ codex.test.ts
    â”‚       â”‚   â”œâ”€â”€ codex.ts
    â”‚       â”‚   â”œâ”€â”€ oca.test.ts
    â”‚       â”‚   â”œâ”€â”€ oca.ts
    â”‚       â”‚   â”œâ”€â”€ provider-auth-registry.test.ts
    â”‚       â”‚   â”œâ”€â”€ provider-auth-registry.ts
    â”‚       â”‚   â”œâ”€â”€ server.test.ts
    â”‚       â”‚   â”œâ”€â”€ server.ts
    â”‚       â”‚   â”œâ”€â”€ types.ts
    â”‚       â”‚   â”œâ”€â”€ utils.test.ts
    â”‚       â”‚   â””â”€â”€ utils.ts
    â”‚       â”œâ”€â”€ cline-core/                # Cline core internals (automation, telemetry, types)
    â”‚       â”‚   â”œâ”€â”€ automation.ts
    â”‚       â”‚   â”œâ”€â”€ runtime-services.ts
    â”‚       â”‚   â”œâ”€â”€ start-input.ts
    â”‚       â”‚   â”œâ”€â”€ telemetry.ts
    â”‚       â”‚   â””â”€â”€ types.ts
    â”‚       â”œâ”€â”€ cron/                      # Cron scheduling
    â”‚       â”‚   â”œâ”€â”€ index.ts
    â”‚       â”‚   â”œâ”€â”€ events/
    â”‚       â”‚   â”œâ”€â”€ reports/
    â”‚       â”‚   â”œâ”€â”€ runner/
    â”‚       â”‚   â”œâ”€â”€ schedule/
    â”‚       â”‚   â”œâ”€â”€ service/
    â”‚       â”‚   â”œâ”€â”€ specs/
    â”‚       â”‚   â””â”€â”€ store/
    â”‚       â”œâ”€â”€ extensions/                # Extensions (agents, config, context, MCP, plugin, tools)
    â”‚       â”‚   â”œâ”€â”€ index.ts
    â”‚       â”‚   â”œâ”€â”€ agents/
    â”‚       â”‚   â”œâ”€â”€ config/
    â”‚       â”‚   â”œâ”€â”€ context/
    â”‚       â”‚   â”œâ”€â”€ mcp/
    â”‚       â”‚   â”œâ”€â”€ plugin/
    â”‚       â”‚   â””â”€â”€ tools/
    â”‚       â”œâ”€â”€ hooks/                     # Hook system (checkpoints, subprocess)
    â”‚       â”‚   â”œâ”€â”€ checkpoint-hooks.test.ts
    â”‚       â”‚   â”œâ”€â”€ checkpoint-hooks.ts
    â”‚       â”‚   â”œâ”€â”€ hook-extension.ts
    â”‚       â”‚   â”œâ”€â”€ hook-file-config.test.ts
    â”‚       â”‚   â”œâ”€â”€ hook-file-config.ts
    â”‚       â”‚   â”œâ”€â”€ hook-file-hooks.test.ts
    â”‚       â”‚   â”œâ”€â”€ hook-file-hooks.ts
    â”‚       â”‚   â”œâ”€â”€ index.ts
    â”‚       â”‚   â”œâ”€â”€ subprocess-runner.ts
    â”‚       â”‚   â””â”€â”€ subprocess.ts
    â”‚       â”œâ”€â”€ hub/                       # Hub client, daemon, discovery, runtime-host, server
    â”‚       â”‚   â”œâ”€â”€ index.ts
    â”‚       â”‚   â”œâ”€â”€ settings.test.ts
    â”‚       â”‚   â”œâ”€â”€ client/
    â”‚       â”‚   â”œâ”€â”€ daemon/
    â”‚       â”‚   â”œâ”€â”€ discovery/
    â”‚       â”‚   â”œâ”€â”€ runtime-host/
    â”‚       â”‚   â””â”€â”€ server/
    â”‚       â”œâ”€â”€ remote-config/             # Remote configuration integration
    â”‚       â”‚   â””â”€â”€ integration.ts
    â”‚       â”œâ”€â”€ runtime/                   # Runtime core (capabilities, config, host, orchestration, safety, tools, turn-queue)
    â”‚       â”‚   â”œâ”€â”€ index.ts
    â”‚       â”‚   â”œâ”€â”€ capabilities/
    â”‚       â”‚   â”‚   â”œâ”€â”€ index.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ normalize-runtime-capabilities.ts
    â”‚       â”‚   â”‚   â””â”€â”€ runtime-capabilities.ts
    â”‚       â”‚   â”œâ”€â”€ config/
    â”‚       â”‚   â”‚   â”œâ”€â”€ agent-message-codec.test.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ agent-message-codec.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ agent-runtime-config-builder.test.ts
    â”‚       â”‚   â”‚   â””â”€â”€ agent-runtime-config-builder.ts
    â”‚       â”‚   â”œâ”€â”€ host/
    â”‚       â”‚   â”‚   â”œâ”€â”€ history.test.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ history.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ host.test.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ host.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ local-runtime-host.e2e.test.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ local-runtime-host.test.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ local-runtime-host.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ runtime-host-support.test.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ runtime-host-support.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ runtime-host.ts
    â”‚       â”‚   â”‚   â””â”€â”€ local/
    â”‚       â”‚   â”œâ”€â”€ orchestration/         # Runtime builder, orchestrator, OAuth, parity
    â”‚       â”‚   â”‚   â”œâ”€â”€ runtime-builder.configured-agent-execution.test.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ runtime-builder.team-persistence.test.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ runtime-builder.test.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ runtime-builder.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ runtime-event-adapter.test.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ runtime-event-adapter.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ runtime-oauth-token-manager.test.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ runtime-oauth-token-manager.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ runtime-parity.test.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ session-runtime-orchestrator.test.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ session-runtime-orchestrator.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ session-runtime.ts
    â”‚       â”‚   â”‚   â””â”€â”€ user-input-builder.ts
    â”‚       â”‚   â”œâ”€â”€ safety/                # Loop detection, mistake tracker, rules
    â”‚       â”‚   â”‚   â”œâ”€â”€ loop-detection.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ mistake-tracker.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ rules.test.ts
    â”‚       â”‚   â”‚   â””â”€â”€ rules.ts
    â”‚       â”‚   â”œâ”€â”€ tools/                 # Subprocess sandbox, tool approval
    â”‚       â”‚   â”‚   â”œâ”€â”€ subprocess-sandbox.test.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ subprocess-sandbox.ts
    â”‚       â”‚   â”‚   â””â”€â”€ tool-approval.ts
    â”‚       â”‚   â””â”€â”€ turn-queue/            # Pending prompt service
    â”‚       â”‚       â”œâ”€â”€ pending-prompt-service.test.ts
    â”‚       â”‚       â””â”€â”€ pending-prompt-service.ts
    â”‚       â”œâ”€â”€ services/                  # Core services
    â”‚       â”‚   â”œâ”€â”€ agent-events.ts
    â”‚       â”‚   â”œâ”€â”€ config.ts
    â”‚       â”‚   â”œâ”€â”€ global-settings.test.ts
    â”‚       â”‚   â”œâ”€â”€ global-settings.ts
    â”‚       â”‚   â”œâ”€â”€ local-runtime-bootstrap.startup.test.ts
    â”‚       â”‚   â”œâ”€â”€ local-runtime-bootstrap.test.ts
    â”‚       â”‚   â”œâ”€â”€ local-runtime-bootstrap.ts
    â”‚       â”‚   â”œâ”€â”€ plugin-mcp-settings.test.ts
    â”‚       â”‚   â”œâ”€â”€ plugin-mcp-settings.ts
    â”‚       â”‚   â”œâ”€â”€ plugin-tools.ts
    â”‚       â”‚   â”œâ”€â”€ plugin-uninstall.test.ts
    â”‚       â”‚   â”œâ”€â”€ plugin-uninstall.ts
    â”‚       â”‚   â”œâ”€â”€ session-artifacts.ts
    â”‚       â”‚   â”œâ”€â”€ session-data.test.ts
    â”‚       â”‚   â”œâ”€â”€ session-data.ts
    â”‚       â”‚   â”œâ”€â”€ session-telemetry.ts
    â”‚       â”‚   â”œâ”€â”€ usage.test.ts
    â”‚       â”‚   â”œâ”€â”€ usage.ts
    â”‚       â”‚   â”œâ”€â”€ feature-flags/
    â”‚       â”‚   â”‚   â”œâ”€â”€ FeatureFlagsService.test.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ FeatureFlagsService.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ index.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ posthog.ts
    â”‚       â”‚   â”‚   â””â”€â”€ providers.ts
    â”‚       â”‚   â”œâ”€â”€ llms/                  # LLM services (provider settings, handler, defaults)
    â”‚       â”‚   â”‚   â”œâ”€â”€ apihandler-agent-model-adapter.test.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ apihandler-agent-model-adapter.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ cline-recommended-models.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ configured-provider-registry.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ handler-factory.test.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ handler-factory.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ provider-defaults.test.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ provider-defaults.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ provider-settings.test.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ provider-settings.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ runtime-config.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ runtime-registry.ts
    â”‚       â”‚   â”‚   â””â”€â”€ runtime-types.ts
    â”‚       â”‚   â”œâ”€â”€ providers/             # Provider config & local provider registry
    â”‚       â”‚   â”‚   â”œâ”€â”€ local-provider-registry.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ local-provider-service.test.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ local-provider-service.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ model-source.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ provider-config-fields.test.ts
    â”‚       â”‚   â”‚   â””â”€â”€ provider-config-fields.ts
    â”‚       â”‚   â”œâ”€â”€ storage/               # Storage (artifact, team, session, SQLite)
    â”‚       â”‚   â”‚   â”œâ”€â”€ artifact-store.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ file-team-store.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ index.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ provider-settings-legacy-migration.test.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ provider-settings-legacy-migration.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ provider-settings-manager.test.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ provider-settings-manager.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ session-store.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ sqlite-session-store.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ sqlite-team-store.ts
    â”‚       â”‚   â”‚   â””â”€â”€ team-store.ts
    â”‚       â”‚   â”œâ”€â”€ telemetry/             # Telemetry (OpenTelemetry, PostHog, core events)
    â”‚       â”‚   â”‚   â”œâ”€â”€ core-events.test.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ core-events.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ distinct-id.test.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ distinct-id.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ index.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ ITelemetryAdapter.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ OpenTelemetryAdapter.test.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ OpenTelemetryAdapter.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ OpenTelemetryProvider.test.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ OpenTelemetryProvider.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ TelemetryLoggerSink.test.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ TelemetryLoggerSink.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ TelemetryService.test.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ TelemetryService.ts
    â”‚       â”‚   â”‚   â””â”€â”€ tool-context.ts
    â”‚       â”‚   â””â”€â”€ workspace/             # Workspace management (file indexer, manifest)
    â”‚       â”‚       â”œâ”€â”€ file-indexer.test.ts
    â”‚       â”‚       â”œâ”€â”€ file-indexer.ts
    â”‚       â”‚       â”œâ”€â”€ index.ts
    â”‚       â”‚       â”œâ”€â”€ mention-enricher.test.ts
    â”‚       â”‚       â”œâ”€â”€ mention-enricher.ts
    â”‚       â”‚       â”œâ”€â”€ workspace-manager.ts
    â”‚       â”‚       â”œâ”€â”€ workspace-manifest.ts
    â”‚       â”‚       â”œâ”€â”€ workspace-telemetry.test.ts
    â”‚       â”‚       â””â”€â”€ workspace-telemetry.ts
    â”‚       â”œâ”€â”€ session/                   # Session management (checkpoint, versioning, stores)
    â”‚       â”‚   â”œâ”€â”€ checkpoint-restore.test.ts
    â”‚       â”‚   â”œâ”€â”€ checkpoint-restore.ts
    â”‚       â”‚   â”œâ”€â”€ index.ts
    â”‚       â”‚   â”œâ”€â”€ session-snapshot.ts
    â”‚       â”‚   â”œâ”€â”€ session-versioning-service.test.ts
    â”‚       â”‚   â”œâ”€â”€ session-versioning-service.ts
    â”‚       â”‚   â”œâ”€â”€ models/
    â”‚       â”‚   â”‚   â”œâ”€â”€ session-graph.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ session-manifest.ts
    â”‚       â”‚   â”‚   â””â”€â”€ session-row.ts
    â”‚       â”‚   â”œâ”€â”€ services/
    â”‚       â”‚   â”‚   â”œâ”€â”€ file-session-service.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ message-builder.test.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ message-builder.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ persistence-service.test.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ persistence-service.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ session-service.team-persistence.test.ts
    â”‚       â”‚   â”‚   â””â”€â”€ session-service.ts
    â”‚       â”‚   â”œâ”€â”€ stores/
    â”‚       â”‚   â”‚   â”œâ”€â”€ conversation-store.ts
    â”‚       â”‚   â”‚   â”œâ”€â”€ session-manifest-store.ts
    â”‚       â”‚   â”‚   â””â”€â”€ team-persistence-store.ts
    â”‚       â”‚   â””â”€â”€ team/
    â”‚       â”‚       â”œâ”€â”€ index.ts
    â”‚       â”‚       â”œâ”€â”€ team-child-session-manager.ts
    â”‚       â”‚       â””â”€â”€ team-session-coordinator.ts
    â”‚       â”œâ”€â”€ settings/                  # Settings service
    â”‚       â”‚   â”œâ”€â”€ index.ts
    â”‚       â”‚   â”œâ”€â”€ settings-service.test.ts
    â”‚       â”‚   â”œâ”€â”€ settings-service.ts
    â”‚       â”‚   â””â”€â”€ types.ts
    â”‚       â””â”€â”€ types/                     # Shared types (chat, config, events, storage, etc.)
    â”‚           â”œâ”€â”€ chat-schema.ts
    â”‚           â”œâ”€â”€ common.ts
    â”‚           â”œâ”€â”€ config.ts
    â”‚           â”œâ”€â”€ events.ts
    â”‚           â”œâ”€â”€ index.ts
    â”‚           â”œâ”€â”€ provider-settings.ts
    â”‚           â”œâ”€â”€ session.ts
    â”‚           â”œâ”€â”€ sessions.ts
    â”‚           â””â”€â”€ storage.ts
    â”‚
    â”œâ”€â”€ llms/                              # LLM providers package
    â”‚   â”œâ”€â”€ AGENTS.md
    â”‚   â”œâ”€â”€ bun.mts
    â”‚   â”œâ”€â”€ package.json
    â”‚   â”œâ”€â”€ README.md
    â”‚   â”œâ”€â”€ tsconfig.build.json
    â”‚   â”œâ”€â”€ tsconfig.dev.json
    â”‚   â”œâ”€â”€ tsconfig.json
    â”‚   â”œâ”€â”€ vitest.config.ts
    â”‚   â”œâ”€â”€ fixtures/
    â”‚   â”‚   â””â”€â”€ usage.json
    â”‚   â”œâ”€â”€ scripts/
    â”‚   â”‚   â”œâ”€â”€ fix-esm-imports.ts
    â”‚   â”‚   â”œâ”€â”€ generate-models.ts
    â”‚   â”‚   â”œâ”€â”€ tsconfig.json
    â”‚   â”‚   â””â”€â”€ models/
    â”‚   â””â”€â”€ src/
    â”‚       â”œâ”€â”€ index.browser.ts
    â”‚       â”œâ”€â”€ index.ts
    â”‚       â”œâ”€â”€ models.ts
    â”‚       â”œâ”€â”€ providers.browser.ts
    â”‚       â”œâ”€â”€ providers.ts
    â”‚       â”œâ”€â”€ catalog/                   # Model catalog (recommended, live, generated)
    â”‚       â”‚   â”œâ”€â”€ catalog-cline-recommended.ts
    â”‚       â”‚   â”œâ”€â”€ catalog-live.test.ts
    â”‚       â”‚   â”œâ”€â”€ catalog-live.ts
    â”‚       â”‚   â”œâ”€â”€ catalog.generated-access.ts
    â”‚       â”‚   â”œâ”€â”€ catalog.generated.ts
    â”‚       â”‚   â”œâ”€â”€ model-id-aliases.test.ts
    â”‚       â”‚   â”œâ”€â”€ model-id-aliases.ts
    â”‚       â”‚   â”œâ”€â”€ README.md
    â”‚       â”‚   â””â”€â”€ types.ts
    â”‚       â”œâ”€â”€ providers/                 # Provider implementations (AI SDK, billing, builtins, gateway, HTTP, vendors)
    â”‚       â”‚   â”œâ”€â”€ ai-sdk.test.ts
    â”‚       â”‚   â”œâ”€â”€ ai-sdk.ts
    â”‚       â”‚   â”œâ”€â”€ async.ts
    â”‚       â”‚   â”œâ”€â”€ billing.test.ts
    â”‚       â”‚   â”œâ”€â”€ billing.ts
    â”‚       â”‚   â”œâ”€â”€ builtins-runtime.ts
    â”‚       â”‚   â”œâ”€â”€ builtins.test.ts
    â”‚       â”‚   â”œâ”€â”€ builtins.ts
    â”‚       â”‚   â”œâ”€â”€ compat.test.ts
    â”‚       â”‚   â”œâ”€â”€ compat.ts
    â”‚       â”‚   â”œâ”€â”€ config.ts
    â”‚       â”‚   â”œâ”€â”€ errors.ts
    â”‚       â”‚   â”œâ”€â”€ factory-registry.ts
    â”‚       â”‚   â”œâ”€â”€ format.test.ts
    â”‚       â”‚   â”œâ”€â”€ format.ts
    â”‚       â”‚   â”œâ”€â”€ gateway.test.ts
    â”‚       â”‚   â”œâ”€â”€ gateway.ts
    â”‚       â”‚   â”œâ”€â”€ handler.ts
    â”‚       â”‚   â”œâ”€â”€ http.test.ts
    â”‚       â”‚   â”œâ”€â”€ http.ts
    â”‚       â”‚   â”œâ”€â”€ ids.test.ts
    â”‚       â”‚   â”œâ”€â”€ ids.ts
    â”‚       â”‚   â”œâ”€â”€ messages.ts
    â”‚       â”‚   â”œâ”€â”€ model-facts.ts
    â”‚       â”‚   â”œâ”€â”€ model-registry.ts
    â”‚       â”‚   â”œâ”€â”€ openai-codex-models.ts
    â”‚       â”‚   â”œâ”€â”€ provider-keys.ts
    â”‚       â”‚   â”œâ”€â”€ provider-request-capture.ts
    â”‚       â”‚   â”œâ”€â”€ README.md
    â”‚       â”‚   â”œâ”€â”€ registry.ts
    â”‚       â”‚   â”œâ”€â”€ stream.ts
    â”‚       â”‚   â”œâ”€â”€ types.ts
    â”‚       â”‚   â”œâ”€â”€ middleware/
    â”‚       â”‚   â”œâ”€â”€ routing/
    â”‚       â”‚   â””â”€â”€ vendors/
    â”‚       â”œâ”€â”€ services/                  # Telemetry services
    â”‚       â””â”€â”€ tests/                     # Live provider test configurations
    â”‚           â”œâ”€â”€ live-providers.example.json
    â”‚           â”œâ”€â”€ live-providers.openai-codex.example.json
    â”‚           â”œâ”€â”€ live-providers.openai-codex.reasoning.example.json
    â”‚           â”œâ”€â”€ live-providers.reasoning-disabled.example.json
    â”‚           â”œâ”€â”€ live-providers.reasoning.example.json
    â”‚           â”œâ”€â”€ live-providers.tools.example.json
    â”‚           â”œâ”€â”€ provider-live-config.test.ts
    â”‚           â”œâ”€â”€ provider-live-config.ts
    â”‚           â”œâ”€â”€ provider-live-minimax-routing.test.ts
    â”‚           â”œâ”€â”€ provider-live-reasoning.test.ts
    â”‚           â”œâ”€â”€ provider-live-runner.ts
    â”‚           â”œâ”€â”€ provider-live-tools.test.ts
    â”‚           â”œâ”€â”€ provider-live.test.ts
    â”‚           â”œâ”€â”€ provider-vcr.test.ts
    â”‚           â””â”€â”€ provider-vcr/
    â”‚
    â””â”€â”€ shared/                            # Shared types & utilities package
        â”œâ”€â”€ AGENTS.md
        â”œâ”€â”€ bun.mts
        â”œâ”€â”€ package.json
        â”œâ”€â”€ README.md
        â”œâ”€â”€ tsconfig.build.json
        â”œâ”€â”€ tsconfig.json
        â”œâ”€â”€ vitest.config.ts
        â””â”€â”€ src/
            â”œâ”€â”€ agent.ts
            â”œâ”€â”€ dispose.ts
            â”œâ”€â”€ feature-flags.ts
            â”œâ”€â”€ hub.test.ts
            â”œâ”€â”€ hub.ts
            â”œâ”€â”€ index.browser.ts
            â”œâ”€â”€ index.ts
            â”œâ”€â”€ vcr.test.ts
            â”œâ”€â”€ vcr.ts
            â”œâ”€â”€ agents/
            â”‚   â”œâ”€â”€ index.ts
            â”‚   â””â”€â”€ types.ts
            â”œâ”€â”€ automation/
            â”‚   â”œâ”€â”€ index.ts
            â”‚   â”œâ”€â”€ schemas.ts
            â”‚   â””â”€â”€ types.ts
            â”œâ”€â”€ connectors/
            â”‚   â”œâ”€â”€ events.ts
            â”‚   â””â”€â”€ options.ts
            â”œâ”€â”€ cron/
            â”‚   â”œâ”€â”€ cron-spec-types.ts
            â”‚   â””â”€â”€ index.ts
            â”œâ”€â”€ db/
            â”‚   â”œâ”€â”€ index.ts
            â”‚   â”œâ”€â”€ sqlite-db.test.ts
            â”‚   â””â”€â”€ sqlite-db.ts
            â”œâ”€â”€ extensions/
            â”‚   â”œâ”€â”€ context.ts
            â”‚   â”œâ”€â”€ contribution-registry.test.ts
            â”‚   â”œâ”€â”€ contribution-registry.ts
            â”‚   â””â”€â”€ plugin.ts
            â”œâ”€â”€ hooks/
            â”‚   â”œâ”€â”€ contracts.ts
            â”‚   â””â”€â”€ events.ts
            â”œâ”€â”€ llms/
            â”‚   â”œâ”€â”€ ai-sdk-format.test.ts
            â”‚   â”œâ”€â”€ ai-sdk-format.ts
            â”‚   â”œâ”€â”€ gateway.ts
            â”‚   â”œâ”€â”€ media.test.ts
            â”‚   â”œâ”€â”€ media.ts
            â”‚   â”œâ”€â”€ messages.ts
            â”‚   â”œâ”€â”€ model-info.ts
            â”‚   â”œâ”€â”€ model-options.ts
            â”‚   â”œâ”€â”€ reasoning-effort.ts
            â”‚   â”œâ”€â”€ requests.ts
            â”‚   â”œâ”€â”€ tokens.ts
            â”‚   â””â”€â”€ tools.ts
            â”œâ”€â”€ logging/
            â”‚   â””â”€â”€ logger.ts
            â”œâ”€â”€ parse/
            â”‚   â”œâ”€â”€ error.ts
            â”‚   â”œâ”€â”€ json.test.ts
            â”‚   â”œâ”€â”€ json.ts
            â”‚   â”œâ”€â”€ shell.test.ts
            â”‚   â”œâ”€â”€ shell.ts
            â”‚   â”œâ”€â”€ string.ts
            â”‚   â”œâ”€â”€ time.ts
            â”‚   â”œâ”€â”€ zod.ts
            â”‚   â””â”€â”€ headers/
            â”œâ”€â”€ prompt/
            â”‚   â”œâ”€â”€ cline.ts
            â”‚   â”œâ”€â”€ format.test.ts
            â”‚   â”œâ”€â”€ format.ts
            â”‚   â”œâ”€â”€ system-part.test.ts
            â”‚   â”œâ”€â”€ system-part.ts
            â”‚   â””â”€â”€ system.ts
            â”œâ”€â”€ providers/
            â”‚   â””â”€â”€ utils.ts
            â”œâ”€â”€ remote-config/
            â”‚   â”œâ”€â”€ artifact-store.ts
            â”‚   â”œâ”€â”€ blob-storage.ts
            â”‚   â”œâ”€â”€ bundle.ts
            â”‚   â”œâ”€â”€ constants.ts
            â”‚   â”œâ”€â”€ index.ts
            â”‚   â”œâ”€â”€ materializer.ts
            â”‚   â”œâ”€â”€ paths.ts
            â”‚   â”œâ”€â”€ runtime.test.ts
            â”‚   â”œâ”€â”€ runtime.ts
            â”‚   â”œâ”€â”€ schema.test.ts
            â”‚   â”œâ”€â”€ schema.ts
            â”‚   â””â”€â”€ telemetry.ts
            â”œâ”€â”€ rpc/
            â”‚   â”œâ”€â”€ index.ts
            â”‚   â”œâ”€â”€ runtime.ts
            â”‚   â””â”€â”€ team-progress.ts
            â”œâ”€â”€ runtime/
            â”‚   â”œâ”€â”€ build-env.test.ts
            â”‚   â”œâ”€â”€ build-env.ts
            â”‚   â”œâ”€â”€ cline-environment.test.ts
            â”‚   â”œâ”€â”€ cline-environment.ts
            â”‚   â”œâ”€â”€ hub-daemon-env.test.ts
            â”‚   â””â”€â”€ hub-daemon-env.ts
            â”œâ”€â”€ services/
            â”‚   â”œâ”€â”€ telemetry-config.ts
            â”‚   â”œâ”€â”€ telemetry.test.ts
            â”‚   â””â”€â”€ telemetry.ts
            â”œâ”€â”€ session/
            â”‚   â”œâ”€â”€ hook-context.ts
            â”‚   â”œâ”€â”€ index.ts
            â”‚   â”œâ”€â”€ records.ts
            â”‚   â”œâ”€â”€ runtime-config.ts
            â”‚   â”œâ”€â”€ runtime-env.ts
            â”‚   â””â”€â”€ workspace.ts
            â”œâ”€â”€ storage/
            â”‚   â”œâ”€â”€ index.ts
            â”‚   â”œâ”€â”€ path-resolution.test.ts
            â”‚   â”œâ”€â”€ path-resolution.ts
            â”‚   â”œâ”€â”€ paths.home-dir.test.ts
            â”‚   â”œâ”€â”€ paths.test.ts
            â”‚   â””â”€â”€ paths.ts
            â”œâ”€â”€ team/
            â”‚   â”œâ”€â”€ index.ts
            â”‚   â”œâ”€â”€ schema.ts
            â”‚   â””â”€â”€ types.ts
            â”œâ”€â”€ tools/
            â”‚   â”œâ”€â”€ create.test.ts
            â”‚   â”œâ”€â”€ create.ts
            â”‚   â”œâ”€â”€ definition.ts
            â”‚   â”œâ”€â”€ dispatch.test.ts
            â”‚   â”œâ”€â”€ dispatch.ts
            â”‚   â””â”€â”€ types.ts
            â””â”€â”€ types/
                â”œâ”€â”€ auth.ts
                â”œâ”€â”€ index.ts
                â””â”€â”€ vcr.ts
```

## Summary

| Directory | Description |
|---|---|
| `apps/cli` | Main CLI application (commands, TUI, runtime, connectors, MCP, logging, utilities) |
| `apps/zenuxs-hub` | Hub server & webview (Vite + React frontend, Express-like backend) |
| `packages/agents` | Agent runtime (MCP client, browser/Skyvern, Mem0 memory, Langfuse observability, OpenHands, RAG, sub-agents) |
| `packages/core` | Core engine (auth, runtime orchestration, services, session management, cron, hooks, extensions, settings) |
| `packages/llms` | LLM provider implementations (catalog, built-in & vendor providers, gateway, AI SDK, billing, telemetry) |
| `packages/shared` | Shared types & utilities (types, prompts, storage paths, parse utils, remote config, RPC, team schema, tools) |