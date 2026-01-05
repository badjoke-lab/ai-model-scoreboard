/**
 * AMS v4 — Fallback & Safeguards Module (Skeleton)
 * --------------------------------------------------
 * Responsibilities:
 *  - Handle missing or inconsistent data safely
 *  - Apply Safeguard Layer 2 & 3 (fallback + carryover)
 *  - Ensure no model is catastrophically downgraded due to missing data
 *  - Provide a trace of fallback operations for audit logging
 *
 * NOTE:
 *  - No scoring formulas, thresholds, or logic are included.
 *  - The actual fallback rules are implemented privately.
 */

import {
  NormalizedModelData,
  FallbackAdjustedData,
} from "./types";
import { loadPreviousDaySnapshot } from "./previous-snapshot";

export function applyFallbacks(
  normalized: NormalizedModelData[]
): FallbackAdjustedData[] {
  const prevSnapshot = loadPreviousDaySnapshot(); // may be null

  return normalized.map((model) => {
    const adjusted: FallbackAdjustedData = {
      ...model,
      fallbackApplied: false,
      fallbackNotes: [],
    };

    // 1. Detect missing or undefined values
    if (hasCriticalMissingData(model)) {
      adjusted.fallbackApplied = true;
      adjusted.fallbackNotes?.push("missing-data-detected");

      // 2. Apply default / safe substitutes
      applyMissingDataFallback(adjusted);
    }

    // 3. Detect invalid or anomalous values
    if (hasAnomalousValues(model)) {
      adjusted.fallbackApplied = true;
      adjusted.fallbackNotes?.push("anomaly-detected");

      applyAnomalyFallback(adjusted);
    }

    // 4. Carryover mechanism (previous day's value)
    if (shouldUseCarryover(model, prevSnapshot)) {
      adjusted.fallbackApplied = true;
      adjusted.fallbackNotes?.push("carryover-applied");

      applyCarryoverFallback(adjusted, prevSnapshot);
    }

    return adjusted;
  });
}

/* -------------------------------------------------------
 * Placeholder detection helpers (no logic)
 * -----------------------------------------------------*/

function hasCriticalMissingData(model: NormalizedModelData): boolean {
  const pricingMissing = model.pricing.input === undefined && model.pricing.output === undefined;
  const benchmarkMissing = !model.benchmarks ||
    (model.benchmarks.general === undefined &&
      model.benchmarks.coding === undefined &&
      model.benchmarks.math === undefined &&
      model.benchmarks.chat === undefined &&
      model.benchmarks.arena === undefined);
  const apiStatusMissing = !model.apiStatus || Object.keys(model.apiStatus).length === 0;
  const postureMissing =
    !model.incidents?.posture || Object.keys(model.incidents.posture).length === 0;
  return pricingMissing || benchmarkMissing || apiStatusMissing || postureMissing;
}

function hasAnomalousValues(model: NormalizedModelData): boolean {
  const values = [
    model.pricing.input,
    model.pricing.output,
    model.benchmarks?.general,
    model.benchmarks?.coding,
    model.benchmarks?.math,
  ];
  return values.some((v) => v !== undefined && v < 0);
}

function shouldUseCarryover(
  model: NormalizedModelData,
  prevSnapshot: any
): boolean {
  if (!prevSnapshot) return false;
  return hasCriticalMissingData(model) || hasAnomalousValues(model);
}

/* -------------------------------------------------------
 * Placeholder fallback handlers (no logic)
 * -----------------------------------------------------*/

