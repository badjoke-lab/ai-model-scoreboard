# 🟥 AI Model Scoreboard v4 – Internal Specification (English)

## Section 5 – Methodology publishing rules

### Purpose
Translate the internal specification into a public-facing methodology without exposing proprietary formulas. Transparency is balanced with protections against score gaming.

### What we publish
- The goals of AMS: fairness, reproducibility, and objectivity.
- High-level explanations of listing layers (Full, Provisional, Not Listed).
- The existence of scoring axes (performance, safety, adoption, openness, cost) without revealing coefficients.
- Update frequency and the fact that snapshots are rebuilt automatically.

### What stays private
- Exact scoring formulas, thresholds, and correction factors.
- Internal incident handling heuristics and risk weights.
- Debug logs and any data that could be used to reverse-engineer the ranking logic.

### Publishing guidelines
- Keep wording concise and neutral so it is easy to translate later.
- Avoid examples that could be misused to overfit a single benchmark.
- Document data freshness expectations and how missing inputs are handled.

### Anti-gaming stance
The methodology should make clear that AMS uses only verifiable data, so attempts to manipulate social sentiment or unstable community tests have no impact on scores.
