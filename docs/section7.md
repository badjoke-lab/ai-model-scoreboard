# 🟥 **AI Model Scoreboard v4 – 内部仕様書（完全版 / 非公開）**

## **Section 7 — Error Handling & Safeguards（エラーハンドリングと安全装置）**

---

# **7-0. 目的**

本セクションでは AMS（AI Model Scoreboard）が

* 取得エラー
* データ欠損
* 計算失敗
* 不整合
* 外部APIの崩壊
* ベンチマークの欠落
* モデル名の衝突
* 内部ロジックの異常
* GitHub Actions の障害

など、**全ての障害を無停止で吸収し、
Scoreboard を壊さずに更新し続けるための“安全装置”** を定義する。

AMS の最重要ポリシー：

# 👉 **「データが壊れても UI を壊さない」**

# 👉 **「ロジックが壊れても結果は破損させない」**

---

# # **7-1. Fault Isolation（障害の隔離）**

AMS パイプラインは
**モデル単位でエラーを隔離する（fail-soft）**。

つまり：

* GPT-5.3 の API が落ちても
* Claude-Next の benchmark が壊れても
* Gemini の価格が取得できなくても

**他のモデルのスコア計算には影響しない**。

### 方法：

1. 各モデルを独立した try/catch で処理
2. 失敗したモデルだけ fallback snapshot を使用
3. 全体処理は停止しない

---

# # **7-2. Fallback System（代替データ処理）**

AMS の核心は「データ欠損時の挙動」。

---

## **7-2-1. データ取得失敗（Fetch Error）**

例：ベンダー API が落ちた場合。

**Fallback：**

* `raw/{date}/{model}.json` が生成されない
  → 前日の snapshot を流用
  → `"data_source":"fallback"` と内部タグ付け

**ユーザーへは何も見せない**

---

## **7-2-2. 部分的な欠損（Partial Missing）**

例：価格だけ欠損、透明性情報だけ欠損など。

**Fallback：**

* 欠損フィールドだけ前日の値
* スコアは weighted re-normalize（内部仕様だが非公開）

---

## **7-2-3. ベンチマーク欠損**

例：LM-Eval がまだ新モデルに対応していない。

**Fallback：**

* Performance の “Chat” 以外のファミリーでスコア
* Arena がある場合は微調整
* Family coverage が 1つだけの場合は Provisional 強制維持

---

## **7-2-4. 透明性データ欠損**

例：モデルカードが存在しない / not found。

**Fallback：**

* Openness は “評価保留値”
* Provisional へ自動分類

（外部へは何も表示しない）

---

## **7-2-5. モデル名が変わった（Renaming）**

例：Llama-3 405B → Llama-3.1 405B

**Fallback：**

* 内部 canonical name で同一モデルと見なす
* 履歴が途切れないように自動連結
* UI には新名称のみ表示

---

## **7-2-6. モデル削除（Deprecation）**

例：ベンダーが GPT-3.5 Turbo を削除。

**Fallback：**

* “deprecated:true” を付加
* 次回の更新からはランキングに出さない
* 過去 snapshot は維持（統計のため）

---

# # **7-3. Scoring Safety（スコアリング安全装置）**

AMS では内部ロジックが壊れても
**Scoreboard の公開結果が壊れないよう設計する**。

---

## **7-3-1. スコア無効化（Score Invalidation）**

もし内部でスコアが NAN / -inf / 1000 など異常値になった場合：

→ そのモデルのスコアを
**前日の final_score に巻き戻す**

これにより UI が崩壊することはない。

---

## **7-3-2. ファミリー欠損**

例：Math のベンチが欠損。

→ Performance の計算に
**自動 re-weight** を適用（非公開）

---

## **7-3-3. 内部例外（Internal Exception）**

もし特定モデルの scoring code が落ちた場合：

* スコア計算はスキップ
* 前日のスコア + “status:degraded”（内部タグ）
* 外部には通常通りのランキングを返す
  （“壊れてます” を絶対に見せない）

---

# # **7-4. Publishing Safety（公開データの破損防止）**

### **目的：誤った json が public に push されることを防ぐ**

---

## **7-4-1. JSON 検証**

公開前に schema チェック：

* `rankings.json`
* `models.json`
* `not-listed.json`

もし schema mismatch：

→ その日の更新は **全キャンセル**
→ 前日の public データをそのまま残す
→ Actions 内部でエラー処理し、UI は無傷

---

## **7-4-2. ランキングの“飛び”防止**

もし final_score が *前日から ±40 以上* 変化した場合：

* internal safety check が警告
* **人間による確認が必要なフラグを立てる**（内部だけ）
* 公開値は前日の値を使う

これにより突然のバグで
GPT-4 が 30点 → 95点 みたいなことが起こらない。

（内部機能で UI には見せない）

---

# # **7-5. Incident Safety（安全性インシデントの扱い）**

AMS では安全性インシデントが起こった際の
**自動処理** も定義する。

### **外部には何も表示しない**

（内部判定だけで昇格・降格に反映）

---

## **7-5-1. Minor incident**

* 内部ペナルティのみ
* 公開スコアには微弱影響
* ステータスは Full のまま

---

## **7-5-2. Major incident**

* 強制的に Provisional へ降格
* スコア減衰（非公開）

---

## **7-5-3. Critical incident**

* 内部で “rejected-internal”
* 公開では Not Listed
* スコアは完全に無効化
* 自動復帰はしない（手動のみ）

---

# # **7-6. Scheduler Safety（実行スケジュール安全装置）**

GitHub Actions が落ちたり、週末に障害があっても AMS が止まらないようにする。

---

## **7-6-1. 自動リトライ**

* Fetch
* Processing
* Publish

の各段階は **2回まで自動リトライ**。

---

## **7-6-2. 前回成功時のデータ保持**

もし全処理が失敗した場合：

→ public データは上書きしない
→ 最後に成功したデータ（前回分）を保持
→ UI には平常通り表示される

---

## **7-6-3. ログの外部非公開**

* Actions のログは artifacts に残さない
* 内部的にのみ保存
* 外部がロジックを推測できないよう制御

---

# # **7-7. Developer Safety（開発者操作の安全装置）**

あなたが AMS を操作するときに
間違って壊さないための保護。

---

## **7-7-1. 手動追加したモデルは “locked” 扱い**

モデル名を手動追加した場合：

* discovery が上書きしない
* 自動削除もしない
* 明示的に手動解除しない限り残る

---

## **7-7-2. 手動変更を public に即反映しない**

draft mode があり：

* 手動編集 → draft.json
* Actions が次回反映 → public.json

直接 public を壊すことがない。

---

## **7-7-3. 誤 push 防止の CI**

PR マージ前に：

* JSON schema チェック
* forbidden changes チェック（public ディレクトリへの手動編集禁止）

---

# # **7-8. Section 7 完了まとめ**

このセクションで AMS は：

* **壊れない**
* **止まらない**
* **データ欠損でも動作する**
* **バグや外部障害を UI に出さない**
* **スコアが暴走しない**
* **毎日安定して更新され続ける**

という“実用レベルの強固なシステム”になった。

---
