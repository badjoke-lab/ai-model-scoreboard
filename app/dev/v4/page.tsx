import Link from "next/link";

import {
  loadV4DevSnapshot,
  V4_SCORE_ITEMS,
  type V4RankingEntry,
} from "@/lib/v4-dev-snapshot";

export const dynamic = "force-dynamic";

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      });
}

function formatScore(value: number | null) {
  if (value === null) return "N/A";
  return value.toFixed(1);
}

function LayerBadge({ layer }: { layer: string }) {
  const normalized = layer.toLowerCase();

  let label = layer;
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

function DiagnosticsBanner({ errors }: { errors: string[] }) {
  if (!errors.length) return null;

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 shadow-sm">
      <p className="font-semibold">Snapshot warnings</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-[0.85rem]">
        {errors.slice(0, 6).map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
      {errors.length > 6 ? (
        <p className="mt-2 text-xs opacity-80">…and {errors.length - 6} more</p>
      ) : null}
    </div>
  );
}

function LeaderboardRow({
  entry,
  index,
  displayName,
  displayVendor,
}: {
  entry: V4RankingEntry;
  index: number;
  displayName: string;
  displayVendor: string;
}) {
  return (
    <div className="grid grid-cols-10 items-center gap-2 border-b border-slate-800/70 px-4 py-3 text-sm text-slate-200 last:border-b-0">
      <span className="text-slate-500">#{index + 1}</span>
      <Link
        href={`/dev/v4/${encodeURIComponent(entry.model)}`}
        className="col-span-3 font-semibold text-slate-50 hover:text-accent"
      >
        {displayName}
      </Link>
      <span className="col-span-2 text-slate-300">{displayVendor || "Unknown"}</span>
      <div className="col-span-1">
        <LayerBadge layer={entry.layer} />
      </div>
      <span className="col-span-1 text-right font-semibold text-slate-50">
        {formatScore(entry.score)}
      </span>
      {V4_SCORE_ITEMS.slice(0, 2).map((item) => (
        <span key={item.key} className="col-span-1 text-right text-slate-300">
          {formatScore(entry.scores[item.key])}
        </span>
      ))}
    </div>
  );
}

export default async function DevV4Page() {
  const { index, rankings, models, notListed, diagnostics } = await loadV4DevSnapshot();
  const updatedLabel = formatDate(index.meta.updatedAt);
  const modelCountLabel = Number.isFinite(index.meta.modelsCount)
    ? index.meta.modelsCount
    : rankings.length;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10">
      <header className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
            AIMS · v4 · Dev Preview
          </p>
          <h1 className="text-3xl font-semibold text-slate-50 md:text-4xl">
            Snapshot leaderboard
          </h1>
          <p className="text-xs text-slate-400">Last updated: {updatedLabel}</p>
          <p className="mt-2 text-sm text-slate-400">
            Models in snapshot: {modelCountLabel}
          </p>
        </div>

        <DiagnosticsBanner errors={diagnostics.errors} />
      </header>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Leaderboard</h2>
          <p className="text-xs text-slate-400">
            Order follows rankings.json (no sorting applied)
          </p>
        </div>

        {rankings.length ? (
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-surface/70 shadow">
            <div className="grid grid-cols-10 gap-2 bg-slate-900/80 px-4 py-3 text-[0.7rem] font-semibold uppercase tracking-wide text-slate-400">
              <span>#</span>
              <span className="col-span-3">Model</span>
              <span className="col-span-2">Vendor</span>
              <span className="col-span-1">Layer</span>
              <span className="col-span-1 text-right">Total</span>
              {V4_SCORE_ITEMS.slice(0, 2).map((item) => (
                <span key={item.key} className="col-span-1 text-right">
                  {item.label}
                </span>
              ))}
            </div>
            {rankings.map((entry, index) => {
              const meta = models[entry.model];
              const displayName = meta?.name ?? entry.model;
              const displayVendor = meta?.vendor ?? entry.vendor;
              return (
                <LeaderboardRow
                  key={`${entry.model}-${index}`}
                  entry={entry}
                  index={index}
                  displayName={displayName}
                  displayVendor={displayVendor}
                />
              );
            })}
          </div>
        ) : (
          <p className="rounded-2xl border border-slate-800 bg-surface/70 px-4 py-3 text-sm text-slate-400">
            No ranking data available yet.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-100">Not-listed models</h2>
        {notListed.length ? (
          <div className="space-y-3">
            {notListed.map((entry) => (
              <div
                key={entry.id}
                className="rounded-2xl border border-slate-800 bg-surface/70 px-4 py-3 text-sm text-slate-200"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-50">
                      {models[entry.id]?.name ?? entry.id}
                    </p>
                    <p className="text-xs text-slate-400">
                      {models[entry.id]?.vendor ?? "Unknown vendor"}
                    </p>
                  </div>
                  <Link
                    href={`/dev/v4/${encodeURIComponent(entry.id)}`}
                    className="text-xs font-semibold text-accent hover:text-accent/80"
                  >
                    View detail →
                  </Link>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  Reason: {entry.reason ?? "No reason provided"}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-slate-800 bg-surface/70 px-4 py-3 text-sm text-slate-400">
            No not-listed models found.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-100">Diagnostics</h2>
        <div className="rounded-2xl border border-slate-800 bg-surface/70 px-4 py-4 text-sm text-slate-300">
          <ul className="space-y-1">
            <li>
              index.json: {diagnostics.files.index.ok ? "loaded" : "error"}
              {diagnostics.files.index.error
                ? ` (${diagnostics.files.index.error})`
                : ""}
            </li>
            <li>
              rankings.json: {diagnostics.files.rankings.ok ? "loaded" : "error"}
              {diagnostics.files.rankings.error
                ? ` (${diagnostics.files.rankings.error})`
                : ""}
            </li>
            <li>
              models.json: {diagnostics.files.models.ok ? "loaded" : "error"}
              {diagnostics.files.models.error
                ? ` (${diagnostics.files.models.error})`
                : ""}
            </li>
            <li>
              not-listed.json: {diagnostics.files.notListed.ok ? "loaded" : "error"}
              {diagnostics.files.notListed.error
                ? ` (${diagnostics.files.notListed.error})`
                : ""}
            </li>
          </ul>
          <div className="mt-4 grid gap-2 text-xs text-slate-400 sm:grid-cols-3">
            <div>Rankings count: {rankings.length}</div>
            <div>Models count: {Object.keys(models).length}</div>
            <div>Not-listed count: {notListed.length}</div>
          </div>
          {diagnostics.errors.length ? (
            <div className="mt-4 text-xs text-slate-400">
              <p className="font-semibold text-slate-300">Errors captured</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {diagnostics.errors.slice(0, 5).map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
              {diagnostics.errors.length > 5 ? (
                <p className="mt-2">…and {diagnostics.errors.length - 5} more</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
