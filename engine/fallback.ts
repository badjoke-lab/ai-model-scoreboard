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
  return pricingMissing || benchmarkMissing;
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
  if (model.pricing.input === undefined && model.pricing.output === undefined) {
    model.pricing.input = 0.1;
    model.pricing.output = 0.1;
  }

  if (!model.benchmarks || Object.keys(model.benchmarks).length === 0) {
    model.benchmarks = { general: 0, coding: 0, math: 0, chat: 0 };
  }
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
