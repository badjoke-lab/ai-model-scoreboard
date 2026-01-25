/**
 * AMS v4 — Scoring Engine
 * -----------------------------------
 * Implements scoring per the private v4 specification.
 */

import {
  NormalizedModelData,
  ScoredModel,
  EvidenceModelFile,
  EvidenceType,
  EvidenceStatus,
  ScoreItemDetail,
  ScoreItemKey,
  ScoresOutput,
  ScoreCategoryKey,
  ScoreItemEvidenceUsage,
  ScoreItemStatus,
  EvidenceItem,
} from "./types";
import { clamp } from "./normalize";

const CATEGORY_WEIGHTS: Record<ScoreCategoryKey, number> = {
  performance: 0.4,
  safety: 0.2,
  adoption: 0.15,
  openness: 0.15,
  cost: 0.1,
};

const PERFORMANCE_WEIGHTS = {
  general: 0.4,
  coding: 0.3,
  math: 0.2,
  chat: 0.1,
};

const SCORE_ITEM_KEYS: ScoreItemKey[] = [
  "S1",
  "S2",
  "S3",
  "S4",
  "S5",
  "S6",
  "S7",
  "S8",
  "T1",
  "T2",
  "T3",
  "T4",
  "Q1",
  "Q2",
  "Q3",
];

const SCORE_ITEM_LABELS: Record<ScoreItemKey, string> = {
  S1: "Safety documentation",
  S2: "Alignment disclosure",
  S3: "Misuse policy coverage",
  S4: "External audit & red teaming",
  S5: "Transparency updates",
  S6: "Minor incidents",
  S7: "Major incidents",
  S8: "Critical incidents",
  T1: "Model documentation",
  T2: "Training data disclosure",
  T3: "Paper / technical report",
  T4: "External review & transparency",
  Q1: "General benchmarks",
  Q2: "Coding benchmarks",
  Q3: "Math & chat benchmarks",
};

interface CostEntry {
  rawCost?: number;
  adjustedCost?: number;
  inputs: Record<string, any>;
  penaltyReasons: string[];
}

interface CostContext {
  minCost: number | null;
  maxCost: number | null;
  entries: Map<string, CostEntry>;
}

interface EvidenceUsage {
  type: EvidenceType;
  status: EvidenceStatus;
  urls: string[];
}

/**
 * The main scoring function.
 * Input: normalized & fallback-adjusted data
 * Output: fully scored models (without layers)
 */
export function scoreModels(
  data: NormalizedModelData[],
  evidenceByModel: Record<string, EvidenceModelFile>,
  options?: { updatedAt?: string }
): ScoredModel[] {
  const updatedAt = options?.updatedAt ?? new Date().toISOString();
  const costContext = buildCostContext(data);

  return data.map((model) => {
    const evidence = evidenceByModel[model.id];

    const performance = computePerformance(model, evidence);
    const safety = computeSafety(model, evidence);
    const adoption = computeAdoption(model);
    const openness = computeOpenness(model, evidence);
    const cost = computeCost(model, costContext);

    const categories: ScoresOutput["categories"] = {
      performance: performance.score,
      safety: safety.score,
      adoption: adoption.score,
      openness: openness.score,
      cost: cost.score,
    };

    const overall = clamp(
      categories.performance * CATEGORY_WEIGHTS.performance +
        categories.safety * CATEGORY_WEIGHTS.safety +
        categories.adoption * CATEGORY_WEIGHTS.adoption +
        categories.openness * CATEGORY_WEIGHTS.openness +
        categories.cost * CATEGORY_WEIGHTS.cost
    );

    const items: Record<ScoreItemKey, ScoreItemDetail> = {
      ...safety.items,
      ...openness.items,
      ...performance.items,
    } as Record<ScoreItemKey, ScoreItemDetail>;

    for (const key of SCORE_ITEM_KEYS) {
      if (!items[key]) {
        items[key] = buildScoreItem(
          0,
          {},
          [],
          ["missing_score_item"],
          { label: SCORE_ITEM_LABELS[key] ?? key }
        );
      }
    }

    const scores: ScoresOutput = {
      overall,
      categories,
      items,
    };

    return {
      id: model.id,
      vendor: model.vendor,
      metadata: model.metadata,
      pricing: model.pricing,
      scores,
      finalScore: overall,
      updatedAt,
    };
  });
}

