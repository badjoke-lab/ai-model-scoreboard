export const ITEM_FORMULAS_EN: Record<string, string> = {
  "performance.benchmark": "score = clamp((value - 0) / (100 - 0), 0, 1) * 100",
  "safety.incident_rate": "score = (1 - clamp((value - 0) / (10 - 0), 0, 1)) * 100",
  "adoption.usage_index": "score = clamp((value - 0) / (100 - 0), 0, 1) * 100",
  "openness.license_score": "score = clamp((value - 0) / (100 - 0), 0, 1) * 100",
  "cost.efficiency": "score = clamp((value - 0) / (100 - 0), 0, 1) * 100",
};

export const DEFAULTS_EN: Record<string, string> = {
  "performance.benchmark":
    "missing -> full: deterministic fallback (fixture/hash); non-full: value=null, score=0",
  "safety.incident_rate":
    "missing -> full: deterministic fallback (fixture/hash); non-full: value=null, score=0",
  "adoption.usage_index":
    "missing -> full: deterministic fallback (fixture/hash); non-full: value=null, score=0",
  "openness.license_score":
    "missing -> full: deterministic fallback (fixture/hash); non-full: value=null, score=0",
  "cost.efficiency":
    "missing -> full: deterministic fallback (fixture/hash); non-full: value=null, score=0",
};

export function getItemFormulaEn(itemId: string): string {
  return ITEM_FORMULAS_EN[itemId] ?? "";
}

export function getItemDefaultEn(itemId: string): string {
  return DEFAULTS_EN[itemId] ?? "";
}

/**
 * IMPORTANT:
 * - Display only (no recalculation).
 * - Never display coefficients unless they are guaranteed to match implementation.
 */
export const FORMULAS = {
  overall: {
    title: "Overall score",
    formulaText: "Overall = weighted_sum(category_scores)",
    notes: [
      "Overall is a weighted sum of category scores.",
      "This is documentation; the UI does not recompute scores.",
      "Exact weights are defined in the scoring implementation/spec; this panel avoids hardcoding coefficients unless they are guaranteed to match.",
    ],
  },
  categories: [
    {
      id: "performance",
      title: "Performance",
      formulaText: "Performance = weighted_sum(performance_submetrics)",
      notes: [
        "Each category score is computed from its sub-metrics per the scoring spec.",
        "Uses available benchmark inputs; missing inputs/evidence may withhold item scores per policy.",
      ],
    },
    {
      id: "safety",
      title: "Safety",
      formulaText: "Safety = weighted_sum(safety_submetrics)",
      notes: [
        "Each category score is computed from its sub-metrics per the scoring spec.",
        "Evidence requirements may cap or withhold safety-related items.",
      ],
    },
    {
      id: "adoption",
      title: "Adoption",
      formulaText: "Adoption = weighted_sum(adoption_submetrics)",
      notes: [
        "Each category score is computed from its sub-metrics per the scoring spec.",
        "Based on provider/source signals; missing data is shown explicitly in Raw Inputs.",
      ],
    },
    {
      id: "openness",
      title: "Openness",
      formulaText: "Openness = weighted_sum(openness_submetrics)",
      notes: [
        "Each category score is computed from its sub-metrics per the scoring spec.",
        "Based on disclosures, docs, and availability of primary sources.",
      ],
    },
    {
      id: "cost",
      title: "Cost",
      formulaText: "Cost = function(pricing_inputs)",
      notes: [
        "Each category score is computed from its sub-metrics per the scoring spec.",
        "Computed from pricing inputs; shown as documentation only.",
      ],
    },
  ],
} as const;

export type FormulaCategoryId = (typeof FORMULAS.categories)[number]["id"];
