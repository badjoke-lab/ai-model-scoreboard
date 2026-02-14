import type { V4ModelDetailBreakdownItem } from "@/types/v4";

export type CategoryReason1L = {
  performance: string;
  safety: string;
  adoption: string;
  openness: string;
  cost: string;
};

type CategoryId = keyof CategoryReason1L;

const CATEGORY_PREFIX: Record<CategoryId, string> = {
  performance: "Q",
  safety: "S",
  adoption: "A",
  openness: "T",
  cost: "C",
};

const CATEGORY_DEFAULTS: Record<CategoryId, string> = {
  performance: "Strong benchmark signals with no major data gaps.",
  safety: "Safety score reflects documented policies and available evidence.",
  adoption: "Adoption reflects availability and ecosystem signals.",
  openness: "Openness reflects documentation and transparency signals.",
  cost: "Cost reflects published pricing and effective value.",
};

const NO_ITEMS_REASON = "No scoring items available for this category.";
const SPEC_VIOLATION_REASON =
  "Capped due to missing required evidence links (spec violation).";
const WITHHELD_REASON = "Limited by withheld items due to missing inputs/evidence.";
const INPUT_MISSING_REASON = "Limited by missing raw inputs for multiple items.";

type CategoryCounts = {
  withheldCount: number;
  specViolationCount: number;
  inputMissingCount: number;
  totalCount: number;
  weakSignalCount: number;
};

function countCategoryItems(items: V4ModelDetailBreakdownItem[]): CategoryCounts {
  let withheldCount = 0;
  let specViolationCount = 0;
  let inputMissingCount = 0;

  for (const item of items) {
    const status = (item.status ?? "").toLowerCase();
    if (status === "withheld" || (item.score == null && status !== "ok")) {
      withheldCount += 1;
    }
    if (item.specMissingEvidence) {
      specViolationCount += 1;
    }
    if (item.inputMissing?.status === "missing") {
      inputMissingCount += 1;
    }
  }

  const totalCount = items.length;
  const weakSignalCount = withheldCount + specViolationCount + inputMissingCount;
  return { withheldCount, specViolationCount, inputMissingCount, totalCount, weakSignalCount };
}

function normalizeSingleLine(value: string): string {
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (collapsed.length <= 120) return collapsed;
  return `${collapsed.slice(0, 119).trimEnd()}…`;
}

function resolveMissingReason(counts: CategoryCounts): string {
  if (counts.inputMissingCount === 0) return WITHHELD_REASON;
  if (counts.withheldCount === 0) return INPUT_MISSING_REASON;
  const withheldRatio = counts.totalCount
    ? counts.withheldCount / counts.totalCount
    : 0;
  const inputMissingRatio = counts.totalCount
    ? counts.inputMissingCount / counts.totalCount
    : 0;
  return inputMissingRatio >= withheldRatio ? INPUT_MISSING_REASON : WITHHELD_REASON;
}

function resolveCategoryReason(
  categoryId: CategoryId,
  items: V4ModelDetailBreakdownItem[]
): string {
  if (items.length === 0) return NO_ITEMS_REASON;

  const counts = countCategoryItems(items);
  if (counts.specViolationCount > 0) return SPEC_VIOLATION_REASON;

  const withheldRatio = counts.totalCount ? counts.withheldCount / counts.totalCount : 0;
  if (withheldRatio >= 0.34) return WITHHELD_REASON;

  const inputMissingRatio = counts.totalCount
    ? counts.inputMissingCount / counts.totalCount
    : 0;
  if (inputMissingRatio >= 0.34) return INPUT_MISSING_REASON;

  if (counts.weakSignalCount > 0) {
    return resolveMissingReason(counts);
  }

  return CATEGORY_DEFAULTS[categoryId];
}

export function buildCategoryReason1L(
  breakdownItems: V4ModelDetailBreakdownItem[]
): CategoryReason1L {
  const itemsByCategory: Record<CategoryId, V4ModelDetailBreakdownItem[]> = {
    performance: [],
    safety: [],
    adoption: [],
    openness: [],
    cost: [],
  };

  for (const item of breakdownItems) {
    for (const [categoryId, prefix] of Object.entries(CATEGORY_PREFIX) as Array<
      [CategoryId, string]
    >) {
      if (item.key.startsWith(prefix)) {
        itemsByCategory[categoryId].push(item);
        break;
      }
    }
  }

  return {
    performance: normalizeSingleLine(
      resolveCategoryReason("performance", itemsByCategory.performance)
    ),
    safety: normalizeSingleLine(resolveCategoryReason("safety", itemsByCategory.safety)),
    adoption: normalizeSingleLine(resolveCategoryReason("adoption", itemsByCategory.adoption)),
    openness: normalizeSingleLine(resolveCategoryReason("openness", itemsByCategory.openness)),
    cost: normalizeSingleLine(resolveCategoryReason("cost", itemsByCategory.cost)),
  };
}
