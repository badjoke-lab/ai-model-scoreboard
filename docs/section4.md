# 🟥 AI Model Scoreboard v4 – Internal Specification (English)

## Section 4 – Data collection and snapshot pipeline

### Purpose
Define how AMS gathers data, discovers new models, and writes daily snapshots that reflect the state of the ecosystem.

### Principles
1. Prefer official vendor sources for accuracy.
2. Use third-party benchmarks as supporting evidence.
3. Ignore rumors, social media, and unverifiable blogs.
4. Mark missing data as "not captured" instead of treating it as zero.
5. Keep the expected schema fixed so changes are detectable.

### Core metadata schema (per model)
- `model_name`, `vendor`, `family`, `description`
- `updatedAt`, version, and release notes
- Capability signals (context length, modalities, safety notes)
- Pricing (per 1K tokens) when public
- Benchmark results grouped by scoring family
- Incident log and source links

### Discovery and refresh
- Crawl vendor model lists, public marketplaces, and curated sources daily.
- Normalize naming to a canonical form before matching against existing entries.
- Create new entries as Provisional when only partial data is available.

### Snapshot process
1. Fetch raw data and store it with timestamps.
2. Normalize and validate the schema.
3. Write `public/data/v4/index.json`, `rankings.json`, `models.json`, and `not-listed.json` for the UI.
4. Keep history files for auditing while ensuring the UI only reads the finalized snapshot directory.

### Handling gaps
- If fetching fails, reuse the previous raw snapshot to avoid service disruption.
- Mark uncertain data so downstream scoring can lower confidence rather than invent numbers.
