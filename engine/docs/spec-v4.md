# 📘 **AI Model Scoreboard v4 — Internal Specification (spec-v4.md)**

## **Part 1 / 8**

---

# # **0. Preface（序文 / 文書の目的）**

本ドキュメント **AI Model Scoreboard v4 – Internal Specification（内部仕様書 / 非公開）** は、
AI Model Scoreboard（以下 AMS）が提供するすべてのランキング・評価・ステータス表示の
**内部ロジック・採用基準・データ処理・自動更新パイプライン・安全装置**
を厳密に定義することを目的とする。

AMS の評価対象は、
大規模言語モデル（LLM）および同等の AI モデルである。

本仕様書は **外部公開されない**。
Methodology ページに記載される公開仕様は本ドキュメントの抽象化版であり、
**内部ロジック（式・閾値・補正・正規化係数・ファミリー分離ロジック）は一切公開しない。**

---

## **0.1 位置付け**

本仕様書は AMS v4 の “中核（Core）” として機能し、
Codex（AI エージェント）による実装処理の参照文書として利用する。
AMS の動作を変更する際には **すべてこの仕様書の改訂から開始する。**

---

## **0.2 非公開ポリシー**

以下の情報は外部公開禁止とする：

* スコア計算式（重み・係数・補正式など）
* 欠損データの補完アルゴリズム
* 昇格・降格ロジックの詳細
* canonical model name の内部表
* インシデントの内部評価値
* モデル検知の優先度パラメータ
* 内部 JSON（private-score.json など）

Methodology に含めるのはあくまで “思想・枠組み” のみとする。

---

## **0.3 文書構成**

本仕様書は以下の章で構成される：

```
0. Preface（序文）
1. Core Principles（AMS の前提思想）
2. Model Listing System（掲載レイヤー）
3. Scoring Specification（スコアリング仕様）
4. Layer Logic（昇格 / 降格 / 除外）
5. Data Pipeline（データ収集・モデル発見）
6. Methodology Translation（公開版への変換）
7. Automation Pipeline（自動更新）
8. Error Handling & Safeguards（安全装置）
9. Future Expansion（将来拡張）
10. Appendix（用語集 / スキーマ）
```

---

## **0.4 文書の適用範囲**

本仕様書が扱う領域：

* モデルの掲載判断
* スコア計算
* データ処理
* 自動更新ルール
* 非公開ロジックの扱い
* UIへ出す公開データの仕様
* 将来の拡張余地

本仕様書が扱わない領域：

* ベンダーの内部仕様
* モデルの利用方法
* 法的評価

---

## **0.5 設計哲学（Design Philosophy）**

AMS v4 は次の課題を解決するために設計されている：

* SNS などの主観・熱狂・評判を排除する
* 公平・再現性・客観性に基づくモデル評価
* 自動更新・ロジック非公開による評価の中立性
* ベンダー間のプロモーション影響を受けない評価
* 毎日の更新で常に最新の評価を維持する

AMS v4 は **“評価の透明性” と “ロジックの秘匿性” の両立**
という難題を両立させる設計となっている。

---

# 📘 **AI Model Scoreboard v4 — Internal Specification (spec-v4.md)**

## **Part 2 / 8**

---

# # **1. Core Principles（AMS の基本原則）**

AMS（AI Model Scoreboard）は “公平・客観・自動化” を実現するために
以下 5 つの基本原則（Core Principles）を採用する。

---

## **1.1 Principle 1 — Objectivity（客観性）**

AMS は **外部に存在する客観データのみ** で評価する。

排除される情報：

* SNS の評判（X/Twitter, Reddit, YouTube など）
* 口コミ・人気度
* 主観的な評価・レビュー
* 曖昧な「強い／弱い」議論
* プロンプト職人による手動評価

採用される情報：

* ベンチマーク結果
* API 仕様
* 公表されたモデルカード
* 価格情報
* 安全性レポート
* 稼働実績（API uptime）
* リリースノート・更新頻度
* インシデント情報（客観的証拠のみ）

---

## **1.2 Principle 2 — Reproducibility（再現性）**

AMS は **誰がいつ実行しても同じスコアになる** ことを最重要とする。

再現性の担保：

* 全ロジックは spec-v4.md に固定される
* Codex がロジックを変更しないよう制御
* 更新は GitHub Actions のみ
* “今日と明日で同じ入力なら同じ結果になる” ことを保証

---

## **1.3 Principle 3 — Continuous Update（継続的更新）**

AMS は **毎日0:00 UTC に自動更新**される。

理由：

* モデルの変化速度が極めて速いため
* API コストが日々変化するため
* 新モデルの登場が頻繁なため
* 安全性インシデントの影響を早く反映する必要があるため

ユーザーは「常に最新の評価」を得る。

---

## **1.4 Principle 4 — Non-Revealing Logic（ロジック非公開）**

AMS は透明性を追求しつつ、
**ロジックそのもの（式・係数・閾値・補正）は一切公開しない。**

理由：

1. ベンダーが AMS の得点だけを狙って
   “部分最適化したモデル” を作るのを防ぐ
2. 評価の中立性を維持する
3. Scoreboard を攻撃される（ハックされる）リスクを減らす
4. 任意の利用者によるロジック改変を防ぐ（fork対策）