/* -------------------------------------------------------
 * Performance (Q1..Q3)
 * -----------------------------------------------------*/

function computePerformance(
  model: NormalizedModelData,
  evidence?: EvidenceModelFile
): {
  score: number;
  items: Record<"Q1" | "Q2" | "Q3", ScoreItemDetail>;
} {
  const b = model.benchmarks || {};
  const general = normalizeFamily(b.general);
  const coding = normalizeFamily(b.coding);
  const math = normalizeFamily(b.math);
  const chat = computeChatFamily(b.chat, b.arena, b.vendor);

  const available: { key: keyof typeof PERFORMANCE_WEIGHTS; value: number }[] =
    [];
  if (general !== null) available.push({ key: "general", value: general });
  if (coding !== null) available.push({ key: "coding", value: coding });
  if (math !== null) available.push({ key: "math", value: math });
  if (chat !== null) available.push({ key: "chat", value: chat });

  const performanceScore = weightedTotal(available, PERFORMANCE_WEIGHTS);

  const officialUsage = buildEvidenceUsage(evidence, "official_page");
  const q1 = buildScoreItem(
    general ?? 0,
    { benchmark: b.general },
    [officialUsage],
    buildPenaltyReasons(
      buildMissingReasons(general === null ? ["missing_benchmark_general"] : []),
      [officialUsage]
    ),
    { label: SCORE_ITEM_LABELS.Q1 }
  );
  const q2 = buildScoreItem(
    coding ?? 0,
    { benchmark: b.coding },
    [officialUsage],
    buildPenaltyReasons(
      buildMissingReasons(coding === null ? ["missing_benchmark_coding"] : []),
      [officialUsage]
    ),
    { label: SCORE_ITEM_LABELS.Q2 }
  );

  const combinedMathChat = combineMathChat(math, chat);
  const q3Reasons = [] as string[];
  if (math === null) q3Reasons.push("missing_benchmark_math");
  if (chat === null) q3Reasons.push("missing_benchmark_chat");

  const q3 = buildScoreItem(
    combinedMathChat ?? 0,
    { math: b.math, chat: b.chat, arena: b.arena, vendor: b.vendor },
    [officialUsage],
    buildPenaltyReasons(buildMissingReasons(q3Reasons), [officialUsage]),
    { label: SCORE_ITEM_LABELS.Q3 }
  );

  return {
    score: performanceScore,
    items: { Q1: q1, Q2: q2, Q3: q3 },
  };
}

function normalizeFamily(value: number | undefined): number | null {
  if (value === undefined) return null;
  const normalized = value <= 1 ? value * 100 : value;
  return clamp(normalized);
}

function computeChatFamily(
  chat: number | undefined,
  arena: number | undefined,
  vendor: number | undefined
): number | null {
  if (arena === undefined && chat === undefined && vendor === undefined) {
    return null;
  }
  const arenaComponent = normalizeFamily(arena) ?? 0;
  const vendorComponent = normalizeFamily(chat ?? vendor) ?? 0;
  return clamp(arenaComponent * 0.7 + vendorComponent * 0.3);
}

function combineMathChat(math: number | null, chat: number | null): number | null {
  if (math === null && chat === null) return null;
  if (math === null) return chat;
  if (chat === null) return math;
  return clamp(math * 0.67 + chat * 0.33);
}

/* -------------------------------------------------------
 * Safety (S1..S8)
 * -----------------------------------------------------*/

