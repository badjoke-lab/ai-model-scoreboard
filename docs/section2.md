# AMS v4 Spec — Section 2: Output files & stable schema contract

## 1. v4 public data folder (UI contract)
UI reads ONLY from:
`public/data/v4/`

The generator (private-engine) MUST output:
- index.json
- adoption.json
- decisions.json
- models.json
- rankings.json
- not-listed.json
- evidence/index.json
- evidence/{modelKey}.json (for every adopted+provisional modelKey; and optionally for denied models)

## 2. index.json (meta-based manifest) — REQUIRED
Purpose: make UI deterministic and decoupled from filenames drift.

Shape (stable):
{
  "meta": {
    "schemaVersion": "v4",
    "generatedAt": "ISO-8601",
    "source": { "openrouter": true, "seed": true|false },
    "counts": {
      "intake": number,
      "adopted": number,
      "provisional": number,
      "denied": number
    }
  },
  "files": {
    "adoption": "adoption.json",
    "decisions": "decisions.json",
    "models": "models.json",
    "rankings": "rankings.json",
    "notListed": "not-listed.json",
    "evidenceIndex": "evidence/index.json"
  }
}

## 3. adoption.json — REQUIRED
Purpose: adopted/provisional lists for UI and scoring loops.
Must include:
{
  "meta": { "generatedAt": "...", "rulesHash": "..." },
  "adopted": [ { "modelKey": "...", "source": "openrouter|seed", "rawRef": {...} } ],
  "provisional": [ { "modelKey": "...", "source": "...", "rawRef": {...}, "missing": ["fieldA", ...] } ]
}

## 4. decisions.json — REQUIRED
Purpose: machine-auditable “why status”.
Must include:
{
  "meta": { "generatedAt": "...", "rulesSummary": {...}, "rulesHash": "..." },
  "items": [
    {
      "modelKey": "...",
      "status": "adopted|provisional|denied",
      "source": "openrouter|seed",
      "rawRef": { "id": "...", "canonicalSlug": "..." },
      "normalized": { "name": "...", "provider": "...", "slug": "..." },
      "reasons": ["..."] 
    }
  ]
}

## 5. evidence/index.json — REQUIRED
Purpose: list evidence coverage and paths.
{
  "meta": { "generatedAt": "...", "types": ["official_page","dev_activity","paper","audit"] },
  "models": [
    { "modelKey": "...", "path": "evidence/<modelKey>.json" }
  ]
}

## 6. evidence/{modelKey}.json — REQUIRED
Purpose: store enrichment attempt outcomes (no unknown).
{
  "meta": { "generatedAt": "...", "modelKey": "..." },
  "evidenceItems": [
    {
      "type": "official_page|dev_activity|paper|audit",
      "status": "ok|not_found|ambiguous|rate_limited|blocked|invalid|missing_source_link",
      "reasons": ["..."],
      "refs": ["https://...", "..."],
      "extracted": { ... } 
    }
  ]
}

## 7. models.json — REQUIRED
Purpose: per-model absolute metrics + all scoring item results + references.

Top-level must be:
{
  "meta": { "generatedAt": "...", "schemaVersion":"v4" },
  "models": {
     "<modelKey>": {
        "identity": {...},
        "absolute": {...},
        "status": {...},
        "scores": {
          "items": { "<itemKey>": { "score":0-100, "inputs":{...}, "refs":{...} } },
          "categories": { "<categoryKey>": 0-100 },
          "overall": 0-100
        }
     }
  }
}

## 8. rankings.json — REQUIRED
Purpose: sorted list used by /v4 list.
{
  "meta": { "generatedAt":"...", "sort":"overall_desc_then_key" },
  "rows": [
    { "rank":1, "modelKey":"...", "name":"...", "provider":"...", "status":"...", "overall": 0-100, "categories": {...}, "evidenceOkCount": 0-4 }
  ]
}

## 9. not-listed.json — REQUIRED
Purpose: denied models with reasons (traceability).
{
  "meta": { "generatedAt":"..." },
  "denied": [
    { "modelKey":"...", "name":"...", "provider":"...", "reasons":["..."] }
  ]
}

## 10. Stability rule
Once published, the above shapes are treated as public contract.
Breaking changes require schemaVersion bump (NOT allowed in v4 tasks).