公開されるのは「思想・構造・スコア結果」のみ。

---

## **1.5 Principle 5 — Separation of Internal & Public Layers（内部 / 公開層の完全分離）**

AMS は次の 2 層構造を採用する。

### **● Internal Layer（非公開）**

* scoring engine
* promotion/demotion logic
* canonical name table
* cost normalization
* safety penalty
* fallback rules

### **● Public Layer（公開）**

* rankings.json（最終結果）
* models.json（モデル情報）
* not-listed.json（非掲載モデル一覧）
* methodology（思想のみ）

内部 → 公開は **一方向** であり、
公開側から内部ロジックを逆算できない設計とする。

---

## **1.6 Principle 6 — Fail-Soft（壊れにくい設計）**

AMS は “壊れたデータを飲み込んでも壊れない” ように設計される。

例：

* 価格データが0やN/Aでも落ちない
* ベンチマークが欠損しても落ちない
* モデルカードが見つからなくても落ちない
* 内部例外が出てもスコアを前日に巻き戻す

これは Section 7（Safeguards）で詳細に述べる。

---

# # **2. Model Listing System（モデル掲載レイヤー）**

AMS では、モデルを 3 つのレイヤーに分類し、
Scoreboard への掲載状態を管理する。

```
Full Listing
Provisional Listing
Not Listed (Rejected)
```

この分類は AMS の “採用体系” を定義し、
スコア表示や UI の構造に直接影響する。

---

## **2.1 Full Listing（正式採用）**

Full Listing は AMS が正式に採用し、
ranking table に表示するモデル。

### **条件（要約）**

* 必須データが揃っている
* ベンチマークが複数ファミリーで取得できている
* API 情報が安定している
* 安全性インシデントが重大でない
* 過去 90 日以内に更新されている（推奨）

### **特徴**

* 最終スコアが計算されランキングに反映
* UI のメイン一覧に表示
* Detail page を持つ

---

## **2.2 Provisional Listing（暫定採用）**

データが不足 or 不確実な場合に採用される “暫定枠”。

### **条件（要約）**

* 新規モデルでベンチが未整備
* 価格情報が未公開
* API 仕様が不完全
* モデルカードが不十分
* 安全性評価に不確定要素がある

### **特徴**

* ランキングには掲載されるが “Provisional” バッジ付き
* スコアは内部推定を含む
* 欠損データは re-weight / fallback により処理される

---

## **2.3 Not Listed（Rejected / 非掲載モデル）**

AMS の基準を満たさない or 評価不能なモデル。

ランキングには表示されない。

### **条件（要約）**

* データが極端に不足
* 重大インシデント（Critical）
* ベンダーが model information を撤回
* API が機能していない
* 不正確 / 自称モデル（疑わしい）

### **特徴**

* ランキングに出ない
* 公開用 not-listed.json に “名前だけ” を載せる
* 内部理由は外部公開しない

---

## **2.4 “階層の意味” と “評価の柔軟性”**

AMS は “モデルクオリティの絶対評価” ではない。
あくまで「客観的に評価可能なモデルだけ扱う」ツールである。

そのため：

* Full ←→ Provisional の行き来は頻繁に発生
* Not Listed は “永久追放” ではない
* データが揃えば昇格する

柔軟に上下することを前提とした分類体系。

---

# 📘 **AI Model Scoreboard v4 — Internal Specification (spec-v4.md)**

## **Part 3 / 8**

---

# # **3. Scoring Specification（スコアリング仕様）**

本章では AMS v4 の **5大スコアカテゴリの正式仕様** を定義する。
これらは AMS の “心臓部” であり、Final Score（0〜100）を構成する。

AMS の評価軸：

```
Performance
Safety & Reliability
Adoption & Support
Openness & Transparency
Cost Efficiency
```

これら 5 つのスコアを内部ロジックで加算・正規化し
**最終スコア（final_score）** を算出する。

（※計算式そのものは非公開であり、ここでは構造のみ定義）

---

---

# ## **3.1 Performance Score（性能スコア）**

Performance は AMS の中核であり、最も重みが高い。

### **目的**

モデルの純粋な “推論品質” を客観データのみで評価する。

### **使用データ**

* LM Evaluation Harness
* LMSYS / Chatbot Arena 系
* ベンダー公表の能力指標（限定的）
* 複数ファミリー（chat, reasoning, math, coding, vision 等）

### **内部構造（公開されない）**

Performance は以下のような内部ブロックに分かれる：

```
Chat Performance
Reasoning / Logic
Coding Ability
Math / Science
Long-context Behavior
Vision Capability（該当モデルのみ）
Latency / Efficiency（遅延逆数）
```

それぞれ正規化し重み付けされるが、
**重み・結合式・補正式は非公開**とする。

---

## **3.1.1 ベンチマーク欠損時の取り扱い**

* 欠損ファミリーはスコア計算から除外
* 自動的に re-weight（内部ロジック）
* ファミリーが1つしかないモデルは **Provisional 強制維持**

---

## **3.1.2 ベンダー自称値の扱い**

* ベンダーの自己申告値のみ：
  → “信頼度が低いソース”として補正（内部減衰）

