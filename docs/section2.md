# 🟥 AI Model Scoreboard v4 – Internal Specification (English)

## Section 2 – Performance score

### Purpose
The performance score measures model capability using transparent, third-party evidence. Only objective benchmarks are included to keep rankings reproducible.

### Data sources we use
- Standard third-party benchmarks (e.g., LM Eval Harness suites).
- Chatbot Arena Elo, stored on a quarterly fixed scale.
- Vendor benchmarks with reduced weight when no independent data exists.

### Data we exclude
- Social media sentiment or anecdotal reviews.
- Marketing posts and unverifiable community tests.
- Any subjective human evaluation without a stable protocol.

### Scoring families and weights
| Family | What it measures | Typical inputs | Weight |
| --- | --- | --- | --- |
| General Reasoning | Broad QA and reasoning | MMLU, MMLU-Pro, BigBench | 0.40 |
| Coding Ability | Code generation and repair | HumanEval, MBPP, other code suites | 0.30 |
| Math & STEM | Structured calculation | GSM8K, MATH | 0.20 |
| Chat Quality | Dialog quality | Arena Elo, vendor chat benchmarks | 0.10 |

### Calculation steps
1. Normalize every benchmark to a 0–100 scale per family.
2. Apply family weights and compute the weighted mean.
3. Cap outliers and drop stale benchmark runs.
4. Record missing families as “not available” rather than zero so they do not distort the score.

### Rationale
Separating families prevents unrelated metrics from being averaged together. The weighted structure keeps the leaderboard stable even when one data source is temporarily missing.
