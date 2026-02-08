export type CategoryId = "C1" | "C2" | "C3" | "C4" | "C5" | "C6" | "C7";

export const CATEGORY_ORDER: CategoryId[] = ["C1", "C2", "C3", "C4", "C5", "C6", "C7"];

export const CATEGORY_WEIGHTS: Record<CategoryId, number> = {
  C1: 0.4,
  C2: 0.2,
  C3: 0.12,
  C4: 0.1,
  C5: 0.08,
  C6: 0.06,
  C7: 0.04,
};

export const CATEGORY_LABELS_EN: Record<CategoryId, string> = {
  C1: "C1 Performance",
  C2: "C2 Spec",
  C3: "C3 Cost",
  C4: "C4 Speed",
  C5: "C5 Reliability",
  C6: "C6 Features",
  C7: "C7 Transparency",
};