* ただし **データゼロのモデルを全て除外すると新興モデルが死ぬ**ため
  自称値を最低限のヒントとして扱う。

---

---

# ## **3.2 Safety & Reliability Score（安全性・信頼性）**

安全性・安定性を定量評価する。

### **使用データ**

* 公的な安全性レポート
* ベンダーの transparency report
* 外部監査情報
* インシデント（客観データのみ）

---

## **3.2.1 インシデント分類**

AMS ではインシデントを 3 階級で扱う：

```
Minor Incident
Major Incident
Critical Incident
```

### ● Minor

軽度の懸念。スコアに微弱減衰。

### ● Major

重大な問題。Provisional へ強制降格。

### ● Critical

致命的問題。Not Listed へ強制移動。

※ どのインシデントに該当するかは
内部の rule set（非公開）で自動判定する。

---

## **3.2.2 安全性評価の構造（内部）**

内部では次のような構造で処理する：

```
base_safety_score
 - incident_penalty
 + transparency_bonus
 + update_frequency_bonus
```

係数・閾値・補正式などは非公開。

---

---

# ## **3.3 Adoption & Support Score（採用・更新・API品質）**

モデルが「実際に生きている」かを評価する。

### **使用データ**

* 更新頻度（release notes / change logs）
* API uptime / status
* 実運用の安定性
* ベンダーのサポート状況
* SDK / 言語対応

---

## **3.3.1 freshness（更新新しさ）**

更新日の例：

* 30 日以内 → 高スコア
* 60 日 → 中
* 90 日以降 → 要警告
* 150 日以降 → Not Listed へ近づく

（閾値ロジックは非公開）

---

## **3.3.2 稼働安定性（runtime stability）**

API の 99.9% uptime や
Error 率などを元に内部スコア化。

---

---

# ## **3.4 Openness & Transparency Score（透明性スコア）**

透明性を“姿勢”として評価する。

AI コミュニティが求めているのは
「クローズド or オープン」という二分ではなく
**“どれだけ説明しようとしているか”** である。

---

## **3.4.1 評価要素**

* モデルカードの情報量
* データ開示範囲
* fine-tuning 情報
* 安全性評価プロセス
* 外部レビューへの積極性
* RLHF などの学習方針の明示

---

## **3.4.2 注意事項**

AMS は
**クローズドモデルだから減点**
**オープンモデルだから加点**
を行わない。

透明性の“姿勢”を評価するのみ。

---

---

# ## **3.5 Cost Efficiency Score（費用効率）**

### **目的**

「同じ性能で安いほうが良い」を定量化。

### **使用データ**

* input token 単価
* output token 単価
* 性能との比率（performance/cost）

内部ロジックにより正規化される。

---

## **3.5.1 安価すぎる低性能モデルへの対策**

低性能だが安いモデルが上位にならないよう
AMS は以下の調整を内部で行う：

* performance × cost の複合評価
* threshold barrier を設定
* 低性能モデルの過剰評価を防ぐ補正式

（実際の式は非公開）

---

---

# ## **3.6 Final Score（総合スコア）**

AMS v4 の最終スコアは：

```
Performance
Safety
Adoption
Openness
Cost-efficiency
```

の 5 スコアから合成される。

重みは内部ロジックで固定化されているが非公開。

結果は 0〜100 スケールに正規化される。

---

## **3.6.1 UI の表示仕様**

公開UIに表示されるのは：

* final_score（0〜100）
* 各カテゴリの小スコア
* Provisional badge（暫定）
* モデルのレイヤー（Full / Provisional / Not Listed）

内部ロジックは UI に表示しない。

---

# 📘 **AI Model Scoreboard v4 — Internal Specification (spec-v4.md)**

## **Part 4 / 8**

---

# # **4. Promotion / Demotion Logic（昇格・降格ロジック）**

モデルは時間とともに品質・安定性・価格・安全性が変化するため
AMS は **自動的に昇格・降格する仕組み** を持つ。

AMS の昇格降格は完全自動であり、
**手動介入は “例外処理” としてのみ行う。**

---

# ## **4.1 レイヤー構造の再掲**

AMS の 3 レイヤーは以下：

```
Full Listing（正式採用）
Provisional Listing（暫定）
Not Listed（非掲載 / Rejected）
```

---

# ## **4.2 昇格基準（Promotion Rules）**

昇格は以下の 3 種類：

---

## **4.2.1 Provisional → Full Listing**

条件（内部ロジックにより決定）：

* 欠損データが解消
* 複数ベンチマークが揃う
* 安全性に重大懸念なし
* API が安定
* 更新が一定頻度で継続
* 内部総合スコアが Full の閾値を超える

**人間の判断は不要**。

---

## **4.2.2 Not Listed → Provisional**

Not Listed（Rejected）になったモデルも復活可能。

条件：

* データ不足が解消
* 再登場し API が復活
* モデルカードを再公開
* 安全性レポートが改善
* 価格情報が公開される

AMS は “永久追放” をしない。

「評価可能になったら戻す」が原則。

---

## **4.2.3 Not Listed → Full**

極めてまれだが、
以下を満たした場合に直接 Full へ昇格：