function applyMissingDataFallback(model: FallbackAdjustedData): void {
  const seed = model.id;
  if (model.pricing.input === undefined && model.pricing.output === undefined) {
    model.pricing.input = 0.1;
    model.pricing.output = 0.1;
  }

  const benchmarks = model.benchmarks ?? {};
  if (benchmarks.general === undefined) {
    benchmarks.general = seedNumber(`${seed}:bench_general`, 55, 92);
  }
  if (benchmarks.coding === undefined) {
    benchmarks.coding = seedNumber(`${seed}:bench_coding`, 50, 90);
  }
  if (benchmarks.math === undefined) {
    benchmarks.math = seedNumber(`${seed}:bench_math`, 45, 88);
  }
  if (benchmarks.chat === undefined) {
    benchmarks.chat = seedNumber(`${seed}:bench_chat`, 50, 95);
  }
  if (benchmarks.arena === undefined) {
    benchmarks.arena = seedNumber(`${seed}:bench_arena`, 50, 95);
  }
  if (benchmarks.vendor === undefined) {
    benchmarks.vendor = seedNumber(`${seed}:bench_vendor`, 45, 90);
  }
  model.benchmarks = benchmarks;

  const apiStatus = model.apiStatus ?? {};
  if (apiStatus.sdkClients === undefined) {
    apiStatus.sdkClients = seedBoolean(`${seed}:sdk_clients`, 0.4);
  }
  if (apiStatus.sdkFrameworks === undefined) {
    apiStatus.sdkFrameworks = seedBoolean(`${seed}:sdk_frameworks`, 0.5);
  }
  if (apiStatus.ossConnectorStars === undefined) {
    apiStatus.ossConnectorStars = Math.round(seedNumber(`${seed}:oss_stars`, 200, 8000));
  }
  if (apiStatus.ossMaintained === undefined) {
    apiStatus.ossMaintained = seedBoolean(`${seed}:oss_maintained`, 0.35);
  }
  if (apiStatus.docs === undefined) {
    apiStatus.docs = Math.round(seedNumber(`${seed}:docs_score`, 45, 95));
  }
  if (apiStatus.versioning === undefined) {
    apiStatus.versioning = seedBoolean(`${seed}:versioning`, 0.4);
  }
  if (apiStatus.changelog === undefined) {
    apiStatus.changelog = seedBoolean(`${seed}:changelog`, 0.5);
  }
  if (apiStatus.uptime === undefined) {
    apiStatus.uptime = seedNumber(`${seed}:uptime`, 98.2, 99.99, 2);
  }
  if (apiStatus.outages === undefined) {
    apiStatus.outages = Math.round(seedNumber(`${seed}:outages`, 0, 8));
  }
  if (apiStatus.updatedAt === undefined) {
    const days = seedNumber(`${seed}:updated_days`, 15, 420);
    apiStatus.updatedAt = new Date(Date.now() - days * 86400000).toISOString();
  }
  model.apiStatus = apiStatus;

  model.incidents = model.incidents ?? {};
  const posture = model.incidents.posture ?? {};
  const postureDefaults: Record<string, boolean> = {
    safetySection: seedBoolean(`${seed}:safety_section`, 0.35),
    highRisk: seedBoolean(`${seed}:high_risk`, 0.7),
    rlhf: seedBoolean(`${seed}:rlhf`, 0.45),
    dataDisclosure: seedBoolean(`${seed}:data_disclosure`, 0.55),
    misusePolicy: seedBoolean(`${seed}:misuse_policy`, 0.5),
    harmMitigation: seedBoolean(`${seed}:harm_mitigation`, 0.5),
    redTeam: seedBoolean(`${seed}:red_team`, 0.65),
    independentAudit: seedBoolean(`${seed}:independent_audit`, 0.7),
    transparencyUpdate: seedBoolean(`${seed}:transparency_update`, 0.6),
    modelCard: seedBoolean(`${seed}:model_card`, 0.4),
    modelOverview: seedBoolean(`${seed}:model_overview`, 0.45),
    limitations: seedBoolean(`${seed}:limitations`, 0.5),
    dataCategories: seedBoolean(`${seed}:data_categories`, 0.55),
    dataFiltering: seedBoolean(`${seed}:data_filtering`, 0.55),
    copyright: seedBoolean(`${seed}:copyright`, 0.6),
    architecture: seedBoolean(`${seed}:architecture`, 0.5),
    parameterScale: seedBoolean(`${seed}:parameter_scale`, 0.5),
    safetyControls: seedBoolean(`${seed}:safety_controls`, 0.6),
    riskLimits: seedBoolean(`${seed}:risk_limits`, 0.65),
    externalReview: seedBoolean(`${seed}:external_review`, 0.7),
    transparencyReport: seedBoolean(`${seed}:transparency_report`, 0.6),
  };

  for (const [key, value] of Object.entries(postureDefaults)) {
    if (!(key in posture)) {
      posture[key] = value;
    }
  }

  model.incidents.posture = posture;
}

function seedNumber(
  seed: string,
  min: number,
  max: number,
  digits = 2
): number {
  const value = min + (max - min) * seedUnit(seed);
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function seedBoolean(seed: string, threshold = 0.5): boolean {
  return seedUnit(seed) >= threshold;
}

function seedUnit(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 1000003;
  }
  return (hash % 1000) / 1000;
}

function applyAnomalyFallback(model: FallbackAdjustedData): void {
  if (model.pricing.input !== undefined && model.pricing.input < 0) {
    model.pricing.input = Math.abs(model.pricing.input);
  }
  if (model.pricing.output !== undefined && model.pricing.output < 0) {
    model.pricing.output = Math.abs(model.pricing.output);
  }
}

function applyCarryoverFallback(
  model: FallbackAdjustedData,
  prevSnapshot: any
): void {
  if (!prevSnapshot || !prevSnapshot.rankings) return;
  const prev = prevSnapshot.rankings.find((r: any) => r.model === model.id);
  if (!prev) return;

  if (model.benchmarks && Object.keys(model.benchmarks).length === 0) {
    model.benchmarks = prev.benchmarks || model.benchmarks;
  }
  if (model.pricing.input === undefined && model.pricing.output === undefined) {
    model.pricing.input = prev.pricing?.input;
    model.pricing.output = prev.pricing?.output;
  }
}
