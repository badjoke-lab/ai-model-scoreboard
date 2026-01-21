"use client";

export default function V4EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-surface/70 px-4 py-4 text-sm text-slate-400">
      <div className="text-base font-semibold text-slate-100">No results.</div>
      <p className="mt-2 text-sm text-slate-400">
        Try a broader query or clear filters to see the full list.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onClear}
          className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 hover:border-slate-500 hover:text-slate-100"
        >
          Clear filters
        </button>
        <div className="text-xs text-slate-500">
          Example searches: GPT-4.1, Claude, Llama
        </div>
      </div>
    </div>
  );
}
