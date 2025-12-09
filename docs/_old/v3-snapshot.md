# v3 Snapshot Pipeline

The v3 snapshot pipeline keeps the leaderboard consistent while minimizing Hugging Face API calls and exposing the freshness of the data.

## Data flow
1. **Model sources**: A curated list of repositories (see `MODEL_SOURCES` in `lib/v3/snapshot.ts`) defines the scope.
2. **Fetching**: Each source is requested from the Hugging Face models API with retry logic. Individual failures are captured per model so one outage does not break the set.
3. **Normalization**: Metadata (`downloads`, `likes`, `lastModified`) is normalized into a stable shape. Missing or malformed values are defaulted to safe fallbacks.
4. **Scoring**: Adoption, ecosystem, and velocity scores are scaled relative to cohort ranges, then weighted by fixed ratios to produce a total score.
5. **Caching**: The snapshot object is cached in memory with a short TTL. Reuse protects the upstream API and keeps snapshot age predictable.

## Caching & revalidation
- **In-memory cache**: Snapshot results live in memory for a small TTL. Successful fetches refresh the cache; failures fall back to the latest good snapshot when possible.
- **Route revalidation**: The homepage requests use a `revalidate` window so the rendered leaderboard reuses cached data for up to a minute before triggering a rebuild.
- **Retry protection**: Fetch requests include limited retry with backoff to smooth transient errors without prolonging stale data.

## Health badge
- `/api/health` reports the global status (`ok`, `degraded`, `failed`) plus component breakdowns for fetch, cache, and scoring.
- The payload includes `snapshot.ageSeconds`, which drives the UI badge and alerts if the snapshot exceeds the staleness threshold.

## Snapshot age handling
- Snapshot age is derived from the cache timestamp and exposed both in the health payload and in the homepage header.
- Ages under a minute render as “Just now,” then roll up to minutes, hours, and days for clarity.
- The UI surfaces the age in two places: a header badge and within the “Live snapshot” section, improving visibility on mobile and desktop.
