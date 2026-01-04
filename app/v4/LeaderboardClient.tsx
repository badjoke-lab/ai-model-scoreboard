"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type {
  V4EvidenceSummaryLite,
  V4ModelMetadata,
  V4RankingEntry,
} from "@/lib/v4-snapshot";
import { V4_DIMENSIONS, type V4DimensionKey } from "@/lib/v4-dimensions";

const STATUS_OPTIONS = ["all", "adopted", "provisional", "denied"] as const;

type StatusFilter = (typeof STATUS_OPTIONS)[number];

type LeaderboardEntry = V4RankingEntry & {
  displayName: string;
  displayVendor: string;
  status: "adopted" | "provisional" | "denied";
  evidenceCount: number;
  evidenceTopReason?: string;
  hasEvidence: boolean;
  dimensionReasons: Record<V4DimensionKey, string[]>;
  dimensionHasRefs: Record<V4DimensionKey, boolean>;
};

function formatScore(value: number) {
  return Number.isFinite(value) ? value.toFixed(1) : "—";
}

function formatReasonLabel(reason: string) {
  return reason
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
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

function mapLayerToStatus(layer: V4RankingEntry["layer"]): LeaderboardEntry["status"] {
  if (layer === "full") return "adopted";
  if (layer === "provisional") return "provisional";
  return "denied";
}

function collectDimensionReasons(
  scoreItems: V4RankingEntry["scoreItems"] | undefined,
  prefix: string
): string[] {
  if (!scoreItems) return [];
  const reasons = Object.entries(scoreItems)
    .filter(([key]) => key.startsWith(prefix))
    .flatMap(([, item]) => {
      const penaltyReasons = item.penaltyReasons ?? [];
      if (penaltyReasons.length) return penaltyReasons;
      const evidenceStatuses =
        item.usedEvidence?.flatMap((entry) => {
          if (!entry.type || !entry.status) return [];
          return [`evidence_${entry.type}_${entry.status}`];
        }) ?? [];
      return evidenceStatuses.length ? evidenceStatuses : [];
    })
    .filter((reason) => Boolean(reason));
  return Array.from(new Set(reasons));
}

function isInsufficientEvidence(reasons: string[], hasEvidenceRefs: boolean) {
  return reasons.length === 0 && !hasEvidenceRefs;
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

function StatusBadge({ status }: { status: LeaderboardEntry["status"] }) {
  const label =
    status === "adopted" ? "Adopted" : status === "provisional" ? "Provisional" : "Denied";
  const className =
    status === "adopted"
      ? "rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[0.65rem] uppercase tracking-wide text-emerald-300"
      : status === "provisional"
        ? "rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[0.65rem] uppercase tracking-wide text-amber-300"
        : "rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[0.65rem] uppercase tracking-wide text-rose-300";

  return <span className={className}>{label}</span>;
}

function formatStatusLabel(status: StatusFilter) {
  if (status === "all") return "All";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function LeaderboardClient({
  rankings,
  models,
  evidenceSummaries,
}: {
  rankings: V4RankingEntry[];
  models: Record<string, V4ModelMetadata>;
  evidenceSummaries: Record<string, V4EvidenceSummaryLite>;
}) {
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const normalizedQuery = query.trim().toLowerCase();
  const normalizedProvider = provider.trim().toLowerCase();

  const entries = useMemo(() => {
    return rankings.map((entry) => {
      const meta = models[entry.model];
      const evidence = evidenceSummaries[entry.model];
      const evidenceCount = evidence?.count ?? 0;
      const dimensionReasons: Record<V4DimensionKey, string[]> = {
        spec: collectDimensionReasons(entry.scoreItems, "S"),
        evidence: collectDimensionReasons(entry.scoreItems, "T"),
        ops: collectDimensionReasons(entry.scoreItems, "Q"),
      };
      const dimensionHasRefs: Record<V4DimensionKey, boolean> = {
        spec: false,
        evidence: (evidence?.count ?? 0) > 0,
        ops: false,
      };
      return {
        ...entry,
        displayName: meta?.name ?? entry.model,
        displayVendor: meta?.vendor ?? entry.vendor,
        status: mapLayerToStatus(entry.layer),
        evidenceCount,
        evidenceTopReason: evidence?.topReason,
        hasEvidence: evidence?.hasEvidence ?? evidenceCount > 0,
        dimensionReasons,
        dimensionHasRefs,
      } satisfies LeaderboardEntry;
    });
  }, [rankings, models, evidenceSummaries]);

  const filtered = useMemo(() => {
    return entries.filter((entry) => {
      const matchesQuery =
        !normalizedQuery ||
        entry.displayName.toLowerCase().includes(normalizedQuery) ||
        entry.model.toLowerCase().includes(normalizedQuery);
      const matchesProvider =
        !normalizedProvider ||
        entry.displayVendor.toLowerCase().includes(normalizedProvider) ||
        entry.vendor.toLowerCase().includes(normalizedProvider);
      const matchesStatus = statusFilter === "all" || entry.status === statusFilter;
      return matchesQuery && matchesProvider && matchesStatus;
    });
  }, [entries, normalizedQuery, normalizedProvider, statusFilter]);

  return (
    <div className="space-y-6">
      <section className="grid gap-3 rounded-2xl border border-slate-800 bg-surface/70 p-4 shadow sm:grid-cols-3">
        <div>
          <label className="text-[0.7rem] uppercase tracking-wide text-slate-500">
            Search by name
          </label>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="e.g. GPT-4.1"
            className="mt-2 w-full rounded-lg border border-slate-800 bg-background/80 px-3 py-2 text-sm text-slate-200"
          />
        </div>
        <div>
          <label className="text-[0.7rem] uppercase tracking-wide text-slate-500">
            Provider
          </label>
          <input
            value={provider}
            onChange={(event) => setProvider(event.target.value)}
            placeholder="e.g. openai"
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
      </section>

      <div className="text-xs text-slate-400">
        Showing {filtered.length} of {rankings.length} models
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-surface/70 px-4 py-3 text-sm text-slate-400">
          No models match the current filters.
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {filtered.map((entry, index) => {
              const insufficientDimensions = V4_DIMENSIONS.some((dimension) =>
                isInsufficientEvidence(
                  entry.dimensionReasons[dimension.key],
                  entry.dimensionHasRefs[dimension.key]
                )
              );
              const totalScore = insufficientDimensions ? "—" : formatScore(entry.score);
              return (
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
                      <div className="text-xs text-slate-500">Total</div>
                      <div className="text-xl font-semibold text-slate-50">{totalScore}</div>
                      {insufficientDimensions ? (
                        <div className="text-[0.7rem] text-slate-500">
                          Insufficient evidence
                        </div>
                      ) : null}
                  </div>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Updated {formatUpdatedAt(entry.updatedAt)}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Evidence: {entry.evidenceCount}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusBadge status={entry.status} />
                  <LayerBadge layer={entry.layer} />
                </div>
                {entry.hasEvidence && entry.evidenceTopReason ? (
                  <div className="mt-2 text-xs text-slate-400">
                    Top reason: {formatReasonLabel(entry.evidenceTopReason)}
                  </div>
                ) : null}
                <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-xs text-slate-400">
                  {V4_DIMENSIONS.map((dimension) => {
                    const reasons = entry.dimensionReasons[dimension.key];
                    const hasRefs = entry.dimensionHasRefs[dimension.key];
                    const insufficient = isInsufficientEvidence(reasons, hasRefs);
                    return (
                      <div key={dimension.key}>
                        <dt className="text-[0.65rem] uppercase">{dimension.label}</dt>
                        <dd className="font-medium text-slate-200">
                          {insufficient ? "—" : formatScore(entry.scores[dimension.key])}
                        </dd>
                        {insufficient ? (
                          <div className="text-[0.65rem] text-slate-500">
                            Insufficient evidence
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </dl>
                </Link>
              );
            })}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-slate-800 bg-surface/70 shadow md:block">
            <div
              className="grid bg-surface px-4 py-3 text-[0.75rem] font-semibold uppercase tracking-wide text-slate-400"
              style={{
                gridTemplateColumns: `60px minmax(220px, 2fr) minmax(140px, 1fr) minmax(110px, 1fr) minmax(130px, 1fr) minmax(120px, 1fr) minmax(90px, 1fr) minmax(90px, 1fr) repeat(${V4_DIMENSIONS.length}, minmax(90px, 1fr))`,
              }}
            >
              <span>#</span>
              <span>Model</span>
              <span>Vendor</span>
              <span>Layer</span>
              <span>Status</span>
              <span>Updated</span>
              <span>Evidence</span>
              <span className="text-right">Total</span>
              {V4_DIMENSIONS.map((dimension) => (
                <span key={dimension.key} className="text-right">
                  {dimension.label}
                </span>
              ))}
            </div>

            <div className="divide-y divide-slate-800/80">
              {filtered.map((entry, index) => (
                <Link
                  key={entry.model}
                  href={`/models/${encodeURIComponent(entry.model)}`}
                  className="grid items-center px-4 py-3 text-sm text-slate-200 hover:bg-surface/80"
                  style={{
                    gridTemplateColumns: `60px minmax(220px, 2fr) minmax(140px, 1fr) minmax(110px, 1fr) minmax(130px, 1fr) minmax(120px, 1fr) minmax(90px, 1fr) minmax(90px, 1fr) repeat(${V4_DIMENSIONS.length}, minmax(90px, 1fr))`,
                  }}
                >
                  <span className="text-sm font-semibold text-slate-500">
                    {index + 1}
                  </span>

                  <div>
                    <div className="font-semibold text-slate-50 hover:text-accent">
                      {entry.displayName}
                    </div>
                    <div className="text-xs text-slate-500">{entry.model}</div>
                    {entry.hasEvidence && entry.evidenceTopReason ? (
                      <div className="text-[0.7rem] text-slate-400">
                        Top reason: {formatReasonLabel(entry.evidenceTopReason)}
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <div className="text-sm text-slate-200">{entry.displayVendor}</div>
                  </div>

                  <div>
                    <LayerBadge layer={entry.layer} />
                  </div>

                  <div>
                    <StatusBadge status={entry.status} />
                  </div>

                  <span className="text-xs text-slate-400">
                    {formatUpdatedAt(entry.updatedAt)}
                  </span>

                  <span className="text-xs text-slate-400">
                    {entry.evidenceCount}
                  </span>

                  <span className="text-right font-semibold text-slate-50">
                    {V4_DIMENSIONS.some((dimension) =>
                      isInsufficientEvidence(
                        entry.dimensionReasons[dimension.key],
                        entry.dimensionHasRefs[dimension.key]
                      )
                    )
                      ? "—"
                      : formatScore(entry.score)}
                  </span>
                  {V4_DIMENSIONS.map((dimension) => {
                    const reasons = entry.dimensionReasons[dimension.key];
                    const hasRefs = entry.dimensionHasRefs[dimension.key];
                    const insufficient = isInsufficientEvidence(reasons, hasRefs);
                    return (
                      <span key={dimension.key} className="text-right text-slate-200">
                        {insufficient ? "—" : formatScore(entry.scores[dimension.key])}
                      </span>
                    );
                  })}
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
