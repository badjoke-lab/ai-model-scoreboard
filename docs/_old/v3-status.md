# aims-v3 status

- Live data only: leaderboard pulls Hugging Face downloads/likes/lastModified on every request.
- Deterministic scoring: min–max normalization with fixed weights (adoption 45%, ecosystem 35%, velocity 20%).
- Resilience: three-attempt retry plus a 5-minute in-memory cache to keep refreshes stable on Vercel.
- Legacy v1/v2 assets removed to avoid mixed data paths (app/v2 routes, v1 leaderboard components, static data JSON, and exec plan docs).
