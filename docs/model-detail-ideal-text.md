# Ideal Model Detail Output (Text Equivalent)

This document defines the **text-equivalent** of the ideal model detail page.
It is the **source of truth** for what the UI/API must support.

## Scope
- This is not UI styling.
- This is the **required content structure** and minimum wording rules.
- When the UI changes, this spec stays stable.

---

## MUST: Sections (in order)

1) **Identity**
- Provider
- Display name
- Model key (canonical)
- UpdatedAt (date string)

2) **Scores**
- Overall score (0-100)
- Category scores (0-100 each)
- Adoption status (e.g. adopted/experimental/unknown) + decision reasons (short)

3) **Evidence (4 types fixed)**
Types (fixed):
- official_page
- dev_activity
- paper
- audit

Each evidence block MUST include:
- type
- status: ok / not_found / blocked / rate_limited / ambiguous / invalid / missing_source_link / missing
- reasons: non-empty list of reason codes
- url OR refs (at least one should exist; if none, status must NOT be ok)
- label (optional but recommended)

4) **Raw Inputs (by source, fixed list)**
Fixed sources:
- openrouter
- huggingface
- github
- arxiv
- ops

Each source MUST include:
- status (same status vocabulary)
- reasons (non-empty)
- key-value list (may be empty when missing)

5) **Full Breakdown**
For each scoring item:
- key/id/label
- score (number or null)
- status (WITHHELD/ok/etc as used by the system)
- why (one line)
- evidenceUrls (list) OR explicit missing explanation
- flags: withheld / specMissingEvidence (when applicable)

6) **Conclusion**
- 2-5 short bullets summarizing why the score is high/low
- MUST mention missing evidence/inputs if they contributed

7) **Links**
- A deduped list of URLs that appear anywhere in the page data:
  - evidence url/refs
  - breakdown evidenceUrls / usedEvidence links
  - references section urls
  - rawInputsBySource URL-like strings (best-effort)

---

## SHOULD: Quality Rules
- Prefer reason **codes** over free text
- Do not silently drop missing data; show missing explicitly
- Avoid long paragraphs; keep lines short and scannable

---

## Example Output (illustrative)

### Identity
Provider: openai  
Name: OpenAI: GPT-5 Codex  
ModelKey: openai/gpt-5-codex  
UpdatedAt: 2026-01-30

### Scores
Overall: 80.02  
Performance: 81.46 | Safety: 75.00 | Adoption: 74.57 | Openness: 75.00 | Cost: 100.00  
Adoption: adopted (reasons: meets_required_fields)

### Evidence
- official_page: ok  
  reasons: [provider_fallback, openrouter_model_page]  
  url: https://openai.com  
  refs: https://openrouter.ai/models/openai/gpt-5-codex
- dev_activity: missing_source_link  
  reasons: [missing_source_link, repo_link_missing]  
  refs: missing:github_repo
- paper: not_found  
  reasons: [no_known_paper_source, not_found]  
  refs: arxiv_query:"OpenAI: GPT-5 Codex"
- audit: missing_source_link  
  reasons: [missing_source_link, no_known_audit_source]  
  refs: missing:audit_link

### Raw Inputs
- openrouter: ok (reasons: [ok])  
  context_length: 400000  
  pricing_input_per_1m: 0.00000125  
  pricing_output_per_1m: 0.00001
- huggingface: missing (reasons: [missing])  
  (no fields)
- github: missing (reasons: [missing])  
  (no fields)
- arxiv: missing (reasons: [missing])  
  (no fields)
- ops: ok (reasons: [ok])  
  (fields...)

### Full Breakdown (sample)
- Q1 General benchmarks: WITHHELD  
  why: missing evidence (official_page only)  
  usedEvidence: https://openai.com, https://openrouter.ai/models/openai/gpt-5-codex

### Conclusion
- Score is withheld for multiple items due to missing official evidence links.
- Transparency is capped because paper/audit sources are not confirmed.
- Inputs exist for pricing/context, but supporting sources are incomplete.

### Links
- https://openai.com
- https://openrouter.ai/models/openai/gpt-5-codex
