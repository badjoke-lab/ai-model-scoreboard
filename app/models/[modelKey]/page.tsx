import Link from "next/link";

import {
  loadV4ModelDetail,
  type V4EvidenceItem,
  type V4EvidenceReference,
  V4_REQUIRED_EVIDENCE_TYPES,
} from "@/lib/v4-snapshot";

function formatScore(value: number): string {
  return Number.isFinite(value) ? value.toFixed(1) : "—";
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

function EvidenceRow({ item }: { item: V4EvidenceItem }) {
  return (
    <tr className="border-b border-slate-800/70 last:border-b-0">
      <td className="px-3 py-3 text-sm font-semibold text-slate-200">
        {item.type.replace("_", " ")}
      </td>
      <td className="px-3 py-3 text-sm text-slate-200">{item.status}</td>
      <td className="px-3 py-3 text-sm text-slate-200">
        {item.score !== null && item.score !== undefined ? formatScore(item.score) : "—"}
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap gap-2 text-[0.7rem] text-slate-300">
          {item.reasons.map((reason) => (
            <span
              key={reason}
              className="rounded-full border border-slate-700/70 bg-slate-900/50 px-2 py-0.5"
            >
              {reason}
            </span>
          ))}
        </div>
      </td>
      <td className="px-3 py-3">
        <EvidenceRefs refs={item.refs} />
      </td>
    </tr>
  );
}

function AlertBox({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100 shadow-sm">
      <p className="font-semibold">Snapshot load error</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-[0.85rem]">
        {items.slice(0, 10).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {items.length > 10 ? (
        <p className="mt-2 text-xs opacity-80">…and {items.length - 10} more</p>
      ) : null}
    </div>
  );
}

export default async function ModelDetailPage({
  params,
}: {
  params: { modelKey: string };
}) {
  const modelKey = decodeURIComponent(params.modelKey);
  const { detail, isNotListed, notListedEntry, index, diagnostics } =
    await loadV4ModelDetail(modelKey);

  if (diagnostics.errors.length) {
    return (
      <div className="space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
            AI Model Scoreboard · v4
          </p>
          <h1 className="text-2xl font-semibold text-slate-50">Snapshot load error</h1>
          <p className="text-sm text-slate-400">
            The snapshot data for this model violates the v4 contract.
          </p>
        </header>
        <AlertBox items={diagnostics.errors} />
        <Link href="/v4" className="text-sm font-semibold text-accent underline">
          ← Back to leaderboard
        </Link>
      </div>
    );
  }

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

  const updatedLabel = formatDate(detail.updatedAt ?? index?.updatedAt);
  const pricing = detail.modelMetadata.pricing ?? {};

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
          AI Model Scoreboard · v4
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <StatusBadge status={detail.status} />
              <LayerBadge layer={detail.layer} />
              <span className="rounded-full border border-slate-800 px-3 py-1 font-semibold uppercase tracking-wide text-slate-300">
                {detail.vendor}
              </span>
            </div>
            <h1 className="text-3xl font-semibold leading-tight text-slate-50 sm:text-4xl">
              {detail.name}
            </h1>
            <p className="text-sm text-slate-400">
              Snapshot-driven detail sourced from the bundled v4 JSON files.
            </p>
          </div>
          <div className="self-start rounded-2xl border border-slate-800 bg-background/70 px-5 py-4 text-right text-sm text-slate-300 shadow-xl">
            <p className="text-[0.65rem] uppercase tracking-wide text-slate-500">Overall</p>
            <p className="text-4xl font-semibold text-slate-50">
              {formatScore(detail.score)}
            </p>
            <p className="text-[0.7rem] text-slate-500">Updated {updatedLabel}</p>
          </div>
        </div>
      </header>

      <section className="space-y-3 rounded-2xl border border-slate-800 bg-surface/70 p-5 shadow-xl">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Model Summary</h2>
          <p className="text-xs text-slate-400">Core identifiers and decision reasons.</p>
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
        <div>
          <p className="text-[0.7rem] uppercase tracking-wide text-slate-500">Decision reasons</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-300">
            {detail.decision.reasons.map((reason) => (
              <span
                key={reason}
                className="rounded-full border border-slate-700/70 bg-slate-900/50 px-2 py-0.5"
              >
                {reason}
              </span>
            ))}
          </div>
          {detail.decision.source ? (
            <p className="mt-2 text-xs text-slate-500">Source: {detail.decision.source}</p>
          ) : null}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-800 bg-surface/70 p-5 shadow-xl">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Spec Table</h2>
          <p className="text-xs text-slate-400">Absolute metrics used by the spec rules.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 text-sm text-slate-300 sm:grid-cols-2">
          <div>
            <p className="text-[0.7rem] uppercase tracking-wide text-slate-500">Release date</p>
            <p className="font-semibold text-slate-50">
              {detail.modelMetadata.released ? formatDate(detail.modelMetadata.released) : "—"}
            </p>
          </div>
          <div>
            <p className="text-[0.7rem] uppercase tracking-wide text-slate-500">Context length</p>
            <p className="font-semibold text-slate-50">
              {detail.modelMetadata.context ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-[0.7rem] uppercase tracking-wide text-slate-500">Model type</p>
            <p className="font-semibold text-slate-50">{detail.modelMetadata.type ?? "—"}</p>
          </div>
          <div>
            <p className="text-[0.7rem] uppercase tracking-wide text-slate-500">Pricing</p>
            <p className="font-semibold text-slate-50">
              {pricing.input !== undefined || pricing.output !== undefined
                ? `${pricing.input ?? "—"} / ${pricing.output ?? "—"} ${
                    pricing.currency ?? ""
                  }`
                : "—"}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Evidence Table</h2>
          <p className="text-xs text-slate-400">
            Evidence status and reasons by required type.
          </p>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-surface/70 shadow">
          <table className="w-full text-left text-xs text-slate-400">
            <thead className="bg-slate-900/80 text-[0.7rem] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Score</th>
                <th className="px-3 py-3">Reasons</th>
                <th className="px-3 py-3">References</th>
              </tr>
            </thead>
            <tbody>
              {V4_REQUIRED_EVIDENCE_TYPES.map((type) => {
                const item = detail.evidenceItems.find((entry) => entry.type === type);
                if (!item) return null;
                return <EvidenceRow key={type} item={item} />;
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Score Breakdown</h2>
          <p className="text-xs text-slate-400">
            Overall = 0.45 × Spec + 0.35 × Evidence + 0.20 × Ops (no UI-side
            recalculation).
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-800/80 bg-surface/80 px-4 py-3">
            <p className="text-[0.7rem] uppercase tracking-wide text-slate-500">Spec</p>
            <p className="text-lg font-semibold text-slate-50">
              {formatScore(detail.scores.spec)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800/80 bg-surface/80 px-4 py-3">
            <p className="text-[0.7rem] uppercase tracking-wide text-slate-500">Evidence</p>
            <p className="text-lg font-semibold text-slate-50">
              {formatScore(detail.scores.evidence)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800/80 bg-surface/80 px-4 py-3">
            <p className="text-[0.7rem] uppercase tracking-wide text-slate-500">Ops</p>
            <p className="text-lg font-semibold text-slate-50">
              {formatScore(detail.scores.ops)}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-800 bg-surface/80 p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-100">Raw Inputs</h2>
        <details className="rounded-xl border border-slate-800/80 bg-background/60 p-4 text-sm text-slate-300">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-400">
            View JSON payloads
          </summary>
          <pre className="mt-3 whitespace-pre-wrap text-xs text-slate-400">
            {JSON.stringify(detail.rawInputs, null, 2)}
          </pre>
        </details>
      </section>

      <Link href="/v4" className="text-sm font-semibold text-accent underline">
        ← Back to leaderboard
      </Link>
    </div>
  );
}
