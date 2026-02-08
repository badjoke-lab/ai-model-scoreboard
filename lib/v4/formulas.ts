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
