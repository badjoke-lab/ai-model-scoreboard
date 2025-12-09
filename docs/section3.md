# 🟥 **AI Model Scoreboard v4 – 内部仕様書（完全版）**

## **Section 3 – 掲載レイヤー（Full / Provisional / Rejected）運用ロジック〈最終仕様〉**

---

# **3-1. 概要（Purpose）**

本セクションは、Scoreboard の **自動運用のコアロジック** を定義する。

目的は：

1. **モデルを適切な掲載レイヤーに自動配置する**
2. **昇格・降格・除外を完全に数値で判定する**
3. **日次ループでの安定運用を保証する**

ここで定義する条件は曖昧さゼロであり、
人手による主観判断は一切発生しない。

---

# **3-2. 掲載レイヤー定義（3階層）〈再掲＋仕様〉**

| レイヤー             | 意味             | スコア表示     | ランキング表示           |
| ---------------- | -------------- | --------- | ----------------- |
| **Full Listing** | 本採用モデル         | あり        | あり                |
| **Provisional**  | 一次採用（データ不足／新規） | あり（※推定含む） | あり                |
| **Rejected**     | 評価不能・重大問題・長期放置 | なし        | なし（※専用リストに名前のみ掲載） |

---

# **3-3. 昇格・降格の評価タイミング**

### ■ 原則

**毎日 0:00 UTC の更新ループ時に自動判断する。**

### ■ 例外

重大インシデント発生時は即時（以降 3-10 で定義）。

---

# **3-4. 新規モデル登場時の自動処理**

新しいモデルが登場した場合、Scoreboard は以下の順番で自動処理する：

1. **最小データ収集**

   * モデルカード
   * 法的情報
   * 価格
   * API
   * ベンチマーク（あれば）

2. **スコア計算可能性の判定**

```
if 全カテゴリにデータ不足:
    → Rejected（評価不能）
else:
    → 仮スコア算出
```

3. **初期レイヤー決定（最重要）**

```
if major benchmarks < 2:
    → Provisional（初期配置）
else:
    → Full（基準を満たせば）
```

4. **snapshot.json へ登録（state = provisional/new）**

---

# **3-5. 昇格ロジック（Provisional → Full）**

以下すべての条件を満たした場合、
Provisional モデルは **自動で Full Listing に昇格** する。

---

## ✔ A. Performance データ基準

**主要ファミリー（General/Coding/Math/Chat）のうち
最低2カテゴリでベンチマークが存在すること**

```
performance_family_count ≥ 2
```

※ 自称値のみのカテゴリはカウント不可。

---

## ✔ B. Safety 基準

以下の両方：

1. safety_score ≥ 50
2. critical incident = 0（重大問題なし）

---

## ✔ C. Adoption 基準

以下すべて：

* 更新日が 90 日以内
* API 稼働率 ≥ 99.0%（過去30日平均）
* documentation_score ≥ 50

---

## ✔ D. Openness 基準

最低限の透明性要件：

* model_card_points ≥ 5
* data_disclosure_points ≥ 5

---

## ✔ E. Cost 基準（参考・昇格阻害無し）

Cost は昇格判定の阻害要因にはしない
（＝コスパが悪くても Full に昇格は可能）。

---

## ✔ F. 総合条件

```
if A, B, C, D をすべて満たす
    → Full Listing に昇格
```

昇格ログを snapshot に記録：

```
promoted_at: YYYY-MM-DD
```

---

# **3-6. 降格ロジック（Full → Provisional）**

Full モデルが以下のいずれかを満たすと自動降格する：

---

## ■ 降格A：更新停止

```
更新日 > 180 日  
→ Provisional へ降格
```

---

## ■ 降格B：API/システムの不安定化

過去30日の API 安定性が：

```
uptime < 97.5%
```

---

## ■ 降格C：ベンチデータの欠損発生

```
performance_family_count < 2
```

＝「性能評価が安定しない」と判断。

---

## ■ 降格D：Safety ペナルティ

```
incident_severity_total ≥ 20（中〜大インシデント）
```

※ Critical（重大）なら即 Rejected（後述）。

---

## ■ 降格E：透明性の悪化

* モデルカード削除
* 訓練データ方針の非公開化
* 技術情報の撤回

この場合：

```
raw_openness_score < 20
→ Provisional
```

---

# **3-7. Rejected（掲載外）への移動**

以下 **いずれか** を満たす場合、Full/Provisional から **即 Rejected** に移される。

---

## ✔ Rejected 条件（強制排除）

### ■ R1. 重大インシデント（Critical）

例：

* 大規模フェイク生成
* 個人データ漏洩
* 自律的危険挙動
* 公式が「利用停止」を宣言した場合

```
→ 即時 Rejected（critical_flag = true）
```

---

### ■ R2. 価格が不明または拒否

```
input/output 単価が不明 or 非公開と明言
→ Rejected
```

---

### ■ R3. 情報の全面欠損

* モデルカードなし
* 訓練情報ゼロ
* 安全情報ゼロ
* ベンチゼロ
* 価格ゼロ

```
→ 評価不能モデルとして Rejected
```

---

### ■ R4. 長期放置

```
更新停止 > 540 日（18ヶ月）
→ Rejected（アーカイブ）
```

---

# **3-8. Rejected モデルの扱い（確定仕様）**

あなたの指示通り、以下を正式仕様にする。

---

## ✔ Rejected はランキングには載せない

## ✔ ただし必ず別ページで “名前だけのリスト” として維持する

表示項目：

* model_name
* vendor
* rejected_reason_code
* last_checked_date

スコアは表示しない。

復帰ルール：

```
Rejected → Provisional は可能  
（改善が確認されれば）
```

この仕様を Section 3 に統合済み。

---

# **3-9. 日次更新ループ（Daily Update Loop）**

毎日 0:00 UTC に以下を自動実行する。

---

### Step 1：最新データ収集

* ベンチ
* API 稼働率
* 価格
* モデルカード
* 安全レポート

### Step 2：スコア再計算

5大スコア（Performance, Safety, Adoption, Openness, Cost）

### Step 3：昇格・降格判断

上記の各条件を論理的に判定する。

### Step 4：Rejected 判定

critical や長期放置チェック。

### Step 5：snapshot.json 更新

以下を保存：

* final_score
* layer（full/prov/rejected）
* reasons
* last_update

### Step 6：ランキングページ更新

---

# **3-10. フローチャート（論理図）**

（Codex で実装しやすいように）一行で表すと：

```
for each model:
    refresh_data()
    calculate_scores()
    
    if critical_issue:
        set_layer(rejected)
    else if fully_unscorable:
        set_layer(rejected)
    else:
        if layer == provisional and meets_full_requirements:
            promote_to_full()
        elif layer == full and meets_demotion_requirements:
            demote_to_provisional()

    if inactive > 540 days:
        set_layer(rejected)

save_snapshot()
```

---
