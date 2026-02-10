# Model Detail Data Requirements (v4)

This document defines **MUST/SHOULD** requirements for the model detail payload
so reviewers can verify PRs consistently.

## Status Vocabulary (MUST)
Allowed status values:
- ok
- not_found
- blocked
- rate_limited
- ambiguous
- invalid
- missing_source_link
- missing

No other values are allowed in UI output.

---

## Evidence (MUST)
Evidence types are fixed:
- official_page
- dev_activity
- paper
- audit

Each evidence entry MUST include:
- type (one of the fixed types)
- status (allowed status vocabulary)
- reasons: string[] (non-empty; prefer reason codes)
- label: string (optional)
- url: string (optional)
- refs: string[] (optional)

Rules:
- If status is **ok**, at least one of `url` or `refs[]` MUST provide a real URL (not "missing:*").
- If neither url nor refs include a URL, status MUST NOT be ok.

---

## Raw Inputs (MUST)
Sources are fixed:
- openrouter
- huggingface
- github
- arxiv
- ops

Payload MUST provide `rawInputsBySource` keys for all sources (empty objects allowed),
and UI MUST show missing explicitly.

---

## Breakdown (MUST)
For each item:
- key/id/label
- score (number|null)
- status
- why (short string)
- evidenceUrls (string[]; may be empty)
- usedEvidence (optional) links if available
- flags: `specMissingEvidence` / `missingEvidenceRule` when applicable

---

## Links (SHOULD, but target is MUST eventually)
Links SHOULD be the union of:
- evidence.url
- evidence.refs
- breakdown.evidenceUrls
- breakdown.usedEvidence[].link
- references[].urls
- URL-like strings in rawInputsBySource (best-effort)

Links MUST be:
- unique (dedup)
- stable order (optional but recommended)
