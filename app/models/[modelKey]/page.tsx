import Link from "next/link";

import { getCategoryLabel, getCategoryScore } from "@/lib/v4/categories";
import {
  loadV4ModelDetail,
  type V4EvidenceItem,
  type V4EvidenceReference,
  type V4ScoreItem,
} from "@/lib/v4-snapshot";

function formatScore(value?: number | null): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(1) : "—";
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
  const typeLabel =
    item.type.toLowerCase() === "audit" || item.type.toLowerCase() === "security"
      ? "audit/security"
      : item.type;
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-background/60 p-4 shadow">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[0.65rem] uppercase tracking-wide text-slate-300">
          {typeLabel}
        </span>
        {item.status ? (
          <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[0.65rem] uppercase tracking-wide text-slate-400">
            {item.status}
          </span>
        ) : null}
      </div>
      {item.summary ? <p className="mt-2 text-sm text-slate-200">{item.summary}</p> : null}
      {item.reasons?.length ? (
        <div className="mt-3">
          <p className="text-[0.65rem] uppercase tracking-wide text-slate-500">Reasons</p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-300">
            {item.reasons.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {item.refs?.length ? (
        <div className="mt-3">
          <p className="text-[0.65rem] uppercase tracking-wide text-slate-500">Refs</p>
          <EvidenceRefs refs={item.refs} />
        </div>
      ) : null}
      {item.extracted ? (
        <div className="mt-3 text-xs text-slate-400">
          <p className="text-[0.65rem] uppercase tracking-wide text-slate-500">Extracted</p>
          <dl className="mt-2 grid gap-1">
            {Object.entries(item.extracted).map(([key, value]) => (
              <div key={key} className="flex flex-wrap gap-2">
                <dt className="font-semibold text-slate-300">{key}</dt>
                <dd className="text-slate-400">
                  {typeof value === "string" || typeof value === "number"
                    ? String(value)
                    : JSON.stringify(value)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
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

function EvidenceLinks({
  refs,
}: {
  refs: { label: string; url?: string }[];
}) {
  if (!refs.length) return <span className="text-slate-500">—</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {refs.map((ref) =>
        ref.url ? (
          <Link
            key={ref.label}
            href={ref.url}
            className="font-semibold text-accent hover:text-accent/80"
            target="_blank"
            rel="noreferrer"
          >
            {ref.label} →
          </Link>
        ) : (
          <span key={ref.label} className="text-slate-400">
            {ref.label}
          </span>
        )
      )}
    </div>
  );
}

function ScoreBreakdownItem({ label, item }: { label: string; item: V4ScoreItem }) {
  const weight = typeof item.weight === "number" ? item.weight : 1;
  const subtotal = typeof item.weight === "number" ? item.score * item.weight : null;
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-surface/80 p-4 shadow">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[0.65rem] uppercase tracking-wide text-slate-500">{label}</p>
          <p className="text-2xl font-semibold text-slate-50">
            {formatScore(item.score)}
          </p>
        </div>
        <div className="text-xs text-slate-400">
          <p className="uppercase tracking-wide text-slate-500">Reasons</p>
          {item.penaltyReasons?.length ? (
            <ul className="mt-1 list-disc space-y-1 pl-4 text-[0.7rem] text-slate-300">
              {item.penaltyReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[0.7rem] text-slate-500">No reasons provided.</p>
          )}
        </div>
      </div>
      <div className="mt-3 text-xs text-slate-400">
        <p className="uppercase tracking-wide text-slate-500">Weight & subtotal</p>
        <div className="mt-1 flex flex-wrap gap-4 text-[0.7rem] text-slate-300">
          <span>Weight: {formatScore(weight)}</span>
          <span>Subtotal: {subtotal === null ? "—" : formatScore(subtotal)}</span>
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
  const { detail, isNotListed, notListedEntry, meta } = await loadV4ModelDetail(modelKey);

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

  const updatedLabel = formatDate(detail.updatedAt ?? meta.updatedAt);
  const evidenceCountLabel = detail.evidenceCount.toString();
  const rankLabel = detail.rank ? `#${detail.rank}` : "—";

  const evidenceRefsByType = detail.evidenceItems.reduce<Record<string, V4EvidenceReference[]>>(
    (acc, item) => {
      if (item.refs?.length) {
        acc[item.type] = item.refs;
      }
      return acc;
    },
    {}
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
              {detail.vendor ? (
                <span className="rounded-full border border-slate-800 px-3 py-1 font-semibold uppercase tracking-wide text-slate-300">
                  {detail.vendor}
                </span>
              ) : null}
              <span className="rounded-full border border-slate-800 px-3 py-1 font-semibold uppercase tracking-wide text-slate-300">
                Rank {rankLabel}
              </span>
            </div>
            <h1 className="text-3xl font-semibold leading-tight text-slate-50 sm:text-4xl">{detail.name}</h1>
            <p className="text-sm text-slate-400">
              Updated {updatedLabel} · Evidence items {evidenceCountLabel}
            </p>
          </div>
          <div className="self-start rounded-2xl border border-slate-800 bg-background/70 px-5 py-4 text-right text-sm text-slate-300 shadow-xl">
            <p className="text-[0.65rem] uppercase tracking-wide text-slate-500">Overall score</p>
            <p className="text-4xl font-semibold text-slate-50">{formatScore(detail.score)}</p>
            <p className="text-[0.7rem] text-slate-500">Rank {rankLabel}</p>
          </div>
        </div>
      </header>

      <section className="space-y-3 rounded-2xl border border-slate-800 bg-surface/70 p-5 shadow-xl">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Summary</h2>
          <p className="text-xs text-slate-400">Key identifiers, status, and overall score.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 text-sm text-slate-300 sm:grid-cols-2">
          <div>
            <p className="text-[0.7rem] uppercase tracking-wide text-slate-500">Model key</p>
            <p className="font-semibold text-slate-50">{detail.id}</p>
          </div>
          <div>
            <p className="text-[0.7rem] uppercase tracking-wide text-slate-500">Provider</p>
            <p className="font-semibold text-slate-50">{detail.vendor || "—"}</p>
          </div>
          <div>
            <p className="text-[0.7rem] uppercase tracking-wide text-slate-500">Status</p>
            <p className="font-semibold text-slate-50">{formatStatus(detail.status)}</p>
          </div>
          <div>
            <p className="text-[0.7rem] uppercase tracking-wide text-slate-500">Listing layer</p>
            <p className="font-semibold text-slate-50">{detail.layer}</p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Category breakdown (C1–C5)</h2>
          <p className="text-xs text-slate-400">Summary scores for the five public categories.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {(["C1", "C2", "C3", "C4", "C5"] as const).map((key) => (
            <div key={key} className="rounded-xl border border-slate-800/80 bg-surface/80 px-4 py-3">
              <p className="text-[0.7rem] uppercase tracking-wide text-slate-500">
                {key} · {getCategoryLabel(key)}
              </p>
              <p className="text-lg font-semibold text-slate-50">
                {formatScore(getCategoryScore(detail.categories, key))}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Scoring breakdown (Spec/Evidence/Ops)</h2>
          <p className="text-xs text-slate-400">
            Category totals use equal-weight item averages. Overall uses weighted sum.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-surface/70 p-4 text-xs text-slate-300">
          <div className="font-semibold text-slate-200">Overall formula</div>
          <div className="mt-2 flex flex-wrap gap-3">
            {detail.overallFormula.categoryTotals.map((category) => (
              <span key={category.key}>
                {category.weight} × {category.key}({category.total ?? "—"})
              </span>
            ))}
          </div>
          <div className="mt-2 text-sm text-slate-200">
            Overall = {detail.overallFormula.weightedTotal ?? "—"}
          </div>
        </div>
        {detail.scoreGroups.map((group) => (
          <div key={group.key} className="space-y-3 rounded-2xl border border-slate-800 bg-surface/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-100">{group.label}</p>
                <p className="text-xs text-slate-400">
                  Total = mean(items) · Weight {group.weight}
                </p>
              </div>
              <div className="text-right text-sm text-slate-200">
                Total {group.total ?? "—"}
              </div>
            </div>
            {group.items.length ? (
              <div className="overflow-hidden rounded-xl border border-slate-800">
                <div className="grid grid-cols-6 bg-surface px-3 py-2 text-[0.65rem] uppercase tracking-wide text-slate-500">
                  <span className="col-span-1">Item</span>
                  <span className="col-span-1 text-right">Score</span>
                  <span className="col-span-1 text-right">Weight</span>
                  <span className="col-span-1 text-right">Subtotal</span>
                  <span className="col-span-2">Evidence links</span>
                </div>
                <div className="divide-y divide-slate-800/80 text-xs text-slate-300">
                  {group.items.map(({ key, item }) => {
                    const weight = typeof item.weight === "number" ? item.weight : 1;
                    const subtotal =
                      typeof item.weight === "number" ? item.score * item.weight : null;
                    const evidenceLinks = (item.usedEvidence ?? []).flatMap((ref) => {
                      const refs = evidenceRefsByType[ref.type ?? ""] ?? [];
                      return refs.map((evidenceRef, index) => ({
                        label: evidenceRef.label ?? `${ref.type ?? "evidence"}-${index + 1}`,
                        url: evidenceRef.url,
                      }));
                    });

                    return (
                      <div key={key} className="grid grid-cols-6 px-3 py-2">
                        <span className="col-span-1 font-semibold text-slate-200">{key}</span>
                        <span className="col-span-1 text-right">{formatScore(item.score)}</span>
                        <span className="col-span-1 text-right">{formatScore(weight)}</span>
                        <span className="col-span-1 text-right">
                          {subtotal === null ? "—" : formatScore(subtotal)}
                        </span>
                        <div className="col-span-2">
                          <EvidenceLinks refs={evidenceLinks} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500">No items recorded for this category.</div>
            )}
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Evidence</h2>
          <p className="text-xs text-slate-400">Evidence signals captured for this model.</p>
        </div>
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

      <section className="space-y-3 rounded-2xl border border-slate-800 bg-surface/80 p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-100">Raw</h2>
        <details className="rounded-xl border border-slate-800/80 bg-background/60 p-4 text-xs text-slate-300">
          <summary className="cursor-pointer text-sm font-semibold text-slate-200">
            View raw snapshot JSON
          </summary>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words">
            {JSON.stringify(detail.raw, null, 2)}
          </pre>
        </details>
      </section>

      <Link href="/v4" className="text-sm font-semibold text-accent underline">
        ← Back to leaderboard
      </Link>
    </div>
  );
}
