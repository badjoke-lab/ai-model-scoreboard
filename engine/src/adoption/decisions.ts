import {
  AdoptionDecisionEntry,
  AdoptionOutput,
  DecisionsLog,
} from "../../types";
import { AdoptionDecision, AdoptionRules } from "./rules";

export function buildDecisionsLog(
  decisions: AdoptionDecision[],
  rules: AdoptionRules,
  generatedAt?: string
): DecisionsLog {
  const sorted = [...decisions].sort((a, b) =>
    a.candidate.modelKey.localeCompare(b.candidate.modelKey)
  );

  const decisionEntries: AdoptionDecisionEntry[] = sorted.map((decision) => ({
    modelKey: decision.candidate.modelKey,
    source: decision.candidate.source,
    status: decision.status,
    reasons: decision.reasons,
    normalized: {
      name: decision.candidate.name ?? null,
      slug: decision.candidate.modelKey,
      provider: decision.candidate.provider ?? null,
    },
    rawRef: {
      id: decision.candidate.rawRef.id,
      canonical_slug: decision.candidate.rawRef.canonical_slug,
    },
  }));

  const counts = decisionEntries.reduce(
    (acc, entry) => {
      acc.total += 1;
      acc[entry.status] += 1;
      if (entry.source === "openrouter") acc.sources.openrouter += 1;
      if (entry.source === "seed") acc.sources.seed += 1;
      return acc;
    },
    {
      total: 0,
      adopted: 0,
      provisional: 0,
      denied: 0,
      sources: { openrouter: 0, seed: 0 },
    }
  );

  return {
    meta: {
      generatedAt: generatedAt ?? new Date().toISOString(),
      requiredFields: rules.requiredFields,
      allowlistCount: rules.allowlist.length,
      denylistCount: rules.denylist.length,
      totals: counts,
      rules: {
        allowlist: rules.allowlist,
        denylist: rules.denylist,
      },
    },
    decisions: decisionEntries,
  };
}

export function buildAdoptionOutput(
  decisions: AdoptionDecision[]
): AdoptionOutput {
  const adopted = [];
  const provisional = [];

  for (const decision of decisions) {
    if (decision.status === "adopted") {
      adopted.push(decision);
    }
    if (decision.status === "provisional") {
      provisional.push(decision);
    }
  }

  const serialize = (decision: AdoptionDecision) => ({
    modelKey: decision.candidate.modelKey,
    name: decision.candidate.name ?? null,
    provider: decision.candidate.provider ?? null,
    source: decision.candidate.source,
  });

  const byKey = (a: AdoptionDecision, b: AdoptionDecision) =>
    a.candidate.modelKey.localeCompare(b.candidate.modelKey);

  return {
    adopted: adopted.sort(byKey).map(serialize),
    provisional: provisional.sort(byKey).map(serialize),
  };
}