* 突然データが出揃った（新型モデルなど）
* ベンチ・API・安全性が一気に充足
* 高いスコアを内部ロジックが判定

---

---

# ## **4.3 降格基準（Demotion Rules）**

降格は主に以下の 3 種類：

---

## **4.3.1 Full → Provisional**

条件：

* 更新が長く停滞（例：90 日超）
* API の安定性が低下
* インシデント（Major）が発生
* モデルカードが撤回 / 不完全化
* ベンチマーク更新が古くなる

---

## **4.3.2 Provisional → Not Listed**

条件：

* データがあまりにも不足
* インシデント（Critical）発生
* API が停止 / 実質死亡
* ベンダーからモデル撤回
* 情報追跡不能

---

## **4.3.3 Full → Not Listed**

強制降格パターン。

条件：

* Critical Incident
* ベンダーがモデル完全撤回
* API 廃止
* 悪質な不正行為が確認された場合
  （例：性能を偽装していた、商用利用できない虚偽表示）

---

---

# ## **4.4 境界条件（Borderline Behavior）**

AMS は “境界線上の揺れ” に対処するため
**スコアの微小変動で上下しないようヒステリシス（遅延判定）** を採用する。

例：

* Provisional → Full は 3 日連続で条件クリア
* Full → Provisional は 7 日連続で不安定
* Full → Not Listed は即時
* Provisional → Not Listed は 5 日様子見

（具体数値は非公開ロジックで調整）

---

---

# ## **4.5 新規モデルの扱い**

AMS に存在しないモデル名が検出された場合：

```
→ Provisional Listing に自動登録（Default）
```

条件：

* API が利用可能
* 名前が正しく解釈できる（canonical brand mapping）
* 価格 or モデルカード or ベンチのどれかが存在する

**初期スコアは最低限の暫定値から開始し、
データが集まるごとに自動的に正常化される。**

---

---

# ## **4.6 旧モデルの扱い**

旧バージョン（例：GPT-3.5、Claude 1 など）は以下の基準：

```
active マークが外れた瞬間に Provisional へ移動
```

その後：

* ベンチ更新が止まる
* 価格が更新されない
* API が非推奨扱いになる

これらが一定しきい値を超えると
Not Listed に移動する。

---

---

# ## **4.7 ベンダー変更 / モデル改名の扱い**

例：
LLaMA → Meta Llama
Gemini → Google Gemini
Gemini 1.5 Flash → Flash 1.5

AMS は内部で「canonical name table」によって
全てを **正規化して扱う**。

名前変化でスコアが変わらないようにし、
新旧モデルの混乱を防ぐ。

---

---

# ## **4.8 手動介入（Manual Overrides）**

手動介入は “最小限” に限定される。

必要となるケース：

* API が1週間以上完全停止している
* ベンダーがモデル情報を虚偽掲載していた
* メジャーアップデートをベンダーが隠した
* 新型モデルが公開直後にスコアを破壊してしまうケース
* 緊急安全性アラート

これらは GitHub 上の
`manual-overrides.yaml`
のみで操作できる。

*ただし override は 30 日で自動無効化される。*

---

# 📘 **AI Model Scoreboard v4 — Internal Specification (spec-v4.md)**

## **Part 5 / 8**

---

# # **5. Data Collection & Daily Update Pipeline（データ収集・自動更新パイプライン）**

AMS が毎日0:00 UTCに実行する “自動更新ループ” の仕様を完全に定義する。

---

# ## **5.1 全体構造（High-Level Overview）**

AMS のデータパイプラインは以下の 3 層で構成される：

```
Layer 1: Raw Data Fetchers（外部データ取得）
Layer 2: Normalization & Validation（正規化・検証）
Layer 3: Scoring Engine → rankings.json（最終結果生成）
```

結果は GitHub Actions により
**毎日 0:00 UTC** に更新・コミットされる。

---

# ## **5.2 収集対象データ（Canonical Sources）**

AMS が利用するデータソースは **客観性のある領域に限定** される。

### **5.2.1 ベンチマーク系**

* LM Evaluation Harness
* EleutherAI 評価データ
* LMSYS / Chatbot Arena
* ベンダー公表の test suite
  （自称値は補正をかけた最小限扱い）

---

### **5.2.2 API / Platform 系**

* 各ベンダーの pricing JSON
* モデル一覧
* 速度・レイテンシ（公表データ or 外部 API 測定）
* SDK 対応状況
* API status（uptime モニタリング）

---

### **5.2.3 文書 / 公開情報系**

* モデルカード
* チェンジログ（release notes）
* 安全性レポート
* 外部監査レポート

---

### **5.2.4 インシデント系**

* 公的に確認されたインシデント
* 論文で報告された重大欠陥
* セキュリティ事故
* 重大挙動不良に関する客観発表

※SNS の噂、憶測、誇張は **一切使わない**。

---

# ## **5.3 データ取得（Raw Fetch Step）**

GitHub Actions が実行する fetch スクリプトは次を行う：

```
1. モデル一覧の取得（vendors.json）
2. ベンチマークの取得（benchmarks/*.json）
3. 価格情報の取得（pricing/*.json）
4. モデルカードの取得（cards/*.json）
5. API status の取得（status/*.json）
6. インシデント情報の取得（incidents/*.json）
```

