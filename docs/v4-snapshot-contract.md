# v4 Snapshot Contract (Locked)

This document is the single source of truth for the v4 snapshot schema consumed by the UI and validator.

## Files

### `public/data/v4/index.json`

```json
{
  "meta": {
    "version": "v4",
    "updatedAt": "2025-12-23T11:31:47.716Z",
    "modelsCount": 5,
    "fullCount": 0,
    "provisionalCount": 5,
    "notListedCount": 0
  }
}
```

**Required keys**
- `meta` (object)
  - `version` (string, must be `"v4"`)
  - `updatedAt` (ISO 8601 timestamp string)
  - `modelsCount` (number, non-negative)
  - `fullCount` (number, non-negative)
  - `provisionalCount` (number, non-negative)
  - `notListedCount` (number, non-negative)

**Ordering**
- Not applicable (object map). The contract does not require a key order.

**Cross-file requirements**
- `modelsCount` must equal `rankings.json.length`.
- `fullCount` must equal the number of `rankings.json` entries with `layer: "full"`.
- `provisionalCount` must equal the number of `rankings.json` entries with `layer: "provisional"`.
- `notListedCount` must equal `not-listed.json.length`.

### `public/data/v4/rankings.json`

Array of leaderboard entries.

**Required keys per entry**
- `model` (string, non-empty model slug)
- `vendor` (string, non-empty)
- `layer` (string, one of `full`, `provisional`, `rejected`, `not-listed`)
- `score` (number, finite)
- `scores` (object)
  - `performance` (number, finite)
  - `safety` (number, finite)
  - `adoption` (number, finite)
  - `openness` (number, finite)
  - `cost` (number, finite)
- `updatedAt` (ISO 8601 timestamp string)

**Ordering**
- Sorted by `score` descending.
- Tie-breaker: `model` slug ascending (lexicographic).
- No duplicate `model` slugs.

### `public/data/v4/models.json`

Object map keyed by model slug.

**Required keys per entry**
- `name` (string, non-empty)
- `vendor` (string, non-empty)

**Cross-file requirements**
- Every `rankings.json[*].model` slug must exist as a key in `models.json`.
- For any shared slug, `rankings.json[*].vendor` must equal `models.json[slug].vendor`.

**Ordering**
- Keys must be sorted ascending by model slug (lexicographic). This makes the JSON stable for diffs.

### `public/data/v4/not-listed.json`

Array of model slugs that are not listed.

**Required keys per entry**
- Each entry is a non-empty string.

**Ordering**
- Sorted ascending by model slug.
- No duplicates.
- Entries must not overlap with any `rankings.json[*].model` slug.

## Compatibility Policy (Breaking vs. Non-breaking changes)

**Breaking changes (not allowed without a version bump)**
- Removing or renaming any required key.
- Changing a required key's type.
- Changing the `index.json` structure away from `meta`.
- Changing the allowed `layer` values.
- Changing ordering guarantees for `rankings.json`, `models.json`, or `not-listed.json` (including tie-breakers).
- Allowing duplicate model slugs in any of the files (including `rankings.json` and `not-listed.json`).
- Skipping or bypassing the required-key validation for `rankings.json`, `models.json`, or `not-listed.json`.
- Removing the cross-file requirements between `rankings.json` and `models.json`.

**Non-breaking changes (allowed)**
- Adding optional keys to `meta`, ranking entries, or model metadata.
- Adding new model entries or ranking rows that respect the ordering rule.
- Increasing counts to match new data, as long as types and required keys remain intact.
