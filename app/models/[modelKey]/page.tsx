import Link from "next/link";

import {
  loadV4ModelDetail,
  type V4EnrichmentSignal,
  type V4EvidenceItem,
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

function ScorePill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800/80 bg-surface/80 px-4 py-3">
      <p className="text-[0.7rem] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-50">{value}</p>
    </div>
  );
}

function EnrichmentRow({
  label,
  signal,
}: {
  label: string;
  signal: V4EnrichmentSignal | null | undefined;
}) {
  const status = signal?.status ?? "Unavailable";
  const statusCode = signal?.status_code ?? "missing";

  return (
    <div className="rounded-xl border border-slate-800/80 bg-surface/80 px-4 py-3">
      <p className="text-[0.7rem] uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-200">
        <span className="font-semibold">{status}</span>
        <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[0.7rem] text-slate-400">
          {statusCode}
        </span>
      </div>
    </div>
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
              {ref.url ? (
                <Link
                  href={ref.url}
                  className="text-xs font-semibold text-accent hover:text-accent/80"
                  target="_blank"
                  rel="noreferrer"
                >
                  View source →
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
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
            <p className="text-4xl font-semibold text-slate-50">{formatScore(detail.score)}</p>
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

      <section className="space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Score breakdown</h2>
          <p className="text-xs text-slate-400">Higher scores indicate stronger performance in that dimension.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ScorePill label="Performance" value={formatScore(detail.scores.performance)} />
          <ScorePill label="Safety" value={formatScore(detail.scores.safety)} />
          <ScorePill label="Adoption" value={formatScore(detail.scores.adoption)} />
          <ScorePill label="Openness" value={formatScore(detail.scores.openness)} />
          <ScorePill label="Cost" value={formatScore(detail.scores.cost)} />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Enrichment signals</h2>
          <p className="text-xs text-slate-400">Signals derived from the latest enrichment pipeline.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <EnrichmentRow label="Developer activity" signal={detail.enrichment?.github} />
          <EnrichmentRow label="Audit evidence" signal={detail.enrichment?.audit} />
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

      <section className="space-y-3 rounded-2xl border border-slate-800 bg-surface/80 p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-100">How to read these scores</h2>
        <div className="space-y-2 text-sm leading-relaxed text-slate-300">
          <p>
            The Total score is a composite that balances capability, safety posture, market traction, openness, and estimated cost
            efficiency. Higher totals suggest well-rounded models that perform strongly across categories.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-slate-400">
            <li>Performance captures general task quality across benchmarks.</li>
            <li>Safety reflects alignment and guardrail effectiveness.</li>
            <li>Adoption tracks ecosystem traction and integrator interest.</li>
            <li>Openness highlights licensing transparency and release practices.</li>
            <li>Cost estimates relative runtime affordability (higher is better).</li>
          </ul>
        </div>
      </section>

      <Link href="/v4" className="text-sm font-semibold text-accent underline">
        ← Back to leaderboard
      </Link>
    </div>
  );
}
