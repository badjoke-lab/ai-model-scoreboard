export const V4_DIMENSIONS = [
  {
    key: "performance",
    label: "Performance",
    description: "Benchmark and capability performance signals.",
  },
  {
    key: "safety",
    label: "Safety",
    description: "Safety evaluation, red-teaming, and incident signals.",
  },
  {
    key: "adoption",
    label: "Adoption",
    description: "Real-world usage and deployment signals.",
  },
  {
    key: "openness",
    label: "Openness",
    description: "Transparency, documentation, and openness signals.",
  },
  {
    key: "cost",
    label: "Cost",
    description: "Price and efficiency considerations.",
  },
] as const;

export type V4DimensionKey = (typeof V4_DIMENSIONS)[number]["key"];
