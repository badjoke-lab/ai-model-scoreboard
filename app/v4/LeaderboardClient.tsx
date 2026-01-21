"use client";

import { useCallback } from "react";

import type {
  V4EvidenceSummaryLite,
  V4ModelMetadata,
  V4RankingEntry,
  V4SnapshotMeta,
} from "@/lib/v4-snapshot";
import {
  useV4StateMachine,
  type V4Filters,
  type V4SnapshotData,
} from "@/lib/v4/useV4StateMachine";
import V4Controls from "@/components/v4/V4Controls";
import V4EmptyState from "@/components/v4/V4EmptyState";
import V4ErrorState from "@/components/v4/V4ErrorState";
import V4Results, { type LeaderboardEntry } from "@/components/v4/V4Results";

function mapLayerToStatus(layer: V4RankingEntry["layer"]): LeaderboardEntry["status"] {
  if (layer === "full") return "adopted";
  if (layer === "provisional") return "provisional";
  return "denied";
}

function buildEntries(
  rankings: V4RankingEntry[],
  models: Record<string, V4ModelMetadata>,
  evidenceSummaries: Record<string, V4EvidenceSummaryLite>
): LeaderboardEntry[] {
  return rankings.map((entry) => {
    const meta = models[entry.model];
    const evidence = evidenceSummaries[entry.model];
    const evidenceCount = evidence?.count ?? 0;
    return {
      ...entry,
      displayName: meta?.name ?? entry.model,
      displayVendor: meta?.vendor ?? entry.vendor,
      status: mapLayerToStatus(entry.layer),
      evidenceCount,
      evidenceTopReason: evidence?.topReason,
      hasEvidence: evidence?.hasEvidence ?? evidenceCount > 0,
    };
  });
}

function filterEntries(entries: LeaderboardEntry[], filters: V4Filters) {
  const normalizedQuery = filters.query.trim().toLowerCase();
  const normalizedProvider = filters.provider.trim().toLowerCase();

  return entries.filter((entry) => {
    const matchesQuery =
      !normalizedQuery ||
      entry.displayName.toLowerCase().includes(normalizedQuery) ||
      entry.model.toLowerCase().includes(normalizedQuery);
    const matchesProvider =
      !normalizedProvider ||
      entry.displayVendor.toLowerCase().includes(normalizedProvider) ||
      entry.vendor.toLowerCase().includes(normalizedProvider);
    const matchesStatus = filters.status === "all" || entry.status === filters.status;
    return matchesQuery && matchesProvider && matchesStatus;
  });
}

export default function LeaderboardClient({
  rankings,
  models,
  meta,
  evidenceSummaries,
}: {
  rankings: V4RankingEntry[];
  models: Record<string, V4ModelMetadata>;
  meta: V4SnapshotMeta | null;
  evidenceSummaries: Record<string, V4EvidenceSummaryLite>;
}) {
  const initialData: V4SnapshotData | null = meta
    ? {
        meta,
        rankings,
        models,
      }
    : null;

  const getResults = useCallback(
    (data: V4SnapshotData, filters: V4Filters) => {
      const entries = buildEntries(data.rankings, data.models, evidenceSummaries);
      return filterEntries(entries, filters);
    },
    [evidenceSummaries]
  );

  const {
    mode,
    data,
    results,
    error,
    filters,
    setQuery,
    setProvider,
    setStatus,
    clearFilters,
    retryFetch,
    showAll,
    isFetching,
  } = useV4StateMachine<LeaderboardEntry>({
    endpoint: "/api/snapshot",
    initialData,
    getResults,
  });

  const totalCount = data?.rankings?.length ?? rankings.length ?? 0;

  return (
    <div className="space-y-6">
      <V4Controls
        filters={filters}
        onQueryChange={setQuery}
        onProviderChange={setProvider}
        onStatusChange={setStatus}
        onClear={clearFilters}
      />

      {mode === "FETCHING" ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
            <span>Loading…</span>
          </div>
          {results.length > 0 ? (
            <div className="opacity-70">
              <V4Results entries={results} totalCount={totalCount} />
            </div>
          ) : null}
        </div>
      ) : null}

      {mode === "FIRST_VIEW" ? (
        <div className="rounded-2xl border border-slate-800 bg-surface/70 px-4 py-4 text-sm text-slate-300">
          <div className="text-base font-semibold text-slate-100">
            Explore the v4 leaderboard
          </div>
          <p className="mt-2 text-sm text-slate-400">
            Use the search and filters to find specific models, or show the full
            leaderboard.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={showAll}
              className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 hover:border-slate-500 hover:text-slate-100"
            >
              Show all
            </button>
            <div className="text-xs text-slate-500">
              Example searches: GPT-4.1, Claude, Llama
            </div>
          </div>
        </div>
      ) : null}

      {mode === "READY" ? (
        <V4Results entries={results} totalCount={totalCount} />
      ) : null}

      {mode === "NO_RESULTS" ? <V4EmptyState onClear={clearFilters} /> : null}

      {mode === "ERROR" ? (
        <V4ErrorState
          error={error}
          onRetry={retryFetch}
          onReload={() => window.location.reload()}
        />
      ) : null}

      {isFetching && mode !== "FETCHING" ? (
        <div className="text-xs text-slate-500">Updating results…</div>
      ) : null}
    </div>
  );
}
