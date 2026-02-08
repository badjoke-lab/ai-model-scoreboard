export type V4ScoreBreakdown = {
  spec: number;
  evidence: number;
  ops: number;
};

export type V4DeltaBreakdown = V4ScoreBreakdown & {
  total: number;
};

export interface V4Model {
  id: string;
  slug: string;
  name: string;
  vendor: string;
  modality: string[];
  summary: string;
  scores: V4ScoreBreakdown;
  evidence: { title: string; url: string; date: string }[];
  updatedAt: string;
  tags: string[];
  total: number;
  delta30d: V4DeltaBreakdown;
}

export interface V4SnapshotResponse {
  status: "ok";
  models: V4Model[];
}

export interface V4LeaderboardResponse {
  status: "ok";
  leaderboard: V4Model[];
}

export interface V4ModelResponse {
  status: "ok";
  model: V4Model | null;
}

export type V4ModelDetailEvidence = {
  type?: string;
  status?: string;
  link?: string;
  url?: string;
};

export type Missing = {
  value: null;
  status:
    | "ok"
    | "not_found"
    | "blocked"
    | "rate_limited"
    | "invalid"
    | "ambiguous"
    | "missing_source_link"
    | "missing";
  reasons: string[];
  refs: string[];
};

export type AdoptionBlock = {
  status: "adopted" | "provisional" | "denied";
  reasons: string[];
  source: "decisions" | "seed" | "openrouter";
  refs: string[];
};

export type AbsVal = string | number | boolean | string[] | Missing;

export type AbsoluteBlock = {
  modelKey: AbsVal;
  displayName: AbsVal;
  provider: AbsVal;
  canonicalSlug: AbsVal;
  contextLength: AbsVal;
  maxOutputTokens: AbsVal;
  pricingInputPer1M: AbsVal;
  pricingOutputPer1M: AbsVal;
  modalities: AbsVal;
  supportsTools: AbsVal;
  supportsJson: AbsVal;
  releaseDate: AbsVal;
  trainingCutoff: AbsVal;
};

export type V4EvidenceKey = "official_page" | "dev_activity" | "paper" | "audit";

export type V4EvidenceStatus =
  | "ok"
  | "not_found"
  | "blocked"
  | "rate_limited"
  | "invalid"
  | "ambiguous"
  | "missing_source_link"
  | "missing";

export type EvidenceItem = {
  type: V4EvidenceKey;
  status: V4EvidenceStatus;
  reasons: string[];
  refs: string[];
  extracted?: unknown;
  label?: string;
};

export type V4ModelDetailEvidenceBlock = {
  key: V4EvidenceKey;
  status: string;
  reasons: string[];
  refs: string[];
  updatedAt?: string;
  extracted?: unknown;
};

export type V4ModelDetailBreakdownItem = {
  key: string;
  id?: string;
  label: string;
  score: number | null;
  status?: string;
  inputsRaw: Record<string, unknown> | null;
  evidenceUrls: string[];
  why: string;
  usedEvidence: V4ModelDetailEvidence[];
  specMissingEvidence: boolean;
  missingEvidenceRule: boolean;
};

export type V4ModelDetailResponse = {
  status: "ok";
  modelKey: string;
  header: {
    title: string;
    provider: string;
    source: string;
    overallScore: number;
    categoryScores: Record<string, number>;
    updatedAt: string | null;
    status: string;
    decisionReasons: string[];
    decisionSource: string | null;
  };
  absolute: AbsoluteBlock;
  adoption: AdoptionBlock | Missing;
  evidence: EvidenceItem[];
  evidenceCards: {
    blocks: Record<string, V4ModelDetailEvidenceBlock>;
    errorMessage: string | null;
    impactByKey: Record<string, string>;
    topReasons: string[];
  };
  breakdown: {
    items: V4ModelDetailBreakdownItem[];
  };
  references: Array<{ label: string; urls: string[] }>;
};
