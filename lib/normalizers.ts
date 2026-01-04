import type { V4DeltaBreakdown, V4Model, V4ScoreBreakdown } from "@/types/v4";

const SCORE_MULTIPLIER = 10;

function scaleScoreBreakdown(breakdown?: V4ScoreBreakdown): V4ScoreBreakdown {
  return {
    spec: (breakdown?.spec ?? 0) * SCORE_MULTIPLIER,
    evidence: (breakdown?.evidence ?? 0) * SCORE_MULTIPLIER,
    ops: (breakdown?.ops ?? 0) * SCORE_MULTIPLIER,
  };
}

function scaleDeltaBreakdown(delta?: V4DeltaBreakdown): V4DeltaBreakdown {
  const scaledScores = scaleScoreBreakdown(delta);

  return {
    ...scaledScores,
    total: (delta?.total ?? 0) * SCORE_MULTIPLIER,
  };
}

export function normalizeModelScores(model: V4Model): V4Model {
  return {
    ...model,
    scores: scaleScoreBreakdown(model.scores),
    delta30d: scaleDeltaBreakdown(model.delta30d),
    total: (model.total ?? 0) * SCORE_MULTIPLIER,
  };
}
