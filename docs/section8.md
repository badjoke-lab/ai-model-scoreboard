# AMS v4 Spec — Section 8: Operations (daily automation + logs + no manual intervention)

## 1. Daily schedule
- Runs daily at fixed time (UTC).
- Steps:
  1) generate v4 outputs in private-engine
  2) validate
  3) copy to UI repo
  4) create/update PR only if diff exists
  5) merge triggers deployment (Vercel)

## 2. Stop-on-failure
Any failure stops the daily job:
- missing API key
- intake fetch failure
- validation failure
- copy/checkout failure

## 3. Log requirements (must be enough to debug in 1 minute)
Logs must include:
- changed=true/false
- generatedAt
- counts (intake/adopted/provisional/denied)
- PR URL if created/updated
- if failure: step name + root error + file/key pointer

## 4. No manual intervention definition
System is considered “self-running” if:
- new models appear automatically from OpenRouter
- enrichment always runs and produces reason-coded evidence
- scoring always produces full item set
- UI updates via PR without editing seed/config