取得後：

* schema validate
* canonical 形式に変換
* 欠損・破損を修復 or fallback
* vendor-specific quirks を補正
  （例：OpenAI の context-length 表記揺れ）

---

# ## **5.4 正規化フェーズ（Normalization）**

各フィールドを **AMS 内部統一形式** に揃える。

例：

```
"OpenAI GPT-4.1" → canonical: "gpt-4.1"
"Anthropic Claude 3 Opus (2025)" → canonical: "claude-3-opus"
"Qwen/Qwen2.5-72B-Instruct" → canonical: "qwen2.5-72b-instruct"
```

統一表は internal table（非公開）で管理。

---

## **5.4.1 欠損処理（Missing Data Rules）**

AMS は壊れにくい設計を採用しており、
欠損データへの対応は以下の通り：

```
必須項目 Missing → Provisional に強制（スコア計算は続行）
重要項目 Missing → re-weight（内部処理）
非重要項目 Missing → そのまま継続
```

---

## **5.4.2 外れ値補正**

API 価格が異常（例：$0.00000001 など）なら
内部閾値に基づいて補正 or 除外。

またベンチマーク値に想定外の外れ値があれば
スコアへの影響を最小化する（内部ロジック）。

---

# ## **5.5 スコアリングフェーズ（Scoring Engine）**

Normalization 後、内部 scoring engine が実行される。

処理順：

```
1. Performance Score
2. Safety Score
3. Adoption Score
4. Openness Score
5. Cost Efficiency Score
6. final_score を計算し 0〜100 に正規化
7. レイヤー判定（Full / Provisional / Not Listed）
8. UI 出力用データ化
```

各ステップのロジックは非公開。

---

# ## **5.6 更新結果の出力（Artifacts）**

生成されるデータは以下：

### **5.6.1 `rankings.json`**

* 全 Full / Provisional モデル
* final_score
* 各カテゴリの小スコア
* 価格・更新日など

ユーザーのメインデータ。

---

### **5.6.2 `models.json`**

* 各モデルのメタ情報
* canonical 名
* UI に必要な要素

---

### **5.6.3 `not-listed.json`**

* 掲載されないモデルの一覧（名前だけ）

---

### **5.6.4 `history/*.json`**

* 日次スナップショット（30日分保持）
* スコアの変動履歴

---

### **5.6.5 `logs/update-YYYYMMDD.log`**

* 更新時の内部ログ（失敗時デバッグ用）

---

# ## **5.7 GitHub Actions（実行スケジュール）**

毎日 0:00 UTC に下記 Job が走る：

```
update-scoreboard:
  - fetch data
  - normalize
  - scoring
  - layer assignment
  - generate artifacts
  - commit & push
```

失敗したとき：

* 前日の成果物にロールバック
* ステータスを badge に表示
* 3 日連続で更新失敗した場合は緊急アラート

---

# ## **5.8 手動更新（Manual Refresh）**

UI からではなく、
GitHub Actions の “Run workflow” ボタンから実行可能。

ただし：

```
内部ロジックは GitHub 上では見えない
更新は scoring-engine が行うだけ
```

UI の更新のみを目的とする。

---

# 📘 **AI Model Scoreboard v4 — Internal Specification (spec-v4.md)**

## **Part 6 / 8**

---

# # **6. Safeguards & Fail-Safe Design（安全装置・フェイルセーフ設計）**

AMS は “壊れない評価システム” を最重要視する。
AI モデル業界は高速・混沌・不確実であり、
外部データの欠損・改名・APIエラーが日常的に発生するためである。

この章では、AMS がどんな状況でも破綻しないための
**Safeguards（安全装置）** を完全に定義する。

---

# ## **6.1 Goal（Safeguards の目的）**

```
・スコアが突然 0 点 → 上位変動が破壊される
・API が一時停止 → モデルが消える
・ベンチが欠損 → 低スコアで誤評価される
・インシデントが誤検知 → Full→Not Listed の誤爆
・ベンダーの命名変更で重複/消滅
```

これらを **100% 回避** するために
AMS は多段構造の防御を採用する。

---

# ## **6.2 Safeguard Layer 1 — Data Validation（入力データ保護）**

取得データが壊れていても AMS は壊れない。

### **6.2.1 Schema Validation**

取得した JSON を各カテゴリごとに schema check。

不足時：

```
reject せず → fallback に回す
```

### **6.2.2 Value Sanity Check**

異常値を自動検知：

* 価格が 0
* context length が 1e9
* ベンチマークが負値
* 更新日が未来になっている
* モデルカードが空文字

これらはすべて **修正 or 無視**（内部判断）し、処理は継続される。

---

# ## **6.3 Safeguard Layer 2 — Fallback Rules（欠損時の予備ロジック）**

AMS は、欠損データがあっても評価を継続する。

### **6.3.1 Fallback の基本方針**

```
Missing だから 0 点 → ❌（評価崩壊）
Missing でも評価は継続 → ⭕

```

AMS は “欠損時は重みゼロで正規化” を採用し、
カテゴリ間の不公平を防ぐ。

---

### **6.3.2 具体例**

#### **例1：価格が欠損**

