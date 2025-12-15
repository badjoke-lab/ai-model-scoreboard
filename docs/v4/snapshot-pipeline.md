# AMS v4 スナップショット更新フロー

このドキュメントは、公開サイトの **v4 リーダーボード** が  
どのように private-engine のスナップショットから更新されるかをまとめたものです。

---

## 対象リポジトリ

- スコアリングエンジン（非公開）：`badjoke-lab/private-engine`
- 公開 UI（このリポジトリ）：`badjoke-lab/ai-model-scoreboard`

---

## UI が参照するファイル

v4 のリーダーボードは、次の静的 JSON ファイルを読み込みます（すべてこのリポジトリ内）：

- `public/data/v4/index.json`
- `public/data/v4/rankings.json`
- `public/data/v4/models.json`
- `public/data/v4/not-listed.json`

これらはすべて `private-engine` で生成されたファイルを  
手動でコピーしてコミットしたものです。

---

## スナップショット更新手順（手動）

### 1. private-engine 側でスナップショットを生成する

```bash
cd ~/private-engine
npm install        # 初回だけでOK
npm run snapshot
````

実行が成功すると、`./output` 以下に最新版の JSON が出力されます。

* `output/index.json`
* `output/rankings.json`
* `output/models.json`
* `output/not-listed.json`
  （その他 `history/` や `logs/` も作られますが、UI は使いません）

---

### 2. public リポジトリにコピーする

```bash
cd ~/ai-model-scoreboard

cp ~/private-engine/output/index.json      public/data/v4/index.json
cp ~/private-engine/output/rankings.json   public/data/v4/rankings.json
cp ~/private-engine/output/models.json     public/data/v4/models.json
cp ~/private-engine/output/not-listed.json public/data/v4/not-listed.json
```

---

### 3. コミット＆プッシュしてデプロイ

```bash
cd ~/ai-model-scoreboard

git add public/data/v4/*.json
git commit -m "Update AMS v4 snapshot"
git push origin main
```

* プッシュが完了すると Vercel が自動でビルドとデプロイを行います。
* デプロイ完了後、 `/scores` ページに新しい v4 ランキングが反映されます。

---

## メモ・方針

* 現在サイトが使っているのは **v4 のみ** です。
  v3 の UI やデータは「過去のダミー扱い」で、今後削除する可能性があります。
* スナップショット更新は、しばらくの間は **手動運用** で続けます。
* 将来的にメソドロジーと運用が安定した段階で、
  GitHub Actions による自動スナップショット＆PR 生成を検討します。
