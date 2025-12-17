# AMS v4 スナップショット更新手順（日本語メモ）

このファイルは、自分用のメモ兼運用手順書です。  
AMS v4 エンジン（private-engine）で JSON を再生成し、  
`ai-model-scoreboard` の v4 リーダーボードに反映するまでの流れをまとめます。

---

## 前提

- macOS
- `~/private-engine` … 非公開リポジトリ（AMS v4 エンジン）
- `~/ai-model-scoreboard` … 公開リポジトリ（サイト本体）
- どちらも `main` ブランチで作業する想定

---

## 1. エンジン側の更新（private-engine）

```bash
cd ~/private-engine

# 念のため最新を取得
git pull origin main

# スナップショット生成
npm install        # 既に入っていれば一瞬で終わる
npm run snapshot   # output/*.json が更新される
````

生成されるファイル（例）：

* `output/index.json`
* `output/rankings.json`
* `output/models.json`
* `output/not-listed.json`
* `output/history/YYYY-MM-DD.json`
* `output/logs/audit-YYYY-MM-DD.json`

---

## 2. サイト側へのコピー（ai-model-scoreboard）

```bash
cd ~/ai-model-scoreboard

# v4 用ディレクトリが無い場合は一度だけ作る
mkdir -p public/data/v4

# private-engine の出力をコピーして上書き
cp ~/private-engine/output/index.json      public/data/v4/index.json
cp ~/private-engine/output/rankings.json   public/data/v4/rankings.json
cp ~/private-engine/output/models.json     public/data/v4/models.json
cp ~/private-engine/output/not-listed.json public/data/v4/not-listed.json
```

---

## 3. Git のコミット & プッシュ

```bash
cd ~/ai-model-scoreboard

# 変更内容確認
git status
git diff public/data/v4

# コミット（updatedAt などが変わっていることを確認してから）
git add public/data/v4/index.json \
        public/data/v4/rankings.json \
        public/data/v4/models.json \
        public/data/v4/not-listed.json

git commit -m "chore(v4): refresh snapshot from private-engine"
git push origin main
```

---

## 4. 動作確認

ブラウザで以下を確認：

* [https://ai-model-scoreboard.vercel.app/](https://ai-model-scoreboard.vercel.app/)

  * ランキングの **スコア・並び順・Snapshot updated の日時** が更新されている
* [https://ai-model-scoreboard.vercel.app/methodology](https://ai-model-scoreboard.vercel.app/methodology)

  * 正常表示されること
* もしおかしければ：

  * `public/data/v4/*.json` の中身を確認
  * Vercel のデプロイログを確認してエラーがないか見る

---

## メモ

* v4 は「単一バージョンのみ運用」。v3 はダミー扱い。
* 将来、自動更新パイプラインを作るときは、
  この手順書の **1〜3 を自動化するイメージ** で設計する。

