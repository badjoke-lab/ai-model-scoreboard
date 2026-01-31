import Link from "next/link";
import { redirect } from "next/navigation";

import AbsoluteMetrics from "@/components/model/AbsoluteMetrics";
import EvidenceCards from "@/components/model/EvidenceCards";
import FullBreakdownTable, {
  extractInputs,
  type FullBreakdownItem,
} from "@/components/model/FullBreakdownTable";
import ModelHeader from "@/components/model/ModelHeader";
import ModelStatus from "@/components/model/ModelStatus";
import ReferencesList from "@/components/model/ReferencesList";
import ScoreSummary from "@/components/model/ScoreSummary";
import { loadV4ModelDetail, loadV4SnapshotWithDiagnostics } from "@/lib/v4-snapshot";
import type { V4ModelDetailResponse } from "@/types/v4";

async function fetchModelDetail(modelKey: string): Promise<V4ModelDetailResponse | null> {
  const response = await fetch(
    `/api/v4/model/${encodeURIComponent(modelKey)}`,
    { cache: "no-store" }
  );
  if (!response.ok) return null;
  return (await response.json()) as V4ModelDetailResponse;
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

  const detailResponse = await fetchModelDetail(modelKey);
  const detail = detailResponse?.header ?? null;
  const breakdownItems = detailResponse?.breakdown.items ?? [];
  const evidenceBlocks = detailResponse?.evidenceCards.blocks ?? {};
  const evidenceErrorMessage = detailResponse?.evidenceCards.errorMessage ?? null;
  const evidenceImpact = detailResponse?.evidenceCards.impactByKey ?? {};
  const referenceSections = detailResponse?.references ?? [];
  const absoluteRows = detailResponse?.absoluteMetrics ?? [];
  const topDrivers = detailResponse?.evidenceCards.topReasons ?? [];

  const { isNotListed, notListedEntry } = await loadV4ModelDetail(modelKey);

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

  if (!detailResponse || !detail) {
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

  const header = detailResponse.header;
  const decisionReasons = header.decisionReasons ?? [];
  const missingEvidenceRules = breakdownItems.filter((item) => item.missingEvidenceRule);
  const breakdownItemsForTable: FullBreakdownItem[] = breakdownItems.map((item) => {
    const inputs = extractInputs({ inputs_raw: item.inputsRaw });
    return {
      key: item.key,
      id: item.id ?? item.key,
      label: item.label,
      score: item.score,
      status: item.status,
      inputs,
      reason: item.why,
      why: item.why,
      usedEvidence: item.usedEvidence,
      specMissingEvidence: item.specMissingEvidence,
    };
  });

  return (
    <div className="space-y-8">
      <ModelHeader
        modelKey={modelKey}
        title={header.title}
        provider={header.provider}
        source={header.source}
        overallScore={header.overallScore}
        updatedAt={header.updatedAt}
      />

      <ModelStatus
        status={header.status}
        reasons={decisionReasons}
        source={header.decisionSource}
      />

      <AbsoluteMetrics rows={absoluteRows} />

      <ScoreSummary
        overallScore={header.overallScore}
        categoryScores={header.categoryScores}
        topDrivers={topDrivers}
      />

      <EvidenceCards
        blocks={evidenceBlocks}
        errorMessage={evidenceErrorMessage}
        impactByKey={evidenceImpact}
      />
      {missingEvidenceRules.length ? (
        <p className="text-xs text-amber-200">
          No evidence rule configured for this item (spec config missing).
        </p>
      ) : null}

      <FullBreakdownTable
        items={breakdownItemsForTable}
        emptyMessage="Score breakdown data is missing; category-level scoring applied with fixed penalties."
      />

      <ReferencesList sections={referenceSections} />
    </div>
  );
}
