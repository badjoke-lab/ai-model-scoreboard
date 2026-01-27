import Link from "next/link";
import { redirect } from "next/navigation";

import AbsoluteMetrics, {
  formatEvidenceStatus,
  formatMetricOrMissing,
  type AbsoluteMetricRow,
} from "@/components/model/AbsoluteMetrics";
import EvidenceCards from "@/components/model/EvidenceCards";
import FullBreakdownTable, {
  extractInputs,
  type FullBreakdownItem,
} from "@/components/model/FullBreakdownTable";
import ModelHeader from "@/components/model/ModelHeader";
import ModelStatus from "@/components/model/ModelStatus";
import ReferencesList from "@/components/model/ReferencesList";
import ScoreSummary from "@/components/model/ScoreSummary";
import { formatReasonList } from "@/lib/v4/deriveReasons";
import {
  buildEvidenceBlocks,
  dedupeUrls,
  formatKeyLabel,
  isHttpUrl,
  toEnglishReason,
} from "@/lib/v4/explainability";
import evidencePolicy from "@/lib/v4/evidence-policy.json";
import {
  loadV4ModelDetail,
  loadV4SnapshotWithDiagnostics,
  type V4ScoreItem,
} from "@/lib/v4-snapshot";

function formatUpdatedDate(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractAbsoluteMetrics(modelRow: Record<string, unknown> | null): Record<string, unknown> {
  if (!modelRow) return {};
  const direct = modelRow.absoluteMetrics;
  if (isObject(direct)) return direct;
  const identity = modelRow.identity;
  if (isObject(identity) && isObject(identity.absoluteMetrics)) {
    return identity.absoluteMetrics;
  }
  return {};
}

function pickMetric(
  metrics: Record<string, unknown>,
  keys: string[],
  fallback?: unknown
): unknown {
  for (const key of keys) {
    const value = metrics[key];
    if (value !== null && value !== undefined && value !== "") {
      return value;
    }
  }
  return fallback;
}

function formatPricing(pricing?: { input?: number; output?: number; currency?: string }): string {
  if (!pricing) return "Missing";
  const currency = pricing.currency ?? "USD";
  const input = typeof pricing.input === "number" ? pricing.input : null;
  const output = typeof pricing.output === "number" ? pricing.output : null;
  if (input === null && output === null) return "Missing";
  const inputLabel = input !== null ? `${input.toFixed(2)}` : "—";
  const outputLabel = output !== null ? `${output.toFixed(2)}` : "—";
  return `in: ${currency} ${inputLabel}   out: ${currency} ${outputLabel}`;
}

function formatSupportFlag(value: unknown): string {
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "string" && value.trim()) return value.trim();
  return "Missing";
}

function buildBreakdownItems(scoreItems?: Record<string, V4ScoreItem>): FullBreakdownItem[] {
  if (!scoreItems) return [];
  return Object.entries(scoreItems)
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([key, item]) => {
      const rawItem = item as Record<string, unknown>;
      const why = typeof item.why === "string" && item.why.trim() ? item.why.trim() : null;
      return {
        key,
        label: item.label ? item.label : formatKeyLabel(key),
        score: typeof item.score === "number" ? item.score : null,
        status: typeof item.status === "string" ? item.status : undefined,
        inputs: extractInputs(rawItem),
        reason: why ?? toEnglishReason(item),
        why,
        usedEvidence: Array.isArray(item.usedEvidence) ? item.usedEvidence : [],
        specMissingEvidence:
          item.status === "missing_evidence" || item.__specMissingEvidenceLink === true,
      };
    });
}

function deriveTopDrivers(
  breakdownItems: FullBreakdownItem[],
  evidenceBlocks: ReturnType<typeof buildEvidenceBlocks>
): string[] {
  const defaultReason = "No reason provided; score derived from available signals.";
  const reasons = breakdownItems
    .map((item) => item.reason)
    .filter((reason) => reason && reason !== defaultReason);
  const evidenceReasons = Object.values(evidenceBlocks).flatMap((block) =>
    formatReasonList(block.reasons)
  );
  const combined = [...reasons, ...evidenceReasons];
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const reason of combined) {
    const normalized = reason.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    deduped.push(normalized);
    if (deduped.length >= 5) break;
  }
  while (deduped.length < 3) {
    deduped.push(
      "Missing or blocked evidence triggers fixed penalties under the v4 scoring policy."
    );
  }
  return deduped.slice(0, 5);
}

