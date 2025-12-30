export const CATEGORY_WEIGHTS = {
  performance: 0.35,
  safety: 0.25,
  adoption: 0.2,
  openness: 0.1,
  cost: 0.1,
};

export const CRITERIA_DEFINITIONS = [
  {
    key: "performance.benchmark",
    label: "Benchmark composite",
    category: "performance",
    min: 0,
    max: 100,
    weight: 1,
    direction: "higher-better",
  },
  {
    key: "safety.incident_rate",
    label: "Safety incident rate",
    category: "safety",
    min: 0,
    max: 10,
    weight: 1,
    direction: "lower-better",
  },
  {
    key: "adoption.usage_index",
    label: "Adoption index",
    category: "adoption",
    min: 0,
    max: 100,
    weight: 1,
    direction: "higher-better",
  },
  {
    key: "openness.license_score",
    label: "License openness score",
    category: "openness",
    min: 0,
    max: 100,
    weight: 1,
    direction: "higher-better",
  },
  {
    key: "cost.efficiency",
    label: "Cost efficiency",
    category: "cost",
    min: 0,
    max: 100,
    weight: 1,
    direction: "higher-better",
  },
];

export const CRITERIA_FIXTURES = {
  "openai-gpt-4.1": {
    "performance.benchmark": 92,
    "safety.incident_rate": 1.2,
    "adoption.usage_index": 88,
    "openness.license_score": 15,
    "cost.efficiency": 45,
  },
  "anthropic-claude-3.5-sonnet": {
    "performance.benchmark": 90,
    "safety.incident_rate": 1.4,
    "adoption.usage_index": 80,
    "openness.license_score": 10,
    "cost.efficiency": 50,
  },
};

export function listCriteriaKeys() {
  return CRITERIA_DEFINITIONS.map((criterion) => criterion.key);
}
