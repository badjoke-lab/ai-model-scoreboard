# AMS v4 Output JSON Mapping (Internal)

This document maps the public v4 snapshot JSON files to their schema, required keys, and semantic meaning. It is intended
for internal verification and downstream tooling.

## index.json

**Location**: `public/data/v4/index.json`

```json
{
  "meta": {
    "version": "v4",
    "updatedAt": "2025-12-30T03:46:14.945Z",
    "modelsCount": 2,
    "fullCount": 1,
    "provisionalCount": 1,
    "notListedCount": 1
  }
}
```

**Keys**
- `meta.version` (string, required): must be `"v4"`.
- `meta.updatedAt` (string, required): ISO-8601 timestamp for the snapshot build.
- `meta.modelsCount` (int, required): number of entries in `rankings.json`.
- `meta.fullCount` (int, required): count of `rankings[].layer === "full"`.
- `meta.provisionalCount` (int, required): count of `rankings[].layer === "provisional"`.
- `meta.notListedCount` (int, required): number of entries in `not-listed.json`.

## rankings.json

**Location**: `public/data/v4/rankings.json`

**Shape**: Array of ranking rows, sorted by `score` descending then `model` ascending.

**Required fields per entry**
- `model` (string): model slug (must exist in `models.json`).
- `vendor` (string): normalized vendor name (must match `models.json[model].vendor`).
- `layer` (string): `full` or `provisional` (other layers are not emitted here).
- `score` (number): total score (0–100 for full models; `0` for provisional).
- `scores` (object): category subscores (all required keys listed below).
- `updatedAt` (string): ISO-8601 snapshot timestamp.

**scores object keys (all required)**
- `performance` (number, 0–100)
- `safety` (number, 0–100)
- `adoption` (number, 0–100)
- `openness` (number, 0–100)
- `cost` (number, 0–100)

## models.json

**Location**: `public/data/v4/models.json`

**Shape**: Object map of `slug -> metadata`, sorted by slug ascending.

**Required keys per model**
- `name` (string): display name.
- `vendor` (string): normalized vendor name.

**Normalization guarantees**
- Slugs are lowercased and whitespace-normalized.
- Vendor is lowercased; missing vendors default to `"unknown"`.

## not-listed.json

**Location**: `public/data/v4/not-listed.json`

**Shape**: Array of model slugs that are not listed.

**Required fields**
- Each entry is a non-empty string slug.
- Sorted ascending; no duplicates.

**Notes**
- `not-listed.json` contains only slugs. Internal decision `reason`/`source` fields are not exposed in the public output.

## Field glossary

- **layer**: Listing status for a model.
  - `full`: listed with a computed score.
  - `provisional`: listed but missing required inputs; scores are zeroed.
  - `not-listed`: excluded from rankings; appears only in `not-listed.json`.
  - `deny`: excluded from rankings and not-listed output; still present in `models.json` metadata.
- **score**: Total weighted score across categories (0–100). Meaningful only for `full`.
- **scores.performance|safety|adoption|openness|cost**: Category subscores (0–100 each).
- **updatedAt**: Snapshot build timestamp; identical across files for a single snapshot.
