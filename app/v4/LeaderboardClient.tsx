"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { getCategoryScore } from "@/lib/v4/categories";
import type { V4LeaderboardRow, V4ModelMetadata } from "@/lib/v4-snapshot";

const STATUS_OPTIONS = ["all", "adopted", "provisional", "denied"] as const;
const SORT_KEYS = ["overall", "C1", "C2", "C3", "C4", "C5"] as const;

type StatusFilter = (typeof STATUS_OPTIONS)[number];
type SortKey = (typeof SORT_KEYS)[number];

type LeaderboardEntry = V4LeaderboardRow & {
  status: "adopted" | "provisional" | "denied";
};

function formatScore(value: number) {
  return Number.isFinite(value) ? value.toFixed(1) : "—";
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function mapLayerToStatus(layer: V4LeaderboardRow["layer"]): LeaderboardEntry["status"] {
  if (layer === "full") return "adopted";
  if (layer === "provisional") return "provisional";
  return "denied";
}

function LayerBadge({ layer }: { layer: string }) {
  const normalized = layer.toLowerCase();

  let label = "Unknown";
  let className =
    "inline-flex items-center rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-[0.7rem] font-medium text-slate-300";

  if (normalized === "full") {
    label = "Full";
    className =
      "inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[0.7rem] font-medium text-emerald-300";
  } else if (normalized === "provisional") {
    label = "Provisional";
    className =
      "inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[0.7rem] font-medium text-amber-300";
  } else if (normalized === "rejected") {
    label = "Rejected";
    className =
      "inline-flex items-center rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[0.7rem] font-medium text-rose-300";
  }

  return <span className={className}>{label}</span>;
}

function formatStatusLabel(status: StatusFilter) {
  if (status === "all") return "All";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function LeaderboardClient({
  rankings,
  models,
}: {
  rankings: V4LeaderboardRow[];
  models: Record<string, V4ModelMetadata>;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("overall");

  const normalizedQuery = query.trim().toLowerCase();

  const entries = useMemo(() => {
    return rankings.map((entry) => {
      const meta = models[entry.model];
      return {
        ...entry,
        displayName: entry.displayName ?? meta?.name ?? entry.model,
        displayVendor: entry.displayVendor ?? meta?.vendor ?? entry.vendor,
        evidenceOkCount: entry.evidenceOkCount ?? 0,
        status: mapLayerToStatus(entry.layer),
      } satisfies LeaderboardEntry;
    });
  }, [rankings, models]);

  const filtered = useMemo(() => {
    return entries.filter((entry) => {
      const matchesQuery =
        !normalizedQuery ||
        entry.displayName.toLowerCase().includes(normalizedQuery) ||
        entry.model.toLowerCase().includes(normalizedQuery) ||
        entry.displayVendor.toLowerCase().includes(normalizedQuery) ||
        entry.vendor.toLowerCase().includes(normalizedQuery);
      const matchesStatus = statusFilter === "all" || entry.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [entries, normalizedQuery, statusFilter]);

  const sorted = useMemo(() => {
    const result = [...filtered];
    result.sort((a, b) => {
      const scoreFor = (entry: LeaderboardEntry) => {
        if (sortKey === "overall") return entry.score;
        return (
          getCategoryScore(entry.scores.categories ?? entry.scores, sortKey) ??
          getCategoryScore(entry.scores.categories ?? entry.scores, sortKey.toLowerCase()) ??
          0
        );
      };
      const delta = scoreFor(b) - scoreFor(a);
      if (delta !== 0) return delta;
      return a.model.localeCompare(b.model);
    });
    return result;
  }, [filtered, sortKey]);

  return (
    <div className="space-y-6">
      <section className="grid gap-3 rounded-2xl border border-slate-800 bg-surface/70 p-4 shadow sm:grid-cols-3">
        <div>
          <label className="text-[0.7rem] uppercase tracking-wide text-slate-500">
            Search model or provider
          </label>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="e.g. GPT-4.1 or OpenAI"
            className="mt-2 w-full rounded-lg border border-slate-800 bg-background/80 px-3 py-2 text-sm text-slate-200"
          />
        </div>
        <div>
          <label className="text-[0.7rem] uppercase tracking-wide text-slate-500">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            className="mt-2 w-full rounded-lg border border-slate-800 bg-background/80 px-3 py-2 text-sm text-slate-200"
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {formatStatusLabel(status)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[0.7rem] uppercase tracking-wide text-slate-500">
            Sort by
          </label>
          <select
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as SortKey)}
            className="mt-2 w-full rounded-lg border border-slate-800 bg-background/80 px-3 py-2 text-sm text-slate-200"
          >
            <option value="overall">Overall</option>
            <option value="C1">C1 Performance</option>
            <option value="C2">C2 Safety</option>
            <option value="C3">C3 Adoption</option>
            <option value="C4">C4 Openness</option>
            <option value="C5">C5 Cost</option>
          </select>
        </div>
      </section>

      <div className="text-xs text-slate-400">
        Showing {sorted.length} of {rankings.length} models
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-surface/70 px-4 py-3 text-sm text-slate-400">
          No models match the current filters.
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {sorted.map((entry, index) => (
              <Link
                key={entry.model}
                href={`/models/${encodeURIComponent(entry.model)}`}
                className="rounded-2xl border border-slate-800 bg-surface/70 p-4 shadow"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs text-slate-500">#{index + 1}</div>
                    <div className="text-base font-semibold text-slate-50 hover:text-accent">
                      {entry.displayName}
                    </div>
                    <div className="text-xs text-slate-500">{entry.displayVendor}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Overall</div>
                    <div className="text-xl font-semibold text-slate-50">
                      {formatScore(entry.score)}
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Updated {formatUpdatedAt(entry.updatedAt)}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <LayerBadge layer={entry.layer} />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-400">
                  <div>
                    <dt className="text-[0.65rem] uppercase">C1 Performance</dt>
                    <dd className="font-medium text-slate-200">
                      {formatScore(
                        getCategoryScore(entry.scores.categories ?? entry.scores, "C1") ?? 0
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[0.65rem] uppercase">C2 Safety</dt>
                    <dd className="font-medium text-slate-200">
                      {formatScore(
                        getCategoryScore(entry.scores.categories ?? entry.scores, "C2") ?? 0
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[0.65rem] uppercase">C3 Adoption</dt>
                    <dd className="font-medium text-slate-200">
                      {formatScore(
                        getCategoryScore(entry.scores.categories ?? entry.scores, "C3") ?? 0
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[0.65rem] uppercase">C4 Openness</dt>
                    <dd className="font-medium text-slate-200">
                      {formatScore(
                        getCategoryScore(entry.scores.categories ?? entry.scores, "C4") ?? 0
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[0.65rem] uppercase">C5 Cost</dt>
                    <dd className="font-medium text-slate-200">
                      {formatScore(
                        getCategoryScore(entry.scores.categories ?? entry.scores, "C5") ?? 0
                      )}
                    </dd>
                  </div>
                </dl>
              </Link>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-slate-800 bg-surface/70 shadow md:block">
            <div className="grid grid-cols-13 bg-surface px-4 py-3 text-[0.75rem] font-semibold uppercase tracking-wide text-slate-400">
              <span className="col-span-1">#</span>
              <span className="col-span-3">Model</span>
              <span className="col-span-2">Provider</span>
              <span className="col-span-1 text-right">Overall</span>
              <span className="col-span-1 text-right">C1</span>
              <span className="col-span-1 text-right">C2</span>
              <span className="col-span-1 text-right">C3</span>
              <span className="col-span-1 text-right">C4</span>
              <span className="col-span-1 text-right">C5</span>
              <span className="col-span-1">Status</span>
            </div>

            <div className="divide-y divide-slate-800/80">
              {sorted.map((entry, index) => (
                <Link
                  key={entry.model}
                  href={`/models/${encodeURIComponent(entry.model)}`}
                  className="grid grid-cols-13 items-center px-4 py-3 text-sm text-slate-200 hover:bg-surface/80"
                >
                  <span className="col-span-1 text-sm font-semibold text-slate-500">
                    {index + 1}
                  </span>

                  <div className="col-span-3">
                    <div className="font-semibold text-slate-50 hover:text-accent">
                      {entry.displayName}
                    </div>
                    <div className="text-xs text-slate-500">{entry.model}</div>
                  </div>

                  <div className="col-span-2">
                    <div className="text-sm text-slate-200">{entry.displayVendor}</div>
                  </div>

                  <span className="col-span-1 text-right font-semibold text-slate-50">
                    {formatScore(entry.score)}
                  </span>
                  <span className="col-span-1 text-right text-slate-200">
                    {formatScore(
                      getCategoryScore(entry.scores.categories ?? entry.scores, "C1") ?? 0
                    )}
                  </span>
                  <span className="col-span-1 text-right text-slate-200">
                    {formatScore(
                      getCategoryScore(entry.scores.categories ?? entry.scores, "C2") ?? 0
                    )}
                  </span>
                  <span className="col-span-1 text-right text-slate-200">
                    {formatScore(
                      getCategoryScore(entry.scores.categories ?? entry.scores, "C3") ?? 0
                    )}
                  </span>
                  <span className="col-span-1 text-right text-slate-200">
                    {formatScore(
                      getCategoryScore(entry.scores.categories ?? entry.scores, "C4") ?? 0
                    )}
                  </span>
                  <span className="col-span-1 text-right text-slate-200">
                    {formatScore(
                      getCategoryScore(entry.scores.categories ?? entry.scores, "C5") ?? 0
                    )}
                  </span>

                  <div className="col-span-1">
                    <LayerBadge layer={entry.layer} />
                  </div>

                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
