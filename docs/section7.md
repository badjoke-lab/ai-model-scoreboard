# 🟥 AI Model Scoreboard v4 – Internal Specification (English)

## Section 7 — Error handling and safeguards

### Purpose
Keep the UI stable even when data sources fail. The guiding rule is: broken inputs must not break the leaderboard.

### Fault isolation
- Errors are contained at the model level. A failure for one vendor does not stop the rest of the pipeline.
- Use retries and stale-cache fallbacks for transient API issues.

### Data validation
- Reject snapshots with missing mandatory fields.
- Flag suspicious ranges and cap extreme outliers.
- Mark incomplete entries so downstream scoring can reduce confidence instead of guessing.

### Rollback strategy
- If scoring fails, republish the last successful snapshot.
- CI should surface alerts, but the production JSON remains stable.

### Incident logging
- Store incident metadata alongside models so demotion decisions are auditable.
- Keep internal logs private to avoid leaking sensitive indicators.

### Resilience checklist
- Benchmarks missing → reuse last good values with a warning.
- Vendor API down → freeze current scores until the next successful pull.
- Naming conflicts → canonicalize and prevent duplicates before publishing.
