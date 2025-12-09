# AI Model Scoreboard

AI Model Scoreboard (AIMS) surfaces near-real-time signals about widely used open models on Hugging Face. The v3 release focuses on a lightweight, server-rendered leaderboard that favors freshness and transparency while keeping the Hugging Face API footprint minimal.

## Architecture overview
- **Framework**: Next.js 14 app router with server components for the leaderboard and model details.
- **Data plane**: A lightweight fetcher that polls a curated set of Hugging Face repositories, normalizes metadata, and caches the computed snapshot in memory.
- **Scoring**: Three weighted dimensions (adoption, ecosystem, velocity) derived from downloads, likes, and recency. Weights are fixed in code for predictability.
- **Caching**: In-memory cache backs the snapshot builder; the homepage adds a short revalidation window to further reduce upstream calls.
- **Health**: `/api/health` exposes component-level status plus snapshot age, and the UI renders the badge for quick validation.

## v3 snapshot pipeline overview
1. **Source selection**: A small, curated list of Hugging Face repositories is defined in `lib/v3/snapshot.ts`.
2. **Fetch & normalize**: The app retrieves model metadata (`downloads`, `likes`, `lastModified`) and normalizes it into a uniform shape, handling errors per model.
3. **Scoring**: Adoption, ecosystem, and velocity scores are scaled relative to the cohort ranges and combined using fixed weights. Total score sorts the leaderboard.
4. **Snapshot cache**: The computed snapshot is cached in memory. Subsequent requests reuse it until the TTL expires or a rebuild is triggered by cache miss.
5. **Presentation**: The homepage and model detail pages render the cached snapshot. Health reporting shares the snapshot age to verify staleness thresholds.

## Future plans (v4 draft)
These documents outline non-binding v4 planning artifacts and may change before implementation:
- [V4 roadmap](future/roadmap-v4.md)
- [V4 technical spec](future/spec-v4.md)
- [V4 task queue](future/tasks-v4.md)
