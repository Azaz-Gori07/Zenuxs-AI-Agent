# Clean-room behavior specs (BEHAVIOR ONLY)

Reference studied at `/home/azaz/reference-outside-workspace/ZCode` for observable behavior and
security invariants only. No reference code, UI text, file names or branding was copied.
Implementations in this repo use original names/structure (`Hook Governance`, `Plugin Exchange`,
`Task Flows`). Reference paths are recorded for provenance; the LICENSE is Apache-2.0 and the
examined files carry no per-file license headers.

## F-hook-01 — Hook Governance

Observable behavior to reproduce:
- A hook is a declaration `{id, event, matcher, type, command/args, source, timeoutMs}`. Events of
  interest: `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`.
- A digest is sha256 over a canonical (stable-key) representation of the declaration. Any change to
  the declaration changes the digest.
- Trust is bound to `(workspace identity, digest)`. States: `pending`, `trusted`, `revoked`,
  `stale` (same source slot, different digest), `blocked` (corrupt store).
- Workspace/project hooks are untrusted by default. Enabling hooks, yolo mode, or starting a
  session does NOT grant trust. Only an explicit grant runs them.
- Decisions: deny/blocked policy > revoked > stale > pending > trusted. `deny` policy blocks all;
  `allow_trusted_only` blocks anything not previously granted; `user_decides` (default) requires an
  explicit grant.
- Store failures (malformed JSON, schema violation) fail closed: every workspace hook is blocked
  until the store is repaired; grant/revoke refuse while corrupt.
- Revocation is by digest or all, keyed to workspace identity. A stale slot is reported separately.
- A hook that is not runnable must produce NO side effect (no process spawn, no marker file).
- CLI surface: `hooks status --json`, `hooks review --json`, `hooks grant --digest <d>`, `hooks revoke --digest <d>|--all`.

Security invariants (mandatory tests): untrusted hook must not run; stale digest must not run;
revoked digest must not run; corrupt store fails closed; `--all` requires an explicit flag.

## F-plug-01 — Plugin Exchange

Observable behavior to reproduce:
- Plugin manifest fields: `name`, `version`, `description`, `skills`, `commands`, `hooks`, `mcpServers`.
  Id is `<name>@<marketplace>`; local/direct plugins use `@local`.
- Marketplace descriptor: `{name, publisherType: official|community, plugins:[...]}` with sources
  `file`/`directory`/`url`. Installed plugins are cached under a version-scoped directory; data
  directory survives uninstall-with-keep-data.
- CLI: `plugins marketplace add|list|remove`, `plugins available --json`, `plugins install <id>`,
  `plugins list --json`, `plugins enable|disable <id>`, `plugins validate <path>`.
- Adding a source that claims a reserved official id is rejected. Removing a source keeps installs
  (they become orphaned). `validate` is read-only (no install, no enable, no hook execution).
- Installing is not enabling. Component paths must stay inside the plugin directory (no symlink
  escape).
- Hook provenance: official/local plugin hooks are trusted; community marketplace hooks are parsed
  and listed but `runnable:false` (diagnostic only) until granted through Hook Governance.

Security invariants (mandatory tests): reserved official id rejected; path confinement; validate
has no side effects; community hook not runnable; corrupt marketplace registry fails closed.

## F-auto-01 — Task Flows (workflow-mode / dwf / expert / goal)

Observable behavior to reproduce:
- A flow definition is a JSON document `{id, name, steps:[{id, kind, ...}]}` with step kinds
  `agent`, `hook`, `plugin`. Steps run in order; each step has a deterministic id.
- `--workflow-mode <file>` runs a flow headlessly and emits NDJSON events; `--target <text>` sets a
  session target; slash commands `/dwf`, `/expert`, `/goal` map to flow/target operations.
- Flow runs are durable: a run record stores per-step status; an interrupted run can be resumed and
  completed steps are not repeated.
- Hooks and plugins used by a flow go through the same trust/admission layer as direct use: a flow
  cannot bypass an untrusted-hook denial or a disabled plugin.
- A plugin step must reference an enabled plugin; a hook step must be granted for the workspace.
- Fail closed: an untrusted hook step fails the flow run with a clear reason; no process spawn.

Security invariants (mandatory tests): flow cannot run untrusted hook; plugin step requires enable;
resume does not repeat completed steps; no arbitrary shell from flow definitions.

## Evidence rule
Each feature gets L3 evidence produced by actually invoking the built CLI (`docs/evidence/F-hook-01/`,
`F-plug-01/`, `F-auto-01/`), not just unit tests.
