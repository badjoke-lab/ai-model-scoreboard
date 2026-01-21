"use client";

import type { V4Filters } from "@/lib/v4/useV4StateMachine";

const STATUS_OPTIONS: V4Filters["status"][] = [
  "all",
  "adopted",
  "provisional",
  "denied",
];

function formatStatusLabel(status: V4Filters["status"]) {
  if (status === "all") return "All";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function V4Controls({
  filters,
  onQueryChange,
  onProviderChange,
  onStatusChange,
  onClear,
}: {
  filters: V4Filters;
  onQueryChange: (value: string) => void;
  onProviderChange: (value: string) => void;
  onStatusChange: (value: V4Filters["status"]) => void;
  onClear: () => void;
}) {
  return (
    <section className="grid gap-3 rounded-2xl border border-slate-800 bg-surface/70 p-4 shadow sm:grid-cols-3">
      <div>
        <label className="text-[0.7rem] uppercase tracking-wide text-slate-500">
          Search by name
        </label>
        <input
          value={filters.query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="e.g. GPT-4.1"
          className="mt-2 w-full rounded-lg border border-slate-800 bg-background/80 px-3 py-2 text-sm text-slate-200"
        />
      </div>
      <div>
        <label className="text-[0.7rem] uppercase tracking-wide text-slate-500">
          Provider
        </label>
        <input
          value={filters.provider}
          onChange={(event) => onProviderChange(event.target.value)}
          placeholder="e.g. OpenAI"
          className="mt-2 w-full rounded-lg border border-slate-800 bg-background/80 px-3 py-2 text-sm text-slate-200"
        />
      </div>
      <div>
        <label className="text-[0.7rem] uppercase tracking-wide text-slate-500">
          Status
        </label>
        <select
          value={filters.status}
          onChange={(event) => onStatusChange(event.target.value as V4Filters["status"])}
          className="mt-2 w-full rounded-lg border border-slate-800 bg-background/80 px-3 py-2 text-sm text-slate-200"
        >
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {formatStatusLabel(status)}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-3">
        <button
          type="button"
          onClick={onClear}
          className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
        >
          Clear filters
        </button>
      </div>
    </section>
  );
}
