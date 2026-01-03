import type { V4DeltaBreakdown, V4Model, V4ScoreBreakdown } from "@/types/v4";

function normalizeScoreBreakdown(breakdown?: V4ScoreBreakdown): V4ScoreBreakdown {
  return {
    spec: breakdown?.spec ?? 0,
    evidence: breakdown?.evidence ?? 0,
    ops: breakdown?.ops ?? 0,
  };
}

function normalizeDeltaBreakdown(delta?: V4DeltaBreakdown): V4DeltaBreakdown {
  const normalizedScores = normalizeScoreBreakdown(delta);

  return {
    ...normalizedScores,
    overall: delta?.overall ?? 0,
  };
}

export function normalizeModelScores(model: V4Model): V4Model {
  return {
    ...model,
    scores: normalizeScoreBreakdown(model.scores),
    delta30d: normalizeDeltaBreakdown(model.delta30d),
    overall: model.overall ?? 0,
  };
}
