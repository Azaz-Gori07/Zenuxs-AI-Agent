# PENDING — remaining P2/P3 items only

Gate is green (16/16). The following are documented P2/P3 follow-ups, not blockers:

- F-rag: intentionally excluded from parity matrix (no RAG indexer implementation in target; stale `.rag-index` artifact only). Needs a real chunking/BM25/watcher/semantic-search implementation before re-enabling.
- Live provider verification: BLOCKED (env vars absent in this shell); fake provider used for all L3 scenarios.
- Extension webview scenarios not yet covered: tool-call cards, diff apply/reject, approval prompts, diagnostics panel, SecretStorage key inspection, core-process-kill reconnect. 12/12 implemented scenarios pass.
- Dogfooding: 6 of 10 tasks executed with verified artifacts; remaining four require live-provider or large-history scenarios.
- Full Phase 8 stress/chaos suite partially executed (429/500/malformed/slow/cut streams, workspace boundary, permission denial); not exhaustive.
- Windows-only unit tests (3) skipped by platform; live compaction test gated by CORE_LIVE_COMPACTION_TESTS.
- `config.json` history scrub command prepared in docs/recon/secrets-audit.md but NOT run (mission R7 forbids history rewrite without explicit user authorization).
- Multi-provider live normalization (Anthropic/Gemini/OpenRouter/Ollama): fake-provider only; live: BLOCKED (no endpoint).

No P0/P1 feature is pending.
