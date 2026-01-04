export const V4_DIMENSIONS = [
  {
    key: "spec",
    label: "Spec",
    description: "Absolute capability and specification signals.",
  },
  {
    key: "evidence",
    label: "Evidence",
    description: "External verification and published evidence.",
  },
  {
    key: "ops",
    label: "Ops",
    description: "Operational quality and reliability signals.",
  },
] as const;

export type V4DimensionKey = (typeof V4_DIMENSIONS)[number]["key"];
