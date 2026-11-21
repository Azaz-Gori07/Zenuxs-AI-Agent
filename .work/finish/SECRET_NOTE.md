# SECRET_NOTE (round 1)

No real credential values were found in tracked files or history.

Credential NAMES encountered during scanning (values never recorded here):
- `OPENROUTER_API_KEY` — `.env.example` placeholder only (`sk-or-your-key-here`).
- Test-provider fixtures — `docs/evidence/P0/core-unit-test.log` contains obvious
  fake values of the form `sk-<provider>-provider-key`; not real credentials.
- `sk-REDACTED-EXAMPLE` — reviewer's canary string in `.work/REVIEW_FINDINGS.md`
  was redacted from its original key-shaped form during round 1.
- CSS class `.task-completed-banner` matched a naive `sk-` grep as a false positive.

`scripts/secrets-scan.py` targets real credential shapes and fails closed on any hit.
