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

### A. Evidence（4タイプ固定）

| Evidence type | 自動生成 | 手動override | ok許可条件 | 禁止 |
| --- | ---: | ---: | --- | --- |
| official_page | △ | ✅ | 一次ソースURLが確定 | 推測でok |
| dev_activity | △ | ✅ | 公式GitHub org/repo確定 | 推測でok |
| paper | △ | ✅ | arXiv/公式PDF等の一次ソース確定 | 推測でok |
| audit | ✗ | ✅ | **第三者監査のみ** | ベンダー自己申告でok |

※ △ = 辞書（provider/model map）にヒットしたときだけ `ok` 可。ヒットしない場合は `ambiguous` / `not_found`。

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

### B. Raw Inputs（5ソース固定）

| Source | 収集 | 表示 | 欠損扱いの理由コード必須 |
| --- | ---: | ---: | ---: |
| OpenRouter | ✅ | ✅ | ✅ |
| HuggingFace | △ | ✅ | ✅ |
| GitHub | △ | ✅ | ✅ |
| arXiv | △ | ✅ | ✅ |
| Ops | ✗（無料） | ✅（欠損表示） | ✅ |

### C. 継続計測系（無料では原則不可）

- TTFT/TPS/success/uptime の継続収集は **原則欠損**（理由コード必須）。
- レート制限の正確値は **原則欠損**。

Payload MUST provide `rawInputsBySource` keys for all sources (empty objects allowed),
and UI MUST show missing explicitly.

---

## 欠損の厳格運用（MUST）

- 欠損は `missing` / `not_found` / `ambiguous` / `missing_source_link` のいずれかで明示する。
- 欠損がある場合は、既存仕様どおり `withheld` および `specMissingEvidence` に影響させる（本書では再定義しない）。

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
