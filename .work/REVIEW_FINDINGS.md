# Independent adversarial review findings (fresh process)

Reviewer: fresh-context independent reviewer. I did not write the code under review.
No product files were modified and no fixes were applied. The prior contents of this
file were a review of an older HEAD (`8065358`) and are superseded by this one.

- **Branch**: `fix/zenuxs-recovery`
- **SHA reviewed**: `ff041f8f65a5ec353b449d8eef592d1156237f8f`
  (`chore(evidence): gate-green evidence and matrix on final HEAD`)
- **HEAD movement note**: during the review an evidence-only commit moved HEAD to
  `8e25f11` (`chore(status): gate green, independent review pending; refresh evidence`).
  `git diff --stat ff041f8..8e25f11 -- packages apps scripts` is empty — no product,
  source or script changes — so every finding below applies equally to `8e25f11`.
- **Initial tree state**: `git status --short` clean.
- **Date**: 2026-11-21

## Commands I ran myself (not trusting evidence files)

```bash
cd /home/azaz/Projects/Zenuxs-AI-Agent
git log -1 --oneline && git status --short
export PATH="$HOME/.bun/bin:$PATH"
bun install --frozen-lockfile
bun run build && bun run build:extension
bash scripts/gate.sh                         # exit 0; 18/18 steps, === FAILURES: 0 ===
node scripts/reconcile-matrix.mjs --check    # exit 0; 35 VERIFIED, 2 BLOCKED
node scripts/check-matrix.mjs                 # exit 0; problems: []
node scripts/security-check.mjs               # exit 0 BUT prints 19 problems
git diff b658202..HEAD -- scripts/gate.sh scripts/check-matrix.mjs
git log --diff-filter=D --summary --oneline -- '**/*.test.ts' '**/*.test.mjs'
bun test packages/core/src/services/storage/provider-settings-{roundtrip,manager,legacy-migration}.test.ts  # 32 pass
```