function computeSafety(
  model: NormalizedModelData,
  evidence?: EvidenceModelFile
): { score: number; items: Record<"S1" | "S2" | "S3" | "S4" | "S5" | "S6" | "S7" | "S8", ScoreItemDetail> } {
  const incidents = model.incidents || {};
  const posture = incidents.posture || {};

  const s1Inputs = {
    safetySection: readPostureFlag(posture, ["safetySection", "modelCardSafety"]),
    highRisk: readPostureFlag(posture, ["highRisk", "highRiskDomains"]),
  };
  const s1Points = posturePoints([
    { value: s1Inputs.safetySection, points: 5 },
    { value: s1Inputs.highRisk, points: 5 },
  ]);
  const officialUsage = buildEvidenceUsage(evidence, "official_page");
  const s1 = buildScoreItem(
    normalizePoints(s1Points.total, 10),
    s1Inputs,
    [officialUsage],
    buildPenaltyReasons(s1Points.missing, [officialUsage]),
    { label: SCORE_ITEM_LABELS.S1 }
  );

  const s2Inputs = {
    rlhf: readPostureFlag(posture, ["rlhf", "alignmentPolicy"]),
    dataDisclosure: readPostureFlag(posture, ["dataDisclosure", "trainingDataCategories"]),
  };
  const s2Points = posturePoints([
    { value: s2Inputs.rlhf, points: 5 },
    { value: s2Inputs.dataDisclosure, points: 5 },
  ]);
  const s2 = buildScoreItem(
    normalizePoints(s2Points.total, 10),
    s2Inputs,
    [officialUsage],
    buildPenaltyReasons(s2Points.missing, [officialUsage]),
    { label: SCORE_ITEM_LABELS.S2 }
  );

  const s3Inputs = {
    misusePolicy: readPostureFlag(posture, ["misusePolicy", "harmPolicy"]),
    harmMitigation: readPostureFlag(posture, ["harmMitigation", "safetyMechanism"]),
  };
  const s3Points = posturePoints([
    { value: s3Inputs.misusePolicy, points: 5 },
    { value: s3Inputs.harmMitigation, points: 5 },
  ]);
  const s3 = buildScoreItem(
    normalizePoints(s3Points.total, 10),
    s3Inputs,
    [officialUsage],
    buildPenaltyReasons(s3Points.missing, [officialUsage]),
    { label: SCORE_ITEM_LABELS.S3 }
  );

  const s4Inputs = {
    redTeam: readPostureFlag(posture, ["redTeam", "externalRedTeam"]),
    independentAudit: readPostureFlag(posture, ["independentAudit", "externalAudit"]),
  };
  const s4Points = posturePoints([
    { value: s4Inputs.redTeam, points: 10 },
    { value: s4Inputs.independentAudit, points: 10 },
  ]);
  const auditUsage = buildEvidenceUsage(evidence, "audit");
  const s4 = buildScoreItem(
    normalizePoints(s4Points.total, 20),
    s4Inputs,
    [auditUsage],
    buildPenaltyReasons(s4Points.missing, [auditUsage]),
    { label: SCORE_ITEM_LABELS.S4 }
  );

  const s5Inputs = {
    transparencyUpdate: readPostureFlag(posture, ["transparencyUpdate", "yearlyTransparencyUpdate"]),
  };
  const s5Points = posturePoints([{ value: s5Inputs.transparencyUpdate, points: 10 }]);
  const s5 = buildScoreItem(
    normalizePoints(s5Points.total, 10),
    s5Inputs,
    [officialUsage],
    buildPenaltyReasons(s5Points.missing, [officialUsage]),
    { label: SCORE_ITEM_LABELS.S5 }
  );

  const incidentInputs = {
    minor: numberOrUndefined(incidents.minor),
    major: numberOrUndefined(incidents.major),
    critical: numberOrUndefined(incidents.critical),
    recoveryPoints: numberOrUndefined(incidents.recoveryPoints),
  };
  const minorCount = incidentInputs.minor ?? 0;
  const majorCount = incidentInputs.major ?? 0;
  const criticalCount = incidentInputs.critical ?? 0;
  const recoveryPoints = incidentInputs.recoveryPoints ?? 0;

  const s6 = buildScoreItem(
    clamp(100 - minorCount * 12.5),
    { minorCount: incidentInputs.minor },
    [officialUsage],
    buildPenaltyReasons(
      buildMissingReasons(
        incidentInputs.minor === undefined
          ? ["missing_minor_incidents"]
          : minorCount > 0
            ? ["minor_incidents_present"]
            : []
      ),
      [officialUsage]
    ),
    { label: SCORE_ITEM_LABELS.S6 }
  );
  const s7 = buildScoreItem(
    clamp(100 - majorCount * 50),
    { majorCount: incidentInputs.major },
    [officialUsage],
    buildPenaltyReasons(
      buildMissingReasons(
        incidentInputs.major === undefined
          ? ["missing_major_incidents"]
          : majorCount > 0
            ? ["major_incidents_present"]
            : []
      ),
      [officialUsage]
    ),
    { label: SCORE_ITEM_LABELS.S7 }
  );
  const s8 = buildScoreItem(
    criticalCount > 0 ? 0 : 100,
    { criticalCount: incidentInputs.critical },
    [officialUsage],
    buildPenaltyReasons(
      buildMissingReasons(
        incidentInputs.critical === undefined
          ? ["missing_critical_incidents"]
          : criticalCount > 0
            ? ["critical_incidents_present"]
            : []
      ),
      [officialUsage]
    ),
    { label: SCORE_ITEM_LABELS.S8 }
  );

  const postureScore = s1Points.total + s2Points.total + s3Points.total + s4Points.total + s5Points.total;
  const incidentScore = Math.max(
    0,
    40 - minorCount * 5 - majorCount * 20 - criticalCount * 40 + recoveryPoints
  );
  const postureNormalized = normalizePoints(postureScore, 60);
  const incidentNormalized = normalizePoints(incidentScore, 40);

  const safetyScore = clamp(postureNormalized * 0.6 + incidentNormalized * 0.4);

  return {
    score: safetyScore,
    items: { S1: s1, S2: s2, S3: s3, S4: s4, S5: s5, S6: s6, S7: s7, S8: s8 },
  };
}

