# AMS v4 Spec — Section 4: Enrichment (evidence) — always attempt, never unknown

## 1. Evidence types (fixed set)
For every adopted + provisional model, generate exactly these 4 evidence items:
1) official_page
2) dev_activity
3) paper
4) audit

## 2. Status codes (exclusive)
- ok
- not_found
- ambiguous
- rate_limited
- blocked
- invalid
- missing_source_link

"unknown" is forbidden.

## 3. “Always attempt” definition
Even if we do not have a link to query, we MUST output an evidence item with:
status = missing_source_link
reasons = ["no_canonical_link_in_intake"] (example)
refs = [] (or provider landing if known)

This counts as an attempted enrichment outcome.

## 4. Deterministic source policy (no free scraping)
Evidence collection MUST rely on deterministic inputs:
- intake-provided URLs/ids
- curated provider landing URLs map (static map in code/config)
- deterministic endpoints only (e.g., GitHub API for dev_activity when repo URL is known)

No uncontrolled web scraping.

## 5. Evidence logic per type

### 5.1 official_page
- If intake provides a canonical URL => validate URL => ok
- Else if provider landing exists in curated map => set ref=landing and status=not_found (unless a deterministic mapping finds a page)
- Else missing_source_link

### 5.2 dev_activity
- Only ok when an official repository URL exists (from seed or deterministic mapping).
- Use GitHub API (or equivalent deterministic API).
- Extract:
  - repoUrl
  - latestCommitAt
  - commits90d
  - release180d (boolean)
- If no repoUrl => missing_source_link or not_found (depending on whether mapping was attempted)

### 5.3 paper
- Only ok when a deterministic paper identifier exists (arXiv id / DOI) in seed/mapping.
- If none => missing_source_link or not_found
- If multiple conflicting candidates => ambiguous
- Extract:
  - hits
  - top[] (title, url, year, venue)

### 5.4 audit
- Only ok when a deterministic audit/security report link exists in seed/mapping.
- If none => not_found (treat as “no public audit evidence”)
- Extract:
  - reports[] (name, url, date, scope)

## 6. Rate limiting / blocked
If API returns 429 => rate_limited
If 403/robot => blocked
If response schema invalid => invalid
Always put error hint in reasons[] (e.g., "http_429", "http_403", "json_parse_error")

## 7. Output requirement
For each modelKey:
- evidence/{modelKey}.json MUST exist
- evidenceItems MUST have 4 entries (types fixed)
- each entry MUST include status + reasons[] (non-empty)
