# OVERRIDES_HOWTO

このドキュメントは、`overrides/model-maps/provider-maps` と `overrides/v4/models/*.json` を**手動運用で安全に更新するための固定手順**です。  
無料運営で品質を維持するため、以下のルールを厳守してください。

## A. 役割の違い（3ファイル）

- `overrides/v4/maps/provider-maps.json`
  - provider 単位の確定を置く。
  - 対象は **paper / dev の「共通ルール」だけ**。
  - モデル個別事情はここに入れない。
- `overrides/v4/maps/model-maps.json`
  - modelKey 単位の確定を置く。
  - `official / dev / paper` のモデル別判定をここで上書きする。
- `overrides/v4/models/*.json`
  - 最終表示に使う Evidence 実体。
  - **4枠（official / dev / paper / audit）を固定フォーマットで持つ最終ソース**。

## B. “okにして良い条件”の定義（タイプ別）

- `official_page`
  - **OK**: 公式配布ページ、公式ドキュメント、公式モデルカードなど、断定できる URL。
  - **NG**: まとめサイト、転載、非公式 Wiki、推測で「公式っぽい」URL。
- `dev_activity`
  - **OK**: 公式 organization / 公式 repository。
  - **NG**: 個人 fork、ミラー、第三者の再配布 repo。
- `paper`
  - **OK**: arXiv、または公式テックレポート。
  - **NG**: ブログまとめ、解説記事、ニュース記事。
- `audit`
  - **OK**: 第三者監査（外部独立主体）の公開レポート。
  - **NG**: 社内レポート、marketing 資料、ベンダー自己評価。

## C. 必須の理由コード（reasons）

- 手動で入れた値には、必ず `reasons` に **`"manual_override"`** を含める。
- 自動マップ由来なら、該当するものを併記する。
  - model map 由来: `"auto:model_map"`
  - provider map 由来: `"auto:provider_map"`
- **手動更新なのに `manual_override` が無い状態は NG**。

## D. modelKeyのルール

- 内部表現は **encode 済み（例: `%2F`）** を基本とする。
- 追加時は必ず、実装の正規化フローに合わせて
  - 正規化
  - alias 適用
  - canonicalKey 確定
  の順で確認し、**canonicalKey を使って**編集する。
- **表記ゆれキーを新規作成しない**（既存 canonicalKey へ寄せる）。

## E. 編集手順（具体）

- 差分は以下の順で作る。
  1. 対象 modelKey の canonicalKey（encode 済み）を確認。
  2. 共通で効くものだけ `provider-maps.json` に追加。
  3. モデル固有は `model-maps.json` に追加。
  4. 最終 evidence を `models/<canonicalKey>.json` に反映。
- URL を追加する前に、手動確認する。
  - 公式性: ドメイン/発行主体が公式か。
  - 一次性: 原典か（転載・要約ではないか）。
  - 継続性: 一時ページではなく参照可能か。
- **「迷ったら ok にしない」**。判定不能は保留にする。

## F. 検証手順（コマンド必須）

- まず overrides 検証を実行する。
  - `node scripts/v4/validate_overrides.mjs`
  - もし存在しない場合は、**「無ければT27Rを先に」**を作業メモに明記して先に整備する。
- その後、型とビルドを確認する。
  - `pnpm -s typecheck`
  - `pnpm -s build`

## G. 反映と確認（ブラウザでの確認点）

- `/models/<modelKey>` を開いて次を確認。
  - Evidence の 4枠（official / dev / paper / audit）が揃っている。
  - Links に追加した URL が表示される。
  - Raw Inputs に `manual curated` が表示される（T43R 実装後）。
- 1つでも欠ける場合は、マップと `models/*.json` の整合を再確認する。

## H. 破壊しやすいNG例（必須）

- `official_page` に公式でない URL を入れてしまう。
- `paper` をブログ記事で埋めてしまう。
- modelKey の表記ゆれで別ファイルを増殖させてしまう。
- `audit` を「それっぽい紹介ページ」で ok にしてしまう。
- 手動更新なのに `reasons` に `manual_override` を入れ忘れる。
