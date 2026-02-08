import { generateDecisions } from "../../scripts/auto_adopt_models.mjs";
import { normalizeDecision, normalizeSlug } from "./metadata.mjs";
import { scoreV4 } from "./scoring.mjs";

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function sortBySlug(a, b) {
  return a.slug.localeCompare(b.slug);
}

function sortRanking(a, b) {
  if (b.score !== a.score) return b.score - a.score;
  return a.model.localeCompare(b.model);
}

function formatScores(scores) {
  return {
    performance: round(scores.performance ?? 0),
    safety: round(scores.safety ?? 0),
    adoption: round(scores.adoption ?? 0),
    openness: round(scores.openness ?? 0),
    cost: round(scores.cost ?? 0),
  };
}

function ensureUniqueSlug(baseSlug, seen) {
  let candidate = baseSlug || "missing-model";
  let suffix = 2;
  while (seen.has(candidate)) {
    candidate = `${baseSlug || "missing-model"}-${suffix}`;
    suffix += 1;
  }
  seen.add(candidate);
  return candidate;
}

export function buildSnapshot({ now = new Date() } = {}) {
  const updatedAt = now.toISOString();
  const decisions = generateDecisions();
  const orderedDecisions = decisions
    .map((decision, index) => ({ decision, index }))
    .sort((a, b) => {
      const slugA = normalizeSlug(a.decision?.slug) || normalizeSlug(a.decision?.name);
      const slugB = normalizeSlug(b.decision?.slug) || normalizeSlug(b.decision?.name);
      if (slugA !== slugB) return slugA.localeCompare(slugB);
      const nameA = String(a.decision?.name ?? "");
      const nameB = String(b.decision?.name ?? "");
      if (nameA !== nameB) return nameA.localeCompare(nameB);
      return a.index - b.index;
    });

  const seenSlugs = new Set();
  const models = orderedDecisions.map(({ decision }) => {
    const normalized = normalizeDecision(decision);
    const baseSlug = normalized.slug || normalizeSlug(normalized.name);
    const uniqueSlug = ensureUniqueSlug(baseSlug, seenSlugs);
    normalized.slug = uniqueSlug;

    const scoring = scoreV4(normalized);

    return {
      model: {
        slug: uniqueSlug,
        name: normalized.name,
        vendor: normalized.vendor,
      },
      decision: {
        status: normalized.layer,
        reason: normalized.reason,
        source: normalized.source,
      },
      scores: {
        total: scoring.totalScore,
        breakdown: formatScores(scoring.scores),
      },
      criteria: scoring.criteria,
      updatedAt,
    };
  });

  models.sort((a, b) => sortBySlug(a.model, b.model));

  const rankings = models
    .filter((entry) => entry.decision.status === "full" || entry.decision.status === "provisional")
    .map((entry) => ({
      model: entry.model.slug,
      vendor: entry.model.vendor,
      layer: entry.decision.status,
      score: entry.scores.total,
      scores: formatScores(entry.scores.breakdown),
      updatedAt: entry.updatedAt,
    }))
    .sort(sortRanking);

  const notListed = models
    .filter((entry) => entry.decision.status === "not-listed")
    .map((entry) => ({
      slug: entry.model.slug,
      reason: entry.decision.reason,
      source: entry.decision.source,
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug));

  const fullCount = rankings.filter((entry) => entry.layer === "full").length;
  const provisionalCount = rankings.filter((entry) => entry.layer === "provisional").length;

  const meta = {
    version: "v4",
    updatedAt,
    modelsCount: rankings.length,
    fullCount,
    provisionalCount,
    notListedCount: notListed.length,
  };

  return {
    meta,
    models,
    rankings,
    notListed,
  };
}

export function toPublicSnapshot(snapshot) {
  const models = {};
  snapshot.models.forEach((entry) => {
    models[entry.model.slug] = {
      name: entry.model.name,
      vendor: entry.model.vendor,
    };
  });

  const sortedModels = Object.keys(models)
    .sort((a, b) => a.localeCompare(b))
    .reduce((acc, key) => {
      acc[key] = models[key];
      return acc;
    }, {});

  return {
    index: {
      meta: snapshot.meta,
    },
    rankings: snapshot.rankings,
    models: sortedModels,
    notListed: snapshot.notListed.map((entry) => entry.slug),
  };
}
