# 🟥 **AI Model Scoreboard v4 – 内部仕様書（完全版 / 非公開）**

## **Section 5 – Methodology（公開版への変換方針）**

---

# **5-0. このセクションの目的（Purpose）**

本セクションの目的は：

* 内部仕様書（Sections 1〜4）を **外部公開用 Methodology** に変換する際の
  **公開範囲・非公開範囲・翻訳ルール・制限事項** を定義し、
* Scoreboard の透明性と中立性を保ちながら、
  **悪用・逆最適化（score gaming）を防止する** ことにある。

---

# **5-1. 公開対象と非公開対象の原則（Public vs Private Scope）**

外部公開向けに提供する情報は、
AMS の信頼性・透明性を高めるために必要最小限とし、
内部ロジック（式・閾値・補正・判定）は一切公開しない。

---

## **5-1-1. 公開してよい項目（HIGH-LEVEL ONLY）**

以下は Methodology に掲載可能：

### ✔ AMS の目的・哲学

* 公平・再現性・客観性
* SNS 評判を使わない理由
* 透明性を重視する理由

### ✔ 掲載レイヤーの説明

* Full
* Provisional
* Not Listed（外部向け名称として使用）
  ※内部の Rejected は外部では “Not Listed” として簡潔化

### ✔ 5大スコアカテゴリの説明

* Performance（意味だけ）
* Safety（意味だけ）
* Adoption（意味だけ）
* Transparency（意味だけ）
* Cost Efficiency（意味だけ）

※計算式・重みは非公開

### ✔ 更新頻度

* 毎日自動更新されること
* データは常に最新であること

### ✔ データポリシー

* 公式情報・第三者ベンチマークのみ使用
* SNS, 評判, 噂, マーケ情報は一切不採用

---

## **5-1-2. 公開してはいけない項目（STRICTLY PRIVATE）**

以下は **GitHub 上にも Methodology にも決して公開しない**：

### ❌ スコア計算式

* Performance 正規化式
* 重み（weights）
* 欠損 reweight 処理
* Safety ペナルティの実数値
* コスト式
* Arena の補助係数
* ファミリー配点構造

### ❌ 昇格・降格の閾値

* 90日更新/180日停止/540日停止の内部基準
* API uptime のしきい値
* transparency の最低点
* performance_family_count の実数条件

### ❌ 新規モデル発見ロジックの技術詳細

* クロール対象URL
* 正規化テーブル
* モデル名解決ルール
* 機械的比較アルゴリズム

### ❌ 内部的な incident 判定式

* major/critical のスコア反映のルール
* rejection 条件の詳細

---

# **5-2. 外部説明（Methodology）への変換ルール（Translation Rules）**

内部仕様を Methodology に変換する際には
以下の “翻訳ポリシー” に従う。

---

## **5-2-1. 数字 → 言葉に置き換える**

例：

内部：

```
performance_family_count ≥ 2
```

外部：

```
複数の領域で性能が評価されているモデルをより信頼性が高いと見なします。
```

---

## **5-2-2. 閾値 → 抽象的な基準へ**

内部：

```
updated_at > 180 days → demotion
```

外部：

```
長期間更新が行われていないモデルは、評価が慎重になります。
```

---

## **5-2-3. ペナルティ → 行動方針に置換**

内部：

```
incident_critical → rejected
```

外部：

```
重大な安全性問題が確認されたモデルは掲載を停止します。
```

---

## **5-2-4. 欠損処理 → “評価保留” に置換**

内部：

```
missing_openness_score → weight=0, reweight categories
```

外部：

```
情報が不足しているモデルは仮評価（Provisional）として扱います。
```

---

# **5-3. 非公開部分の存在理由（Why Certain Logic Is Private）**

公開 Methodology の最後に必ず以下の趣旨を記載する。

---

## ✔ **ロジック非公開の理由（外部向け説明）**

AMS は公平性と中立性を維持するため、
スコア算出式、閾値、補正ロジックなどの内部仕様は公開しません。

理由は以下の通り：

1. **スコアの逆最適化（score gaming）を防ぐため**
2. **特定ベンダーのチューニング誘導を避けるため**
3. **評価基準を恣意的に回避されないようにするため**
4. **透明性よりも“公平性・安全性”の維持が重要なため**

---

# **5-4. サイト上の Methodology 構成（公開版の章立て）**

公開Methodologyは以下の章構成とする。

```
1. Overview（目的と理念）
2. Evaluation Philosophy（AMS の思想）
3. Model Layers（Full / Provisional / Not Listed）
4. Five Core Dimensions（Performance / Safety / Adoption / Transparency / Cost）
5. Update Policy（毎日更新の仕組み）
6. Data Sources & Principles（公式情報のみ使用）
7. Non-Disclosure Policy（ロジック非公開方針）
8. Notes & Limitations
```

内部仕様書（Sections 1〜4）の複雑な内容は **すべて隠す**。

---

# **5-5. Section 5 の目的の総まとめ**

Section 5 の目的は：

* 内部仕様（完全ロジック）と
* 公開 Methodology（思想・方針）

を **完全に分離するためのルールブック** を作ること。

これにより：

* 公平性
* 中立性
* 長期運用性
* ベンダー最適化の阻止
* 透明性と信頼の維持

が同時に成立する。

---