→ Cost Score のみ re-weight。Final Score には影響最小。

#### **例2：ベンチマークが 1 系列のみ**

→ Provisional のまま評価するが、スコアは生きる。

#### **例3：モデルカードが欠損**

→ Openness Score だけ下げ、他カテゴリは維持。

#### **例4：API 状態が読み取れない**

→ runtime スコアを保留し、前日値を継続（後述）。

---

# ## **6.4 Safeguard Layer 3 — Previous Day Carryover（前日値の継承）**

AMS は “急変による誤爆” を防ぐため
**前日の値を自動参照する仕組み** を備える。

### **ルール：**

* 今日の更新に重大欠損がある
* ベンチ全滅
* 価格 API 全滅
* モデル一覧が空になった
* インシデント検出器が壊れた

このどれかが起こると：

```
→ 前日の rankings.json をそのまま採用  
→ UI も前日のまま  
→ ログに「carryover」を記録
```

AMS が「壊れない」のはこの設計による。

---

# ## **6.5 Safeguard Layer 4 — Hysteresis（境界判定の遅延）**

モデルが Full ↔ Provisional を行き来しすぎると
UI も信頼性も破壊される。

AMS は変動を吸収するため
**昇格・降格に遅延ロジック（ヒステリシス）** を採用する。

例：

```
Full → Provisional は “悪化が一定日数継続した場合”
Provisional → Full は “改善が一定日数継続した場合”
```

この閾値は内部ロジックで管理し、公開しない。

---

# ## **6.6 Safeguard Layer 5 — Canonical Name Mapping（名前変更保護）**

モデル名の表記揺れ・改名による混乱を防ぐ。

例：

```
GPT-4.1 Chat
OpenAI GPT-4.1
gpt4.1chat
```

これらは自動的に **canonical: "gpt-4.1"** に統一される。

ベンダー改名時も同様：

```
Gemini → Google Gemini
Claude → Anthropic Claude
LLaMA → Meta Llama
```

正規化は internal table（非公開）で行われる。

---

# ## **6.7 Safeguard Layer 6 — Audit Trail（内部監査ログ）**

AMS は毎日必ず audit log を生成する：

```
audit-YYYYMMDD.json
```

含まれる要素：

* 取得データ総数
* 欠損数
* fallback 発生回数
* 名前変換ログ
* 昇格 / 降格イベント
* Critical Incident の有無

UI には出さないが、Scoreboard の健全性を保つ。

---

# ## **6.8 Safeguard Layer 7 — Rollback System（自動ロールバック）**

更新失敗時：

```
当日 artifacts → 廃棄
前日 artifacts → 復元
```

ロールバック対象：

* rankings.json
* models.json
* not-listed.json
* history への追記停止

3 日連続失敗した場合、
開発者に alert（Slack/Webhook/メール等）。

---

# ## **6.9 Safeguard Layer 8 — Manual Overrides（手動例外処理）**

このセーフガードは重要。

内部ファイル：

```
/internal/manual-overrides.yaml
```

でのみ、特定モデルに対して手動調整を行える。

例：

* API が死亡しているのに「Full」に残ってしまう
* 新型モデルが誤判定で極端に高スコア
* ベンダーが虚偽情報を出してきた（稀だが起こり得る）
* 一時的な UI 再配置のための隠し処理

但し、**override は 30 日で自動リセット**される。

---

# ## **6.10 Safeguard Layer 9 — Vendor Abuse Prevention（悪用防止）**

AMS は “AMS のスコアだけを上げるためのインチキ最適化” を防止する。

対策：

* 式・係数・閾値を非公開
* 複数ソースから cross-check
* 異常値は内部で検出・補正
* モデルカードの急激な肥大化にスコアを依存しない
* 不自然なベンチ上昇を抑制（内部ロジック）

結果：

> **ベンダーは AMS をチートできない。
> 真に性能が高いモデルだけが高スコアを取る。**

---

# 📘 **AI Model Scoreboard v4 — Internal Specification (spec-v4.md)**

## **Part 7 / 8**

---

# # **7. Public Architecture & Output Format（公開アーキテクチャ & 出力形式）**

AMS の内部ロジックは非公開だが、
**生成される成果物（rankings.json / models.json / not-listed.json / history）と
UI 構造は完全に公開**される。

この章では、外部へ公開されるデータ構造を定める。

---

# ## **7.1 Public Output Summary（公開される成果物一覧）**

AMS が毎日生成するのは以下：

```
rankings.json        … メインランキング
models.json          … モデルのメタ情報
not-listed.json      … 非掲載モデル一覧（名前のみ）
history/YYYYMMDD.json  … スコア履歴
index.json           … バージョン・更新日時情報
logs/update-YYYYMMDD.log … 内部ログ（必要に応じて公開）
```

UI は **rankings.json と models.json だけで動作可能** となる設計。

---

# ## **7.2 rankings.json（最重要データ）**

AMS が公開する “最終ランキング” の JSON。

例（簡略版）：

