"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { V4ModelMetadata, V4RankingEntry } from "@/lib/v4-snapshot";

const STATUS_OPTIONS = ["all", "adopted", "provisional", "denied"] as const;
const EVIDENCE_STATUS_OPTIONS = ["all", "ok", "issue"] as const;

type StatusFilter = (typeof STATUS_OPTIONS)[number];
type EvidenceStatusFilter = (typeof EVIDENCE_STATUS_OPTIONS)[number];

type LeaderboardEntry = V4RankingEntry & {
  displayName: string;
  displayVendor: string;
  status: "adopted" | "provisional" | "denied";
  evidenceStatus: "ok" | "issue";
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

function mapLayerToStatus(layer: V4RankingEntry["layer"]): LeaderboardEntry["status"] {
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

function formatEvidenceStatusLabel(status: EvidenceStatusFilter) {
  if (status === "all") return "All";
  return status === "ok" ? "OK" : "Issue";
}

function parseNumberInput(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function LeaderboardClient({
  rankings,
  models,
  evidenceStatusByModel,
}: {
  rankings: V4RankingEntry[];
  models: Record<string, V4ModelMetadata>;
  evidenceStatusByModel: Record<string, "ok" | "issue">;
}) {
  const [provider, setProvider] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [evidenceStatusFilter, setEvidenceStatusFilter] =
    useState<EvidenceStatusFilter>("all");
  const [minOverall, setMinOverall] = useState("");
  const [maxOverall, setMaxOverall] = useState("");
  const [minSpec, setMinSpec] = useState("");
  const [minEvidence, setMinEvidence] = useState("");
  const [minOps, setMinOps] = useState("");

  const normalizedProvider = provider.trim().toLowerCase();

  const entries = useMemo(() => {
    return rankings.map((entry) => {
      const meta = models[entry.model];
      return {
        ...entry,
        displayName: meta?.name ?? entry.model,
        displayVendor: meta?.vendor ?? entry.vendor,
        status: mapLayerToStatus(entry.layer),
        evidenceStatus: evidenceStatusByModel[entry.model] ?? "issue",
      } satisfies LeaderboardEntry;
    });
  }, [rankings, models, evidenceStatusByModel]);

  const filtered = useMemo(() => {
    const minOverallValue = parseNumberInput(minOverall);
    const maxOverallValue = parseNumberInput(maxOverall);
    const minSpecValue = parseNumberInput(minSpec);
    const minEvidenceValue = parseNumberInput(minEvidence);
    const minOpsValue = parseNumberInput(minOps);

    return entries.filter((entry) => {
      const matchesProvider =
        !normalizedProvider ||
        entry.displayVendor.toLowerCase().includes(normalizedProvider) ||
        entry.vendor.toLowerCase().includes(normalizedProvider);
      const matchesStatus = statusFilter === "all" || entry.status === statusFilter;
      const matchesEvidence =
        evidenceStatusFilter === "all" || entry.evidenceStatus === evidenceStatusFilter;
      const matchesOverallMin =
        minOverallValue === null || entry.score >= minOverallValue;
      const matchesOverallMax =
        maxOverallValue === null || entry.score <= maxOverallValue;
      const matchesSpecMin =
        minSpecValue === null || entry.scores.spec >= minSpecValue;
      const matchesEvidenceMin =
        minEvidenceValue === null || entry.scores.evidence >= minEvidenceValue;
      const matchesOpsMin = minOpsValue === null || entry.scores.ops >= minOpsValue;

      return (
        matchesProvider &&
        matchesStatus &&
        matchesEvidence &&
        matchesOverallMin &&
        matchesOverallMax &&
        matchesSpecMin &&
        matchesEvidenceMin &&
        matchesOpsMin
      );
    });
  }, [
    entries,
    normalizedProvider,
    statusFilter,
    evidenceStatusFilter,
    minOverall,
    maxOverall,
    minSpec,
    minEvidence,
    minOps,
  ]);

  return (
    <div className="space-y-6">
      <section className="grid gap-3 rounded-2xl border border-slate-800 bg-surface/70 p-4 shadow md:grid-cols-5">
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
        <div>
          <label className="text-[0.7rem] uppercase tracking-wide text-slate-500">
            Evidence status
          </label>
          <select
            value={evidenceStatusFilter}
            onChange={(event) =>
              setEvidenceStatusFilter(event.target.value as EvidenceStatusFilter)
            }
            className="mt-2 w-full rounded-lg border border-slate-800 bg-background/80 px-3 py-2 text-sm text-slate-200"
          >
            {EVIDENCE_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {formatEvidenceStatusLabel(status)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[0.7rem] uppercase tracking-wide text-slate-500">
            Overall range
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input
              value={minOverall}
              onChange={(event) => setMinOverall(event.target.value)}
              placeholder="Min"
              inputMode="decimal"
              className="w-full rounded-lg border border-slate-800 bg-background/80 px-3 py-2 text-sm text-slate-200"
            />
            <input
              value={maxOverall}
              onChange={(event) => setMaxOverall(event.target.value)}
              placeholder="Max"
              inputMode="decimal"
              className="w-full rounded-lg border border-slate-800 bg-background/80 px-3 py-2 text-sm text-slate-200"
            />
          </div>
        </div>
        <div>
          <label className="text-[0.7rem] uppercase tracking-wide text-slate-500">
            Min Spec/Evidence/Ops
          </label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <input
              value={minSpec}
              onChange={(event) => setMinSpec(event.target.value)}
              placeholder="Spec"
              inputMode="decimal"
              className="w-full rounded-lg border border-slate-800 bg-background/80 px-3 py-2 text-sm text-slate-200"
            />
            <input
              value={minEvidence}
              onChange={(event) => setMinEvidence(event.target.value)}
              placeholder="Evidence"
              inputMode="decimal"
              className="w-full rounded-lg border border-slate-800 bg-background/80 px-3 py-2 text-sm text-slate-200"
            />
            <input
              value={minOps}
              onChange={(event) => setMinOps(event.target.value)}
              placeholder="Ops"
              inputMode="decimal"
              className="w-full rounded-lg border border-slate-800 bg-background/80 px-3 py-2 text-sm text-slate-200"
            />
          </div>
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
            {filtered.map((entry, index) => (
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
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[0.65rem] uppercase tracking-wide ${
                      entry.evidenceStatus === "ok"
                        ? "border-emerald-500/40 text-emerald-300"
                        : "border-amber-500/40 text-amber-200"
                    }`}
                  >
                    Evidence {entry.evidenceStatus}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-x-6 gap-y-1 text-xs text-slate-400">
                  <div>
                    <dt className="text-[0.65rem] uppercase">Spec</dt>
                    <dd className="font-medium text-slate-200">
                      {formatScore(entry.scores.spec)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[0.65rem] uppercase">Evidence</dt>
                    <dd className="font-medium text-slate-200">
                      {formatScore(entry.scores.evidence)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[0.65rem] uppercase">Ops</dt>
                    <dd className="font-medium text-slate-200">
                      {formatScore(entry.scores.ops)}
                    </dd>
                  </div>
                </dl>
              </Link>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-slate-800 bg-surface/70 shadow md:block">
            <div className="grid grid-cols-12 bg-surface px-4 py-3 text-[0.75rem] font-semibold uppercase tracking-wide text-slate-400">
              <span className="col-span-1">#</span>
              <span className="col-span-3">Model</span>
              <span className="col-span-2">Vendor</span>
              <span className="col-span-1">Layer</span>
              <span className="col-span-1">Updated</span>
              <span className="col-span-1 text-right">Overall</span>
              <span className="col-span-1 text-right">Spec</span>
              <span className="col-span-1 text-right">Evidence</span>
              <span className="col-span-1 text-right">Ops</span>
              <span className="col-span-1 text-right">Evidence Status</span>
            </div>

            <div className="divide-y divide-slate-800/80">
              {filtered.map((entry, index) => (
                <Link
                  key={entry.model}
                  href={`/models/${encodeURIComponent(entry.model)}`}
                  className="grid grid-cols-12 items-center px-4 py-3 text-sm text-slate-200 hover:bg-surface/80"
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

                  <div className="col-span-1">
                    <LayerBadge layer={entry.layer} />
                  </div>

                  <span className="col-span-1 text-xs text-slate-400">
                    {formatUpdatedAt(entry.updatedAt)}
                  </span>

                  <span className="col-span-1 text-right font-semibold text-slate-50">
                    {formatScore(entry.score)}
                  </span>
                  <span className="col-span-1 text-right text-slate-200">
                    {formatScore(entry.scores.spec)}
                  </span>
                  <span className="col-span-1 text-right text-slate-200">
                    {formatScore(entry.scores.evidence)}
                  </span>
                  <span className="col-span-1 text-right text-slate-200">
                    {formatScore(entry.scores.ops)}
                  </span>
                  <span className="col-span-1 text-right text-xs text-slate-400">
                    {entry.evidenceStatus}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