function buildAbsoluteMetricRows(
  detail: {
    context?: number;
    pricing?: { input?: number; output?: number; currency?: string };
    type?: string;
    released?: string;
  },
  metrics: Record<string, unknown>,
  evidenceStatus?: string
): AbsoluteMetricRow[] {
  const contextLength = formatMetricOrMissing(
    pickMetric(metrics, [
      "context_length",
      "context_window",
      "max_context_length",
      "contextLength",
    ], detail.context),
    "Missing context length => affects score: performance signals reduced."
  );
  const maxOutputTokens = formatMetricOrMissing(
    pickMetric(metrics, ["max_output_tokens", "max_output", "maxOutputTokens"]),
    "Missing max output tokens => affects score: performance signals reduced."
  );
  const pricing = formatMetricOrMissing(
    pickMetric(metrics, ["pricing", "price"], detail.pricing),
    "Missing pricing => affects score: cost signals reduced.",
    (value) => formatPricing(value as { input?: number; output?: number; currency?: string })
  );
  const modalities = formatMetricOrMissing(
    pickMetric(metrics, ["modalities", "modality"], detail.type),
    "Missing modalities => affects score: modality coverage signals reduced."
  );
  const toolSupport = formatSupportFlag(
    pickMetric(metrics, ["tool_support", "tools", "tooling", "supports_tools"])
  );
  const jsonSupport = formatSupportFlag(
    pickMetric(metrics, ["json_support", "json_mode", "supports_json"])
  );
  const toolJsonValue = toolSupport === "Missing" && jsonSupport === "Missing"
    ? "Missing"
    : `tools: ${toolSupport}  json: ${jsonSupport}`;
  const toolJsonNote =
    toolJsonValue === "Missing"
      ? "Missing tool/JSON support => affects score: tooling capability signals reduced."
      : null;

  const trainingCutoffValue = pickMetric(metrics, ["training_cutoff", "training_data_cutoff"]);
  const trainingCutoff = formatMetricOrMissing(
    trainingCutoffValue,
    `Missing training cutoff => affects score: openness signals reduced. ${formatEvidenceStatus(
      evidenceStatus
    )}.`
  );
  const releaseDate = formatMetricOrMissing(
    pickMetric(metrics, ["release_date"], detail.released),
    `Missing release date => affects score: openness signals reduced. ${formatEvidenceStatus(
      evidenceStatus
    )}.`
  );

  return [
    {
      label: "Context length",
      value: contextLength.value,
      note: contextLength.note,
    },
    {
      label: "Max output tokens",
      value: maxOutputTokens.value,
      note: maxOutputTokens.note,
    },
    {
      label: "Pricing (per 1M tokens)",
      value: pricing.value,
      note: pricing.note,
    },
    {
      label: "Modalities",
      value: modalities.value,
      note: modalities.note,
    },
    {
      label: "Tool / JSON support",
      value: toolJsonValue,
      note: toolJsonNote,
    },
    {
      label: "Training cutoff (evidence)",
      value: trainingCutoff.value === "Missing"
        ? "Missing"
        : `${trainingCutoff.value} (${formatEvidenceStatus(evidenceStatus)})`,
      note: trainingCutoff.note,
    },
    {
      label: "Release date (evidence)",
      value: releaseDate.value === "Missing"
        ? "Missing"
        : `${releaseDate.value} (${formatEvidenceStatus(evidenceStatus)})`,
      note: releaseDate.note,
    },
  ];
}

