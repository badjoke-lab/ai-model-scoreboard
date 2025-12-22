# 🟥 AI Model Scoreboard v4 – Internal Specification (English)

## Section 3 – Layer management and incident handling

### Purpose
This section documents how the automated pipeline assigns models to Full, Provisional, or Rejected tiers and how incidents trigger movement between layers. All decisions run on the daily 00:00 UTC loop with no manual overrides.

### Evaluation cadence
- Layers are recalculated every day at 00:00 UTC.
- Critical incidents can trigger immediate demotion without waiting for the next loop.

### Layer definitions
| Layer | Meaning | Score visibility | Leaderboard visibility |
| --- | --- | --- | --- |
| Full Listing | Fully adopted model | Scores shown | Appears in rankings |
| Provisional | Limited evidence or early-stage model | Scores shown with caveats | Appears in rankings |
| Rejected | Insufficient data or serious risk | Not shown | Not listed in rankings |

### Incident policy
- **Critical incident (1x)**: Immediate move to Rejected.
- **Multiple medium incidents**: Move to Provisional while the system gathers more evidence.
- **Resolved incidents**: A model can return to Full when recent evidence is healthy and data is complete.

### Staleness rules
- If a model’s update timestamp drifts beyond the freshness threshold, it is moved to Provisional.
- Continued staleness beyond 60 days moves it to Rejected so unreliable entries do not linger.

### Objectives
- Keep the leaderboard trustworthy by never showing entries with broken data.
- Ensure every rule is numeric and explainable so that methodology can be published without revealing sensitive weighting details.
