export type ScoreCategoryKey = "C1"|"C2"|"C3"|"C4"|"C5"|"C6"|"C7";

export type ScoreMetricKey =
  // C1 Performance
  | "P1"|"P2"|"P3"|"P4"
  // C2 Absolute Specs
  | "S1"|"S2"|"S3"|"S4"
  // C3 Cost Efficiency
  | "K1"|"K2"
  // C4 Speed
  | "V1"
  // C5 Reliability
  | "R1"|"R2"|"R3"
  // C6 Capability (tools / structured output / streaming)
  | "F1"|"F2"|"F3"
  // C7 Transparency & Security
  | "T1"|"T2"|"T3";

export const CATEGORY_WEIGHT: Record<ScoreCategoryKey, number> = {
  C1: 0.40,
  C2: 0.20,
  C3: 0.12,
  C4: 0.10,
  C5: 0.08,
  C6: 0.06,
  C7: 0.04,
};

export const CATEGORY_LABEL: Record<ScoreCategoryKey, string> = {
  C1: "Performance",
  C2: "Absolute Specs",
  C3: "Cost Efficiency",
  C4: "Speed",
  C5: "Reliability",
  C6: "Capability",
  C7: "Transparency & Security",
};

export const METRIC_LABEL: Record<ScoreMetricKey, string> = {
  // C1
  P1: "Benchmark coverage",
  P2: "Benchmark strength",
  P3: "Benchmark recency",
  P4: "Reproducibility",

  // C2
  S1: "Context length",
  S2: "Max output",
  S3: "Modalities",
  S4: "Release recency",

  // C3
  K1: "Input price",
  K2: "Output price",

  // C4
  V1: "Latency",

  // C5
  R1: "Uptime",
  R2: "Error rate",
  R3: "Continuity (7d)",

  // C6
  F1: "Tool calling / function calling",
  F2: "Structured output (JSON)",
  F3: "Streaming",

  // C7
  T1: "Official page",
  T2: "Repository link",
  T3: "Paper / technical report",
};

export const FORMULA_TEXT: Record<ScoreCategoryKey, string> = {
  C1: "C1 = 100 × (0.25·P1 + 0.35·P2 + 0.20·P3 + 0.20·P4)",
  C2: "C2 = 100 × (0.40·S1 + 0.20·S2 + 0.20·S3 + 0.20·S4)",
  C3: "C3 = 100 × (0.45·K1 + 0.55·K2)",
  C4: "C4 = 100 × V1",
  C5: "C5 = 100 × (0.50·R1 + 0.30·R2 + 0.20·R3)",
  C6: "C6 = 100 × (0.40·F1 + 0.35·F2 + 0.25·F3)",
  C7: "C7 = 100 × (0.50·T1 + 0.30·T2 + 0.20·T3)",
};
