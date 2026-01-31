export type EvidenceType = "official_page" | "dev_activity" | "paper" | "audit";

export type ScoreItemKey =
  | "S1"
  | "S2"
  | "S3"
  | "S4"
  | "S5"
  | "S6"
  | "S7"
  | "S8"
  | "T1"
  | "T2"
  | "T3"
  | "T4"
  | "Q1"
  | "Q2"
  | "Q3";

export type ScoreItemPolicy = {
  id: string;
  label: string;
  requiredInputs: string[];
  requiredInputsAnyOf?: string[];
  evidenceTypes: EvidenceType[];
  scoreSummary: string;
};

export const SCORE_ITEM_POLICY: Record<ScoreItemKey, ScoreItemPolicy> = {
  S1: {
    id: "safety-doc",
    label: "Safety documentation",
    requiredInputs: ["safetySection", "highRisk"],
    evidenceTypes: ["official_page"],
    scoreSummary: "10 points across safety section + high-risk coverage, normalized to 100.",
  },
  S2: {
    id: "alignment-disclosure",
    label: "Alignment disclosure",
    requiredInputs: ["rlhf", "dataDisclosure"],
    evidenceTypes: ["official_page"],
    scoreSummary: "10 points across RLHF + training data disclosure, normalized to 100.",
  },
  S3: {
    id: "misuse-policy",
    label: "Misuse policy coverage",
    requiredInputs: ["misusePolicy", "harmMitigation"],
    evidenceTypes: ["official_page"],
    scoreSummary: "10 points across misuse policy + harm mitigation, normalized to 100.",
  },
  S4: {
    id: "external-audit",
    label: "External audit & red teaming",
    requiredInputs: ["redTeam", "independentAudit"],
    evidenceTypes: ["audit"],
    scoreSummary: "20 points across red-team + independent audit signals, normalized to 100.",
  },
  S5: {
    id: "transparency-update",
    label: "Transparency updates",
    requiredInputs: ["transparencyUpdate"],
    evidenceTypes: ["official_page"],
    scoreSummary: "10 points for a recent transparency update, normalized to 100.",
  },
  S6: {
    id: "minor-incidents",
    label: "Minor incidents",
    requiredInputs: ["minorCount"],
    evidenceTypes: ["audit"],
    scoreSummary: "Penalty of 12.5 points per minor incident from a 100 baseline.",
  },
  S7: {
    id: "major-incidents",
    label: "Major incidents",
    requiredInputs: ["majorCount"],
    evidenceTypes: ["audit"],
    scoreSummary: "Penalty of 50 points per major incident from a 100 baseline.",
  },
  S8: {
    id: "critical-incidents",
    label: "Critical incidents",
    requiredInputs: ["criticalCount"],
    evidenceTypes: ["audit"],
    scoreSummary: "Any critical incident sets the score to 0; otherwise 100.",
  },
  T1: {
    id: "model-doc",
    label: "Model documentation",
    requiredInputs: ["modelCard", "overview", "limitations"],
    evidenceTypes: ["official_page"],
    scoreSummary: "15 points across model card + overview + limitations, normalized to 100.",
  },
  T2: {
    id: "training-data",
    label: "Training data disclosure",
    requiredInputs: ["dataCategories", "dataFiltering", "copyright"],
    evidenceTypes: ["official_page"],
    scoreSummary: "15 points across data categories + filtering + licensing, normalized to 100.",
  },
  T3: {
    id: "paper-report",
    label: "Paper / technical report",
    requiredInputs: ["architecture", "parameterScale"],
    evidenceTypes: ["paper"],
    scoreSummary: "10 points across architecture + parameter scale, normalized to 100.",
  },
  T4: {
    id: "external-review",
    label: "External review & transparency",
    requiredInputs: ["safetyControls", "riskLimits", "externalReview", "transparencyReport"],
    evidenceTypes: ["audit"],
    scoreSummary: "20 points across safety controls + risk limits + external review + transparency.",
  },
  Q1: {
    id: "benchmarks-general",
    label: "General benchmarks",
    requiredInputs: ["benchmark"],
    evidenceTypes: ["paper"],
    scoreSummary: "Normalized general benchmark score.",
  },
  Q2: {
    id: "benchmarks-coding",
    label: "Coding benchmarks",
    requiredInputs: ["benchmark"],
    evidenceTypes: ["paper"],
    scoreSummary: "Normalized coding benchmark score.",
  },
  Q3: {
    id: "benchmarks-math-chat",
    label: "Math & chat benchmarks",
    requiredInputs: [],
    requiredInputsAnyOf: ["math", "chat", "arena", "vendor"],
    evidenceTypes: ["paper"],
    scoreSummary: "Combined math + chat benchmark score, weighted by availability.",
  },
};

export const SCORE_ITEM_KEYS = Object.keys(SCORE_ITEM_POLICY) as ScoreItemKey[];

export const OFFICIAL_PAGE_ALLOWED_ITEMS = new Set<ScoreItemKey>([
  "S1",
  "S2",
  "S3",
  "S5",
  "T1",
  "T2",
]);

export const EVIDENCE_POLICY_BY_ID: Record<string, EvidenceType[]> =
  Object.fromEntries(
    Object.values(SCORE_ITEM_POLICY).map((policy) => [policy.id, policy.evidenceTypes])
  );

export const EVIDENCE_POLICY_BY_KEY: Record<ScoreItemKey, EvidenceType[]> =
  Object.fromEntries(
    Object.entries(SCORE_ITEM_POLICY).map(([key, policy]) => [key, policy.evidenceTypes])
  ) as Record<ScoreItemKey, EvidenceType[]>;

export function getScoreItemPolicy(key: ScoreItemKey): ScoreItemPolicy {
  return SCORE_ITEM_POLICY[key];
}