```json
[
  {
    "model": "claude-3-opus",
    "vendor": "Anthropic",
    "layer": "full",
    "score": 93.2,
    "scores": {
      "performance": 96,
      "safety": 88,
      "adoption": 91,
      "openness": 70,
      "cost": 65
    },
    "updatedAt": "2025-12-05T00:00:00Z"
  },
  {
    "model": "gpt-4.1",
    "vendor": "OpenAI",
    "layer": "full",
    "score": 91.8,
    "scores": {
      "performance": 95,
      "safety": 92,
      "adoption": 90,
      "openness": 68,
      "cost": 70
    },
    "updatedAt": "2025-12-05T00:00:00Z"
  }
]
```

---

## **構造のポイント**

* **layer** が Full / Provisional
* **score** は final_score（0–100）
* **scores** の小カテゴリも公開される
* 内部式は非公開
* daily update により常に最新

---

# ## **7.3 models.json（メタ情報 / UI 参照用）**

モデルの基本情報を持つ。

```json
{
  "claude-3-opus": {
    "name": "Claude 3 Opus",
    "vendor": "Anthropic",
    "released": "2025-02-05",
    "context": 200000,
    "type": "text",
    "pricing": {
      "input": 15,
      "output": 75,
      "currency": "USD per 1M tokens"
    },
    "notes": "High-end reasoning model"
  }
}
```

### **目的**

* UI 表示のためのラベル・価格・補足情報
* Scoreboard の「モデル図鑑」部分を構成

評価ロジックに必要な情報は internal で保持され
ここには含まれない。

---

# ## **7.4 not-listed.json（非掲載モデルの公開一覧）**

Not Listed のモデル名だけを公開。

例：

```json
[
  "gpt-3.5-turbo",
  "mistral-medium-old",
  "gemini-1.0-pro-deprecated"
]
```

用途：

* “AMS が追跡しているモデル” を外部にも見せる
* 透明性の最低限を担保（理由は公開しない）

---

# ## **7.5 history/YYYYMMDD.json（スコア履歴）**

日次スコアを保持し、UI の “変動グラフ” に利用。

例：

```json
{
  "model": "claude-3-opus",
  "history": [
    {"date": "2025-12-01", "score": 92.0},
    {"date": "2025-12-02", "score": 92.5},
    {"date": "2025-12-03", "score": 93.0},
    {"date": "2025-12-04", "score": 93.2}
  ]
}
```

---

# ## **7.6 index.json（Scoreboard のメタデータ）**

AMS 全体のメタ情報。

```json
{
  "version": "4.0",
  "updatedAt": "2025-12-05T00:00:00Z",
  "modelsCount": 37,
  "fullCount": 22,
  "provisionalCount": 12,
  "notListedCount": 3
}
```

---

# ## **7.7 Public UI Architecture（フロントエンド設計）**

AMS の公開 UI は、
**scoreboard.json 系を読み取るだけで動作する純静的サイト** を前提とする。

---

## **7.7.1 UI の 3 ページ構成**

```
/           → ランキングページ
/model/:id → モデル詳細ページ
/methodology → 公開用 Methodology
```

---

## **7.7.2 ランキングページ（/）**

表示内容：

* 全 Full / Provisional モデル
* スコア（最後に更新された日付付き）
* レイヤーバッジ
* ソート：score順 / vendor順 / 日付順

---

## **7.7.3 モデル詳細ページ（/model/:id）**

内容：

* モデル説明
* パフォーマンススコア詳細（グラフ）
* 更新履歴
* 価格情報
* UI上の各種ラベル（Full / Provisional）
* “Why Provisional?” の簡易表示（理由は Abstract のみ）

※ 内部ロジックの理由は説明しない（非公開）。

---

## **7.7.4 methodology ページ**

公開版 Methodology には以下だけを掲載：

* 5大評価軸の説明
* レイヤー構造（Full / Provisional / Not Listed）
* 安全性インシデントがスコアに影響すること
* Daily Update の概要
* 透明性の思想（ロジックそのものは出さない）

**内部ロジック・係数・閾値・式は一切掲載しない。**

すでにあなたが書いた
`methodology-index.md` がこれに該当する。

---

# ## **7.8 公開 API（Static Hosting なので実質 JSON 配信）**

AMS v4 の公開 API はベルセル/Vercel や Cloudflare Pages など
「静的ファイル配信」として運用される。

---

### 提供する API（静的 JSON）

```
/rankings.json
/models.json
/not-listed.json
/history/*.json
/index.json
```

サーバー処理は不要。

---

# ## **7.9 バージョン管理（Versioning）**

AMS はメジャーバージョンを持つ。

```
v4.0    → 現行（この仕様書）
v4.1+   → 小改修（仕様書が更新されない範囲）
v5.0    → 将来の新体系
```

UI と JSON schema は v4 系で固定。
v5 以降は別フォルダで共存可能にする。

---

# 📘 **AI Model Scoreboard v4 — Internal Specification (spec-v4.md)**

## **Part 8 / 8（Final Part）**

これで **spec-v4.md の全セクションが出揃う**。
この章は「運用プロセス」「将来拡張」「開発方針」をまとめる仕上げ部分。

---

# # **8. Operations, Governance & Future Extensions（運用・管理・将来拡張）**

AMS（AI Model Scoreboard v4）は
“自動更新・軽量・高信頼” を軸とした永続運用モデルを採用する。

