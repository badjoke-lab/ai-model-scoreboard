# 🟥 **AI Model Scoreboard v4 – 内部仕様書（完全版）**

## **Section 4 – データ収集・モデル発見・snapshot システム〈最終仕様〉**

---

# **4-1. 目的（Purpose）**

本セクションは Scoreboard v4 の **データ層・情報取得レイヤー** の仕様を定義する。

目的：

1. **性能・安全性・更新情報・透明性・価格** を正確に収集する
2. **新規モデルを自動で発見する**
3. **snapshot.json に“日次状態の真実”を保存する**
4. **すべての処理を自動化し、人的介入を不要にする**

---

# **4-2. データ収集の大原則（Fundamental Principles）**

1. **公式情報を最優先ソースとする**
2. **第三者データ（LM Eval・Arena）は補助として採用**
3. **SNS・噂・非公式ブログは一切使用しない**
4. **欠損データは“ゼロ”ではなく“未取得”として扱う**
5. **収集すべきデータ項目は固定（後述）**
6. **データ不整合があった場合は Provisional または Rejected に反映する**

---

# **4-3. データ項目（Data Schema：Model Metadata）**

各モデルが必ず持つべきフィールドを定義する。

```
{
  "model_name": "",
  "vendor": "",
  "family": "",  // GPT / Claude / Gemini / Llama / etc.

  "performance": {
    "bench": {
      "general": null,
      "coding": null,
      "math": null,
      "chat": null
    },
    "arena_elo": null,
    "latency": null
  },

  "safety": {
    "incident_major": 0,
    "incident_critical": 0,
    "external_review": false,
    "notes": ""
  },

  "adoption": {
    "updated_at": "",  // ISO date
    "uptime_30d": null,
    "docs_score": null,
    "api_status": "active/deprecated"
  },

  "openness": {
    "model_card": false,
    "data_disclosure": false,
    "architecture_info": false,
    "transparency_report": false
  },

  "cost": {
    "input_1k": null,
    "output_1k": null,
    "context_tokens": null
  },

  "layer": "full/provisional/rejected",
  "score": 0,
  "reason": "",
  "first_seen": "",
  "last_updated": ""
}
```

これは *snapshot.json* の1モデルの基本構造。

---

# **4-4. データ取得サイクル（Data Refresh Schedule）**

各データの取得頻度を次のように定める。

| データ種別                | 頻度   | 理由           |
| -------------------- | ---- | ------------ |
| Arena Elo            | 毎日   | 変動が大きい       |
| API uptime           | 毎日   | 掲載レイヤーに影響    |
| LM Eval              | 毎週   | 更新頻度そこまで高くない |
| 価格（pricing）          | 毎日確認 | 変更リスクが高い     |
| モデルカード等の透明性情報        | 毎月   | 大変動が少ない      |
| vendor のモデル一覧        | 毎日   | 新規モデル発見のため   |
| Open LLM Leaderboard | 毎日   | モデル名の逆引きのため  |

---

# **4-5. 新規モデル自動発見ロジック（Model Discovery Engine）**

Scoreboard v4 の中核ロジック。
次の3系統を統合して新しいモデルを検出する。

---

## **① ベンダー公式ソース監視（Vendor Monitoring）**

各ベンダーごとに `model_list_url` を保持し、
毎日以下を実行：

```
fetch vendor.model_list_url
extract model_names
```

取得したモデル名を `official_models_today` として記録。

---

## **② ベンチマーク逆引き（Benchmark Reverse Discovery）**

対象：

* LM Eval
* LMSYS Arena
* HELM
* Open LLM Leaderboard

毎日：

```
fetch benchmark_pages
extract model_names (string match)
```

結果を `bench_models_today` として記録。

---

## **③ スナップショット比較（Diff Detector）**

前日の `snapshot.json` の既存モデル一覧：

```
known_models = snapshot.model_name[]
```

今日発見したモデル一覧：

```
today_found = official_models_today ∪ bench_models_today
```

差分：

```
new_models = today_found - known_models
```

---

# **4-6. 新規モデルの初期登録**

`new_models` に含まれるモデルは次の処理を行う。

1. metadata をテンプレートで作成
2. layer = provisional/new
3. first_seen = 現在日時
4. 可能なデータを収集（スコア未確定OK）
5. snapshot に追加

---

# **4-7. データ欠損の扱い（Missing Data Policy）**

以下のルールを適用する：

### ✔ 欠損 = 0点ではない

スコアを下げるのではなく **そのカテゴリの重みをゼロにし再正規化**。

### ✔ 欠損が続く場合

* 90 日欠損 → Provisional のまま
* 180 日欠損 → “評価不能モデル” 判定候補
* 540 日欠損 → Rejected（長期放置）

### ✔ 安全性データが欠損

→ Full に昇格不可（Provisional 固定）

---

# **4-8. snapshot.json の仕様（Snapshot Format）**

Scoreboard の“唯一の真実の状態”を保存するファイル。

### ■ snapshot.json の構造

```
{
  "date": "YYYY-MM-DD",
  "models": [
     { model metadata (前述) },
     { ... }
  ],
  "stats": {
    "total_full": 0,
    "total_provisional": 0,
    "total_rejected": 0,
    "new_models": [],
    "promotions": [],
    "demotions": [],
    "rejections": []
  }
}
```

---

# **4-9. snapshot.json の更新タイミング**

1. 毎日 0:00 UTC（定期更新）
2. 新規モデル登場時
3. モデル価格更新時
4. 重大インシデント時
5. 手動メンテナンス時（rare）

---

# **4-10. snapshot のバージョン履歴**

毎日 1 ファイル保存：

```
/snapshots/2025-12-05.json
/snapshots/2025-12-06.json
...
```

目的：

* 差分比較
* モデルの成長履歴
* トラブル時のロールバック
* 公開用アーカイブにもなる

---

# **4-11. エラー・不整合検知**

次の条件を満たす場合、自動で `error_flags` を立てる：

* 価格が負数
* 透明性が急にゼロになる
* ベンチ値が異常（±20σ 逸脱）
* API uptime の急落（> 15%）
* モデル名の重複

必要に応じて Provisional または Rejected に反映。

---

# **4-12. Section 4 のまとめ（仕様意図）**

Section 4 では以下を保証する：

1. **Scoreboard が自律的に新規モデルを発見し続ける**
2. **必要なすべての情報を自動取得し、欠損を明確に扱う**
3. **日次記録（snapshot）が Scoreboard の“真実の歴史”になる**
4. **運用が人間に依存しない仕組みとなる**

---
