# 🟥 **AI Model Scoreboard v4 – 内部仕様書（完全版 / 非公開）**

## **Section 8 — Future Expansion (v5+ Roadmap / 次世代拡張設計)**

---

# **8-0. このセクションの目的**

本セクションでは AMS の将来的な拡張項目を整理し、
v4 の設計が長期的に持続し、
将来的な評価精度向上と自動化高度化に耐えられるよう、
**中核アーキテクチャの拡張指針** を定義する。

ここで定義する内容は v4 に即時実装しないが、
**v5 の仕様策定に直接つながる“地図”**となる。

---

# # **8-1. Evaluation Axis Expansion（評価軸の拡張）**

AMS v5 では、5大スコアに加え **追加カテゴリ（補助軸）** を検討する。

---

## **8-1-1. Long-context capability（超長文能力）**

長文処理能力を独立軸として評価。

* max context length
* 長文保持精度
* summarization robustness

※今は Performance に包含しているが、将来的に分離独立の可能性あり。

---

## **8-1-2. Multi-modality（多モード能力の評価）**

画像・音声・動画・コード生成・エージェント実行能力を
独立評価軸として切り出す。

v4 では透明性問題のため非対応だが、
将来的には：

* vision benchmark
* audio SNR
* tool-use accuracy
* retrieval-augmented performance

を評価に組み込める構造にする。

---

## **8-1-3. Hallucination robustness（幻覚耐性）**

信頼性の核心であり、v5 で追加する可能性が高い。

* truthfulness
* citation correctness
* hallucination under stress
* adversarial robustness

外部ベンチが整備され次第、実装可能。

---

## **8-1-4. Enterprise readiness（企業利用評価）**

企業向け要件：

* uptime
* SLA
* compliance
* data retention
* privacy guarantees

などを別軸として評価する可能性。

---

# # **8-2. Scoring Engine Re-architecture（スコアリングエンジンの高度化）**

将来 AMS は “計算エンジン単位で差し替え可能” な
モジュールアーキテクチャを持つべき。

---

## **8-2-1. Weight auto-optimization（重みの自動最適化）**

v4 は固定重み（非公開）だが、v6 以降では：

* 時系列データ
* メタベンチマークとの外部一致率
* 実測利用データ（匿名AGG）

を基に **重み最適化（回帰モデル or Bayesian optimization）** を検討。

---

## **8-2-2. Family-based scoring engine（ファミリー別エンジン）**

General / Chat / Coding / Math / Vision のエンジンを独立化。

これにより：

* ファミリー別評価の追加が容易
* vision / agent など将来カテゴリに対応
* performance の内部構造を柔軟にできる

---

## **8-2-3. ML-assisted scoring（半自動スコア推定）**

外部ベンチ不足の新規モデルに対し：

* 仕様
* コスト
* 過去モデルとの類似度
* vendor 更新傾向

を元に **推定スコアを生成する ML モデル** の導入も可能。

※ Provisional の補完用途。

---

# # **8-3. Model Discovery の拡張（新規モデル検知の進化）**

---

## **8-3-1. 自然言語抽出型モデル発見**

論文・ニュース・リリースノートから新モデル名を自然言語で抽出。
（embedding + NER モデルで自動判別）

---

## **8-3-2. RSS・ソーシャル監視（ただしスコアに反映しない）**

“モデルの存在” を検知するためのみ SNS を使用する。
（※評価には使わない）

---

## **8-3-3. ベンダー更新ストリームへの対応**

OpenAI / Google / Anthropic が提供予定の
「モデル更新イベントフィード」をサポート可能にする。

---

# # **8-4. Framework Interoperability（他プラットフォーム連携）**

AMS のデータを他ツールと連携。

---

## **8-4-1. Scoreboard API（read-only）**

公開データを API 形式でも提供：

* `/models`
* `/rankings`
* `/history/{model}`

商用利用は禁止だが、ツール連携用に read-only 開放可能。

---

## **8-4-2. Export formats（出力形式の追加）**

* CSV
* Markdown summary
* PDF snapshot

などを生成する可能性。

---

# # **8-5. UI & UX Roadmap（UIの将来拡張）**

---

## **8-5-1. モデル比較モード**

ユーザーが任意モデル2〜4種を比較できる UI。

* performance family breakdown
* safety event timeline
* cost curve
* adoption history

---

## **8-5-2. モデルの履歴表示（History timeline）**

毎日のスコア推移をグラフ化。
v4 の changes.json がこの基礎になる。

---

## **8-5-3. “用途別おすすめ” の生成（非推奨→慎重）**

用途別（coding / math など）で
“ランキングフィルタ”を提供するが、
これは AMS が用途適合を保証しないため慎重に扱う。

---

# # **8-6. Ecosystem Integration（AMS を広げる構想）**

---

## **8-6-1. AMS for LLM Providers（ベンダー向け Dashboard）**

将来的には、AI 企業が：

* 自社モデルの掲載状況
* スコアの内訳（非公開だが抽象化）
* 改善ポイント（abstract suggestion）

を確認できる専用ビューを提供可能。

（内部ロジックは完全秘匿であり続ける）

---

## **8-6-2. AMS Lite（ローカル版 / オフライン版）**

GitHub Pages やローカルで動く簡易版。
ロジックを含まない “ビューアのみ” をコンセプトに。

---

# # **8-7. 将来の課題（Risks & Open Questions）**

AMS v5+ に向けて考慮すべき課題：

### ● モデル数の爆発

毎月数十〜数百のモデルが登場する可能性。
→ discovery パイプラインのスケール対応が必要。

### ● 評価ベンチ不足

新しい領域（vision, agents）はまだ統一ベンチが未成熟。
→ Scoreboard は成熟を待つ必要がある。

### ● ベンダーによる“部分最適化”の可能性

ロジック非公開にしても存在するリスクだが、
AMS は v4 で十分に対策済。

### ● AI 自体が評価される時代（meta-eval）

将来的に AMS が“AI によって更新される”可能性。
→ その時のバイアス対策が課題。

---

# # **8-8. Section 8 完了まとめ**

このセクションにより：

* AMS v4 → v5 で何を追加すべきか
* スコア軸の拡張
* 評価エンジンの差し替え
* 新規モデル検知の強化
* UI/UX の将来像
* プラットフォーム化の可能性

が明確になった。

---

