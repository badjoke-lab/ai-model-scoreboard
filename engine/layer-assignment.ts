/**
 * AMS v4 — Layer Assignment Module (Skeleton)
 * --------------------------------------------
 * Responsibilities:
 *  - Assign models to one of the three AMS layers:
 *      "full"
 *      "provisional"
 *      "not-listed"
 *
 *  - Apply Safeguard rules for hysteresis (promotion/demotion delay)
 *  - Ensure stability: prevent rapid layer flapping
 *  - Maintain consistency with previous snapshot when necessary
 *
 * NOTE:
 *  - No internal thresholds, formulas, or logic are included.
 *  - Real decision criteria are implemented privately.
 */

import {
  ScoredModel,
  LayerAssignedModel,
  Layer,
} from "./types";
import { loadPreviousDaySnapshot } from "./previous-snapshot";

/**
 * Main entry point
 * Input: Scored models (after fallback)
 * Output: Models with assigned layers
 */
export function assignLayers(
  scored: ScoredModel[]
): LayerAssignedModel[] {
  const prevSnapshot = loadPreviousDaySnapshot(); // may be null

  return scored.map((model) => {
    const layer = determineLayer(model, prevSnapshot);
    return {
      ...model,
      layer,
    };
  });
}

/* -------------------------------------------------------
 * Layer Determination (structure only, no logic)
 * -----------------------------------------------------*/

/**
 * Determine the layer for a model.
 * This function is a placeholder; real logic is private.
 */
function determineLayer(
  model: ScoredModel,
  prevSnapshot: any
): Layer {
  const prev = prevSnapshot?.rankings?.find((r: any) => r.model === model.id);
  const incidents = (prevSnapshot?.incidentsByModel || {})[model.id] || {};
  const critical = incidents.critical || 0;

  if (critical > 0 || model.scores.categories.safety <= 0) {
    return "not-listed";
  }

  const hasLowPerformance = model.scores.categories.performance < 40;
  const hasLowOpenness = model.scores.categories.openness < 20;
  const outdated = isOutdated(prevSnapshot, model.id);

  if (hasLowPerformance || hasLowOpenness || outdated) {
    return "provisional";
  }

  const prevLayer: Layer | undefined = prev?.layer;
  if (prevLayer === "provisional" && model.scores.categories.performance < 50) {
    return "provisional";
  }

  return "full";
}

function isOutdated(prevSnapshot: any, modelId: string): boolean {
  const entry = prevSnapshot?.rankings?.find((r: any) => r.model === modelId);
  if (!entry?.updatedAt) return false;
  const updated = new Date(entry.updatedAt);
  const days = (Date.now() - updated.getTime()) / (1000 * 60 * 60 * 24);
  return days > 180;
}