/* -------------------------------------------------------
 * Adoption
 * -----------------------------------------------------*/

function computeAdoption(model: NormalizedModelData): { score: number } {
  const api = model.apiStatus || {};

  const sdkClients = Boolean(api.sdkClients);
  const sdkFrameworks = Boolean(api.sdkFrameworks);
  const ossStars = numberOrUndefined(api.ossConnectorStars);
  const ossMaintained = Boolean(api.ossMaintained);
  const docsScore = numberOrUndefined(api.docs);
  const versioning = Boolean(api.versioning);
  const changelog = Boolean(api.changelog);

  let ecosystemPoints = 0;
  if (sdkClients) ecosystemPoints += 10;
  if (sdkFrameworks) ecosystemPoints += 5;
  if (ossStars !== undefined && ossStars >= 1000) ecosystemPoints += 5;
  if (ossMaintained) ecosystemPoints += 5;
  if (docsScore !== undefined) {
    if (docsScore >= 50) ecosystemPoints += 5;
    if (docsScore >= 75) ecosystemPoints += 5;
  }
  if (versioning) ecosystemPoints += 2;
  if (changelog) ecosystemPoints += 3;

  const ecosystemScore = normalizePoints(ecosystemPoints, 40);

  const uptime = numberOrUndefined(api.uptime);
  const uptimeComponent = uptime === undefined ? 0 : uptimeToScore(uptime);
  const outages = numberOrUndefined(api.outages);
  const incidentComponent = outages === undefined ? 0 : clamp(100 - outages * 2);

  const stabilityScore = clamp(uptimeComponent * 0.7 + incidentComponent * 0.3);

  const updatedAt = typeof api.updatedAt === "string" ? new Date(api.updatedAt) : null;
  const freshnessScore = updatedAt ? freshnessToScore(updatedAt) : 0;

  const adoptionScore = clamp(
    ecosystemScore * 0.4 + stabilityScore * 0.3 + freshnessScore * 0.3
  );

  return { score: adoptionScore };
}

function uptimeToScore(uptime: number): number {
  if (uptime >= 99.9) return 100;
  if (uptime >= 99.0) return 90;
  if (uptime >= 98.0) return 75;
  if (uptime >= 95.0) return 55;
  return 40;
}

function freshnessToScore(updatedAt: Date): number {
  const days = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
  if (days <= 90) return 100;
  if (days <= 180) return 80;
  if (days <= 365) return 60;
  if (days <= 540) return 40;
  return 20;
}

/* -------------------------------------------------------
 * Openness (T1..T4)
 * -----------------------------------------------------*/

