# AMS v4 — Product Definition (Completion Criteria)

## 0. Purpose
AI Model Scoreboard (AMS) v4 is a **deterministic daily-updating scoreboard** that:
- Automatically discovers models (OpenRouter)
- Attempts external evidence collection for every model (no skipping)
- Computes **all scoring items** for every model (no “unknown” escape)
- Publishes machine-auditable outputs (decisions/evidence + scores)
- Renders real data in UI (no dummy) including per-model detail pages

This document defines **what “complete” means**. If any of the below is not true, v4 is **not complete**.

---

## 1. Completion Criteria (MUST ALL be true)

### 1.1 Data / private-engine
- **Daily model discovery from OpenRouter**
  - New models can appear without manual edits.
- **Models can increase/decrease without seed**
  - Seed is only a bootstrap fallback; OpenRouter is the primary intake.
- **External info collection attempted for EVERY model**
  - For every adopted + provisional modelKey, evidence collection runs for each evidence type.
- **Evidence always records a reason code**
  - Evidence status must be one of:
    - `ok | not_found | rate_limited | blocked | ambiguous | invalid | missing_source_link`
  - `unknown` is forbidden.
- **All scoring items are always computed**
  - Every model must have a 0–100 score for every item (no silent skip).
  - Missing evidence becomes a deterministic penalty (with reason codes recorded).
- **Auditability**
  - You can trace “why this model exists / why this score happened” via:
    - `decisions.json` (adoption reasons)
    - `evidence/*` (collection results + reason codes)
    - `models.json` (item scores + usedEvidence + penalties)
- **Deterministic v4 output**
  - Given identical inputs and identical runs (same API payloads), output must be stable:
    - same modelKey normalization
    - same decision outcome
    - same evidence statuses
    - same scores
- **v4 outputs are copied to UI repo deterministically**
  - Copy step includes evidence folder and all v4 files.

### 1.2 UI / ai-model-scoreboard
- **Dummy = 0**
  - No hardcoded dummy models in production route.
- **Real models shown**
  - Rankings shows **dozens+ models** from v4 data.
- **Per-model detail pages work for all models**
  - `/models/[modelKey]` opens for every model in v4 `models.json`.
- **Model pages show full breakdown + evidence**
  - Absolute metrics (“spec”) shown
  - Adoption status + reasons shown
  - Evidence shown with reason codes + refs + extracted
  - All scoring items shown with usedEvidence link
- **/v4 is production**
  - `/v4` is canonical route; old routes are removed or explicitly marked as legacy.

### 1.3 Operations
- **Daily must stop on break**
  - If secrets missing, validation fails, schema invalid, etc. → job fails (not “best effort”).
- **Logs must explain failure immediately**
  - Logs must clearly say which stage failed and why.
- **No manual intervention required to keep increasing**
  - Daily can run indefinitely without hand-editing to accept new models.

---

## 2. Non-Negotiables (Contract Rules)
1) `unknown` is forbidden in outputs.  
2) Evidence is attempted for every model and every evidence type.  
3) Every scoring item is computed for every model every day.  
4) Every computed score must be explainable by machine logs (decisions/evidence).  
5) Deterministic outputs: no randomness, no nondeterministic ordering.

---

## 3. Definitions
- **Absolute metrics (“spec”)**: cross-model comparable “PC spec-like” values (context length, pricing, modalities, tool support, structured output support, etc.). These MUST be shown and MUST affect scoring.
- **All scoring items**: the full v4 list defined in section6. Every model gets a numeric score per item.
- **Evidence**: external info collection result for a model, per evidence type, with reason codes.
