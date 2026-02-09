# Overrides Policy (v4)

This policy defines the only safe way to add/modify v4 overrides.
Follow this document exactly. No guessing. No “looks ok”.

---

## 1) Location and filename rules (strict)

Overrides live ONLY here:

- `overrides/v4/models/<modelKey>.json`

`<modelKey>` MUST be the URL-encoded model key, and it MUST match the JSON field `modelKey` exactly.

**Invalid (rejected) examples**
- filename and `modelKey` differ
- non-URL-encoded filename
- extra suffixes like `_v2`, `-override`, etc.

---

## 2) What you are allowed to override (only these)

An override JSON may contain ONLY these top-level keys:

- `modelKey` (required)
- `evidence` (optional)
- `rawInputsBySource` (optional)
- `links` (optional)

Anything else is forbidden.

---

## 3) Evidence schema (strict)

`evidence` is an array of items. Each item MUST follow this schema.

### 3.1 Required fields
- `type`: `"official_page" | "dev_activity" | "paper" | "audit"`
- `status`: `"ok" | "not_found" | "blocked" | "rate_limited" | "ambiguous" | "invalid" | "missing_source_link"`

### 3.2 Optional fields (allowed ONLY if needed)
- `label` (string)
- `url` (string)
- `refs` (string[])
- `reasons` (string[])

No other fields are allowed.

### 3.3 Mandatory rules for `status="ok"`
When `status` is `ok`, ALL of the following are required:
- `label` MUST exist and be non-empty
- at least one of `url` or `refs[0]` MUST exist and be a valid full URL
- `reasons` MUST include `"manual_override"` (example: `["manual_override"]`)

### 3.4 Mandatory rules for `status!="ok"`
When `status` is NOT `ok`:
- `reasons` MUST exist and MUST NOT be an empty array
- `url` and `refs` are optional (may be omitted)

---

## 4) Links rules (strict)

- `links` MUST be an array of full URLs (strings).
- Only real, clickable reference URLs are allowed.
- Do not add “guessed” URLs.
- Duplicates are allowed (dedup happens later), but avoid obvious duplicates when adding.

---

## 5) rawInputsBySource rules (strict)

Allowed source keys are ONLY these five (no exceptions):

- `openrouter`
- `huggingface`
- `github`
- `arxiv`
- `ops`

For each source block:
- values MUST be primitives (`string|number|boolean|null`) OR a MissingInfo object.

MissingInfo MUST be shaped like:
- `{ "value": null, "status": "<status>", "reasons": ["..."], "refs": ["..."]? }`

Forbidden:
- deep nested objects
- unknown source keys
- random structural blobs

---

## 6) Hard prohibitions (auto-reject)

- Setting `status="ok"` based on speculation (auto-reject)
- Marking `audit` as `ok` unless it is a verifiable third-party audit primary source URL (auto-reject)
- Using blogs/press releases/roundups as `audit ok` (auto-reject)
- `modelKey` mismatch between filename and JSON (auto-reject)
- `type` outside the 4 allowed types (auto-reject)
- `status` outside the allowed list (auto-reject)

---

## 7) PR review checklist (required)

For EACH override JSON added/edited:

### A) Identity
- [ ] filename `<modelKey>.json` matches JSON `modelKey` exactly (URL-encoded)

### B) Evidence validity
- [ ] all modified evidence items use allowed `type` and `status`
- [ ] for any `status="ok"`: `label` exists, `url` or `refs[0]` exists, and `reasons` includes `"manual_override"`
- [ ] if `audit` is `ok`: it is a third-party audit primary source URL (not a blog/press/summary)

### C) Links validity
- [ ] links are full URLs and clickable references only
- [ ] no obvious junk URLs

### D) Raw inputs
- [ ] rawInputsBySource keys are only the allowed five
- [ ] values are primitives or MissingInfo only (no deep nesting)

---

## 8) Update procedure (GitHub UI)

- Add: create `overrides/v4/models/<modelKey>.json`
- Edit: update the existing file only
- PR description MUST include:
  - model key
  - what was added/changed (evidence / links / raw)
  - if audit is `ok`, include why (third-party URL)
