"use client";

import Link from "next/link";

import { V4_DIMENSIONS } from "@/lib/v4-dimensions";

export type LeaderboardEntry = {
  model: string;
  vendor: string;
  layer: string;
  score: number;
  scores: { categories?: Record<string, number> };
  updatedAt: string;
  displayName: string;
  displayVendor: string;
  status: "adopted" | "provisional" | "denied";
  evidenceCount: number;
  evidenceTopReason?: string;
  hasEvidence: boolean;
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

export default function V4Results({
  entries,
  totalCount,
}: {
  entries: LeaderboardEntry[];
  totalCount: number;
}) {
  return (
    <div className="space-y-4">
      <div className="text-xs text-slate-400">
        Showing {entries.length} of {totalCount} models
      </div>

      <div className="space-y-3 md:hidden">
        {entries.map((entry, index) => {
          const totalScore = formatScore(entry.score);
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
                  <div className="text-xl font-semibold text-slate-50">
                    {totalScore}
                  </div>
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
                  return (
                    <div key={dimension.key}>
                      <dt className="text-[0.65rem] uppercase">{dimension.label}</dt>
                      <dd className="font-medium text-slate-200">
                        {formatScore(entry.scores.categories?.[dimension.key] ?? 0)}
                      </dd>
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
          {entries.map((entry, index) => (
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

              <span className="text-xs text-slate-400">{entry.evidenceCount}</span>

              <span className="text-right font-semibold text-slate-50">
                {formatScore(entry.score)}
              </span>
              {V4_DIMENSIONS.map((dimension) => {
                return (
                  <span key={dimension.key} className="text-right text-slate-200">
                    {formatScore(entry.scores.categories?.[dimension.key] ?? 0)}
                  </span>
                );
              })}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
