# AMS v4 Methodology Spec (Internal)

This document is the internal, developer-focused specification for how AMS v4 scores are defined, computed, and serialized
into the public snapshot. It prioritizes accuracy over public-facing phrasing.

## A. Purpose & Definitions

- **v4**: The fourth major snapshot format used by the public AI Model Scoreboard UI. v4 snapshots are deterministic JSON
  files published under `public/data/v4/*`.
- **Snapshot**: A single, time-stamped output of the v4 pipeline (seed/decisions → normalization → scoring → JSON files).
  Snapshots are immutable once published.
- **Score**: The composite result of five category subscores (Performance, Safety, Adoption, Openness, Cost). Each category
  score is normalized to a 0–100 scale and combined by configured weights to produce the total score. A score is only
  meaningful for models in the **full** layer.

**Internal note:** The current v4 scorer uses deterministic placeholder inputs (fixtures or hash-based fallbacks) to keep
outputs stable while the production engine is finalized.

## B. Data flow (one page)

1. **Seed/bootstrap**
   - Source: `data/bootstrap/models_seed.json` + allow/deny lists in `data/bootstrap/model_allow_deny.json`.
2. **Decision pass**
   - `scripts/auto_adopt_models.mjs` classifies each seed model as `adopted` (full), `provisional`, `not-listed`, or
     `denied`, emitting `output/decisions.json`.
3. **Normalization**
   - `lib/v4/metadata.mjs` normalizes slug/name/vendor and maps decisions into v4 layers (`full`, `provisional`,
     `not-listed`, `deny`).
4. **Scoring**
   - `lib/v4/scoring.mjs` computes per-criterion scores → category subscores → total score.
5. **Snapshot build**
   - `lib/v4/snapshot.mjs` assembles models, rankings, and not-listed records with `updatedAt` timestamps.
6. **Public output**
   - `toPublicSnapshot` emits `public/data/v4/index.json`, `rankings.json`, `models.json`, `not-listed.json`.
7. **UI consumption**
   - The UI reads `public/data/v4/*` directly (no runtime scoring).

## C. Score components (all current + planned)

### 1) Performance
- **Intent**: Overall capability based on benchmarks (reasoning, coding, math/STEM, general LLM evals).
- **Input signals**: Criterion `performance.benchmark` (benchmark composite).
- **Output field(s)**:
  - `rankings[].scores.performance` (category score, 0–100)
  - Included in `rankings[].score` (total).
- **Allowed range**: 0–100 (category score). Criterion input range: 0–100.
- **Default if missing**:
  - For **full** models: deterministic fallback value is generated if no fixture exists.
  - For **non-full** models: category score is `0`; per-criterion value is `null` with `missingReason` internally.

### 2) Safety
- **Intent**: Risk posture derived from incident rates and safety disclosures.
- **Input signals**: Criterion `safety.incident_rate` (lower-better, 0–10 range).
- **Output field(s)**:
  - `rankings[].scores.safety` (0–100)
  - Included in `rankings[].score` (total).
- **Allowed range**: 0–100 (category score). Criterion input range: 0–10.
- **Default if missing**: Same as Performance.

### 3) Adoption
- **Intent**: Real-world usage/traction (availability, ecosystem support, stable access).
- **Input signals**: Criterion `adoption.usage_index` (0–100 range).
- **Output field(s)**:
  - `rankings[].scores.adoption` (0–100)
  - Included in `rankings[].score` (total).
- **Allowed range**: 0–100 (category score). Criterion input range: 0–100.
- **Default if missing**: Same as Performance.

### 4) Openness
- **Intent**: Transparency of licensing, documentation, and model-card artifacts.
- **Input signals**: Criterion `openness.license_score` (0–100 range).
- **Output field(s)**:
  - `rankings[].scores.openness` (0–100)
  - Included in `rankings[].score` (total).
- **Allowed range**: 0–100 (category score). Criterion input range: 0–100.
- **Default if missing**: Same as Performance.

### 5) Cost
- **Intent**: Estimated efficiency and affordability relative to peers.
- **Input signals**: Criterion `cost.efficiency` (0–100 range).
- **Output field(s)**:
  - `rankings[].scores.cost` (0–100)
  - Included in `rankings[].score` (total).
- **Allowed range**: 0–100 (category score). Criterion input range: 0–100.
- **Default if missing**: Same as Performance.

### 6) Planned: Long-context capability
- **Intent**: Sustained accuracy at large context lengths.
- **Input signals**: Not yet implemented in v4; reserved for a future scoring update.
- **Output field(s)**: None in current v4 JSON (planned category).
- **Allowed range**: N/A in v4.
- **Default if missing**: Not scored; no impact on totals.

### 7) Planned: Multimodality
- **Intent**: Vision/audio/video/tool-use capability, scored as distinct abilities.
- **Input signals**: Not yet implemented in v4; reserved for a future scoring update.
- **Output field(s)**: None in current v4 JSON (planned category).
- **Allowed range**: N/A in v4.
- **Default if missing**: Not scored; no impact on totals.

### 8) Planned: Latency & throughput
- **Intent**: Responsiveness for real-time use cases and throughput at scale.
- **Input signals**: Not yet implemented in v4; reserved for a future scoring update.
- **Output field(s)**: None in current v4 JSON (planned category).
- **Allowed range**: N/A in v4.
- **Default if missing**: Not scored; no impact on totals.

## D. Weighting / aggregation rules

- **Per-criterion normalization**
  - Each criterion is normalized to 0–100 using min/max bounds.
  - If a criterion is `lower-better`, it is inverted before scaling.
- **Category aggregation**
  - Category score = weighted average of its criteria (weights default to 1.0).
  - If a category has zero effective weight, its score is `0`.
- **Total aggregation**
  - Total score = weighted average of category scores using `CATEGORY_WEIGHTS`:
    - Performance 0.35
    - Safety 0.25
    - Adoption 0.20
    - Openness 0.10
    - Cost 0.10
  - If total weight is zero, total score is `0`.
- **Missing subscores**
  - **Non-full layers**: all criteria are recorded with `value: null`, `score: 0`, and `missingReason`; category and total
    scores are `0`.
  - **Full layer with missing data**: values are filled deterministically (fixtures or hash-based fallback) so the score
    remains stable and non-null.

## E. Provisional / Not-listed rules

- **Full (listed)**
  - Decision status `adopted` from `model_allow_deny.json` allowlist → `layer: full`.
- **Provisional**
  - Missing required seed fields (`name`, `slug`, `vendor`) or duplicate slug in seed.
  - Any unrecognized decision status also defaults to provisional.
  - Provisional models still appear in rankings but with `score = 0` and zeroed subscores.
- **Not-listed**
  - Seed entry has required fields but is not in the allowlist and not denied.
  - Not-listed models are excluded from rankings and appear only in `not-listed.json`.
- **Deny**
  - Explicit deny list entry (`model_allow_deny.json`) → `layer: deny`.
  - Denied models are excluded from rankings and not-listed outputs; they still appear in `models.json` metadata.

## F. Versioning / stability promises

- **Schema stability**: v4 output JSON must not introduce breaking changes without a version bump.
- **Deterministic ordering**:
  - `rankings.json` sorted by `score` descending, then `model` slug ascending.
  - `models.json` keys sorted by slug ascending.
  - `not-listed.json` sorted by slug ascending.
- **Deterministic scores**: given identical inputs, scoring output is stable (fixture + hash fallback).

(日本語メモ) 公開用の言い回しではなく、開発者向けに正確な仕様を記載しています。
