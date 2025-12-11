"use client";

import { useEffect, useMemo, useState } from "react";

type IndexData = {
  version: string;
  updatedAt: string;
  modelsCount: number;
  fullCount: number;
  provisionalCount: number;
  notListedCount: number;
};

type RankingEntry = {
  model: string;
  vendor: string;
  layer: string;
  score: number;
};

export default function V4PreviewPage() {
  const [indexData, setIndexData] = useState<IndexData | null>(null);
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const [indexRes, rankingsRes] = await Promise.all([
          fetch("/data/v4/index.json"),
          fetch("/data/v4/rankings.json"),
        ]);

        if (!indexRes.ok || !rankingsRes.ok) {
          throw new Error("Unable to load snapshot files");
        }

        const [indexJson, rankingsJson] = await Promise.all([
          indexRes.json(),
          rankingsRes.json(),
        ]);

        if (!isMounted) return;

        setIndexData(indexJson);
        setRankings(rankingsJson);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        if (!isMounted) return;
        setLoading(false);
      }
    };

    void loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const updatedLabel = useMemo(() => {
    if (!indexData?.updatedAt) return "—";
    return new Date(indexData.updatedAt).toLocaleString();
  }, [indexData?.updatedAt]);

  const sortedRankings = useMemo(
    () => [...rankings].sort((a, b) => b.score - a.score),
    [rankings],
  );

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
          AMS · v4 Preview
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h1 className="text-3xl font-semibold text-slate-50 sm:text-4xl">
            Offline snapshot
          </h1>
          <p className="text-xs text-slate-500">Snapshot updated: {updatedLabel}</p>
        </div>
        <p className="max-w-3xl text-sm text-slate-400">
          Quick client-side preview of the latest AMS v4 snapshot copied into
          <code className="mx-1 rounded bg-slate-900/50 px-1.5 py-0.5 text-[0.75rem] text-slate-200">
            /public/data/v4
          </code>
          . This view is for debugging only and does not affect the live v3 experience.
        </p>
      </header>

      {loading && !error ? (
        <div className="rounded-xl border border-slate-800 bg-surface p-4 text-sm text-slate-300">
          Loading snapshot…
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-800/60 bg-rose-950/50 p-4 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {!loading && !error && indexData ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-100">Snapshot metadata</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <MetadataCard label="Version" value={indexData.version} />
            <MetadataCard label="Updated" value={updatedLabel} />
            <MetadataCard label="Models" value={indexData.modelsCount} />
            <MetadataCard label="Full" value={indexData.fullCount} />
            <MetadataCard label="Provisional" value={indexData.provisionalCount} />
            <MetadataCard label="Not listed" value={indexData.notListedCount} />
          </div>
        </section>
      ) : null}

      {!loading && !error ? (
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
                    <td className="px-4 py-3 text-sm font-semibold text-slate-500">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-50">{entry.model}</td>
                    <td className="px-4 py-3 text-slate-300">{entry.vendor}</td>
                    <td className="px-4 py-3 text-slate-300 capitalize">{entry.layer}</td>
                    <td className="px-4 py-3 font-semibold text-slate-50">
                      {entry.score.toFixed(1)}
                    </td>
                  </tr>
                ))}

                {!sortedRankings.length ? (
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

function MetadataCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-surface p-4 text-sm text-slate-200">
      <p className="text-[0.75rem] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-50">{value}</p>
    </div>
  );
}
