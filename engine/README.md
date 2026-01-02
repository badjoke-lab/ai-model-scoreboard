# AMS v4 スコアリングエンジン（private-engine）

このリポジトリは **AI Model Scoreboard v4（AMS v4）** のための  
「オフライン用スコアリングエンジン」をまとめたものです。

エンジンはモデル情報とブートストラップ用のモデル一覧を読み取り、  
各モデルのスコアを計算し、  
公開サイト（`ai-model-scoreboard`）から読み込まれる JSON スナップショットを出力します。

---

## 1. セットアップ

```bash
npm install
````

前提環境：

* Node.js 18 以上
* npm

---

## 2. スナップショットを実行する

```bash
npm run snapshot
```

このコマンドを実行すると、エンジンが起動して

* 外部／内部のデータソースを読み込み

* 各モデルのスコアとレイヤー（Full / Provisional / Rejected）を計算し

* 以下のファイルを `./output` 以下に出力します：

* `output/index.json`      … スナップショット全体のメタデータ（version / updatedAt / 件数など）

* `output/models.json`     … スコアリング対象モデルの一覧
  * **配列ではなくマップ形式**（キー=モデルの slug、値=モデル詳細）

* `output/rankings.json`   … 各モデルの総合スコア・サブスコア入りランキング
  * **常に配列**（順位順）

* `output/not-listed.json` … メインのテーブルから除外されたモデルの一覧

* `output/history/*.json`  … 実行履歴（今後の機能向け）

* `output/logs/*.json`     … 監査ログ・デバッグ用

`ts-node index.ts` でスナップショットを生成したあと、`scripts/validate_output.mjs` で
`output/*.json` の存在と JSON 形式／構造（rankings は配列、models はマップなど）を検証します。
ファイルが欠けている・壊れている場合はここで **非ゼロ終了** します。

---

## 3. ブートストラップモデルデータ

* ベースとなるモデル一覧は `docs/bootstrap-models.json` にあります。
* 各エントリの型は `types.ts` の `RawBootstrapModel` で定義されています。

新しいモデルを追加したい場合は：

1. `docs/bootstrap-models.json` に新しいモデルのエントリを追加する
2. `npm run snapshot` を実行する
3. `output/rankings.json` を確認し、スコアや順位が妥当かチェックする

---

## 4. 公開 UI への反映（手動）

スナップショット実行後、次の 4 ファイルを
公開側リポジトリ `ai-model-scoreboard` にコピーしてコミットします。

コピー元（このリポジトリ） → コピー先（公開リポジトリ）：

* `output/index.json`      → `ai-model-scoreboard/public/data/v4/index.json`
* `output/rankings.json`   → `ai-model-scoreboard/public/data/v4/rankings.json`
* `output/models.json`     → `ai-model-scoreboard/public/data/v4/models.json`
* `output/not-listed.json` → `ai-model-scoreboard/public/data/v4/not-listed.json`

その後、公開リポジトリ側でコミット＆プッシュすると、
Vercel がビルドを実行し、サイトに新しいランキングが反映されます。

---

## 5. 自動化（GitHub Actions）

`main` ブランチには **1 つだけ** の自動更新ワークフローがあります：

* `.github/workflows/update-v4-snapshot.yml`
  * スケジュール：毎日 06:00 UTC（`workflow_dispatch` でも手動実行可）
  * 処理内容：`npm run snapshot` で `output/*.json` を生成し、`ai-model-scoreboard` の `public/data/v4/` にコピーした上で、差分があれば PR を作成する（差分なしの場合は正常終了）
  * PR タイトル：`Update v4 snapshot (YYYY-MM-DD)`
  * PR 本文：`output/index.json` の `updatedAt` を含める
  * 使用シークレット：`AI_MODEL_SCOREBOARD_PAT`（`badjoke-lab/ai-model-scoreboard` へのブランチ作成と PR 作成を許可する PAT）

上記以外のスナップショット用スケジュール実行は削除済みです。
