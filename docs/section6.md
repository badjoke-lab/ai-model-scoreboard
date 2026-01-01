# AMS v4 — Scoring Items (Final) + Formulas (0–100) + Weights

## 0. Principles
- Every model gets a score for every item (0–100).
- No item may be skipped.
- Missing info is not “unknown”; it becomes a deterministic penalty with reason codes.

---

## 1. Common math
### clamp
`clamp(x, 0, 1) = min(1, max(0, x))`

### log normalize (high better)
`norm_log(x; min, max) = clamp((ln(x) - ln(min)) / (ln(max) - ln(min)), 0, 1)`

### low-better transform
If `norm` produces 0..1 where bigger means larger value:
`score_low_better = 100 * (1 - norm)`

### missing rule (global)
If a required input is missing and the evidence status indicates non-ok:
- compute score with the item’s “missing penalty rule” (defined per item)
- record penaltyReasons = [status + reason codes]

---

## 2. Category structure (fixed)
We use 3 top categories.

### Category Weights (overall)
- Spec (Absolute metrics): **0.45**
- Evidence (External proof): **0.35**
- Ops (Operational quality): **0.20**

Overall formula:
`Overall = round(0.45*Spec + 0.35*Evidence + 0.20*Ops)`

---

## 3. Spec Category (Spec = avg of S1..S8) [weight inside = equal]
### S1 Context Length
Input: `contextLength`
Formula:
`S1 = round(100 * norm_log(contextLength; 4096, 200000))`
Missing penalty:
- if missing → `S1=0`

### S2 Max Output Tokens
Input: `maxOutputTokens`
Formula:
`S2 = round(100 * norm_log(maxOutputTokens; 512, 64000))`
Missing penalty:
- missing → `S2=0`

### S3 Price Efficiency (input+output)
Inputs: `pricing.input`, `pricing.output` (USD per 1M tokens)
Compute:
`price_eff = (price_in + price_out) / 2`
Formula (low better):
`S3 = round(100 * (1 - norm_log(price_eff; 0.05, 100)))`
Missing penalty:
- missing pricing → `S3=0` (price unknown = worst for real ops)

### S4 Modalities
Inputs: modality flags (in/out)
Points:
- text_in 20, text_out 20
- image_in 15, image_out 15
- audio_in 10, audio_out 10
- video_in 5,  video_out 5
`S4 = sum(points_enabled)` (cap 100)
Missing penalty:
- missing modality info → `S4=0`

### S5 Tool/Function Calling Support
Input: `supportsTools` boolean
`S5 = 100 if true else 0`
Missing penalty:
- missing → `S5=0`

### S6 Structured Output (JSON/Schema)
Input: `supportsJson` boolean
`S6 = 100 if true else 0`
Missing penalty:
- missing → `S6=0`

### S7 Rate Limit Capacity
Inputs: `rateLimits.rpm`, `rateLimits.tpm` (if available)
Compute:
If both exist:
`cap = sqrt(rpm * tpm)`
Formula:
`S7 = round(100 * norm_log(cap; 1000, 10000000))`
Missing penalty:
- missing rate limits → `S7=0`

### S8 Architecture/Params Disclosure
Input: `architectureDisclosed` boolean (or inferred from metadata presence)
`S8 = 100 if disclosed else 0`
Missing penalty:
- missing → `S8=0`

Spec total:
`Spec = round((S1+S2+S3+S4+S5+S6+S7+S8)/8)`

---

## 4. Evidence Category (Evidence = avg of T1..T4)
Evidence status enum:
`ok | not_found | rate_limited | blocked | ambiguous | invalid | missing_source_link`

### T1 Official Page Evidence
Evidence type: `official_page`
Score:
- ok → 100
- not_found / missing_source_link → 0
- rate_limited / blocked / ambiguous / invalid → 20
Rationale:
- “could not verify” gets small non-zero but still penalized vs ok.

### T2 Dev Activity Evidence
Evidence type: `dev_activity`
If ok, inputs from extracted:
- commits90d (0..)
- release180d (boolean)
Compute:
`a = clamp(commits90d / 200, 0, 1)`
`b = 1 if release180d else 0`
`T2 = round(100 * (0.7*a + 0.3*b))`
If non-ok:
- not_found / missing_source_link → 0
- rate_limited / blocked / ambiguous / invalid → 20

### T3 Paper/Research Evidence
Evidence type: `paper`
Score:
- ok → 100
- not_found / missing_source_link → 0
- rate_limited / blocked / ambiguous / invalid → 20

### T4 Audit/Security Evidence
Evidence type: `audit`
Score:
- ok → 100
- not_found / missing_source_link → 0
- rate_limited / blocked / ambiguous / invalid → 20

Evidence total:
`Evidence = round((T1+T2+T3+T4)/4)`

---

## 5. Ops Category (Ops = avg of Q1..Q3)
Ops is “measured” signals. If not measurable, it is still computed with penalties (=0).
(Reason codes must be stored.)

### Q1 Latency (TTFT p50)
Input: `ops.ttft_p50_seconds`
Formula (low better):
`Q1 = round(100 * (1 - clamp((ttft - 0.3) / (5.0 - 0.3), 0, 1)))`
Missing penalty:
- missing → `Q1=0`

### Q2 Throughput (tokens/sec p50)
Input: `ops.tps_p50`
Formula (high better):
`Q2 = round(100 * clamp((tps - 5) / (80 - 5), 0, 1))`
Missing penalty:
- missing → `Q2=0`

### Q3 Reliability (success rate 7d)
Input: `ops.success_rate_7d` in [0..1]
`Q3 = round(100 * success_rate_7d)`
Missing penalty:
- missing → `Q3=0`

Ops total:
`Ops = round((Q1+Q2+Q3)/3)`

---

## 6. Item Weights inside Categories
Inside each category, items are equal-weight averages (as defined above).
Category weights are fixed in section2.

---

## 7. Required per-item audit fields (must appear in models.json)
For each item (S1..S8, T1..T4, Q1..Q3), store:
- `score` (0..100)
- `inputs` (raw values used)
- `usedEvidence`:
  - `type` (official_page/dev_activity/paper/audit/ops)
  - `status`
- `penaltyReasons[]` (empty if ok path used)
