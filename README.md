# Zenuxs-AI-Agent

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](https://github.com/Azaz-Gori07/Zenuxs-AI-Agent/blob/main/LICENSE)
[![Language](https://img.shields.io/badge/language-TypeScript-3178c6.svg)](https://github.com/Azaz-Gori07/Zenuxs-AI-Agent)

A fast, open-source CLI autonomous coding agent — inspired by Cline — built with TypeScript.

Zenuxs-AI-Agent helps developers automate and accelerate engineering tasks directly from the terminal: scaffolding, refactors, multi-file edits, test generation, code reviews, and safe automation workflows.

Table of contents
- Project / Product Summary
- What’s new in this README
- Key features
- Extensions & Plugins (detailed)
- Architecture & internals (overview)
- Quick start (development)
- CLI usage and examples
- Configuration & security
- Extending the agent: plugin author guide
- VS Code extension and other integrations
- Workflows & examples
- Contributing
- Maintainers & contact
- License

---

## Project / Product Summary

Zenuxs-AI-Agent is a developer-first command-line autonomous agent focused on reproducible, auditable AI-assisted engineering. It provides a CLI-first experience, with both an interactive TUI and headless modes for CI, enabling teams to automate common engineering workflows safely and transparently.

Target users
- Individual developers who want to accelerate repetitive tasks.
- Small teams that need reproducible automation for scaffolding, refactors, or release chores.
- Open source contributors who want an extensible, TypeScript-native agent CLI.

Design goals
- Predictability: show diffs and require approval for destructive operations by default.
- Extensibility: plugin-first architecture so teams can add tools and workflows.
- Local-first: run locally without sending code unless explicitly configured to use a provider.

---

## What’s new in this README

This version expands the top-level documentation with:
- A dedicated Extensions & Plugins section that explains extension architecture, APIs, and publishing tips.
- More professional, actionable examples and developer-oriented quick start steps.
- Clearer configuration and security recommendations for production/CI usage.

---

## Key features

- Interactive TUI (terminal UI) for step-by-step workflows.
- Headless CLI modes (one-shot, JSON/NDJSON output) for automation and CI.
- Plan / Act modes to separate reasoning (planning) from execution.
- Preview diffs and tool approval flows—never apply destructive changes without an explicit approval step unless `--yolo` is used.
- Task templates: scaffold, refactor, generate tests, release automation.
- Connectors: chat bridges (Telegram, Slack, WhatsApp), webhooks, scheduling.
- Provider-agnostic: integrate with OpenAI, Anthropic, OpenRouter, self-hosted models, or local runtimes.

---

## Extensions & Plugins (detailed)

Zenuxs is intentionally modular. Extension points allow you to add new commands, tools, connectors, and UI integrations.

Plugin types
- Command plugins: add new CLI subcommands or change existing behavior.
- Tool plugins: expose new tools the agent can call (e.g., custom linters, test runners, project generators).
- Connector plugins: integrate external chat surfaces or delivery channels.
- UI plugins: extend the TUI (renderers, custom views) or the VS Code extension.

Plugin discovery & registration
- Plugins are discovered from a plugins/commands directory or via configuration (e.g., `plugins` array in `.zenuxs/config`).
- A plugin exports a standardized interface (see "Plugin API" below) and registers metadata (name, version, commands, permissions required).

Plugin API (overview)
- Every plugin should export an async `register` function that receives a runtime context object.
- The runtime `context` includes:
  - logger: structured logging helper
  - config: resolved configuration for the current workspace
  - tools: tool registry for registering tool handlers
  - commands: CLI command registration helper
  - hooks: lifecycle hooks (onStart, onBeforeToolRun, onAfterToolRun)

Minimal plugin example (conceptual):

```ts
export async function register(context) {
  context.commands.register({
    name: 'hello',
    description: 'Say hello from a plugin',
    handler: async (args) => {
      context.logger.info('Hello from plugin', { args })
      return { ok: true }
    }
  })
}
```

Permissions and safety
- Plugins must declare required permissions (filesystem access, network access, spawn processes, write/commit rights).
- The CLI enforces an approval step for plugins that request elevated permissions. Use configuration to allow trusted plugins in CI.

Testing & publishing plugins
- Unit test plugin logic; use the runtime context mock to validate registration and handlers.
- Publish plugins as npm packages or provide them as local paths in the repo config. Consider a plugin registry for discoverability.

Best practices
- Keep tool handlers idempotent and provide a dry-run mode that returns a proposed diff.
- Log actions and produce structured output for auditability.
- Avoid embedding secrets in plugins — read credentials from environment variables or a secure vault.

---

## Architecture & internals (overview)

High level components
- CLI entrypoint (apps/cli) — parses flags, loads config, discovers plugins, and starts a session.
- Agent runtime — orchestrates planning, tool invocation, and iteration loops.
- Tool registry — pluggable handlers that can operate on the workspace, call external services, or spawn processes.
- Connector layer — bridges external chat surfaces into sessions.
- Optional hub/daemon — background process for long-running or scheduled tasks.

Data & state
- Sessions and checkpoints are stored under a configurable data directory (default: `~/.zenuxs` or repo-local `.zenuxs`).
- Checkpoints integrate with git for workspace-safe edits when enabled.

---

## Quick start (development)

1. Clone the repo

   git clone https://github.com/Azaz-Gori07/Zenuxs-AI-Agent.git
   cd Zenuxs-AI-Agent

2. Install dependencies

   npm install
   # or
   yarn install

3. Build

   npm run build
   # or
   yarn build

4. Run the CLI in dev

   npm start -- <command>

5. Link locally if you want a global binary during development

   npm link
   zenuxs --help

Tips
- Run unit tests for the package or workspace before publishing plugins.
- Use `--data-dir` to isolate test runs and avoid polluting your real CLI state.

---

## CLI usage and examples

Show help

  zenuxs --help

Start interactive TUI

  zenuxs

Run a single prompt (one-shot)

  zenuxs "Audit this package and propose fixes"

Generate tests for a file

  zenuxs gen:tests src/myModule.ts

Headless, NDJSON output (CI)

  zenuxs --json "List TODO comments" | jq -r 'select(.type=="agent_event")'

Run with explicit provider and model

  zenuxs -P openai -m gpt-4o "Refactor this module"

Safety flags
- `--auto-approve false` — require approval for tool runs
- `--yolo` — auto-approve and exit (unsafe, use with caution)
- `--zen` — dispatch to background hub and exit (used for scheduled or long-running tasks)

---

## Configuration & security

Config locations
- Repo-local: `.zenuxs/config.{json|yaml}`
- Global: `~/.zenuxs/config.{json|yaml}`
- Environment variables for secrets: `ZENUXS_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.

Recommended settings
- Keep `autoApproveTools` false in developer and CI settings unless you control the input source.
- Use sandbox or data-dir isolation during experimentation: `--data-dir ./tmp-zenuxs`.

Secrets handling
- Never commit API keys or secrets.
- Prefer environment variables or a secret manager. If running in CI, inject secrets via the CI provider's secret store.

Auditability
- Use the CLI's dry-run and preview features to inspect diffs before applying.
- Keep session logs (configurable) and review them as part of your pipeline.

---

## Extending the agent: plugin author guide (practical)

Folder layout
- Place local plugins under `plugins/` or `packages/plugins/<name>` in the monorepo layout.
- For npm-published plugins, use a discoverable naming convention `@zenuxs/plugin-<name>`.

Registration lifecycle
1. Export an async `register(context)` function.
2. Register CLI commands and tools using `context.commands.register` and `context.tools.register`.
3. Add metadata file `plugin.json` with permissions and config schema.

Handler patterns
- Provide `dryRun` and `apply` functions for any tool that mutates the repo.
- Prefer returning structured diagnostics instead of free-form text for programmatic consumption.

Publishing and distribution
- Publish to npm with clear semantic versioning.
- Provide a README with examples and an integration test that runs the plugin in an isolated data-dir.

Example plugin checklist
- [ ] Exports `register`.
- [ ] Declares permissions and config schema.
- [ ] Implements dry-run and apply.
- [ ] Includes unit tests and a small integration test.
- [ ] Provides docs and examples.

---

## VS Code extension & other integrations

This repo contains an apps/vscode-extension that integrates the agent with VS Code. Key points:
- The extension provides an inline chat, selection-based actions (Explain, Fix, Generate Tests), and quick commands.
- The extension uses the same runtime and provider configuration as the CLI, enabling consistent behavior.

Developer tips
- Use the extension in development with `bun run build` in `apps/vscode-extension` or by packaging a `.vsix` during testing.
- Keep provider configuration synchronized between the CLI and extension during testing.

---

## Workflows & examples

Scaffold a service
- `zenuxs run scaffold --template express-service --name hello-world`
- Inspect the diff and run tests.

Automated PR reviewer (CI)
- `git diff origin/main | zenuxs --json "Review these changes for security issues"`
- Fail the CI job if the agent reports high-severity issues.

Scheduled maintenance
- Use the scheduler to run housekeeping tasks (dependency updates, lint fixes) and surface proposed diffs as PRs.

---

## Contributing

We welcome contributions. Guidelines:
- Fork the repository and open a topic branch.
- Follow TypeScript conventions and lint rules in the repo.
- Add tests for new functionality and update documentation.
- Keep commits small and focused; write descriptive PR messages.

Consider opening issues for large design changes before implementing them.

---

## Maintainers & contact

Maintained by: Azaz-Gori07

For questions, bugs, or feature requests, open an issue in this repository. Include reproducible steps and any relevant logs.

---

## License

This project is licensed under Apache 2.0 — see the LICENSE file in the repository for details.

---

Would you like me to:
- Add badge images (CI, coverage, npm) and a compact landing README variant?
- Generate a plugins/README.md with a formal plugin API spec, TypeScript types, and a full example plugin implementation?
- Extract the actual CLI commands from the source and include a generated `CLI_REFERENCE.md` section in the README?

Tell me which option you prefer and I will update the repo accordingly.