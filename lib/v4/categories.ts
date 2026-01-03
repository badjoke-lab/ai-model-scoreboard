import type { V4ScoreBreakdown, V4ScoreCategories } from "@/lib/v4-snapshot";

const CATEGORY_KEY_MAP: Record<string, string> = {
  C1: "performance",
  C2: "safety",
  C3: "adoption",
  C4: "openness",
  C5: "cost",
};

function normalizeCategoryKey(key: string) {
  const trimmed = key.trim();
  if (CATEGORY_KEY_MAP[trimmed]) return CATEGORY_KEY_MAP[trimmed];
  const upper = trimmed.toUpperCase();
  if (CATEGORY_KEY_MAP[upper]) return CATEGORY_KEY_MAP[upper];
  return trimmed;
}

export function getCategoryScore(
  categories: V4ScoreCategories | V4ScoreBreakdown,
  key: string
): number | null {
  const normalizedKey = normalizeCategoryKey(key);
  const source = "categories" in categories ? categories.categories ?? {} : categories;
  const value =
    (source as V4ScoreCategories)[normalizedKey] ??
    (source as V4ScoreCategories)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function getCategoryLabel(key: string) {
  const normalizedKey = normalizeCategoryKey(key);
  const baseLabel =
    normalizedKey === "performance"
      ? "Performance"
      : normalizedKey === "safety"
        ? "Safety"
        : normalizedKey === "adoption"
          ? "Adoption"
          : normalizedKey === "openness"
            ? "Openness"
            : normalizedKey === "cost"
              ? "Cost"
              : normalizedKey;
  return baseLabel;
}
