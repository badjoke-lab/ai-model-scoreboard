"use client";

import { useV4Snapshot } from "@/lib/useV4Snapshot";

export default function ScoresPage() {
  const { updatedLabel, sortedRankings, loading, error } = useV4Snapshot();

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">AMS · v4</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold text-slate-50 sm:text-4xl">Scores</h1>
            <span className="inline-flex items-center rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wide text-slate-200">
              AMS v4 – offline snapshot
            </span>
          </div>
          <p className="text-xs text-slate-500">Snapshot updated: {updatedLabel}</p>
        </div>
        <p className="max-w-3xl text-sm text-slate-400">
          Powered by AMS v4 (offline snapshot from
          <code className="mx-1 rounded bg-slate-900/50 px-1.5 py-0.5 text-[0.75rem] text-slate-200">/public/data/v4</code>).
          This page always reflects the current snapshot—no v3 data or live scoring is used.
        </p>
      </header>

      {loading && !error ? (
        <div className="rounded-xl border border-slate-800 bg-surface p-4 text-sm text-slate-300">Loading snapshot…</div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-800/60 bg-rose-950/50 p-4 text-sm text-rose-200">{error}</div>
      ) : null}

      {!error ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-100">Rankings</h2>
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-background/70 shadow-xl">
            <table className="min-w-[520px] w-full text-sm">
              <thead>
                <tr className="bg-surface text-[0.75rem] font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">Model</th>
                  <th className="px-4 py-3 text-left">Vendor</th>
                  <th className="px-4 py-3 text-left">Layer</th>
                  <th className="px-4 py-3 text-left">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {sortedRankings.map((entry, index) => (
                  <tr key={`${entry.vendor}-${entry.model}`} className="hover:bg-surface">
                    <td className="px-4 py-3 text-sm font-semibold text-slate-500">{index + 1}</td>
                    <td className="px-4 py-3 font-semibold text-slate-50">{entry.model}</td>
                    <td className="px-4 py-3 text-slate-300">{entry.vendor}</td>
                    <td className="px-4 py-3 text-slate-300 capitalize">{entry.layer}</td>
                    <td className="px-4 py-3 font-semibold text-slate-50">{entry.score.toFixed(1)}</td>
                  </tr>
                ))}

                {!loading && !sortedRankings.length ? (
                  <tr>
                    <td className="px-4 py-3 text-sm text-slate-400" colSpan={5}>
                      No rankings found in the snapshot.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <div className="text-xs text-slate-500">
        Files read from <code className="font-mono text-slate-300">/public/data/v4/index.json</code> and
        <code className="mx-1 font-mono text-slate-300">/public/data/v4/rankings.json</code> on the client.
      </div>
    </div>
  );
}
