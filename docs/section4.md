# AMS v4 — Model Detail Page Spec (/models/[modelKey]) + Routing

## 0. Route Rules
- Canonical production route is `/v4`.
- Model detail pages live at:
  - `/models/[modelKey]`
- `/v4` must link into model pages.
- Legacy routes must be either removed or explicitly marked as legacy.

---

## 1. Model Detail Page Layout (FIXED 4 blocks)

### Block A — Absolute Metrics (Spec / “PC spec”)
Purpose:
- Cross-model comparable absolute metrics
- MUST display for every model
- MUST affect scoring (section6)

Required fields (show as key-value table):
- `modelKey`
- `name`
- `provider`
- `canonicalSlug`
- `sourceRef` (raw id)
- `contextLength`
- `maxOutputTokens`
- `pricing.input` and `pricing.output`
- `modalities` (text/image/audio/video flags)
- `supportsTools`
- `supportsJson`
- optional: `rateLimits` if available
- `trainingCutoff` and `releaseDate`:
  - If not directly available, they must be represented as evidence-derived outcomes:
    - show the evidence status + reason codes (“not_found”, etc.)
  - Displaying nothing is a bug.

Rule:
- If a value is missing, UI must show:
  - “Unavailable” plus a link/label to the relevant evidence status + reason
  - NOT “unknown”.

---

### Block B — Adoption Status + Decision Reasons
Purpose:
- Explain why the model is adopted/provisional/denied.

Required:
- `status` badge (adopted / provisional / denied)
- `decisions.reasons[]` displayed as list
- `decisions.source` (openrouter|seed)
- `updatedAt` (from v4 meta)

Rule:
- reasons[] must be non-empty. Empty is a bug.

---

### Block C — Evidence (External collection results)
Purpose:
- Show the machine results of evidence collection.
- Every model has exactly 4 evidence types.

Evidence types (fixed set):
1) `official_page`
2) `dev_activity`
3) `paper`
4) `audit`

Each evidence type MUST show:
- `status` badge:
  - `ok | not_found | rate_limited | blocked | ambiguous | invalid | missing_source_link`
- `reasons[]` list (non-empty)
- `refs[]` list as links (may be empty)
- `extracted` (structured fields when ok)

Rule:
- Missing evidence items is a bug.
- `unknown` is forbidden.

(Concrete UI behavior is in section5.)

---

### Block D — Score Breakdown (ALL items)
Purpose:
- Explain the score; no hidden items; no skipping.

Required:
- `overall` score + category totals
- Full list of scoring items (from section6) with:
  - item score 0–100
  - inputs used
  - usedEvidence type + status
  - penaltyReasons (reason codes) if applicable

Rule:
- If an item is absent for a model, it is a bug.
- If an item is present but lacks usedEvidence linkage, it is a bug.

---

## 2. Linking Rules
- Rankings entries link to `/models/[modelKey]`
- Evidence section includes a “References” list aggregating refs across evidence types (deduped)
- Score items should link/anchor to relevant evidence type if applicable