Plus my own new adversarial scenarios (NOT the repo's tests), all against the real
built CLI with fresh temp data dirs, captured in `/tmp/opencode/revsec{,2,3,4}/results.log`
and `/tmp/opencode/direct-settings.ts`:

- hook trust: pending / stale-after-grant / revoked / corrupt-store / flow-bypass attempts;
- plugin exchange: reserved-id spoof, lexical vs symlink path escape, validate side effects;
- flow: untrusted hook, stale hook, disabled plugin, injected `command` field;
- settings: valid-file round trip (baseUrl/protocol/client/unknown), `clearFields`;
- CLI: `--no-color`, `--locale` validation, `--disallowed-tools`, `--attach`;
- secrets/branding: history scan, `.gitignore`, `security-check` output.

---

## P1 — F-sec-01 is marked VERIFIED although the "no ZCode endpoints/branding" invariant is violated, and the gate cannot fail on it

`scripts/security-check.mjs:11-18` defines the forbidden patterns (`Z.AI`, `zcode.cjs`,
`zcode.bot`, `app.cline.bot`, `api.cline.bot`, `ZCODE_OFFICIAL_ENDPOINT_TOKEN`). Running
`node scripts/security-check.mjs` prints **19 problems** in shipped source, for example:

- `packages/shared/src/runtime/zenuxs-environment.ts:19-26` — `appBaseUrl: "https://app.cline.bot"`,
  `apiBaseUrl: "https://api.cline.bot"`, and a staging `app.cline.bot` URL. This is runtime
  configuration, not a test fixture.
- `apps/zenuxs-hub/src/webview/src/components/views/settings/account-view.tsx:401,485,526,559`
  — user-facing links to `https://app.cline.bot/...`.
- `apps/cli/src/tui/zenuxs-account.ts:21` — credits URL `https://app.cline.bot/dashboard/account...`.
- `packages/llms/src/catalog/catalog.generated.ts` — `Z.ai` / `GLM` branding in the model catalog.
- `apps/cli/CHANGELOG.md`, `apps/cli/src/runtime/run-agent.test.ts`, and several more.

Yet the script ends:

```js
// scripts/security-check.mjs:70-72
console.log(JSON.stringify({ problems }, null, 2))
if (problems.some((p) => keyPattern.test(p))) process.exit(1)
// Branding/config findings are reported but do not block until cleanup lands.
process.exit(0)
```

The only exit-1 condition is a literal `sk-*` key in a *problem string*; branding/endpoint
findings never fail the step. `scripts/gate.sh:66` runs this step and records `EXIT: 0`,
so `docs/evidence/gate/status.json` is written with `failures: 0`. The matrix row
`F-sec-01` (`docs/03-gap-analysis.md:51`, "No ZCode keys/endpoints/branding/telemetry in
target") is computed VERIFIED from that file (`scripts/reconcile-matrix.mjs:14,51`).
`node scripts/check-matrix.mjs` therefore reports `F-sec-01: VERIFIED` with `problems: []`.

**Repro**:
```bash
node scripts/security-check.mjs          # 19 problems, EXIT 0
node scripts/check-matrix.mjs            # F-sec-01 VERIFIED, problems []
grep -n 'app.cline.bot' packages/shared/src/runtime/zenuxs-environment.ts \
  apps/cli/src/tui/zenuxs-account.ts \
  apps/zenuxs-hub/src/webview/src/components/views/settings/account-view.tsx
```
**Impact**: a P0-priority security row claims VERIFIED on evidence that is structurally
incapable of detecting the violation. No live credentials or ZCode tokens were found
in tracked files or history (see "Clean results" below), so this is a false assurance /
hygiene defect rather than credential exposure. I rate it P1 because it defeats the
gate's stated security invariant on a P0 row.

---

## P2 — Reserved official marketplace IDs can be claimed by any attacker-authored descriptor

`PluginExchange.addMarketplace` (`packages/core/src/extensions/plugin-exchange/plugin-exchange.ts:159-190`)
trusts the `publisherType` field **from the descriptor file being added**:

```ts
// :171-176
if (RESERVED_OFFICIAL_MARKETS.has(id) && descriptor.publisherType !== "official") {
  throw new PluginExchangeError(`marketplace id ${id} is reserved for official sources`);
}
if (descriptor.publisherType === "official" && !RESERVED_OFFICIAL_MARKETS.has(id)) {
  throw new PluginExchangeError("official marketplaces must use a reserved official id");
}
```

Anyone who can write a `marketplace.json` can set `publisherType:"official"` and name
`zenuxs-official`/`zenuxs-curated`, satisfying both checks. `publisherTypeOf` (`:342-348`)
then reports that community source as `official`, and `plugins hooks --id` surfaces
`"publisherType":"official"`.

**Repro** (I ran this against HEAD with `CLINE_DATA_DIR=/tmp/opencode/revsec/data`):
```bash
cat > /tmp/opencode/revsec/fakeofficial.json <<'EOF'
{"name":"zenuxs-official","publisherType":"official","plugins":[{"name":"hello","path":"plugin"}]}
EOF
bun apps/cli/src/index.ts plugins marketplace add \
  --descriptor /tmp/opencode/revsec/fakeofficial.json --id zenuxs-official
# EXIT 0 -> {"added":{...,"publisherType":"official",...}}
```
A genuine community descriptor with the same `--id` is rejected
(`marketplace id zenuxs-curated is reserved for official sources`), proving the check
is self-certified. Evidence: `/tmp/opencode/revsec/results.log` section I.

**Impact**: defeats reserved-id protection and mislabels community plugins as official.
It is **not** a hook-trust bypass in the current code: `publisherType` is only used for
display (`apps/cli/src/commands/plugins-exchange.ts:108`); plugin hooks are still only
declarations and are never auto-run. The flow runner gates on `isPluginEnabled`, not on
publisher type. Hence P2, not P1.

---

## P2 — Flow agent steps hardcode a real external endpoint, a fake key, and `--auto-approve true`

`apps/cli/src/commands/flow.ts:22-41` implements `runAgentStep` by spawning the CLI with:

```
-P openai-compatible -m fake-model -k fake-key --auto-approve true --json <prompt>
```

With no `ZENUXS_PROVIDER_BASE_URL` override, the default for `openai-compatible` is a
real external endpoint (`platform.openai.com`). The repo's governance L3 evidence only
works because the harness happens to export `ZENUXS_PROVIDER_BASE_URL` to the fake
provider.

**Repro** (my scenario G, no fake provider running):
```bash
cat > /tmp/opencode/revsec/flow-agent.json <<'EOF'
{"id":"a","steps":[{"id":"a","kind":"agent","prompt":"hello from flow"}]}
EOF
CLINE_DATA_DIR=/tmp/opencode/revsec/data bun apps/cli/src/index.ts \
  flow run --file /tmp/opencode/revsec/flow-agent.json --workspace /tmp/opencode/revsec/ws
```
Observed step result: `"Incorrect API key provided: fake-key. You can find your API key
at https://platform.openai.com/account/api-keys."` — i.e. the flow sent the prompt to a
real external provider, ignoring the user's configured provider. Evidence:
`/tmp/opencode/revsec/results.log` section G.

**Impact**: an untrusted flow definition (e.g. one obtained from a marketplace) can
cause the user's flow prompt to be sent to a third-party endpoint, and any tool the
model requests would run with auto-approve enabled. No secret is sent (key is literally
`fake-key`), so this is an egress/trust-boundary concern rather than credential theft.

---

## P3 — `clearFields` cannot remove unknown fields; `mergePreservingUnknown` re-injects them

`ProviderSettingsManager.saveProviderSettings` deletes explicitly cleared keys from
`merged` (`packages/core/src/services/storage/provider-settings-manager.ts:214`), but
`write()` (`:176-180`) immediately calls `mergePreservingUnknown()`, which copies every
unknown raw on-disk field back in (`:56-63`):

```ts
for (const [key, value] of Object.entries(rawSettings)) {
  if (!KNOWN_SETTING_KEYS.has(key)) unknown[key] = value;
}
(entry as { settings: Record<string, unknown> }).settings = {
  ...unknown,
  ...(entry.settings as Record<string, unknown>),
};
```

**Repro** (script `/tmp/opencode/direct-settings.ts`, run with `bun`):
```ts
writeFileSync(p, JSON.stringify({version:1, lastUsedProvider:"openai-compatible",
  providers:{"openai-compatible":{settings:{provider:"openai-compatible",apiKey:"K",
  model:"m",headers:{X:"y"},timeout:5,weirdFlag:true},updatedAt:stamp,tokenSource:"manual"}}}))
const m = new ProviderSettingsManager({filePath:p});
m.saveProviderSettings({provider:"openai-compatible",model:"m"},
  {clearFields:["apiKey","headers","timeout","weirdFlag"]});
```
Result file: `apiKey`, `headers`, `timeout` are correctly removed, but `"weirdFlag": true`
is still present. Known-field clearing works; only unknown fields cannot be cleared.

**Impact**: latent. No current caller passes an unknown field name to `clearFields`
(`local-provider-service.ts:588-626,836-880` only clears known fields), and the primary
OPEN-SETTINGS-01 invariant (preserve baseUrl/unknown fields on ordinary writes) **does
hold** — see "Clean results". I report it because the brief explicitly attacks
"re-add fields that were explicitly cleared".

---

## P3 — Plugin path confinement is lexical only; symlinks are not resolved

`resolveInside` (`packages/core/src/extensions/plugin-exchange/plugin-exchange.ts:80-87`)
uses `path.resolve()` / `path.relative()` and never `realpathSync()`. A descriptor whose
`path` is a symlink to a directory outside the marketplace root is accepted.

**Repro** (`/tmp/opencode/revsec3/results.log` section A):
```bash
ln -s /tmp/opencode/revsec3/outside /tmp/opencode/revsec3/mkt/link
cat > /tmp/opencode/revsec3/mkt/marketplace.json <<'EOF'
{"name":"m","publisherType":"community","plugins":[{"name":"viaLink","path":"link","version":"1.0.0"}]}
EOF
CLINE_DATA_DIR=/tmp/opencode/revsec3/data bun apps/cli/src/index.ts \
  plugins marketplace add --descriptor /tmp/opencode/revsec3/mkt/marketplace.json --id m
CLINE_DATA_DIR=/tmp/opencode/revsec3/data bun apps/cli/src/index.ts plugins available
```
`plugins available` lists `"path":"/tmp/opencode/revsec3/mkt/link"` (the symlink) —
`resolveInside` did not reject it. `plugins install` then failed incidentally with
`ENOTDIR` from `cpSync`, not because of a confinement check. No code execution was
demonstrated. `validate()` (`:292-323`) has the same lexical-only check for
`commands`/`skills` paths. Defense-in-depth gap only.

---

## P3 — Stray tracked symlink `escape -> /escape` at repo root

`git ls-files -s escape` shows a tracked symlink (blob `106bf625…`, added in `408607b`)
pointing to the absolute path `/escape`, which does not exist on this host. It is not
referenced by any test (`tests/scenarios/F-perm/symlink.sh` creates its own symlink under
`/tmp`). Looks like a leftover manual test artifact committed into the repository
root. Hygiene only; no runtime effect.

---

## Clean results (adversarially re-verified; no finding)

- **Gate**: `bash scripts/gate.sh` exit 0. All 18 steps including build, 3 typechecks,
  VSIX build+install, 4 unit suites, fake-provider smoke, evidence regeneration,
  TUI PTY, security check, and both matrix steps returned `EXIT: 0`; summary
  `=== FAILURES: 0 ===`. Evidence `docs/evidence/gate/latest.log`.
- **Matrix honesty**: `node scripts/reconcile-matrix.mjs --check` exit 0 and
  `node scripts/check-matrix.mjs` exit 0; 37 rows, 35 VERIFIED, 2 BLOCKED
  (F-prov, F-toolrobust), **no MISSING/PARTIAL**. `node scripts/check-matrix.mjs`'s
  problem list is empty. Both blocked rows point to `.work/BLOCKED.md` and
  `bash scripts/verify-live.sh` in their evidence cell.
- **Gate/matrix-checker integrity**: `git diff b658202..HEAD -- scripts/gate.sh` shows
  only additions (`vsix:build-install`, `evidence:regenerate`, `tui:pty`,
  `matrix:reconcile`); no step removed, no threshold lowered, no exit ignored.
  `check-matrix.mjs` gained annotated-status parsing, explicit-EXCLUDED handling and
  evidence-freshness enforcement; the required VERIFIED status and evidence-existence
  checks remain. No test was deleted on the recovery branch: test-file count 313 at
  `816c9a7` / `b658202` → 326 at HEAD; the three historical deletions in
  `--diff-filter=D` (`632aefc`, `9de1fd7`) predate the recovery branch and are ancestors
  of the base commit.
- **Gate `status.json` written before matrix steps**: not a masking vector. It is written
  with the accumulated `FAILURES` of all preceding steps, and the subsequent
  `matrix:reconcile`/`matrix:check` steps call `run_step`, which increments `FAILURES`
  on non-zero exit, so the gate still exits 1 for any failed step. I confirmed all
  step exit codes in the gate log.
- **Evidence freshness**: at rest on HEAD, committed evidence was stamped `de73ca7`
  (an earlier commit) rather than `ff041f8`. `reconcile-matrix.mjs:98-104` compares
  commit timestamps, not SHA equality, so this is accepted by design: no product
  source changed between `de73ca7` and HEAD (last product-source commit is `c3af7a1`).
  After my gate run, all generated evidence was refreshed and now stamps `ff041f8`.
  I re-ran the governance L3 driver `tests/scenarios/F-governance/evidence.sh`
  indirectly through the gate and confirmed fresh PASS markers.
- **Representative VERIFIED rows re-run through the real built product** (gate
  regeneration, all with `=== SHA: ff041f8… ===`, guards PASS):
  `docs/evidence/regenerated/boundary.log` (outside-write denial with real tool-call
  error), `docs/evidence/P0-symlink/l3-summary.log` (write through in-workspace
  symlink denied, no outside file), `docs/evidence/regenerated/compaction.log`,
  `resume.log`, `checkpoint.log` (`"restored":true`), `cli-flags.log`,
  `docs/evidence/F-ext/reconnect.json` (all 8 checks ok: `reset_done`,
  `init count 0 -> 1`, fresh session id, successful turn).
- **Hook trust (my own scenarios)**: untrusted/pending, stale-after-grant (changed
  command ⇒ different digest), revoked, and corrupt-trust-store hooks all returned
  `ran:false` and wrote no marker via `hooks run`. Via `flow run`, an untrusted hook
  in a fresh data dir, a stale hook, and a revoked hook were all denied by
  `authorizeHook` before any spawn. `HookGovernance.execute` (`hook-governance.ts:151-159`)
  has no spawn path before `authorize`.
- **Community plugin hooks non-runnable**: `plugins hooks` only prints declarations;
  `hooksFor` (`plugin-exchange.ts:326-340`) returns data, never executes. My marker file
  stayed absent. A flow plugin step is denied when the plugin is disabled
  (`flow-runner.ts:212-221`).
- **Flow trust / journal**: an injected `command` field in a flow definition is ignored
  (`flow-runner.ts:100-108`), no marker files were created; resume reports
  `reused-from-journal` for completed steps. Gate's `F-auto-01/l3-flows.log` likewise
  shows `=== FAILURES: 0 ===`.
- **OPEN-SETTINGS-01 root fix**: with a valid `updatedAt`, a real CLI run preserved
  `baseUrl`, `protocol`, `client` and `customUnknown` through the settings rewrite
  (`/tmp/opencode/revsec4/results.log` section B). The 2/32/… settings suites pass
  (`provider-settings-roundtrip`, `-manager`, `-legacy-migration`: 32 pass, 0 fail).
  Note: a settings file with an *invalid* `updatedAt` (e.g. `"x"`) is rejected by
  `StoredProviderSettingsSchema` (`z.string().datetime()`) and falls back to a clean
  state, which legitimately drops fields — this is schema-invalid input, not a regression.
- **CLI flags**: `--no-color --locale xx-XX doctor --json` produced clean JSON with no
  ANSI bytes and `locale:"en-US"` (unknown locale kept the current locale per
  `apps/cli/src/utils/locale.ts:15`); `--disallowed-tools`, repeatable `--attach` are
  exercised in `docs/evidence/regenerated/cli-flags.log`.
- **Secrets**: history-wide grep for `sk-*`, `AKIA*`, `ghp_*`, PEM keys found only the
  synthetic `AKIAIOSFODNN7EXAMPLE` documented in `docs/recon/secrets-audit.md`.
  `config.json` is untracked and gitignored (`.gitignore:55`); no `.env` (only
  `.env.example`) is tracked. No credential rotation needed.
- **Ctrl-C / crash handling**: no P0/P1 defect found in the interrupt paths I exercised;
  the prior review's Ctrl-C and compaction checks were re-confirmed via the gate's
  real two-turn compaction and PTY scenarios.

---

## Bottom line

**I found one P1 and one P2 in the security/governance surface.** The core hook-trust,
plugin-hook non-runnability and flow-trust invariants hold under my own attacks: no
untrusted, stale, revoked or corrupt-store hook ran, no community plugin hook executed,
and no flow bypassed trust. The P1 is a false `VERIFIED` security claim caused by a
security gate that can never fail on branding/endpoint findings. The P2s are a
self-certified reserved marketplace id and a hardcoded real-endpoint agent step in
flows. The P3s are latent/defense-in-depth.

The completion condition as written in `.work/DECISIONS.md` ("zero open P0/P1 on the
final HEAD") is **not met** because of the P1 above. I did not set STATUS to COMPLETE
and did not modify any product file. The working tree is dirty only because
`bash scripts/gate.sh` regenerates evidence/docs in place; I re-ran it exactly as
prescribed by the brief.
