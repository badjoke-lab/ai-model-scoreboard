import Link from "next/link";
import { headers } from "next/headers";
import {redirect, notFound} from "next/navigation";

import AbsoluteMetrics from "@/components/model/AbsoluteMetrics";
import AdoptionStatus from "@/components/model/AdoptionStatus";
import EvidenceCards from "@/components/model/EvidenceCards";
import FullBreakdownTable, {
  extractInputs,
  type FullBreakdownItem,
} from "@/components/model/FullBreakdownTable";
import LinksSection from "@/components/model/LinksSection";
import ModelHeader from "@/components/model/ModelHeader";
import ModelStatus from "@/components/model/ModelStatus";
import RawInputsPanel from "@/components/model/RawInputsPanel";
import ScoreFormulaPanel from "@/components/model/ScoreFormulaPanel";
import ScoreSummary from "@/components/model/ScoreSummary";
import { fromRouteParam, toEncodedModelKey } from "@/lib/v4/modelKey";
import { loadV4ModelDetail, loadV4SnapshotWithDiagnostics } from "@/lib/v4-snapshot";
import type { AbsoluteBlock, Missing, V4ModelDetailResponse } from "@/types/v4";

type ModelDetailFetchError = {
  status: number | null;
  message: string;
};

async function fetchModelDetail(modelKey: string): Promise<{
  data: V4ModelDetailResponse | null;
  error: ModelDetailFetchError | null;
}> {
  try {
    const h = headers();
    const host = h.get("host") ?? "localhost:3000";
    const proto = h.get("x-forwarded-proto") ?? "https";
    const base = `${proto}://${host}`;
    const response = await fetch(`${base}/api/v4/model/${toEncodedModelKey(modelKey)}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      let message = "Detail data unavailable.";
      try {
        const payload = (await response.json()) as {
          error?: { message?: string } | null;
        };
        if (payload?.error?.message) {
          message = payload.error.message;
        }
      } catch {
        // ignore JSON parse errors
      }
      return {
        data: null,
        error: { status: response.status, message },
      };
    }
    const payload = (await response.json()) as V4ModelDetailResponse & {
      ok?: boolean;
      error?: { message?: string };
    };
    if (payload && typeof payload === "object" && payload.ok === false) {
      return {
        data: null,
        error: {
          status: 500,
          message: payload.error?.message ?? "Detail data unavailable.",
        },
      };
    }
    return { data: payload, error: null };
  } catch {
    return {
      data: null,
      error: { status: null, message: "Unable to load model detail data." },
    };
  }
}

const missingValue = (field: string): Missing => ({
  value: null,
  status: "missing",
  reasons: [`missing_field:${field}`],
  refs: [],
});

const buildMissingAbsoluteBlock = (modelKey: string): AbsoluteBlock => ({
  modelKey,
  displayName: missingValue("displayName"),
  provider: missingValue("provider"),
  canonicalSlug: missingValue("canonicalSlug"),
  contextLength: missingValue("contextLength"),
  maxOutputTokens: missingValue("maxOutputTokens"),
  pricingInputPer1M: missingValue("pricingInputPer1M"),
  pricingOutputPer1M: missingValue("pricingOutputPer1M"),
  modalities: missingValue("modalities"),
  supportsTools: missingValue("supportsTools"),
  supportsJson: missingValue("supportsJson"),
  releaseDate: missingValue("releaseDate"),
  trainingCutoff: missingValue("trainingCutoff"),
});

const buildMissingAdoption = (): Missing => ({
  value: null,
  status: "not_found",
  reasons: ["missing_decision_entry"],
  refs: [],
});

export default async function ModelDetailPage({
  params,
}: {
  params: { modelKey: string[] };
}) {
  const rawParam = Array.isArray(params.modelKey)
    ? params.modelKey.join("/")
    : params.modelKey;
  const modelKey = fromRouteParam(rawParam ?? "");
  const snapshot = await loadV4SnapshotWithDiagnostics();
  const models = snapshot.models ?? {};

  if (!models[modelKey] && modelKey && !modelKey.includes("/")) {
    const slug = modelKey;
    const matches = Object.keys(models).filter((key) => key.split("/").pop() === slug);

    if (matches.length === 1) {
      redirect(`/models/${toEncodedModelKey(matches[0])}`);
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
                  href={`/models/${toEncodedModelKey(match)}`}
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

  const { data: detailResponse, error: detailError } = await fetchModelDetail(modelKey);
  const detail = detailResponse?.header ?? null;
  const breakdownItems = detailResponse?.breakdown.items ?? [];
  const evidenceErrorMessage = detailResponse?.evidenceCards.errorMessage ?? null;
  const evidenceImpact = detailResponse?.evidenceCards.impactByKey ?? {};
  const evidenceItems = detailResponse?.evidence ?? [];
  const links = detailResponse?.links ?? [];
  const absolute = detailResponse?.absolute ?? buildMissingAbsoluteBlock(modelKey);
  const adoption = detailResponse?.adoption ?? buildMissingAdoption();
  const topDrivers = detailResponse?.evidenceCards.topReasons ?? [];

  const { isNotListed, notListedEntry } = await loadV4ModelDetail(modelKey);

  if (!detailError && !detail && isNotListed) {
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

  if (!detailError && (!detailResponse || !detail)) {
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

  if (detailError) {
    const modelMeta = models[modelKey];
    const statusLabel = modelMeta?.layer ?? null;
    return (
      <div className="space-y-8">
        <ModelHeader
          modelKey={modelKey}
          title={modelMeta?.name ?? modelKey}
          provider={modelMeta?.vendor ?? null}
          source={null}
          overallScore={modelMeta?.scores?.overall ?? null}
          updatedAt={null}
        />

        <AbsoluteMetrics absolute={absolute} />

        <AdoptionStatus adoption={adoption} />

        <ModelStatus status={statusLabel} reasons={[]} source={null} />

        <ScoreSummary
          overallScore={modelMeta?.scores?.overall ?? null}
          categoryScores={modelMeta?.scores?.categories ?? {}}
          topDrivers={[]}
        />

        <EvidenceCards evidence={evidenceItems} errorMessage={evidenceErrorMessage} impactByKey={{}} />

        <section className="rounded-2xl border border-rose-500/50 bg-rose-500/10 p-6 shadow-lg">
          <h2 className="text-lg font-semibold text-rose-100">Detail data unavailable</h2>
          <p className="mt-2 text-sm text-rose-100">
            HTTP status: {detailError.status ?? "unknown"}
          </p>
          <p className="mt-1 text-sm text-rose-200">{detailError.message}</p>
        </section>

        <LinksSection links={links} />
      </div>
    );
  }

  if (!detailResponse) {
    notFound();
  }

  const header = detailResponse.header;
  const decisionReasons = header.decisionReasons ?? [];
  const missingEvidenceRules = breakdownItems.filter((item) => item.missingEvidenceRule);
  const rawInputsBySource = detailResponse.rawInputsBySource;
  const breakdownItemsForTable: FullBreakdownItem[] = breakdownItems.map((item) => {
    const inputs = extractInputs({ inputs_raw: item.inputsRaw });
    return {
      key: item.key,
      id: item.id ?? item.key,
      label: item.label,
      score: item.score,
      status: item.status,
      inputs,
      inputMissing: item.inputMissing ?? null,
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

      <AbsoluteMetrics absolute={absolute} />

      <AdoptionStatus adoption={adoption} />

      <ModelStatus
        status={header.status}
        reasons={decisionReasons}
        source={header.decisionSource}
      />

      <ScoreSummary
        overallScore={header.overallScore}
        categoryScores={header.categoryScores}
        topDrivers={topDrivers}
      />

      <EvidenceCards
        evidence={evidenceItems}
        errorMessage={evidenceErrorMessage}
        impactByKey={evidenceImpact}
      />
      {missingEvidenceRules.length ? (
        <p className="text-xs text-amber-200">
          No evidence rule configured for this item (spec config missing).
        </p>
      ) : null}

      <RawInputsPanel rawInputsBySource={rawInputsBySource} />

      <ScoreFormulaPanel />

      <FullBreakdownTable
        items={breakdownItemsForTable}
        emptyMessage="Score breakdown data is missing; category-level scoring applied with fixed penalties."
      />

      <LinksSection links={links} />
    </div>
  );
}
