# AMS v4 — Data Flow & Daily Pipeline (Fixed Order)

## 0. Overview
This section defines the **single fixed order** of the daily pipeline.  
No steps may be skipped. No reordering.

---

## 1. Fixed Daily Pipeline (MUST run in this order)

### Stage 1: Intake
- Source A: OpenRouter Models API (primary)
- Source B: Bootstrap seed (fallback / supplements)
Output:
- raw intake list (in memory)
- normalized candidates list

### Stage 2: Normalize
- Produce canonical `modelKey` for each candidate:
  - prefer `canonical_slug`
  - else `id`
- Normalize:
  - provider name normalization
  - slug normalization (lowercase, trim, replace spaces→`-`)
- Deduplicate by modelKey:
  - keep the most informative record deterministically

Output:
- normalized model candidates keyed by `modelKey`

### Stage 3: Adoption Decision
- Apply allowlist/denylist rules
- Determine status per model:
  - `adopted | provisional | denied`
- Record machine-readable reasons for each decision

Outputs:
- `adoption.json` (adopted + provisional lists)
- `decisions.json` (per-model decision log + reasons + meta)

### Stage 4: Evidence Collection (External Info)
For EVERY `modelKey` in (adopted + provisional):
- Attempt evidence collection for each type:
  1) `official_page`
  2) `dev_activity`
  3) `paper`
  4) `audit`
Rules:
- Attempt must always occur (no skipping)
- Final status must be one of:
  - `ok | not_found | rate_limited | blocked | ambiguous | invalid | missing_source_link`
- `unknown` is forbidden
- Always store `reasons[]` (non-empty)
- Store `refs[]` when available
- Store `extracted` when status=ok (structured fields)

Outputs:
- `evidence/index.json`
- `evidence/{modelKey}.json` for every modelKey

### Stage 5: Scoring (ALL items)
- For EVERY modelKey:
  - Compute ALL scoring items defined in section6
  - Each item is 0–100
  - Missing info triggers deterministic fallback penalty (not “unknown”)
  - Record for each item:
    - raw inputs (what was used)
    - usedEvidence (type + status)
    - penaltyReasons (reason codes)
Outputs:
- `models.json` (per-model scores + breakdown)
- `rankings.json` (sorted summary)
- `not-listed.json` (denied + reasons)

### Stage 6: Validation (Hard stop)
- Validate ALL output files and schemas:
  - index manifest
  - adoption/decisions
  - models/rankings/not-listed
  - evidence index + each evidence/{modelKey}.json
Rules:
- Any validation failure stops the job (fail fast).
- Error message must point to:
  - file path
  - key path
  - rule violated

### Stage 7: Copy-to-UI + Diff + PR
- Copy ALL v4 output files into UI repo under `public/data/v4/`:
  - including `evidence/` folder
- Diff:
  - no diff → success end, no PR
  - diff → create/update PR (title includes date, body includes updatedAt + changed=true)
- PR merge triggers deploy.

---

## 2. “Stop on Break” Conditions (MUST fail fast)
Job must fail immediately if:
- required secrets missing (e.g., OpenRouter API key)
- intake fails (non-200 / invalid JSON)
- adoption decision stage throws
- evidence stage throws
- scoring stage throws
- any validator fails
- copy-to-UI checkout or push fails

No “best effort” is allowed for these. v4 must not silently publish partial data.

---

## 3. Required Logging Fields (Minimal)
Every daily run must emit:
- `runId`
- `updatedAt`
- `changed=true|false`
- `stage` (current stage)
- `modelsTotal`
- `adoptedCount`
- `provisionalCount`
- `deniedCount`
- `outputHash` (optional but recommended)
- on failure:
  - `failedStage`
  - `failReason` (short)
  - `failDetail` (actionable)
- on PR:
  - `prUrl`

(Full log spec is section8.)
