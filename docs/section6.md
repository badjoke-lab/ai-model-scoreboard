# 🟥 AI Model Scoreboard v4 – Internal Specification (English)

## Section 6 — Automation pipeline

### Purpose
Describe how AMS runs end-to-end without manual steps while keeping scoring logic private and published data stable.

### Repository layout (public vs private)
- `/docs/` – public-facing methodology and internal notes.
- `/public/` – finalized JSON consumed by the UI.
- `/scripts/` – helper scripts safe to disclose.
- `/data/raw` and `/data/processed` – optional staging areas for collected data.
- `/internal/` – private pipeline logic (fetching, scoring, rules, canonicalization). This content is not committed to the public repo.

### Pipeline layers
1. **Model discovery**: crawl vendor APIs and marketplaces to detect new models and renamed entries.
2. **Data fetch**: collect pricing, specs, benchmarks, incidents, and transparency signals; apply fallbacks when sources are unavailable.
3. **Processing & scoring**: normalize data, compute scores, and assign listing layers using deterministic rules.
4. **Publishing**: write public JSON files for the site; strip any sensitive intermediate fields.
5. **Scheduler**: run daily at 00:00 UTC via CI; allow manual re-runs when debugging.

### Secrecy controls
- Keep scoring logic in CI secrets or private artifacts so formulas are not exposed.
- Publish only the results needed by the UI.
- Avoid retaining debug logs that could leak internal thresholds.

### Fail-soft behavior
If any layer fails, reuse the last good snapshot and alert via CI logs. The goal is to keep the site functional even when inputs are partially broken.
