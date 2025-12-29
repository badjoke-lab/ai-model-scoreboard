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

### `public/data/v4/rankings.json`

Array of leaderboard entries.

**Required keys per entry**
- `model` (string, model slug)
- `vendor` (string)
- `layer` (string, one of `full`, `provisional`, `rejected`, `not-listed`)
- `score` (number)
- `scores` (object)
  - `performance` (number)
  - `safety` (number)
  - `adoption` (number)
  - `openness` (number)
  - `cost` (number)
- `updatedAt` (ISO 8601 timestamp string)

**Ordering**
- Sorted by `score` descending.
- Tie-breaker: `model` slug ascending (lexicographic).

### `public/data/v4/models.json`

Object map keyed by model slug.

**Required keys per entry**
- `name` (string, non-empty)
- `vendor` (string, non-empty)

**Ordering**
- Not applicable (object map). The contract does not require a key order.

### `public/data/v4/not-listed.json`

Array of model slugs that are not listed.

**Required keys per entry**
- Each entry is a non-empty string.

**Ordering**
- Sorted ascending by model slug.
- No duplicates.

## Breaking vs. Non-breaking changes

**Breaking changes (not allowed without a version bump)**
- Removing or renaming any required key.
- Changing a required key's type.
- Changing the `index.json` structure away from `meta`.
- Changing the allowed `layer` values.
- Changing ordering guarantees for `rankings.json` or `not-listed.json`.

**Non-breaking changes (allowed)**
- Adding optional keys to `meta`, ranking entries, or model metadata.
- Adding new model entries or ranking rows that respect the ordering rule.
- Increasing counts to match new data, as long as types and required keys remain intact.
