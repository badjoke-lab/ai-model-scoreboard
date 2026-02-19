# official_page 判定ポリシー

この文書は `official_page` の採用基準を固定し、推測で `ok` 判定が入る事故を防ぐための運用ルールです。

## 目的

- `official_page` を推測で `ok` にしない。
- 「許可された一次ソース」以外が入ったら CI を **hard fail** させる。
- UI 側で吸収せず、データ入力地点（`overrides/v4/maps` / `overrides/v4/models`）で防ぐ。

## 許可ルール（固定）

`official_page` の URL は、次のどちらかに一致する場合のみ許可します。

1. 許可ドメイン（allowlist）
   - `overrides/v4/maps/allowed-official-sources.json` の `allowedDomains` に対して、
     「完全一致またはサブドメイン一致」で判定します。
2. Hugging Face の公式 Publisher
   - ドメインが `huggingface.co` の場合、パス先頭セグメント（`/ORG/...` の `ORG`）を取り、
     `allowedHfNamespaces` に含まれる場合のみ許可します。

## 禁止ルール（固定）

次は原則として禁止です。

- 短縮 URL（例: `t.co`, `bit.ly`, `tinyurl.com`）
- 個人ブログ・まとめ・フォーラム投稿のみを根拠にした URL
- `docs.google.com` や `notion.site` のような、誰でも作れるホスティング
  - 例外で許可する場合は、`blockedDomains` / allowlist を明示的に更新したうえでレビューすること

## バリデーション対象

`node scripts/v4/validate_overrides.mjs` は以下を検証します。

- `overrides/v4/models/*.json` の `evidence[].type === "official_page"` の `url` / `refs[0]`
- `overrides/v4/maps/model-maps.json` の `models[*].official_page`
- `overrides/v4/maps/provider-maps.json` の `providers[*].official_page`（現時点では禁止）

## 失敗時の扱い

- 自動で `missing_source_link` に落とす等のデータ改変は行いません。
- validate は **hard fail（exit 1）** します。
- PR は CI で停止し、allowlist か入力データを修正するまでマージ不可とします。
