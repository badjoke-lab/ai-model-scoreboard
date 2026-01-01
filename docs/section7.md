# AMS v4 — Traceability: How Scores link to Decisions/Evidence

## 0. Goal
A user (and CI) must be able to answer:
- Why is this model adopted/provisional/denied?
- Why did this item score become X?
- What evidence was used (or failed), and why?

This requires **machine-linkable fields**.

---

## 1. Adoption Trace
Source:
- `decisions.json`

Rule:
- For every model in `models.json`, UI must be able to locate its decisions entry by `modelKey`.

Required linkage:
- `models.json.models[].status` must match decisions entry status.
- `models.json.models[].statusReasons[]` (optional direct copy) may exist, but at minimum:
  - UI must show `decisions.entries[modelKey].reasons[]`.

---

## 2. Evidence Trace
Source:
- `evidence/{modelKey}.json`

Rule:
- For every modelKey in adopted+provisional, evidence file must exist.
- Evidence file must contain all 4 evidence types.

Required linkage fields:
- In each scoring item object (models.json):
  - `usedEvidence.type`
  - `usedEvidence.status`
  - `penaltyReasons[]`

Interpretation:
- If `usedEvidence.status != ok`, then:
  - the item’s score must reflect a deterministic penalty rule (section6)
  - and `penaltyReasons[]` must include the status and/or reason codes.

---

## 3. Score Explanation Contract
For each scoring item:
- The score must be reproducible from:
  - `inputs`
  - evidence status/reasons (if evidence-based)
  - fixed formula in section6

Forbidden:
- “Hidden heuristics” not in section6
- “Manual overrides” not logged
- “unknown” placeholder that avoids scoring

---

## 4. UI Display Requirements for Traceability
On `/models/[modelKey]`:
- For each scoring item row:
  - show score
  - show inputs used
  - show “Used evidence: <type>(<status>)”
  - show penaltyReasons when non-ok
- For Evidence section:
  - show status, reasons, refs, extracted
- For Decisions section:
  - show status + reasons

If any of the above missing:
- treat as bug (not “nice-to-have”).
