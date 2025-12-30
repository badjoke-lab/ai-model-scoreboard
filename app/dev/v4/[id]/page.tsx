import Link from "next/link";

import {
  loadV4DevSnapshot,
  V4_SCORE_ITEMS,
  type V4ScoreBreakdown,
} from "@/lib/v4-dev-snapshot";

export const dynamic = "force-dynamic";

function formatDate(value: string | null | undefined) {
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
        timeZoneName: "short",
      });
}

function formatScore(value: number | null) {
  if (value === null) return "N/A (Pending data)";
  return value.toFixed(1);
}

function ScorePill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800/80 bg-surface/80 px-4 py-3">
      <p className="text-[0.7rem] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-50">{value}</p>
    </div>
  );
}

function getScoreValue(scores: V4ScoreBreakdown, key: keyof V4ScoreBreakdown) {
  return formatScore(scores[key]);
}

export default async function DevV4ModelDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const modelId = decodeURIComponent(params.id);
  const { index, rankings, models, notListed } = await loadV4DevSnapshot();

  const ranking = rankings.find((entry) => entry.model === modelId);
  const meta = models[modelId];
  const notListedEntry = notListed.find((entry) => entry.id === modelId);

  if (!ranking && notListedEntry) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
            AIMS · v4 · Dev Preview
          </p>
          <h1 className="text-3xl font-semibold text-slate-50">
            {meta?.name ?? modelId}
          </h1>
        </header>
        <div className="mt-6 space-y-3 rounded-2xl border border-slate-800 bg-surface/70 p-5 text-slate-200 shadow-lg">
          <p className="text-lg font-semibold text-slate-50">
            This model is currently not listed in the v4 leaderboard.
          </p>
          <p className="text-sm text-slate-400">
            Reason: {notListedEntry.reason ?? "No reason provided"}
          </p>
        </div>
        <Link href="/dev/v4" className="mt-6 inline-block text-sm font-semibold text-accent underline">
          ← Back to dev leaderboard
        </Link>
      </main>
    );
  }

  if (!ranking) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10 text-center">
        <h1 className="text-2xl font-semibold text-slate-50">Model not found in v4 snapshot</h1>
        <p className="mt-2 text-sm text-slate-400">
          We couldn&apos;t find this model in the published v4 data.
        </p>
        <Link href="/dev/v4" className="mt-6 inline-block text-sm font-semibold text-accent underline">
          ← Back to dev leaderboard
        </Link>
      </main>
    );
  }

  const updatedLabel = formatDate(ranking.updatedAt ?? index.meta.updatedAt);
  const displayName = meta?.name ?? ranking.model;
  const displayVendor = meta?.vendor ?? ranking.vendor;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="space-y-8">
        <header className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
            AIMS · v4 · Dev Preview
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="rounded-full border border-slate-800 px-3 py-1 font-semibold uppercase tracking-wide text-slate-300">
                  {displayVendor || "Unknown"}
                </span>
                <span className="rounded-full border border-slate-700 px-3 py-1 text-[0.65rem] uppercase tracking-wide text-slate-400">
                  {ranking.layer}
                </span>
              </div>
              <h1 className="text-3xl font-semibold leading-tight text-slate-50 sm:text-4xl">
                {displayName}
              </h1>
              <p className="text-sm text-slate-400">
                Snapshot-driven detail sourced from /public/data/v4.
              </p>
            </div>
            <div className="self-start rounded-2xl border border-slate-800 bg-background/70 px-5 py-4 text-right text-sm text-slate-300 shadow-xl">
              <p className="text-[0.65rem] uppercase tracking-wide text-slate-500">Total score</p>
              <p className="text-4xl font-semibold text-slate-50">
                {ranking.score === null ? "N/A" : ranking.score.toFixed(1)}
              </p>
              <p className="text-[0.7rem] text-slate-500">Updated {updatedLabel}</p>
            </div>
          </div>
        </header>

        <section className="space-y-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-slate-100">Score breakdown</h2>
            <p className="text-xs text-slate-400">
              All scoring categories are shown, missing values appear as N/A.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {V4_SCORE_ITEMS.map((item) => (
              <ScorePill
                key={item.key}
                label={item.label}
                value={getScoreValue(ranking.scores, item.key)}
              />
            ))}
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-slate-800 bg-surface/80 p-5 shadow-xl">
          <h2 className="text-lg font-semibold text-slate-100">How to read these scores</h2>
          <div className="space-y-2 text-sm leading-relaxed text-slate-300">
            <p>
              The Total score is a composite that balances capability, safety posture, market traction, openness,
              and estimated cost efficiency. Higher totals suggest well-rounded models that perform strongly across
              categories.
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

        <Link href="/dev/v4" className="text-sm font-semibold text-accent underline">
          ← Back to dev leaderboard
        </Link>
      </div>
    </main>
  );
}
