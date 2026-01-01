# AMS v4 Spec — Section 5: Scoring overview (full formulas in scoring.md)

Scoring is fully defined in scoring.md.
This section only states structure and invariants.

## 1. Invariants
- Every model gets a score (0–100) for EVERY scoring item.
- Missing inputs are handled deterministically via evidence status codes.
- No item is skipped.
- All item scores are traceable (inputs + evidence refs + decision refs).
- Overall score is deterministic and stable.

## 2. Scoring layers
- Layer A: Absolute Metrics (Spec) — “PC-spec equivalent”
- Layer B: Evidence-based Trust — official/dev/paper/audit results
- Layer C: Ops Quality — latency/throughput/reliability (if available; if not, deterministic penalty)

## 3. Output embedding
models.json includes:
- absolute metrics
- evidence refs/statuses
- per-item score with inputs & refs
- category totals
- overall score