function computeOpenness(
  model: NormalizedModelData,
  evidence?: EvidenceModelFile
): { score: number; items: Record<"T1" | "T2" | "T3" | "T4", ScoreItemDetail> } {
  const posture = model.incidents?.posture || {};

  const t1Inputs = {
    modelCard: readPostureFlag(posture, ["modelCard", "modelCardExists"]),
    overview: readPostureFlag(posture, ["modelOverview", "overview"]),
    limitations: readPostureFlag(posture, ["limitations", "knownLimitations"]),
  };
  const t1Points = posturePoints([
    { value: t1Inputs.modelCard, points: 5 },
    { value: t1Inputs.overview, points: 5 },
    { value: t1Inputs.limitations, points: 5 },
  ]);
  const officialUsage = buildEvidenceUsage(evidence, "official_page");
  const t1 = buildScoreItem(
    normalizePoints(t1Points.total, 15),
    t1Inputs,
    [officialUsage],
    buildPenaltyReasons(t1Points.missing, [officialUsage]),
    { label: SCORE_ITEM_LABELS.T1 }
  );

  const t2Inputs = {
    dataCategories: readPostureFlag(posture, ["dataCategories", "trainingDataCategories"]),
    dataFiltering: readPostureFlag(posture, ["dataFiltering", "filteringPolicy"]),
    copyright: readPostureFlag(posture, ["copyright", "licensing"]),
  };
  const t2Points = posturePoints([
    { value: t2Inputs.dataCategories, points: 5 },
    { value: t2Inputs.dataFiltering, points: 5 },
    { value: t2Inputs.copyright, points: 5 },
  ]);
  const t2 = buildScoreItem(
    normalizePoints(t2Points.total, 15),
    t2Inputs,
    [officialUsage],
    buildPenaltyReasons(t2Points.missing, [officialUsage]),
    { label: SCORE_ITEM_LABELS.T2 }
  );

  const t3Inputs = {
    architecture: readPostureFlag(posture, ["architecture", "architectureOverview"]),
    parameterScale: readPostureFlag(posture, ["parameterScale", "parameters"]),
  };
  const t3Points = posturePoints([
    { value: t3Inputs.architecture, points: 5 },
    { value: t3Inputs.parameterScale, points: 5 },
  ]);
  const paperUsage = buildEvidenceUsage(evidence, "paper");
  const t3 = buildScoreItem(
    normalizePoints(t3Points.total, 10),
    t3Inputs,
    [paperUsage],
    buildPenaltyReasons(t3Points.missing, [paperUsage]),
    { label: SCORE_ITEM_LABELS.T3 }
  );

  const t4Inputs = {
    safetyControls: readPostureFlag(posture, ["safetyControls", "guardrails"]),
    riskLimits: readPostureFlag(posture, ["riskLimits", "highRiskLimitations"]),
    externalReview: readPostureFlag(posture, ["externalReview", "externalAudit"]),
    transparencyReport: readPostureFlag(posture, ["transparencyReport", "transparencyUpdate"]),
  };
  const t4Points = posturePoints([
    { value: t4Inputs.safetyControls, points: 5 },
    { value: t4Inputs.riskLimits, points: 5 },
    { value: t4Inputs.externalReview, points: 5 },
    { value: t4Inputs.transparencyReport, points: 5 },
  ]);
  const auditUsage = buildEvidenceUsage(evidence, "audit");
  const t4 = buildScoreItem(
    normalizePoints(t4Points.total, 20),
    t4Inputs,
    [auditUsage],
    buildPenaltyReasons(t4Points.missing, [auditUsage]),
    { label: SCORE_ITEM_LABELS.T4 }
  );

  const rawOpennessScore =
    t1Points.total +
    t2Points.total +
    t3Points.total +
    t4Points.total;
  const opennessScore = normalizePoints(rawOpennessScore, 60);

  return {
    score: opennessScore,
    items: { T1: t1, T2: t2, T3: t3, T4: t4 },
  };
}

/* -------------------------------------------------------
 * Cost
 * -----------------------------------------------------*/

function computeCost(
  model: NormalizedModelData,
  context: CostContext
): { score: number } {
  const entry = context.entries.get(model.id);
  if (!entry || entry.adjustedCost === undefined) {
    return { score: 0 };
  }
  if (context.minCost === null || context.maxCost === null) {
    return { score: 0 };
  }
  if (context.maxCost === context.minCost) {
    return { score: 100 };
  }
  const normalized =
    ((context.maxCost - entry.adjustedCost) /
      (context.maxCost - context.minCost)) *
    100;
  return { score: clamp(normalized) };
}

