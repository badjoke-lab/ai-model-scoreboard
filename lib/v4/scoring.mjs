import { CATEGORY_WEIGHTS, CRITERIA_DEFINITIONS, CRITERIA_FIXTURES } from "./config.mjs";

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function hashToUnit(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) % 1000003;
  }
  return (hash % 1000) / 1000;
}

function computeCriterionScore(definition, value) {
  const normalized = clamp((value - definition.min) / (definition.max - definition.min), 0, 1);
  const score =
    definition.direction === "lower-better" ? (1 - normalized) * 100 : normalized * 100;
  return round(score);
}

function shouldScoreLayer(layer) {
  return layer === "full";
}

function buildMissingReason(layer, decisionReason) {
  if (layer === "deny") return "model denied by policy";
  if (layer === "not-listed") return "model not listed";
  if (layer === "provisional") {
    return decisionReason || "model missing required inputs";
  }
  return "missing input";
}

function resolveCriterionValue(model, definition) {
  const fixture = CRITERIA_FIXTURES[model.slug];
  if (fixture && Object.prototype.hasOwnProperty.call(fixture, definition.key)) {
    return fixture[definition.key];
  }
  const token = `${model.slug}:${definition.key}`;
  const unit = hashToUnit(token);
  return round(definition.min + (definition.max - definition.min) * unit, 2);
}

export function computeCriteria(model) {
  const entries = {};
  const canScore = shouldScoreLayer(model.layer);
  const missingReason = canScore ? null : buildMissingReason(model.layer, model.reason);

  CRITERIA_DEFINITIONS.forEach((definition) => {
    if (!canScore) {
      entries[definition.key] = {
        value: null,
        score: 0,
        weight: definition.weight,
        category: definition.category,
        missingReason,
      };
      return;
    }

    const value = resolveCriterionValue(model, definition);
    entries[definition.key] = {
      value,
      score: computeCriterionScore(definition, value),
      weight: definition.weight,
      category: definition.category,
    };
  });

  return entries;
}

function aggregateCategoryScores(criteria) {
  const categoryTotals = {};
  const categoryWeights = {};

  Object.values(criteria).forEach((criterion) => {
    const category = criterion.category;
    const weight = criterion.weight ?? 1;
    if (!category) return;

    categoryTotals[category] = (categoryTotals[category] ?? 0) + criterion.score * weight;
    categoryWeights[category] = (categoryWeights[category] ?? 0) + weight;
  });

  const scores = {};
  Object.keys(CATEGORY_WEIGHTS).forEach((category) => {
    const total = categoryTotals[category] ?? 0;
    const weight = categoryWeights[category] ?? 0;
    scores[category] = weight > 0 ? round(total / weight) : 0;
  });

  return scores;
}

function aggregateTotalScore(categoryScores) {
  let totalWeight = 0;
  let weightedScore = 0;

  Object.entries(CATEGORY_WEIGHTS).forEach(([category, weight]) => {
    totalWeight += weight;
    weightedScore += (categoryScores[category] ?? 0) * weight;
  });

  if (totalWeight === 0) return 0;
  return round(weightedScore / totalWeight);
}

export function scoreV4(model) {
  const criteria = computeCriteria(model);
  const scores = aggregateCategoryScores(criteria);
  const totalScore = aggregateTotalScore(scores);

  return {
    criteria,
    scores,
    totalScore,
  };
}