本章では、運用上のルール、手動介入の方針、将来的な発展方向を定義する。

---

# ## **8.1 Daily Operation（通常運用）**

AMS の日常運用は **完全自動更新** を基本とする。

---

### **8.1.1 毎日の流れ（0:00 UTC）**

GitHub Actions が以下を実行：

```
1. fetch external data
2. normalize
3. scoring engine
4. layer assignment
5. generate rankings & artifacts
6. push commit
7. rotate history
```

UI は最新 JSON を参照するだけで更新される。

---

### **8.1.2 人間が行う作業**

原則なし。

ただし次の 4 つは例外：

* ベンダーの命名体系が急に変わった
* API エラーが 1 週間以上続いた
* 明らかに壊れたデータ（例：価格が10万倍誤記）
* 緊急安全性アラート

これらは manual-overrides.yaml により対応。

---

---

# ## **8.2 Manual Overrides（手動例外処理）**

AMS は “完全自動” を理想とするが、
現実にはベンダーのデータ破損や API 障害が発生する。

### **8.2.1 manual-overrides.yaml の目的**

* 自動処理が壊れた時の緊急措置
* 正常化までの「応急処置」
* 長期反映されない（30日で自動リセット）

---

### **8.2.2 Override の種類（例）**

```
forceLayer: provisional / full / not-listed
forceScoreOffset: ±数値
suppressIncident: true
hideFromRanking: true
```

**これらは外部公開されず、内部ロジックにのみ影響する。**

---

---

# ## **8.3 Model Lifecycle Management（モデルの寿命管理）**

モデルにはライフサイクルがある。
AMS はこれを管理し、ランキングの質を維持する。

---

### **8.3.1 Active / Deprecated / Retired**

AMS はモデルを以下に分類：

```
Active       → Scoreboard の対象
Deprecated   → Provisional に移動し、徐々に評価対象外へ
Retired      → Not Listed へ
```

例：

* GPT-3.5 → Deprecated → Not Listed
* Claude 2 → Deprecated → Not Listed

---

### **8.3.2 廃止モデルの扱い**

API 提供終了が確認されたら：

```
即日 Provisional → Not Listed へ
```

history の保持は継続し、アーカイブされる。

---

---

# ## **8.4 Governance Model（運営体制）**

AMS は neutrality（中立性）を維持するため
以下のガバナンスを採用する。

---

### **8.4.1 開発者の権限**

開発者ができること：

* manual overrides（最小限）
* canonical name table の更新
* schema の更新
* 新ベンダーの追加
* scoring-engine のバージョン更新（v5 以降）

開発者が **できない** こと：

* 特定モデルのスコアを恣意的に上げ下げする
* 内部ロジックを公開 UI から参照可能にする
* スコアの理由を公開する（非公開で固定）

**AMS は恣意的に動かせない設計。**

---

### **8.4.2 自動更新の監査**

* audit logs を毎日生成
* 更新異常時はアラート
* 手動修正はログに残る
* ロールバック履歴も保持

AMS が “勝手に壊れない” ようにする。

---

---

# ## **8.5 Future Extensions（将来拡張）**

v4 は “自動化された AI モデル比較エンジン” として完成したが
将来拡張の余地を残す。

---

### **8.5.1 v5 で想定される改善**

```
① モデル能力のカテゴリ細分化（reasoning / math / tool-use）
② マルチモーダル統合（画像・音声・動画）
③ 評価の個別プロファイル（用途別スコア）
④ GPT Store / OpenAI o3 系の「tool-calling」ベンチ統合
⑤ 価格・性能の時系列予測モデル
```

これらは scoring-engine v5.x として別系統で管理される。

---

### **8.5.2 ベンダー API 変化への対応**

新 API や name schema が登場した場合：

* canonical name mapping に追加
* schemas/*.json を更新
* 自動化パイプラインは変更せずに済む設計

UI 側は基本的に変更不要。

---

### **8.5.3 外部プラットフォーム統合**

今後の候補：

* HuggingFace の新 Leaderboard 連携
* LLM360 / Chatbot Arena v2
* LM-Harness v4
* 外部安全性レポート DB との自動連携

これらは internal pipeline に追加されるだけで
公開 UI は変わらない。

---

---

# ## **8.6 Philosophy（AMS の姿勢）**

AMS の理念を再掲する：

```
AI モデルの進化は速すぎて  
人間が「手で比較」することはもはや不可能。

AMS はその代わりに  
客観データのみで淡々と自動更新される  
“中立なモデル評価インフラ” を目指す。
```

AMS は以下を保証する：

* ベンダーに左右されない
* SNS の声に左右されない
* 感情に左右されない
* UI を派手にしない
* スコアを説明しすぎない
* 結果だけを提示する

そして：

> **良いモデルは自然に上がり、
> 悪いモデルは自然に下がる。
> その透明な秩序を作るのが AMS。**

---

# ## **8.7 Final Structure（spec-v4.md の完成形）**

spec-v4.md は以下の 8 章で構成される：

```
1. Core Principles
2. Model Listing System
3. Scoring Specification
4. Promotion / Demotion Logic
5. Data Collection Pipeline
6. Safeguards
7. Public Architecture & Outputs
8. Operations & Future Extensions
```

---





