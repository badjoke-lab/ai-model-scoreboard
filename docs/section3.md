# AMS v4 Spec — Section 3: Intake, normalization, modelKey, adoption rules

## 1. Intake source
Primary: OpenRouter models endpoint.
Secondary: local seed JSON (optional; MUST NOT be required for growth).

## 2. Canonical identity fields (intake -> normalized)
From OpenRouter, attempt to extract:
- id
- canonical_slug (preferred)
- name
- created
- context_length
- pricing (input/output)
- modalities (in/out if available)
- tool/function calling support if available
- structured output support if available
- top_provider / provider hints if available

## 3. modelKey definition (deterministic)
modelKey MUST be stable and derived from normalized canonical identifier:
- prefer canonical_slug if exists and non-empty
- else fallback to id
Normalize:
- lowercase
- trim
- spaces => "-"
- remove illegal chars (keep [a-z0-9._-])
- collapse repeated separators

## 4. Dedupe rule
Deduplicate by modelKey.
If multiple candidates:
- keep the record with the most filled absolute metrics fields
- tie-break by latest created, then lexical id

## 5. Adoption statuses
Statuses:
- adopted: included in rankings and detail pages
- provisional: included in detail pages and rankings (with flag), but may rank lower due to missing required absolute metrics/evidence penalties
- denied: excluded from rankings by default, but listed in not-listed with reasons

## 6. allowlist/denylist rules
- denylist: hard deny with explicit reason string
- allowlist: force adopt even if some fields missing (still subject to evidence/scoring penalties if missing)

Rules output MUST be fully logged into decisions.json.

## 7. Minimal required absolute metrics for adoption vs provisional
Define minimal set:
- name
- provider (or derivable provider label)
- context_length
- pricing.input
- pricing.output

If missing any -> provisional with reasons listing missing fields.

## 8. Seed behavior (non-required)
Seed is allowed for:
- bootstrapping provider label mapping
- adding models absent from OpenRouter
BUT the system MUST still grow from OpenRouter alone.

If a model exists in both seed and OpenRouter:
- merge fields (OpenRouter wins for raw catalog metrics; seed may supply missing provider label).
