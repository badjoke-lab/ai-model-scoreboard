# Launch Notes (v3.1)

## What’s new
- Polished homepage layout with clearer snapshot age indicators and improved spacing across cards and table rows.
- Lightweight loading skeletons to stabilize perceived performance while snapshots build.
- Footer refresh with consistent typography and a placeholder Donate / Support anchor.
- Added short revalidation to homepage data requests to reduce Hugging Face API pressure.
- New public documentation outlining the pipeline, endpoints, and soft launch caveats.

## Known limitations
- Snapshot covers a curated subset of Hugging Face repositories; it is not an exhaustive leaderboard.
- Snapshot age depends on cache health. Extended upstream outages may yield stale data until the cache refreshes successfully.
- Scores rely solely on downloads, likes, and recency; qualitative factors are out of scope for this release.

## Soft launch notes
- Public endpoints remain read-only. No write operations or authenticated features are shipped in v3.1.
- Cron and API shapes are unchanged to avoid breaking consumers of v3.0.
- Expect minor visual tweaks as we collect feedback; core data and scoring will remain stable.
