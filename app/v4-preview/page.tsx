"use client";

import { useEffect, useMemo, useState } from "react";

import { shellClass } from "@/lib/layout";

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

type SnapshotState =
  | { status: "idle" | "loading"; index: null; rankings: RankingEntry[]; error: null }
  | { status: "error"; index: null; rankings: RankingEntry[]; error: string }
  | { status: "ready"; index: IndexData; rankings: RankingEntry[]; error: null };

export default function V4PreviewPage() {
  const [state, setState] = useState<SnapshotState>({
    status: "loading",
    index: null,
    rankings: [],
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    const loadSnapshot = async () => {
      setState({ status: "loading", index: null, rankings: [], error: null });

      try {
        const [indexRes, rankingsRes] = await Promise.all([
          fetch("/data/v4/index.json", { cache: "no-store" }),
          fetch("/data/v4/rankings.json", { cache: "no-store" }),
        ]);

        if (!indexRes.ok || !rankingsRes.ok) {
          throw new Error("Failed to load snapshot files");
        }

        const [indexJson, rankingsJson] = await Promise.all([
          indexRes.json(),
          rankingsRes.json(),
        ]);

        if (!isMounted) return;

        setState({
          status: "ready",
          index: indexJson as IndexData,
          rankings: rankingsJson as RankingEntry[],
          error: null,
        });
      } catch (err) {
        if (!isMounted) return;
        const message = err instanceof Error ? err.message : "Something went wrong";
        setState({ status: "error", index: null, rankings: [], error: message });
      }
    };

    void loadSnapshot();

    return () => {
      isMounted = false;
    };
  }, []);

  const updatedLabel = useMemo(() => {
    if (!state.index?.updatedAt) return "—";
    return new Date(state.index.updatedAt).toLocaleString();
  }, [state.index?.updatedAt]);

  const sortedRankings = useMemo(
    () => [...state.rankings].sort((a, b) => b.score - a.score),
    [state.rankings],
  );

  const body = (() => {
    if (state.status === "loading" || state.status === "idle") {
      return (
        <div className="rounded-xl border border-slate-800 bg-surface p-4 text-sm text-slate-300">
          Loading snapshot…
        </div>
      );
    }

    if (state.status === "error") {
      return (
        <div className="rounded-xl border border-rose-800/60 bg-rose-950/50 p-4 text-sm text-rose-200">
          Failed to load snapshot. {state.error}
        </div>
      );
    }

    const index = state.index;

    if (!index) {
      return null;
    }

    return (
      <div className="space-y-8">
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-100">Snapshot metadata</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <MetadataCard label="Version" value={index.version} />
            <MetadataCard label="Updated" value={updatedLabel} />
            <MetadataCard label="Models" value={index.modelsCount} />
            <MetadataCard label="Full" value={index.fullCount} />
            <MetadataCard label="Provisional" value={index.provisionalCount} />
            <MetadataCard label="Not listed" value={index.notListedCount} />
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-slate-100">Rankings</h2>
            <p className="text-xs text-slate-400">
              Showing {sortedRankings.length} of {index.modelsCount} models
            </p>
          </div>

          <div className="space-y-3 sm:hidden">
            {sortedRankings.map((entry, index) => (
              <div
                key={`${entry.vendor}-${entry.model}`}
                className="rounded-xl border border-slate-800 bg-background/60 p-4"
              >
                <div className="flex items-center justify-between text-sm text-slate-400">
                  <span className="font-semibold text-slate-300">#{index + 1}</span>
                  <span className="rounded-full bg-slate-900 px-2 py-1 text-[0.7rem] uppercase tracking-wide">
                    {entry.layer}
                  </span>
                </div>
                <div className="mt-2 text-lg font-semibold text-slate-50">{entry.model}</div>
                <div className="text-sm text-slate-400">{entry.vendor}</div>
                <div className="mt-2 text-sm font-semibold text-slate-100">
                  Total score: {entry.score.toFixed(1)}
                </div>
              </div>
            ))}

            {!sortedRankings.length ? (
              <div className="rounded-xl border border-slate-800 bg-background/60 p-4 text-sm text-slate-400">
                No rankings found in the snapshot.
              </div>
            ) : null}
          </div>

          <div className="hidden overflow-x-auto rounded-2xl border border-slate-800 bg-background/70 shadow-xl sm:block">
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

        <div className="text-xs text-slate-500">
          Files read from <code className="font-mono text-slate-300">/public/data/v4/index.json</code> and
          <code className="mx-1 font-mono text-slate-300">/public/data/v4/rankings.json</code> on the client.
        </div>
      </div>
    );
  })();

  return (
    <div className={`${shellClass} space-y-8`}>
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">AMS · v4</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h1 className="text-3xl font-semibold text-slate-50 sm:text-4xl">Offline snapshot (v4)</h1>
          <div className="text-xs text-slate-500">
            <p>Snapshot updated: {updatedLabel}</p>
            {state.index ? <p>Models in snapshot: {state.index.modelsCount}</p> : null}
          </div>
        </div>
        <p className="max-w-3xl text-sm text-slate-400">
          Client-side view of the AMS v4 snapshot bundled at {" "}
          <code className="mx-1 rounded bg-slate-900/50 px-1.5 py-0.5 text-[0.75rem] text-slate-200">/public/data/v4</code>.
          This view mirrors the live leaderboard data and is intended for debugging only.
        </p>
      </header>

      {body}
    </div>
  );
}

function MetadataCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-surface p-4 text-sm text-slate-200">
      <p className="text-[0.75rem] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-50">{value}</p>
    </div>
  );
}
