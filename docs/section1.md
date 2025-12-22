# 🟥 AI Model Scoreboard v4 – Internal Specification (English)

## Section 1 – Model intake, promotion, and rejection

### Purpose
AI Model Scoreboard v4 uses fixed rules to decide whether a model is listed, promoted, or removed. Decisions are automatic and rely on objective evidence so the leaderboard can be reproduced without manual judgment.

### Listing tiers
- **Full Listing**: Meets every scoring requirement, is updated recently, and has no blocking safety incidents. Models appear in the main leaderboard with full cards.
- **Provisional**: New or under-documented models. They may have sparse public data, recent major releases, or early risk signals. Scores may include estimates and are shown with a Provisional badge.
- **Rejected**: Not shown on the leaderboard. Triggered by critical incidents, unreliable data, or long-term neglect.

### Promotion
A Provisional model is promoted to Full when all scoring inputs are available, the latest update is within the last 30 days, and there are zero or one resolved incidents. Promotion can happen in the daily 00:00 UTC batch or during lazy updates when a request is processed.

### Demotion
- Lack of updates or missing required fields will move a Full model to Provisional until the gaps are resolved.
- Provisional models that remain stale for 60 days are demoted to Rejected.
- Any critical incident immediately demotes a model to Rejected. Multiple minor incidents will demote to Provisional while evidence is reviewed by the automated checks.

### Display rules
- Full and Provisional models appear in the leaderboard with their scores.
- Rejected models are omitted from the UI; internal logs retain reasons for traceability.

### Guiding principles
- All thresholds are numeric and deterministic.
- Human overrides are avoided; if data is missing, the pipeline errs on the side of caution.
- Methodology published to users is a concise view of these rules without exposing internal weighting logic.
