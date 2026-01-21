import Link from "next/link";
import { redirect } from "next/navigation";

import BreakdownTable, { type BreakdownItem } from "@/components/score/BreakdownTable";
import EvidenceTiles from "@/components/evidence/EvidenceTiles";
import EvidenceAudit from "@/components/evidence/EvidenceAudit";
import SpecTable from "@/components/model/SpecTable";
import {
  buildEvidenceBlocks,
  dedupeUrls,
  formatKeyLabel,
  isHttpUrl,
  toEnglishReason,
} from "@/lib/v4/explainability";
import {
  loadV4ModelDetail,
  loadV4SnapshotWithDiagnostics,
  type V4ScoreItem,
} from "@/lib/v4-snapshot";

function formatScore(value: number): string {
  return value.toFixed(1);
}

function formatDate(value: string | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractAbsoluteMetrics(modelRow: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!modelRow) return null;
  const direct = modelRow.absoluteMetrics;
  if (isObject(direct)) return direct;
  const identity = modelRow.identity;
  if (isObject(identity) && isObject(identity.absoluteMetrics)) {
    return identity.absoluteMetrics;
  }
  return null;
}

function buildBreakdownItems(scoreItems?: Record<string, V4ScoreItem>): BreakdownItem[] {
  if (!scoreItems) return [];
  return Object.entries(scoreItems)
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([key, item]) => ({
      key,
      label: item.label ? item.label : formatKeyLabel(key),
      impact: item.score,
      reason: toEnglishReason(item),
      usedEvidence: item.usedEvidence,
      specMissingEvidence: item.__specMissingEvidenceLink ?? false,
    }));
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
              &quot;{slug}&quot; matches multiple models. Choose the exact model key
              below.
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
            The model is known to the AMS pipeline but is intentionally excluded from
            the published leaderboard snapshot.
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
  const lastUpdated = formatDate(index.meta?.updatedAt);
  const absoluteMetrics = extractAbsoluteMetrics(modelRow);
  const modelScoreItems =
    isObject(modelRow?.scores) && isObject(modelRow.scores.items)
      ? (modelRow.scores.items as Record<string, V4ScoreItem>)
      : undefined;
  const hasScoreItems = Boolean(
    (detail.scoreItems && Object.keys(detail.scoreItems).length) ||
      (modelScoreItems && Object.keys(modelScoreItems).length)
  );
  const breakdownItems = buildBreakdownItems(detail.scoreItems ?? modelScoreItems);
  const evidenceBlocks = buildEvidenceBlocks(evidenceRaw);
  const evidenceMissing = !evidenceRaw;
  const missingMessage = evidenceMissing
    ? "Evidence file missing or unreadable."
    : undefined;

  const usedEvidenceLinks = breakdownItems
    .flatMap((item) => item.usedEvidence ?? [])
    .map((evidence) => evidence.link)
    .filter((link): link is string => typeof link === "string" && link.trim())
    .filter((link) => isHttpUrl(link));
  const evidenceRefs = Object.values(evidenceBlocks)
    .flatMap((block) => block.refs)
    .filter((ref) => isHttpUrl(ref));
  const referenceUrls = dedupeUrls([...usedEvidenceLinks, ...evidenceRefs]);

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
          AI Model Scoreboard · v4
        </p>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold leading-tight text-slate-50 sm:text-4xl">
              {detail.name}
            </h1>
            <div className="flex flex-wrap gap-2 text-xs text-slate-400">
              {detail.vendor ? (
                <span className="rounded-full border border-slate-800 px-3 py-1 text-slate-300">
                  Provider: {detail.vendor}
                </span>
              ) : null}
              {detail.type ? (
                <span className="rounded-full border border-slate-800 px-3 py-1 text-slate-300">
                  Modality: {detail.type}
                </span>
              ) : null}
              {detail.context ? (
                <span className="rounded-full border border-slate-800 px-3 py-1 text-slate-300">
                  Context length: {detail.context.toLocaleString()}
                </span>
              ) : null}
            </div>
            <p className="text-sm text-slate-400">Last updated: {lastUpdated}</p>
          </div>
          <div className="self-start rounded-2xl border border-slate-800 bg-background/70 px-5 py-4 text-right text-sm text-slate-300 shadow-xl">
            <p className="text-[0.65rem] uppercase tracking-wide text-slate-500">Overall score</p>
            <p className="text-4xl font-semibold text-slate-50">{formatScore(detail.score)}</p>
          </div>
        </div>
      </header>

      <section className="space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Evidence summary</h2>
          <p className="text-xs text-slate-400">
            Official sources, development activity, papers, and audits.
          </p>
        </div>
        <EvidenceTiles
          blocks={Object.values(evidenceBlocks)}
          missingMessage={missingMessage}
        />
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Specs</h2>
          <p className="text-xs text-slate-400">Absolute metrics for this model.</p>
        </div>
        <SpecTable metrics={absoluteMetrics} />
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Breakdown (Why this score)</h2>
          <p className="text-xs text-slate-400">
            Each item shows the impact, reason, and supporting evidence.
          </p>
        </div>
        <BreakdownTable items={breakdownItems} />
      </section>

      <EvidenceAudit
        modelKey={modelKey}
        evidenceRaw={evidenceRaw}
        evidencePath={evidencePath}
        breakdownItems={breakdownItems}
        hasScoreItems={hasScoreItems}
      />

      <section className="space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-100">References</h2>
          <p className="text-xs text-slate-400">Deduped links from evidence sources.</p>
        </div>
        {referenceUrls.length ? (
          <ul className="space-y-2 text-sm text-slate-300">
            {referenceUrls.map((url) => (
              <li key={url}>
                <Link
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-accent hover:text-accent/80"
                >
                  {url}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl border border-slate-800 bg-surface/70 px-4 py-3 text-sm text-slate-400">
            No references were found for this model.
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Raw inputs</h2>
          <p className="text-xs text-slate-400">Model row and evidence payload snapshots.</p>
        </div>
        <details className="rounded-2xl border border-slate-800 bg-surface/70 p-4 text-sm text-slate-300">
          <summary className="cursor-pointer font-semibold text-slate-100">Show raw JSON</summary>
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Model row</p>
              <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-[0.65rem] text-slate-200">
                {JSON.stringify(modelRow ?? { error: "Model row missing" }, null, 2)}
              </pre>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Evidence JSON</p>
              <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-[0.65rem] text-slate-200">
                {JSON.stringify(
                  evidenceRaw ?? { error: "Evidence file missing or unreadable." },
                  null,
                  2
                )}
              </pre>
            </div>
          </div>
        </details>
      </section>

      <Link href="/v4" className="text-sm font-semibold text-accent underline">
        ← Back to leaderboard
      </Link>
    </div>
  );
}
