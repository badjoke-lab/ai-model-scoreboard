# 🟥 AI Model Scoreboard v4 — Internal Specification (English)

This document summarizes the v4 design for AI Model Scoreboard (AMS). It combines the key rules from Sections 1–8 in a concise, English-only format.

## Objectives
- Deliver reproducible model rankings based on objective evidence.
- Automate ingestion, scoring, and publishing so daily updates require no manual work.
- Keep scoring formulas private while sharing methodology at a high level.
- Prefer stable benchmarks over hype or anecdotal claims.

## Listing system
- **Full Listing**: complete data, recent updates, and no blocking incidents.
- **Provisional**: early-stage or partially documented models shown with caveats.
- **Rejected**: hidden from the leaderboard due to critical risk or prolonged staleness.
- Promotions and demotions run each day at 00:00 UTC and respond immediately to critical incidents.

## Scoring axes (high level)
- **Performance**: weighted blend of reasoning, coding, math/STEM, and chat quality benchmarks.
- **Safety**: incident history, vendor safety disclosures, and reliability signals.
- **Adoption**: availability, ecosystem support, and pricing stability.
- **Openness**: documentation quality, model cards, and transparency artifacts.
- **Cost**: comparative token pricing where disclosed.

> Exact formulas, coefficients, and fallback adjustments are private to prevent gaming.

## Data pipeline
1. **Discovery**: crawl vendor APIs and curated lists to find models and canonicalize names.
2. **Collection**: gather specs, benchmarks, incidents, and pricing with retries and validation.
3. **Processing**: normalize fields, compute scores, and assign layers with deterministic rules.
4. **Publishing**: emit `public/data/v4/*.json` for the site; retain history for audits.

## Automation and resilience
- Scheduler runs daily at 00:00 UTC; manual runs are allowed for debugging.
- If a step fails, the system republishes the last healthy snapshot and surfaces warnings in CI.
- Private logic stays outside the public repo; only results and high-level docs are published.

## Future direction
The v4 release is an English-only MVP. Localization and additional scoring axes (long-context, multimodality, latency) are planned for later versions once the pipeline remains stable.
