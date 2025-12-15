import Link from "next/link";

import { fetchSnapshotMeta } from "@/lib/v4/fetchSnapshotMeta";
import { loadV4Leaderboard, type V4LeaderboardRow } from "@/lib/v4-snapshot";

function formatScore(value: number): string {
  return value.toFixed(1);
}

function formatDate(value: string | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export default async function LeaderboardPage() {
  const [meta, { rankings }] = await Promise.all([fetchSnapshotMeta(), loadV4Leaderboard()]);
  const updatedLabel = formatDate(meta.updatedAt);

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">AI Model Scoreboard · v4</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h1 className="text-3xl font-semibold text-slate-50 sm:text-4xl">Leaderboard</h1>
        </div>
        <p className="max-w-3xl text-sm text-slate-400">
          Offline-scored leaderboard powered by the AMS v4 engine snapshot. Scores below are read directly from the
          published JSON snapshot bundled with this site.
        </p>
      </header>

      <section className="rounded-xl border border-slate-800 bg-surface/80 p-4 shadow-md">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-200">
              <span className="rounded-full border border-slate-800/70 bg-background/70 px-3 py-1 text-[0.75rem] font-semibold uppercase tracking-wide text-slate-100">
                Snapshot: v4
              </span>
              <span className="rounded-full border border-slate-800/70 bg-background/70 px-3 py-1 text-[0.75rem] font-semibold uppercase tracking-wide text-slate-100">
                Updated: {updatedLabel}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm text-slate-100 sm:grid-cols-4">
              <div className="rounded-lg border border-slate-800/60 bg-background/70 p-3">
                <dt className="text-[0.7rem] uppercase tracking-wide text-slate-500">Models</dt>
                <dd className="text-lg font-semibold text-slate-50">{meta.modelsCount}</dd>
              </div>
              <div className="rounded-lg border border-slate-800/60 bg-background/70 p-3">
                <dt className="text-[0.7rem] uppercase tracking-wide text-slate-500">Full</dt>
                <dd className="text-lg font-semibold text-emerald-200">{meta.fullCount}</dd>
              </div>
              <div className="rounded-lg border border-slate-800/60 bg-background/70 p-3">
                <dt className="text-[0.7rem] uppercase tracking-wide text-slate-500">Provisional</dt>
                <dd className="text-lg font-semibold text-amber-200">{meta.provisionalCount}</dd>
              </div>
              <div className="rounded-lg border border-slate-800/60 bg-background/70 p-3">
                <dt className="text-[0.7rem] uppercase tracking-wide text-slate-500">Not listed (tracked)</dt>
                <dd className="text-lg font-semibold text-slate-200">{meta.notListedCount}</dd>
              </div>
            </dl>
          </div>

          <Link
            href="/methodology"
            className="inline-flex items-center justify-center rounded-lg border border-slate-800 bg-background/80 px-4 py-2 text-sm font-semibold text-accent transition hover:-translate-y-px hover:border-accent hover:bg-surface/80"
          >
            Read the methodology
          </Link>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Model rankings</h2>
          <p className="text-xs text-slate-400">Sorted by total score (higher is better).</p>
        </div>

        <div className="space-y-3 sm:hidden">
          {rankings.map((entry) => (
            <LeaderboardCard key={entry.model} entry={entry} />
          ))}
        </div>

        <div className="hidden overflow-x-auto rounded-2xl border border-slate-800 bg-background/70 shadow-xl sm:block">
          <table className="min-w-[820px] w-full text-sm">
            <thead>
              <tr className="bg-surface text-[0.75rem] font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3 text-left">Rank</th>
                <th className="px-4 py-3 text-left">Model</th>
                <th className="px-4 py-3 text-left">Vendor</th>
                <th className="px-4 py-3 text-left">Layer</th>
                <th className="px-4 py-3 text-left">Total</th>
                <th className="px-4 py-3 text-left">Perf</th>
                <th className="px-4 py-3 text-left">Safe</th>
                <th className="px-4 py-3 text-left">Adopt</th>
                <th className="px-4 py-3 text-left">Open</th>
                <th className="px-4 py-3 text-left">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {rankings.map((entry) => (
                <LeaderboardRow key={entry.model} entry={entry} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function LayerBadge({ layer }: { layer: V4LeaderboardRow["layer"] }) {
  if (!layer) return null;
  if (layer === "full") {
    return (
      <span className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[0.7rem] font-medium text-emerald-200">
        Full
      </span>
    );
  }

  if (layer === "provisional") {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[0.7rem] font-medium text-amber-200">
        Provisional
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-[0.7rem] font-medium text-slate-200">
      Hidden
    </span>
  );
}

function LeaderboardRow({ entry }: { entry: V4LeaderboardRow }) {
  return (
    <tr className="hover:bg-surface">
      <td className="px-4 py-3 text-sm font-semibold text-slate-500">{entry.rank}</td>
      <td className="px-4 py-3 font-semibold text-slate-50">
        <Link
          href={`/models/${encodeURIComponent(entry.model)}`}
          className="text-slate-50 underline-offset-2 hover:text-accent hover:underline"
        >
          {entry.displayName}
        </Link>
      </td>
      <td className="px-4 py-3 text-slate-300">{entry.displayVendor}</td>
      <td className="px-4 py-3 text-slate-100">
        <LayerBadge layer={entry.layer} />
      </td>
      <td className="px-4 py-3 font-semibold text-slate-50">{formatScore(entry.score)}</td>
      <td className="px-4 py-3 text-slate-100">{formatScore(entry.scores.performance)}</td>
      <td className="px-4 py-3 text-slate-100">{formatScore(entry.scores.safety)}</td>
      <td className="px-4 py-3 text-slate-100">{formatScore(entry.scores.adoption)}</td>
      <td className="px-4 py-3 text-slate-100">{formatScore(entry.scores.openness)}</td>
      <td className="px-4 py-3 text-slate-100">{formatScore(entry.scores.cost)}</td>
    </tr>
  );
}

function LeaderboardCard({ entry }: { entry: V4LeaderboardRow }) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-background/60 p-4 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <span className="rounded-md border border-slate-800 px-2 py-1 font-semibold text-slate-200">#{entry.rank}</span>
            <LayerBadge layer={entry.layer} />
          </div>
          <div className="text-lg font-semibold text-slate-50">
            <Link
              href={`/models/${encodeURIComponent(entry.model)}`}
              className="hover:text-accent"
            >
              {entry.displayName}
            </Link>
          </div>
          <div className="text-sm text-slate-400">{entry.displayVendor}</div>
        </div>
        <div className="text-right">
          <p className="text-[0.65rem] uppercase tracking-wide text-slate-500">Total</p>
          <p className="text-3xl font-semibold text-slate-50">{formatScore(entry.score)}</p>
          <p className="text-[0.7rem] text-slate-500">Updated {formatDate(entry.updatedAt)}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[0.8rem] text-slate-200 sm:grid-cols-3">
        <StatPill label="Performance" value={formatScore(entry.scores.performance)} />
        <StatPill label="Safety" value={formatScore(entry.scores.safety)} />
        <StatPill label="Adoption" value={formatScore(entry.scores.adoption)} />
        <StatPill label="Openness" value={formatScore(entry.scores.openness)} />
        <StatPill label="Cost" value={formatScore(entry.scores.cost)} />
      </div>
    </article>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800/80 bg-surface/80 px-3 py-2">
      <p className="text-[0.65rem] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="font-semibold text-slate-100">{value}</p>
    </div>
  );
}
