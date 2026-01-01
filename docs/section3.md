# AMS v4 — Output Files & Schema Lock (No Breaking Changes)

## 0. Golden Rule
`public/data/v4/` is **schema-locked**.  
Breaking changes are forbidden unless a new version folder is created (`v5/` etc.).

---

## 1. Manifest (index.json)
Path:
- `public/data/v4/index.json`

Purpose:
- Single source of truth for UI to discover current data files.

Required shape:
- `meta.updatedAt` (ISO string)
- `meta.version` = `"v4"`
- `meta.source` (e.g., `"private-engine"`)
- `files` object with fixed keys and relative paths:
  - `adoption`
  - `decisions`
  - `models`
  - `rankings`
  - `notListed`
  - `evidenceIndex`
  - `evidenceDir` (folder path)

Example:
```json
{
  "meta": { "version":"v4", "updatedAt":"2026-01-02T06:00:00Z", "source":"private-engine" },
  "files": {
    "adoption":"adoption.json",
    "decisions":"decisions.json",
    "models":"models.json",
    "rankings":"rankings.json",
    "notListed":"not-listed.json",
    "evidenceIndex":"evidence/index.json",
    "evidenceDir":"evidence/"
  }
}
````

---

## 2. Adoption (adoption.json)

Path:

* `public/data/v4/adoption.json`

Required:

* `meta.updatedAt`
* `adopted[]` list of modelKeys
* `provisional[]` list of modelKeys

Stability rules:

* modelKey stable
* ordering deterministic (sorted)

---

## 3. Decisions (decisions.json)

Path:

* `public/data/v4/decisions.json`

Required:

* `meta.updatedAt`
* `rules` summary (allowlist/denylist versions or hashes)
* `entries[]` array:

  * `modelKey`
  * `source` (`openrouter|seed`)
  * `status` (`adopted|provisional|denied`)
  * `reasons[]` (non-empty)
  * `rawRef` (id/canonical_slug)
  * `normalized` fields (name/provider/slug)

Stability rules:

* reasons[] must exist always
* no unknown statuses

---

## 4. Evidence Index (evidence/index.json)

Path:

* `public/data/v4/evidence/index.json`

Required:

* `meta.updatedAt`
* `models[]` list:

  * `modelKey`
  * `path` = `evidence/{modelKey}.json`

Deterministic ordering:

* sorted by modelKey.

---

## 5. Evidence Per Model (evidence/{modelKey}.json)

Path:

* `public/data/v4/evidence/{modelKey}.json`

Required:

* `meta.updatedAt`
* `meta.modelKey`
* `evidenceItems[]` with exactly these types (fixed set):

  * `official_page`
  * `dev_activity`
  * `paper`
  * `audit`

Each evidence item REQUIRED:

* `type`
* `status` in:

  * `ok | not_found | rate_limited | blocked | ambiguous | invalid | missing_source_link`
* `reasons[]` (non-empty, always)
* `refs[]` (may be empty)
* `extracted` (object; may be empty; must exist when status=ok)

Forbidden:

* `unknown` anywhere as final state.

---

## 6. Models (models.json)

Path:

* `public/data/v4/models.json`

Required:

* `meta.updatedAt`
* `models[]` array, each entry:

  * Identity:

    * `modelKey`
    * `name`
    * `provider`
    * `canonicalSlug` (nullable but explicit)
    * `sourceRef` (raw id)
    * `status` (`adopted|provisional|denied`)
  * Absolute metrics (“spec”):

    * `contextLength` (number or null with reason recorded elsewhere)
    * `maxOutputTokens` (number or null)
    * `pricing` (input/output; number or null)
    * `modalities` flags
    * `supportsTools` boolean
    * `supportsJson` boolean
    * optional: `rateLimits` if available
  * Scoring:

    * `overall` 0–100
    * `categoryTotals` (fixed categories from section6)
    * `items` map (every scoring item id → object)

      * `score` 0–100
      * `inputs` raw values used
      * `usedEvidence` (type + status)
      * `penaltyReasons[]` reason codes used (can be empty if ok)

Stability:

* item list must be complete for all models
* deterministic ordering (by modelKey or by overall then modelKey; choose one and fix)

---

## 7. Rankings (rankings.json)

Path:

* `public/data/v4/rankings.json`

Required:

* `meta.updatedAt`
* `rankings[]` entries:

  * `rank`
  * `modelKey`
  * `name`
  * `provider`
  * `status`
  * `overall`
  * `categoryTotals`

Sorted:

* by overall desc then modelKey asc.

---

## 8. Not Listed (not-listed.json)

Path:

* `public/data/v4/not-listed.json`

Required:

* `meta.updatedAt`
* `denied[]` entries:

  * `modelKey`
  * `name` (if known)
  * `provider` (if known)
  * `reasons[]` (non-empty)
  * `rawRef`

---

## 9. Validator Requirements

Validator must:

* validate presence and type of required keys
* validate enumerations (status codes)
* validate reasons[] non-empty
* validate evidence item set includes the 4 types (exact set)
* fail with file + json path
