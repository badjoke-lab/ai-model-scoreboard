# 🟥 **AI Model Scoreboard v4 – 内部仕様書（完全版 / 非公開）**

## **Section 6 — Automation Pipeline（自動更新パイプライン）**

---

# **6-0. 目的**

本セクションは AI Model Scoreboard（AMS）の
**自動更新パイプライン全体の構造・実行方式・秘匿化設計** を定義する。

これにより AMS は：

* 手動操作ゼロ
* 毎日安定して更新
* 内部ロジックは完全非公開
* 公開データは常に最新

という運用状態を維持する。

---

# # **6-1. ディレクトリ構成（public / private 分離）**

AMS リポジトリの構造は以下を前提とする：

```
/ (public repo root)
  /docs/              → Methodology, 公開ドキュメント
  /public/            → 公開される最終データ（json）
  /scripts/           → 公開してよい補助スクリプト
  /actions/           → GitHub Actions ワークフロー（公開）
  /data/
    /raw/             → 外部データの生スナップショット（公開可）
    /processed/       → 公開用に加工された中間生成物（公開可）
  
  /internal/          → ★ 非公開ロジック保管ディレクトリ
      /pipeline/      → データ取得ロジック
      /scoring/       → スコア算出ロジック
      /rules/         → 昇格・降格・除外ルール
      /canonical/     → モデル名正規化ロジック
```

### ✔ **要点**

* `/internal/` 以下は GitHub には含めず、Actions 内部にのみ保持。
* `/public/` に出るのは **UI が読む json だけ**。
* スコア計算ロジックはどこにも公開されない。

---

# # **6-2. Model Discovery Layer（モデル発見）**

## **目的**

世界中のAIモデルの「存在」を自動検知し、AMS の master list に反映する。

## **処理内容**

1. 各ベンダー API・モデル一覧をクロール
2. モデル名・バージョン・説明を抽出
3. 内部名称へ canonicalize
4. 既存モデルと照合（update / new / rename 判定）
5. `/data/raw/{date}/models.yaml` へ保存

## **I/O 定義**

**Input：**

* ベンダーの公開API一覧URL
* モデルマーケットプレイスのRSS/一覧
* 手動追加された internal/vendor-sources.yaml

**Output：**

```
{
  "model_id": "openai:gpt-5.2",
  "family": "General",
  "vendor": "OpenAI",
  "release_date": "...",
}
```

## **特記事項（内部）**

* 名称の揺れ（GPT-5.2 vs gpt5-2 vs GPT 5 2）は canonical 化
* ベンダー側の削除は “soft delete” として扱う
* 新規モデルは自動で Provisional へ追加される

---

# # **6-3. Data Fetch Layer（データ取得）**

## **目的**

モデルごとに全公開データを集め snapshot 化する。

## **取得データ**

* 価格（$ per 1K tokens）
* API仕様（context length, modalities）
* リリースノート / 更新日
* 安全性レポート
* ベンチマーク（LMSYS, LM-Eval-Harness 等）
* 透明性関連情報（モデルカード）
* インシデント情報（公的なもの）

## **保存形式**

```
/data/raw/{date}/{model_id}.json
```

## **エラー処理**

* 取得失敗 → 前回 snapshot を継続利用
* API 廃止 → “deprecated:true” を付加
* 書式変化 → canonical parser が fallback

---

# # **6-4. Processing & Scoring Layer（処理 + スコア計算）**

## **目的**

内部仕様書（Sections1〜4）に基づき、
**ロジック非公開のままスコアを算出する。**

## **処理フロー**

1. raw snapshot を読み込む
2. 欠損データを内部ルールで補正
3. 性能・安全性・透明性などを内部式で計算
4. full / provisional / not listed の判定
5. incidents による強制降格処理
6. 公開用データに構造化

## **I/O**

**Input：**

* `/data/raw/{date}/*.json`

**Output（private）：**

* `/data/processed/{date}/scores-private.json`
  ※ 内部ロジックを含むため非公開

---

# # **6-5. Publishing Layer（公開用データ生成）**

## **目的**

内部スコアから UI 向けの最終 json を生成。

## **公開されるデータ**

```
/public/models.json       → モデル一覧（metadataのみ）
/public/rankings.json     → スコアと順位（最終結果）
/public/not-listed.json   → 名称のみの非掲載モデル一覧
/public/changes.json      → 最新日の差分ログ
```

## **内部から削除される情報**

* 内部式・補正値
* 欠損情報
* 昇格・降格の内部判定理由
* インシデントの内部判定スコア

※ あくまで外部に出すのは「結果」だけ。

---

# # **6-6. Scheduler Layer（実行計画）**

AMS の自動実行方式：

### ✔ **GitHub Actions の cron（毎日 0:00 UTC）**

```
schedule:
  - cron: "0 0 * * *"
```

毎日以下を実行：

1. モデルの自動発見
2. データ収集
3. スコア計算
4. 公開用 json 生成
5. 差分ログ作成
6. public ディレクトリへ commit/push

### ✔ 手動トリガー（workflow dispatch）

* 新モデル追加の即時リフレッシュ
* バグ修正後の再計算
* デバッグログ出力

---

# # **6-7. ロジック秘匿化の技術仕様（超重要）**

AMS の最も重要な要件：

> **ロジック非公開のまま、public GitHub repo で自動更新すること。**

実現方法：

---

## **① スコア計算ロジックは “actions 内部にだけ” 存在する**

GitHub Actions にだけ配置する方法：

### **方式：Actions Secrets + actions/ 内の private zip**

* `/internal/` ディレクトリは repo に含めない
* スコア計算ロジックを zip で暗号化して Secrets に保存
* Actions 実行時に復号して使用
* 実行後にメモリ上で破棄し、artifact にも残さない

これにより **ソースコードが一切公開されない**。

---

## **② 計算結果だけを public に commit**

公開されるのは結果の JSON のみ。

ベンダーはどれだけ監視してもロジックを逆算できない。

---

## **③ ログは完全非公開（debug は artifacts も削除）**

* debug log は artifact にすら残さない
* すべて Actions 実行内で自動破棄
* 公開 repo から逆算される情報を最小限にする

---

# # **6-8. フォールバック（障害時の動作）**

AMS の安定運用のため、以下の fallback を定義：

---

## **データ取得が失敗した場合**

* 前日の raw snapshot を使用
* スコアは更新されるがデータは古い可能性あり
  （※これでシステムは止まらない）

---

## **計算中にエラーが発生した場合**

* 直近の成功した public データで再公開
* 状態が保たれるように actions が自動で rollback

---

## **モデル発見が全滅した場合**

* 前回のモデルリストを継続保持
* 新規モデル検出は翌日に再試行

---

# # **6-9. データ保持ポリシー（Retention Policy）**

* `/data/raw/` → 90日保持（任意で延長）
* `/public/` → 常に最新のみ
* internal ログ → Actions 実行後に削除
* 差分（changes.json） → 30日分保持

---

# # **6-10. Section 6 完了まとめ**

本セクションにより：

* **AMS は毎日自動で回る完全自動運用体制**
* **ロジック非公開のまま public GitHub で更新可能**
* **新規モデルの発見 → データ取得 → スコア計算 → 公開** の全工程が確立
* 人間の手動操作はゼロ
* 端末故障リスクもゼロ

AMS の運用基盤がこれで完成した。

---