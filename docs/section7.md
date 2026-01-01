# AMS v4 Spec — Section 7: UI contract (no dummy, /v4 production, model pages required)

## 1. Data loading rule
UI must read from public/data/v4/index.json manifest, then load referenced files.
No hard-coded dummy dataset in production route.

## 2. Production routes
- /v4 is the canonical production route.
- old routes must be removed or clearly labeled as legacy (no silent confusion).

## 3. /v4 list (rankings)
Must render:
- updatedAt / generatedAt
- rows from rankings.json
- search/filter by name/provider/status
- evidence summary badge (e.g., okCount/4)
- link to /models/[modelKey]

## 4. /models/[modelKey] (detail page) — REQUIRED
Must work for all adopted+provisional modelKey.

Detail must display:

### A) Identity
- modelKey
- name
- provider
- rawRef (id/canonicalSlug if available)
- status (adopted/provisional/denied) + reasons from decisions.json

### B) Absolute metrics (must be visible)
- context_length
- max_output_tokens
- pricing input/output
- modalities
- supportsTools
- supportsStructuredOutput
- rate limits if present
- architecture/params if present
If missing: display evidence outcome/reason codes (not unknown).

### C) Evidence section (must be visible)
Render 4 evidence items with:
- type
- status badge
- reasons[] (non-empty)
- refs[] links
- extracted fields (if ok)

### D) Scoring breakdown (must be visible)
- overall score
- category totals
- all scoring item rows:
  - score 0–100
  - inputs used
  - refs: evidence type/status used
  - deterministic penalty note when evidence not ok

## 5. UI empty-state is forbidden for required files
If evidence file is missing or malformed => show “data contract broken” error message (not silent empty UI).
