# AMS v4 — Evidence UI Spec (Display + Interaction)

## 0. Placement
On `/models/[modelKey]`, Evidence section appears **before** the full score breakdown:
- Evidence is the “why” that justifies scoring.

---

## 1. Summary UI: 4 Tiles (Fixed)
Render exactly 4 tiles (cards), one per evidence type:
1) Official page
2) Dev activity
3) Paper
4) Audit

Each tile MUST show:
- Title (type)
- Status badge (enum)
- UpdatedAt (from evidence meta)
- One-line summary:
  - If ok: “Found X” (e.g., repo link, number of papers)
  - Else: “Reason: <top reason>”

Badge values:
- `ok`
- `not_found`
- `missing_source_link`
- `rate_limited`
- `blocked`
- `ambiguous`
- `invalid`

---

## 2. Expand Interaction (Tile → Details)
Clicking a tile expands details (accordion or inline panel).

Expanded panel MUST show:
- `type`
- `status`
- `reasons[]` as bullet list (non-empty)
- `refs[]` as clickable links (may be empty)
- `extracted` as key-value table when status=ok

Type-specific extracted display guidelines:
- official_page:
  - url, title/providerName if available
- dev_activity:
  - repoUrl, latestCommitAt, commits30d/90d, releaseTag if available
- paper:
  - hits count + top[] list (title/url/year)
- audit:
  - reports[] list (name/url/date/scope)

---

## 3. References Block (Deduped)
At the end of Evidence section, render “References”:
- Collect all refs from all evidence items
- Deduplicate
- Display as simple list of links

---

## 4. Empty/Missing Rules (Strict)
Forbidden states (treat as bug):
- evidenceItems missing
- evidenceItems does not include all 4 types
- status not in enum
- reasons[] missing or empty
- “unknown” as final state anywhere

Allowed:
- refs[] empty (only if reasons explain why)
- extracted empty when status != ok

---

## 5. Evidence ↔ Scoring Link Display
In Score Breakdown (section4 Block D):
- Each scoring item row MUST show:
  - “Used evidence: <type>(<status>)”
- If a penalty applied due to evidence status:
  - show “Penalty applied: <reason code>”

This makes “why the score is low/high” traceable without guessing.