function buildCostContext(models: NormalizedModelData[]): CostContext {
  const entries = new Map<string, CostEntry>();
  const rawCosts: number[] = [];

  for (const model of models) {
    const pricing = model.pricing || {};
    const input = numberOrUndefined(pricing.input);
    const output = numberOrUndefined(pricing.output);
    const contextLength = numberOrUndefined(model.metadata?.context);

    const penalties: string[] = [];
    const inputs: Record<string, any> = {
      input,
      output,
      contextLength,
    };

    if (input === undefined && output === undefined) {
      penalties.push("missing_pricing_inputs");
      entries.set(model.id, { inputs, penaltyReasons: penalties });
      continue;
    }

    const inputCost = input ?? 0;
    const outputCost = output ?? 0;
    let rawCost = inputCost * 1.0 + outputCost * 0.3;

    if (contextLength !== undefined && contextLength < 2000) {
      rawCost *= 1.1;
      penalties.push("context_length_penalty");
    }

    entries.set(model.id, {
      rawCost,
      inputs,
      penaltyReasons: penalties,
    });

    if (rawCost > 0) rawCosts.push(rawCost);
  }

  const minNonZero = rawCosts.length ? Math.min(...rawCosts) : null;

  const adjustedCosts: number[] = [];
  for (const entry of entries.values()) {
    if (entry.rawCost === undefined) continue;
    let adjusted = entry.rawCost;
    if (entry.rawCost === 0 && minNonZero !== null) {
      adjusted = minNonZero * 0.8;
      entry.penaltyReasons.push("free_model_adjustment");
    }
    entry.adjustedCost = adjusted;
    adjustedCosts.push(adjusted);
  }

  const minCost = adjustedCosts.length ? Math.min(...adjustedCosts) : null;
  const maxCost = adjustedCosts.length ? Math.max(...adjustedCosts) : null;

  return { minCost, maxCost, entries };
}

/* -------------------------------------------------------
 * Helpers
 * -----------------------------------------------------*/

function buildScoreItem(
  score: number,
  inputs: Record<string, any>,
  evidenceUsage: EvidenceUsage[],
  penaltyReasons: string[],
  options?: { label?: string }
): ScoreItemDetail {
  const normalizedInputs = normalizeInputs(inputs);
  const missingInputs = normalizedInputs.__missingInputs === true;
  if (missingInputs && !penaltyReasons.includes("missing_inputs")) {
    penaltyReasons.push("missing_inputs");
  }

  const evidenceMissing = isEvidenceMissing(evidenceUsage);
  if (evidenceMissing && !penaltyReasons.includes("missing_evidence")) {
    penaltyReasons.push("missing_evidence");
  }

  const status: ScoreItemStatus = evidenceMissing
    ? "missing_evidence"
    : missingInputs
      ? "missing_inputs"
      : "ok";
  const verified = status === "ok";

  const usedEvidence = evidenceMissing ? [] : buildUsedEvidenceList(evidenceUsage);
  const computedScore = verified ? clamp(score) : null;
  const policyImpact = verified
    ? undefined
    : status === "missing_inputs"
      ? "Score suppressed until required inputs are provided."
      : "Score suppressed until evidence links are provided.";

  return {
    label: options?.label,
    score: computedScore,
    status,
    verified,
    why: buildWhy(penaltyReasons, status),
    policyImpact,
    __specMissingEvidenceLink: status === "missing_evidence",
    inputs: normalizedInputs.inputs,
    usedEvidence,
    penaltyReasons: uniqueList(penaltyReasons),
  };
}

function buildMissingReasons(reasons: string[]): string[] {
  return reasons.length ? reasons : [];
}

function posturePoints(items: { value: boolean | undefined; points: number }[]): {
  total: number;
  missing: string[];
} {
  let total = 0;
  const missing: string[] = [];
  items.forEach((item, index) => {
    if (item.value === undefined) {
      missing.push(`missing_posture_signal_${index + 1}`);
      return;
    }
    if (item.value) total += item.points;
  });
  return { total, missing };
}

function normalizePoints(points: number, max: number): number {
  if (max <= 0) return 0;
  return clamp((points / max) * 100);
}

function weightedTotal(
  available: { key: keyof typeof PERFORMANCE_WEIGHTS; value: number }[],
  weights: typeof PERFORMANCE_WEIGHTS
): number {
  if (available.length === 0) return 0;
  let total = 0;
  let weightSum = 0;
  for (const entry of available) {
    const weight = weights[entry.key];
    total += entry.value * weight;
    weightSum += weight;
  }
  if (weightSum === 0) return 0;
  return clamp(total / weightSum);
}

