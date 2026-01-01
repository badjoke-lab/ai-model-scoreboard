# AMS v4 Spec — Section 1: Definition of Done / Non-negotiables

This document set (section1–8 + scoring.md) is the single source of truth for AMS v4.
No “best effort”, no “unknown”, no “manual patching” is allowed unless explicitly stated.

## 1. Goal (what “complete” means)
After merge & daily operation, AMS v4 must satisfy ALL:

### Data (private-engine)
- Models automatically increase daily from OpenRouter.
- Models can increase/decrease WITHOUT editing seed (seed may exist, but must not be required).
- For EVERY model (adopted + provisional), enrichment is ALWAYS attempted daily.
- Evidence results ALWAYS store a reason code (ok/not_found/rate_limited/blocked/ambiguous/invalid/missing_source_link). “unknown” is forbidden.
- ALL scoring items are computed for EVERY model (no silent skip).
- Every score is traceable via decisions/evidence references.
- v4 output is deterministic (same inputs => same outputs).

### UI (ai-model-scoreboard)
- Zero dummy-only paths in production.
- Dozens+ real models are shown.
- /models/[modelKey] opens for ALL models in adopted+provisional (and also for denied if present in not-listed).
- Detail page shows: absolute metrics + score breakdown + evidence (with reason codes).
- /v4 is the production route. Old routes are removed or clearly marked.

### Ops
- Daily pipeline fails fast and stops when broken.
- Logs must make root cause obvious (which file/key/step).
- No manual intervention is needed for the system to keep increasing.

## 2. Non-negotiable rules
1) UNKNOWN IS FORBIDDEN  
All missing data must become a reason code outcome, not “unknown”.

2) ALWAYS ATTEMPT ENRICHMENT  
Even if missing links exist, emit `missing_source_link` (still an attempt outcome).

3) ALL ITEMS MUST PRODUCE NUMBERS  
Every scoring item outputs 0–100 for every model.

4) TRACEABILITY  
Every item must link to inputs (absolute metrics) or evidence statuses + decision reasons.

5) DETERMINISM  
No randomness. Stable sort. Stable rounding. Stable keys.

## 3. Daily pipeline (high level)
1) Intake models (OpenRouter) + optional seed merge
2) Normalize + dedupe -> canonical modelKey set
3) Apply allow/deny rules -> adoption.json + decisions.json
4) Enrichment for adopted+provisional -> evidence/{modelKey}.json (+ evidence/index.json)
5) Scoring (absolute metrics + evidence + ops metrics if available) -> models.json + rankings.json + not-listed.json + index.json
6) Validate ALL outputs (schema/type + cross-file references)
7) Copy outputs to UI repo and create PR if diff exists