function buildReferenceSections(
  evidenceBlocks: ReturnType<typeof buildEvidenceBlocks>,
  breakdownItems: FullBreakdownItem[]
) {
  const sections = {
    "official_page": [] as string[],
    "repo/dev": [] as string[],
    paper: [] as string[],
    audit: [] as string[],
    other: [] as string[],
  };

  const addUrl = (section: keyof typeof sections, url: string) => {
    if (!isHttpUrl(url)) return;
    sections[section].push(url);
  };

  for (const block of Object.values(evidenceBlocks)) {
    const target =
      block.key === "official_page"
        ? "official_page"
        : block.key === "dev_activity"
          ? "repo/dev"
          : block.key === "paper"
            ? "paper"
            : block.key === "audit"
              ? "audit"
              : "other";
    block.refs.forEach((ref) => addUrl(target, ref));
  }

  for (const item of breakdownItems) {
    for (const evidence of item.usedEvidence) {
      if (!evidence.link) continue;
      const type = evidence.type?.toLowerCase() ?? "";
      if (type.includes("paper")) {
        addUrl("paper", evidence.link);
      } else if (type.includes("audit")) {
        addUrl("audit", evidence.link);
      } else if (type.includes("repo") || type.includes("dev")) {
        addUrl("repo/dev", evidence.link);
      } else if (type.includes("official")) {
        addUrl("official_page", evidence.link);
      } else {
        addUrl("other", evidence.link);
      }
    }
  }

  return [
    { label: "official_page", urls: dedupeUrls(sections["official_page"]) },
    { label: "repo/dev", urls: dedupeUrls(sections["repo/dev"]) },
    { label: "paper", urls: dedupeUrls(sections.paper) },
    { label: "audit", urls: dedupeUrls(sections.audit) },
    { label: "other", urls: dedupeUrls(sections.other) },
  ];
}

type EvidenceImpactKey = "official_page" | "dev_activity" | "paper" | "audit";

function buildEvidenceImpactSummary(
  breakdownItems: FullBreakdownItem[]
): Record<EvidenceImpactKey, string> {
  const impact: Record<EvidenceImpactKey, string> = {
    official_page: "No scoring items rely on official-page evidence.",
    dev_activity: "No scoring items rely on dev-activity evidence.",
    paper: "No scoring items rely on paper evidence.",
    audit: "No scoring items rely on audit evidence.",
  };
  const itemsByEvidence: Record<EvidenceImpactKey, FullBreakdownItem[]> = {
    official_page: [],
    dev_activity: [],
    paper: [],
    audit: [],
  };

  breakdownItems.forEach((item) => {
    const allowed = evidencePolicy[item.key];
    if (!Array.isArray(allowed)) return;
    allowed.forEach((type) => {
      if (type in itemsByEvidence) {
        itemsByEvidence[type as EvidenceImpactKey].push(item);
      }
    });
  });

  (Object.keys(itemsByEvidence) as EvidenceImpactKey[]).forEach((key) => {
    const items = itemsByEvidence[key];
    if (!items.length) return;
    const hasUnverifiable = items.some(
      (item) => item.score === null && item.status === "missing_evidence"
    );
    if (hasUnverifiable) {
      impact[key] = "Unverifiable => item not scored.";
      return;
    }
    const hasMissingInputs = items.some(
      (item) => item.score === null && item.status === "missing_inputs"
    );
    if (hasMissingInputs) {
      impact[key] = "Inputs missing => item not scored.";
      return;
    }
    impact[key] = "Evidence verified => scoring enabled (no penalty applied).";
  });

  return impact;
}

