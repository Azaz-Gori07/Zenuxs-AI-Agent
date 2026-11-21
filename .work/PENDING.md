# PENDING — remaining externally blocked / follow-up items only

## Live provider (externally blocked, not a product defect)
- F-prov and F-toolrobust live paths remain BLOCKED with evidence in
  `docs/evidence/live/` and `.work/BLOCKED.md`.
- One command to promote them from real evidence only:
  `ZENUXS_TEST_BASE_URL=... ZENUXS_TEST_API_KEY=... ZENUXS_TEST_MODEL=... bash scripts/verify-live.sh`
  It retries 429 with exponential backoff and uses a long timeout (`ZENUXS_LIVE_TIMEOUT_SECONDS`,
  default 300s). It writes `=== LIVE_VERIFY: PASS ===` only after two real CLI scenarios
  succeed, then regenerates the matrix; otherwise it writes BLOCKED and exits 2 without
  changing any row.

## Follow-ups (P2/P3, not blockers)
- Windows-only unit tests (3) are skipped on this Linux host; equivalent non-Windows
  paths are covered by the same test files.
- `config.json` history scrub command is prepared in `docs/recon/secrets-audit.md` but
  NOT run (mission R7 forbids history rewrite without explicit authorization).
- Multi-provider live normalization (Anthropic/Gemini/OpenRouter/Ollama) is verified on
  the fake provider only; live verification is BLOCKED (no working endpoint).

No P0/P1 feature work is pending.

## P3 follow-up (non-blocking; does not gate completion)
- Add a dedicated unit test asserting that naming an *unknown* field in `clearFields`
  actually removes it in `mergePreservingUnknown`. The behavior was verified at runtime by
  the independent reviewer at HEAD `e1e51d3`, and `provider-settings-roundtrip.test.ts`
  already covers unknown-field preservation generally; this is regression-test hardening
  only. Deferred deliberately so no product-source change follows the clean final review.