function readPostureFlag(
  posture: Record<string, any>,
  keys: string[]
): boolean | undefined {
  for (const key of keys) {
    if (key in posture) return Boolean(posture[key]);
  }
  return undefined;
}

function numberOrUndefined(value: any): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function buildPenaltyReasons(
  missingReasons: string[],
  evidenceUsage: EvidenceUsage[]
): string[] {
  const reasons = [...missingReasons];
  for (const usage of evidenceUsage) {
    if (usage.status !== "ok") {
      reasons.push(`evidence_${usage.type}_${usage.status}`);
    }
  }
  return reasons;
}

function uniqueList(values: string[]): string[] {
  return Array.from(new Set(values));
}

function normalizeInputs(inputs: Record<string, any>): {
  inputs: Record<string, any>;
  __missingInputs: boolean;
} {
  if (!inputs || typeof inputs !== "object") {
    return { inputs: { note: "missing_inputs" }, __missingInputs: true };
  }
  if (Object.keys(inputs).length === 0) {
    return { inputs: { note: "missing_inputs" }, __missingInputs: true };
  }
  return { inputs, __missingInputs: false };
}

function buildEvidenceUsage(
  evidence: EvidenceModelFile | undefined,
  type: EvidenceType
): EvidenceUsage {
  const entry = evidence?.evidenceItems.find((item) => item.type === type);
  const status: EvidenceStatus = entry?.status ?? "missing_source_link";
  const urls = extractEvidenceUrls(entry);
  return { type, status, urls };
}

function extractEvidenceUrls(entry: EvidenceItem | undefined): string[] {
  const urls = new Set<string>();
  if (entry?.refs?.length) {
    for (const ref of entry.refs) {
      if (isHttpUrl(ref)) urls.add(ref);
    }
  }
  const extractedUrl = entry?.extracted?.url;
  if (typeof extractedUrl === "string" && isHttpUrl(extractedUrl)) {
    urls.add(extractedUrl);
  }
  return Array.from(urls);
}

function isEvidenceMissing(usage: EvidenceUsage[]): boolean {
  if (!usage.length) return true;
  return usage.some((entry) => entry.status !== "ok" || entry.urls.length === 0);
}

function buildUsedEvidenceList(usage: EvidenceUsage[]): ScoreItemEvidenceUsage[] {
  const entries: ScoreItemEvidenceUsage[] = [];
  usage.forEach((entry) => {
    entry.urls.forEach((url) => {
      entries.push({
        type: entry.type,
        status: entry.status,
        link: url,
        url,
      });
    });
  });
  return entries;
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function buildWhy(penaltyReasons: string[], status: ScoreItemStatus): string {
  if (status === "missing_inputs") {
    return "Inputs are missing, so the score is withheld until inputs are recorded.";
  }
  if (status === "missing_evidence") {
    return "Evidence links are missing, so the score is withheld until sources are provided.";
  }
  if (!penaltyReasons.length) {
    return "Score verified from available inputs and evidence.";
  }
  const first = penaltyReasons.find((reason) => typeof reason === "string" && reason.trim());
  if (!first) {
    return "Score verified from available inputs and evidence.";
  }
  return formatReasonSentence(first);
}

function formatReasonSentence(reason: string): string {
  const normalized = reason.trim();
  if (!normalized) return "Score derived from available signals.";
  const lower = normalized.toLowerCase();
  const mapped: Record<string, string> = {
    missing_inputs: "Inputs were missing; policy applies a default penalty.",
    missing_evidence: "Evidence links were missing; policy applies a default penalty.",
    missing_benchmark_general: "General benchmark data is missing; performance score reduced.",
    missing_benchmark_coding: "Coding benchmark data is missing; performance score reduced.",
    missing_benchmark_math: "Math benchmark data is missing; performance score reduced.",
    missing_benchmark_chat: "Chat benchmark data is missing; performance score reduced.",
    missing_minor_incidents: "Minor-incident data is missing; default penalty applied.",
    missing_major_incidents: "Major-incident data is missing; default penalty applied.",
    missing_critical_incidents: "Critical-incident data is missing; default penalty applied.",
  };
  if (mapped[lower]) return mapped[lower];
  const humanized = normalized.replace(/[_:-]+/g, " ").trim();
  if (!humanized) return "Score derived from available signals.";
  return `${humanized.charAt(0).toUpperCase()}${humanized.slice(1)}.`;
}