export default async function ModelDetailPage({
  params,
}: {
  params: { modelKey: string[] };
}) {
  const segments = (params.modelKey ?? []).map((segment) => decodeURIComponent(segment));
  const modelKey = segments.join("/");
  const snapshot = await loadV4SnapshotWithDiagnostics();
  const models = snapshot.models ?? {};

  if (!models[modelKey] && segments.length === 1) {
    const slug = segments[0];
    const matches = Object.keys(models).filter((key) => key.split("/").pop() === slug);

    if (matches.length === 1) {
      redirect(`/models/${encodeURIComponent(matches[0])}`);
    }

    if (matches.length > 1) {
      return (
        <div className="space-y-6">
          <header className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
              AI Model Scoreboard · v4
            </p>
            <h1 className="text-3xl font-semibold text-slate-50">Multiple matches</h1>
            <p className="text-sm text-slate-400">
              &quot;{slug}&quot; matches multiple models. Choose the exact model key below.
            </p>
          </header>
          <ul className="space-y-3 rounded-2xl border border-slate-800 bg-surface/70 p-4 text-sm text-slate-200 shadow-lg">
            {matches.map((match) => (
              <li key={match}>
                <Link
                  href={`/models/${encodeURIComponent(match)}`}
                  className="font-semibold text-accent hover:text-accent/80"
                >
                  {models[match]?.name ?? match}
                </Link>
                <div className="text-xs text-slate-500">{match}</div>
              </li>
            ))}
          </ul>
          <Link href="/v4" className="text-sm font-semibold text-accent underline">
            ← Back to leaderboard
          </Link>
        </div>
      );
    }
  }

  const { detail, isNotListed, notListedEntry, index, evidenceRaw, evidencePath } =
    await loadV4ModelDetail(modelKey);

  if (!detail && isNotListed) {
    return (
      <div className="space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
            AI Model Scoreboard · v4
          </p>
          <h1 className="text-3xl font-semibold text-slate-50">{modelKey}</h1>
        </header>
        <div className="space-y-3 rounded-2xl border border-slate-800 bg-surface/70 p-5 text-slate-200 shadow-lg">
          <p className="text-lg font-semibold text-slate-50">
            This model is currently not listed in the v4 scoreboard.
          </p>
          <p className="text-sm text-slate-400">
            The model is known to the AMS pipeline but is intentionally excluded from the
            published leaderboard snapshot.
          </p>
          {notListedEntry?.reason ? (
            <p className="text-sm text-slate-400">Decision reason: {notListedEntry.reason}</p>
          ) : null}
          {notListedEntry?.source ? (
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Decision source: {notListedEntry.source}
            </p>
          ) : null}
        </div>
        <Link href="/v4" className="text-sm font-semibold text-accent underline">
          ← Back to leaderboard
        </Link>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-semibold text-slate-50">Model not found in v4 snapshot</h1>
        <p className="text-sm text-slate-400">
          We couldn&apos;t find this model in the published v4 data.
        </p>
        <div className="pt-2">
          <Link href="/v4" className="text-sm font-semibold text-accent underline">
            ← Back to leaderboard
          </Link>
        </div>
      </div>
    );
  }

  const modelRow = (models[modelKey] ?? null) as Record<string, unknown> | null;
  const absoluteMetrics = extractAbsoluteMetrics(modelRow);
  const updatedAt = formatUpdatedDate(index.meta?.updatedAt) ?? null;
  const evidenceBlocks = buildEvidenceBlocks(evidenceRaw);
  const evidenceErrorMessage = detail.evidenceError
    ? `Evidence file issue: ${detail.evidenceError}. Expected path: ${evidencePath}`
    : evidenceRaw
      ? null
      : `Evidence file missing or unreadable. Expected path: ${evidencePath}`;

  const modelScoreItems =
    isObject(modelRow?.scores) && isObject(modelRow.scores.items)
      ? (modelRow.scores.items as Record<string, V4ScoreItem>)
      : undefined;
  const breakdownItems = buildBreakdownItems(detail.scoreItems ?? modelScoreItems);
  const topDrivers = deriveTopDrivers(breakdownItems, evidenceBlocks);

  const absoluteRows = buildAbsoluteMetricRows(
    detail,
    absoluteMetrics,
    evidenceBlocks.official_page?.status
  );

  const decisionReasons = detail.decisionReasons?.length
    ? detail.decisionReasons
    : detail.decisionReason
      ? detail.decisionReason.split(",").map((reason) => reason.trim()).filter(Boolean)
      : [];

  const referenceSections = buildReferenceSections(evidenceBlocks, breakdownItems);
  const evidenceImpact = buildEvidenceImpactSummary(breakdownItems);

  const sourceLabel =
    typeof modelRow?.source === "string" && modelRow?.source.trim()
      ? modelRow.source
      : detail.layer;

  return (
    <div className="space-y-8">
      <ModelHeader
        modelKey={modelKey}
        title={`${detail.vendor} ${detail.name}`}
        provider={detail.vendor}
        source={sourceLabel}
        overallScore={detail.score}
        updatedAt={updatedAt}
      />

      <ModelStatus status={detail.status} reasons={decisionReasons} source={detail.decisionSource} />

      <AbsoluteMetrics rows={absoluteRows} />

      <ScoreSummary
        overallScore={detail.score}
        categoryScores={detail.scores}
        topDrivers={topDrivers}
      />

      <EvidenceCards
        blocks={evidenceBlocks}
        errorMessage={evidenceErrorMessage}
        impactByKey={evidenceImpact}
      />

      <FullBreakdownTable
        items={breakdownItems}
        emptyMessage="Score breakdown data is missing; category-level scoring applied with fixed penalties."
      />

      <ReferencesList sections={referenceSections} />
    </div>
  );
}
