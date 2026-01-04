import Link from "next/link";

import {
  loadV4ModelDetail,
  type V4EvidenceItem,
  type V4EvidenceReference,
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

function formatStatus(status: "adopted" | "provisional" | "denied") {
  return status === "adopted"
    ? "Adopted"
    : status === "provisional"
      ? "Provisional"
      : "Denied";
}

function LayerBadge({ layer }: { layer: "full" | "provisional" | "rejected" | "not-listed" }) {
  if (!layer) return null;
  const label = layer.replace("-", " ");
  const colorClasses =
    layer === "full"
      ? "border-emerald-500/50 text-emerald-300"
      : layer === "provisional"
        ? "border-amber-400/60 text-amber-200"
        : layer === "rejected"
          ? "border-rose-500/50 text-rose-200"
          : "border-slate-600 text-slate-400";

  return (
    <span
      className={`rounded-full border bg-slate-900/60 px-2 py-1 text-[0.65rem] uppercase tracking-wide ${colorClasses}`}
    >
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: "adopted" | "provisional" | "denied" }) {
  const label =
    status === "adopted" ? "Adopted" : status === "provisional" ? "Provisional" : "Denied";
  const colorClasses =
    status === "adopted"
      ? "border-emerald-400/60 text-emerald-200"
      : status === "provisional"
        ? "border-amber-400/60 text-amber-200"
        : "border-rose-500/50 text-rose-200";

  return (
    <span
      className={`rounded-full border bg-slate-900/60 px-2 py-1 text-[0.65rem] uppercase tracking-wide ${colorClasses}`}
    >
      {label}
    </span>
  );
}

function EvidenceRow({ item }: { item: V4EvidenceItem }) {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-background/60 p-4 shadow">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[0.65rem] uppercase tracking-wide text-slate-300">
          {item.type}
        </span>
        {item.status ? (
          <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[0.65rem] uppercase tracking-wide text-slate-400">
            {item.status}
          </span>
        ) : null}
      </div>
      {item.summary ? <p className="mt-2 text-sm text-slate-200">{item.summary}</p> : null}
      {item.reasonCodes?.length ? (
        <div className="mt-3 flex flex-wrap gap-2 text-[0.7rem]">
          {item.reasonCodes.map((code) => (
            <span
              key={code}
              className="rounded-full border border-slate-700/70 bg-slate-900/50 px-2 py-0.5 text-slate-300"
            >
              {code}
            </span>
          ))}
        </div>
      ) : null}
      {item.refs?.length ? (
        <ul className="mt-3 space-y-2 text-xs text-slate-400">
          {item.refs.map((ref, index) => (
            <li key={`${ref.label ?? ref.url ?? "ref"}-${index}`} className="space-y-1">
              <div className="font-semibold text-slate-300">{ref.label ?? "Reference"}</div>
              {ref.note ? <div className="text-slate-500">{ref.note}</div> : null}
              <EvidenceRefs refs={[ref]} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function EvidenceRefs({ refs }: { refs?: V4EvidenceReference[] }) {
  if (!refs?.length) return null;
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {refs.map((ref, index) => {
        const label = ref.label ?? ref.url ?? "Reference";
        if (ref.url) {
          return (
            <Link
              key={`${label}-${index}`}
              href={ref.url}
              className="font-semibold text-accent hover:text-accent/80"
              target="_blank"
              rel="noreferrer"
            >
              {label} →
            </Link>
          );
        }
        return (
          <span key={`${label}-${index}`} className="text-slate-400">
            {label}
          </span>
        );
      })}
    </div>
  );
}

function formatReasonLabel(reason: string) {
  return reason
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

type CategoryScore = {
  label: string;
  value: number;
  reasons: string[];
  evidenceRefs: V4EvidenceReference[];
  hasEvidence: boolean;
};

function ScoreBreakdownItem({ item }: { item: CategoryScore }) {
  const hasReasonedEvidence = item.hasEvidence && item.reasons.length > 0;
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-surface/80 p-4 shadow">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[0.65rem] uppercase tracking-wide text-slate-500">
            {item.label}
          </p>
          <p className="text-2xl font-semibold text-slate-50">
            {hasReasonedEvidence ? formatScore(item.value) : "—"}
          </p>
          {!hasReasonedEvidence ? (
            <p className="text-[0.7rem] text-amber-200">Insufficient evidence</p>
          ) : null}
        </div>
        <div className="text-xs text-slate-400">
          <p className="uppercase tracking-wide text-slate-500">Reasons</p>
          {hasReasonedEvidence ? (
            <div className="mt-2 space-y-2">
              {item.reasons.map((reason) => (
                <div key={reason} className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-slate-700/70 bg-slate-900/50 px-2 py-0.5 text-[0.65rem] text-slate-300">
                      {reason}
                    </span>
                    <span className="text-[0.7rem] text-slate-500">
                      {formatReasonLabel(reason)}
                    </span>
                  </div>
                  <EvidenceRefs refs={item.evidenceRefs} />
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-[0.7rem] text-slate-500">
              No published evidence for this category.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default async function ModelDetailPage({
  params,
}: {
  params: { modelKey: string };
}) {
  const modelKey = decodeURIComponent(params.modelKey);
  const { detail, isNotListed, notListedEntry, index } = await loadV4ModelDetail(modelKey);

  if (!detail && isNotListed) {
    return (
      <div className="space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">AI Model Scoreboard · v4</p>
          <h1 className="text-3xl font-semibold text-slate-50">{modelKey}</h1>
        </header>
        <div className="space-y-3 rounded-2xl border border-slate-800 bg-surface/70 p-5 text-slate-200 shadow-lg">
          <p className="text-lg font-semibold text-slate-50">This model is currently not listed in the v4 scoreboard.</p>
          <p className="text-sm text-slate-400">
            The model is known to the AMS pipeline but is intentionally excluded from the published leaderboard snapshot.
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
        <p className="text-sm text-slate-400">We couldn&apos;t find this model in the published v4 data.</p>
        <div className="pt-2">
          <Link href="/v4" className="text-sm font-semibold text-accent underline">
            ← Back to leaderboard
          </Link>
        </div>
      </div>
    );
  }

  const updatedLabel = formatDate(detail.updatedAt ?? index.meta.updatedAt);
  const evidenceSummary = detail.evidenceSummary;
  const categoryItems: CategoryScore[] = [
    {
      label: "Performance",
      value: detail.scores.performance,
      reasons: evidenceSummary.reasonCodes,
      evidenceRefs: evidenceSummary.refs,
      hasEvidence: evidenceSummary.hasEvidence,
    },
    {
      label: "Safety",
      value: detail.scores.safety,
      reasons: evidenceSummary.reasonCodes,
      evidenceRefs: evidenceSummary.refs,
      hasEvidence: evidenceSummary.hasEvidence,
    },
    {
      label: "Adoption",
      value: detail.scores.adoption,
      reasons: evidenceSummary.reasonCodes,
      evidenceRefs: evidenceSummary.refs,
      hasEvidence: evidenceSummary.hasEvidence,
    },
    {
      label: "Openness",
      value: detail.scores.openness,
      reasons: evidenceSummary.reasonCodes,
      evidenceRefs: evidenceSummary.refs,
      hasEvidence: evidenceSummary.hasEvidence,
    },
    {
      label: "Cost",
      value: detail.scores.cost,
      reasons: evidenceSummary.reasonCodes,
      evidenceRefs: evidenceSummary.refs,
      hasEvidence: evidenceSummary.hasEvidence,
    },
  ];
  const hasMinimumEvidence = categoryItems.every(
    (item) => item.hasEvidence && item.reasons.length > 0
  );

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">AI Model Scoreboard · v4</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <StatusBadge status={detail.status} />
              <LayerBadge layer={detail.layer} />
              <span className="rounded-full border border-slate-800 px-3 py-1 font-semibold uppercase tracking-wide text-slate-300">
                {detail.vendor}
              </span>
            </div>
            <h1 className="text-3xl font-semibold leading-tight text-slate-50 sm:text-4xl">{detail.name}</h1>
            <p className="text-sm text-slate-400">Snapshot-driven detail sourced from the bundled v4 JSON files.</p>
          </div>
          <div className="self-start rounded-2xl border border-slate-800 bg-background/70 px-5 py-4 text-right text-sm text-slate-300 shadow-xl">
            <p className="text-[0.65rem] uppercase tracking-wide text-slate-500">Total score</p>
            <p className="text-4xl font-semibold text-slate-50">
              {hasMinimumEvidence ? formatScore(detail.score) : "—"}
            </p>
            {!hasMinimumEvidence ? (
              <p className="text-[0.7rem] text-amber-200">Insufficient evidence</p>
            ) : null}
            <p className="text-[0.7rem] text-slate-500">Updated {updatedLabel}</p>
          </div>
        </div>
      </header>

      <section className="space-y-3 rounded-2xl border border-slate-800 bg-surface/70 p-5 shadow-xl">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Identity</h2>
          <p className="text-xs text-slate-400">Canonical identifiers and adoption status.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 text-sm text-slate-300 sm:grid-cols-2">
          <div>
            <p className="text-[0.7rem] uppercase tracking-wide text-slate-500">Model key</p>
            <p className="font-semibold text-slate-50">{detail.id}</p>
          </div>
          <div>
            <p className="text-[0.7rem] uppercase tracking-wide text-slate-500">Provider</p>
            <p className="font-semibold text-slate-50">{detail.vendor}</p>
          </div>
          <div>
            <p className="text-[0.7rem] uppercase tracking-wide text-slate-500">Adoption status</p>
            <p className="font-semibold text-slate-50">{formatStatus(detail.status)}</p>
          </div>
          <div>
            <p className="text-[0.7rem] uppercase tracking-wide text-slate-500">Listing layer</p>
            <p className="font-semibold text-slate-50">{detail.layer}</p>
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-800 bg-surface/70 p-5 shadow-xl">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Status</h2>
          <p className="text-xs text-slate-400">Decision status and recorded reasons.</p>
        </div>
        <div className="space-y-3 text-sm text-slate-300">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={detail.status} />
            <LayerBadge layer={detail.layer} />
          </div>
          {detail.decisionReason ? (
            <div>
              <p className="text-[0.7rem] uppercase tracking-wide text-slate-500">Reasons</p>
              <p className="font-semibold text-slate-50">{detail.decisionReason}</p>
            </div>
          ) : (
            <p className="text-xs text-slate-500">No decision reasons were published for this model.</p>
          )}
          {detail.decisionSource ? (
            <div className="text-xs text-slate-500">Source: {detail.decisionSource}</div>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Score breakdown</h2>
          <p className="text-xs text-slate-400">Higher scores indicate stronger performance in that dimension.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {categoryItems.map((item) => (
            <ScoreBreakdownItem key={item.label} item={item} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Evidence</h2>
          <p className="text-xs text-slate-400">Reason codes and references used by the v4 evidence pipeline.</p>
        </div>
        {detail.evidenceError ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Evidence file missing or invalid: {detail.evidenceError}
          </div>
        ) : null}
        {detail.evidenceItems.length ? (
          <div className="space-y-3">
            {detail.evidenceItems.map((item, index) => (
              <EvidenceRow key={`${item.type}-${index}`} item={item} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-800 bg-surface/70 px-4 py-3 text-sm text-slate-400">
            No evidence items are available for this model in the current snapshot.
          </div>
        )}
      </section>

      <Link href="/v4" className="text-sm font-semibold text-accent underline">
        ← Back to leaderboard
      </Link>
    </div>
  );
}
