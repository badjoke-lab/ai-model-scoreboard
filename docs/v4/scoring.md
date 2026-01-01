# AMS v4 Scoring Spec (Definitive) — items, formulas (0-100), weights

This file defines ALL scoring items and their formulas.
No item may be skipped. "unknown" is forbidden; missing inputs must map to reason codes and deterministic penalties.

## 0. Common functions

### clamp01(x)
clamp01(x) = min(1, max(0, x))

### norm_log(x; min, max)
norm_log(x; min, max) = clamp01( (ln(x) - ln(min)) / (ln(max) - ln(min)) )

### score_high_better(x; min, max)
= round(100 * norm_log(x; min, max))

### score_low_better(x; min, max)
= round(100 * (1 - norm_log(x; min, max)))

### reason-code penalty policy (no unknown)
If an input is missing, scoring MUST use:
- status ok => compute normal
- status not_found or missing_source_link => treat as “absent” (max penalty) unless explicitly stated
- status rate_limited/blocked/ambiguous/invalid => treat as “verification failed” (partial penalty) unless explicitly stated

Default mapping (unless overridden per item):
- ok => compute
- not_found / missing_source_link => score = 0
- rate_limited / blocked / ambiguous / invalid => score = 20

## 1. Categories and weights

Overall score is weighted sum of category scores:

- Spec (Absolute metrics): 45%
- Evidence (External proof): 35%
- Ops (Operational quality): 20%

overall = round( 0.45*Spec + 0.35*Evidence + 0.20*Ops )

Each category score is the mean of its items (unless stated).

---

## 2. Category: Spec (45%)

Spec = mean(S1..S8)

### S1 Context length
Input: absolute.context_length
S1 = score_high_better(context_length; 4096, 200000)
If missing => 0

### S2 Max output tokens
Input: absolute.max_output_tokens
S2 = score_high_better(max_output_tokens; 512, 64000)
If missing => 0

### S3 Pricing (avg of input/output)
Inputs: absolute.pricing.input_per_1m, absolute.pricing.output_per_1m
price_eff = (in + out)/2
S3 = score_low_better(price_eff; 0.05, 100)
If pricing missing => 0 (price unknown is treated as worst)

### S4 Modality coverage
Inputs: absolute.modalities flags (text/image/audio/video in/out)
Points (sum, max=100):
- text_in 20, text_out 20
- image_in 15, image_out 15
- audio_in 10, audio_out 10
- video_in 5, video_out 5
S4 = sum(points for supported flags)
If missing => 0

### S5 Tool/function calling
Input: absolute.supports_tools (boolean)
S5 = 100 if true else 0
If missing => 0

### S6 Structured output (JSON/schema)
Input: absolute.supports_structured_output (boolean)
S6 = 100 if true else 0
If missing => 0

### S7 Rate limit capacity
Inputs: absolute.rate_limits.rpm, absolute.rate_limits.tpm
cap = sqrt(rpm * tpm)
S7 = score_high_better(cap; 1000, 1e7)
If one missing => treat missing as 0 => cap=0 => S7=0
If all missing => 0

### S8 Disclosure (architecture/params)
Input: absolute.disclosure.architecture_or_params (boolean)
S8 = 100 if true else 0
If missing => 0

---

## 3. Category: Evidence (35%)

Evidence = mean(T1..T4)

Evidence status is taken from evidence/{modelKey}.json entries.

### T1 Official page evidence
Type: official_page
If status ok => 100
If status not_found or missing_source_link => 0
If status rate_limited/blocked/ambiguous/invalid => 20

### T2 Dev activity evidence
Type: dev_activity
If status ok:
- commits90d from extracted
- release180d from extracted
a = clamp01(commits90d / 200)
b = 1 if release180d else 0
T2 = round(100 * (0.7*a + 0.3*b))
Else use default mapping:
- not_found/missing_source_link => 0
- rate_limited/blocked/ambiguous/invalid => 20

### T3 Paper evidence
Type: paper
If status ok => 100
If status not_found/missing_source_link => 0
If status rate_limited/blocked/ambiguous/invalid => 20

### T4 Audit/security evidence
Type: audit
If status ok => 100
If status not_found/missing_source_link => 0   (treat as “no public audit”)
If status rate_limited/blocked/ambiguous/invalid => 20

---

## 4. Category: Ops (20%)

Ops = mean(Q1..Q3)

Ops inputs come from deterministic measurement pipelines if available.
If not available, MUST produce reason-coded outcomes and apply penalties.

### Q1 Latency (TTFT p50)
Input: ops.ttft_p50_sec
Q1 = round(100 * (1 - clamp01((ttft - 0.3) / (5.0 - 0.3))))
If missing => 0

### Q2 Throughput (tokens/sec p50)
Input: ops.tokens_per_sec_p50
Q2 = round(100 * clamp01((tps - 5) / (80 - 5)))
If missing => 0

### Q3 Reliability (success rate 7d)
Input: ops.success_rate_7d (0..1)
Q3 = round(100 * clamp01(success_rate_7d))
If missing => 0

---

## 5. Required per-item traceability (models.json)
For every itemKey (S1..S8, T1..T4, Q1..Q3):
models[modelKey].scores.items[itemKey] must include:
- score: int 0..100
- inputs: raw values used (or nulls) + evidence status when relevant
- refs:
  - decisionsRef: pointer/key to decisions.json item
  - evidenceRef: type + status + path (when relevant)
- notes: deterministic penalty explanation when status != ok
