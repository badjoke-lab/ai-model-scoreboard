# AMS v4 Spec — Section 6: Validation, determinism, and failure semantics

## 1. Determinism rules
- Stable sorting:
  - rankings: sort by overall desc, then modelKey asc
- Stable rounding:
  - All item scores are integers 0–100 (round half-up)
- Stable timestamps:
  - generatedAt is recorded, but must NOT affect ranking ordering.
- No randomness, no time-based drift except generatedAt.

## 2. Validation scope (must validate ALL)
Validator MUST fail the job if ANY of these fail:
- index.json shape and file references exist
- adoption.json + decisions.json shapes and cross-references consistent
- evidence/index.json exists and every listed path exists
- every evidence/{modelKey}.json includes exactly 4 types
- models.json includes all models and all scoring items
- rankings.json rows count matches adopted+provisional (policy-defined)
- not-listed.json includes denied models

## 3. Error message requirements
On validation error, message MUST specify:
- file path
- JSON pointer (key path)
- expected vs actual type/value

Example:
"validate failed: evidence/gpt-4o.json -> evidenceItems[2].status expected enum, got 'unknown'"

## 4. Failure semantics (“broken => stop”)
Daily pipeline MUST stop (fail CI) when:
- required secret missing
- intake fetch fails
- any validator check fails
- outputs cannot be written

No “continue with partial data”.
Partial outputs are not allowed.

## 5. Ops metrics (optional but deterministic)
If ops metrics are collected:
- they must be stored as deterministic aggregates (p50/p95 over fixed window)
- if unavailable => reason code and deterministic penalty
