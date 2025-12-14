import Link from "next/link";

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
  const { index, rankings } = await loadV4Leaderboard();
  const updatedLabel = formatDate(index.updatedAt);

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">AI Model Scoreboard · v4</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h1 className="text-3xl font-semibold text-slate-50 sm:text-4xl">Leaderboard</h1>
          <div className="flex flex-wrap gap-2 text-xs text-slate-400">
            <span className="rounded-full border border-slate-800/70 bg-background/70 px-3 py-1 font-semibold uppercase tracking-wide text-slate-200">
              Snapshot updated: {updatedLabel}
            </span>
            <span className="rounded-full border border-slate-800/70 bg-background/70 px-3 py-1 font-semibold uppercase tracking-wide text-slate-200">
              Models listed: {index.modelsCount}
            </span>
          </div>
        </div>
        <p className="max-w-3xl text-sm text-slate-400">
          Offline-scored leaderboard powered by the AMS v4 engine snapshot. Scores below are read directly from the
          published JSON snapshot bundled with this site.
        </p>
      </header>

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
          <table className="min-w-[720px] w-full text-sm">
            <thead>
              <tr className="bg-surface text-[0.75rem] font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3 text-left">Rank</th>
                <th className="px-4 py-3 text-left">Model</th>
                <th className="px-4 py-3 text-left">Vendor</th>
                <th className="px-4 py-3 text-left">Total</th>
                <th className="px-4 py-3 text-left">Performance</th>
                <th className="px-4 py-3 text-left">Safety</th>
                <th className="px-4 py-3 text-left">Adoption</th>
                <th className="px-4 py-3 text-left">Openness</th>
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
  const label = layer.replace("-", " ");
  return (
    <span className="rounded-full border border-slate-800 bg-slate-900 px-2 py-1 text-[0.65rem] uppercase tracking-wide text-slate-300">
      {label}
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
