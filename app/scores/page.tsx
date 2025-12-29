import fs from "fs/promises";
import path from "path";
import Link from "next/link";

export const dynamic = "force-static";

type V4SnapshotMeta = {
  version: string;
  updatedAt: string;
  modelsCount: number;
  fullCount: number;
  provisionalCount: number;
  notListedCount: number;
};

type V4SnapshotIndex = {
  meta: V4SnapshotMeta;
};

type V4RankingEntry = {
  model: string;
  vendor: string;
  layer: "full" | "provisional" | "rejected" | "not-listed";
  score: number;
  scores: {
    performance: number;
    safety: number;
    adoption: number;
    openness: number;
    cost: number;
  };
  updatedAt: string;
};

async function readJson<T>(fileName: string): Promise<T> {
  const fullPath = path.join(process.cwd(), "public", "data", "v4", fileName);
  const raw = await fs.readFile(fullPath, "utf8");
  return JSON.parse(raw) as T;
}

async function loadSnapshot() {
  try {
    const index = await readJson<V4SnapshotIndex>("index.json");
    const rankings = await readJson<V4RankingEntry[]>("rankings.json");
    return { meta: index.meta, rankings };
  } catch (err) {
    console.error("[scores] Failed to load v4 snapshot", err);
    return { meta: null, rankings: null };
  }
}

function formatUpdatedLabel(iso?: string | null) {
  if (!iso) return "unavailable";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unavailable";
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function validateSnapshot(meta: V4SnapshotMeta, rankings: V4RankingEntry[]) {
  const fatal: string[] = [];
  const warn: string[] = [];
  const seenModels = new Set<string>();

  // meta checks
  if (meta.version !== "v4") {
    fatal.push(`index.json: version must be "v4" (got "${String(meta.version)}")`);
  }
  if (!meta.updatedAt || Number.isNaN(new Date(meta.updatedAt).getTime())) {
    warn.push(`index.json: updatedAt looks invalid (${String(meta.updatedAt)})`);
  }
  if (!isFiniteNumber(meta.modelsCount) || meta.modelsCount < 0) {
    fatal.push(`index.json: modelsCount must be a non-negative number`);
  }

  // rankings checks
  if (!Array.isArray(rankings)) {
    fatal.push(`rankings.json: must be an array`);
  } else {
    if (rankings.length === 0) {
      fatal.push(`rankings.json: empty (0 entries)`);
    }

    if (isFiniteNumber(meta.modelsCount) && meta.modelsCount !== rankings.length) {
      fatal.push(
        `Mismatch: index.modelsCount (${meta.modelsCount}) !== rankings.length (${rankings.length})`
      );
    }

    for (let i = 0; i < rankings.length; i++) {
      const e = rankings[i];
      if (!e || typeof e !== "object") {
        fatal.push(`rankings.json: entry[${i}] is not an object`);
        break;
      }
      if (!e.model || typeof e.model !== "string") {
        fatal.push(`rankings.json: entry[${i}].model is missing/invalid`);
        break;
      }
      if (!e.vendor || typeof e.vendor !== "string") {
        fatal.push(`rankings.json: entry[${i}].vendor is missing/invalid`);
        break;
      }
      if (seenModels.has(e.model)) {
        fatal.push(`rankings.json: duplicate model slug "${e.model}"`);
        break;
      }
      seenModels.add(e.model);
      if (!["full", "provisional", "rejected", "not-listed"].includes(e.layer)) {
        fatal.push(`rankings.json: entry[${i}].layer is invalid`);
        break;
      }
      if (!isFiniteNumber(e.score)) {
        fatal.push(`rankings.json: entry[${i}].score is missing/invalid`);
        break;
      }
      if (!e.scores || typeof e.scores !== "object") {
        fatal.push(`rankings.json: entry[${i}].scores is missing/invalid`);
        break;
      }
      const s = e.scores as Record<string, unknown>;
      for (const k of ["performance", "safety", "adoption", "openness", "cost"] as const) {
        if (!isFiniteNumber(s[k])) {
          fatal.push(`rankings.json: entry[${i}].scores.${k} is missing/invalid`);
          break;
        }
      }
      if (fatal.length) break;
    }

    for (let i = 1; i < rankings.length; i++) {
      const prev = rankings[i - 1];
      const current = rankings[i];
      if (prev.score < current.score) {
        fatal.push(`rankings.json: order must be score desc (index ${i - 1} before ${i})`);
        break;
      }
      if (prev.score === current.score && prev.model.localeCompare(current.model) > 0) {
        fatal.push(
          `rankings.json: tie-breaker must be model slug asc (index ${i - 1} before ${i})`
        );
        break;
      }
    }
  }

  return { fatal, warn };
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

function AlertBox({
  variant,
  title,
  items,
}: {
  variant: "error" | "warn";
  title: string;
  items: string[];
}) {
  if (!items.length) return null;

  const base = "rounded-2xl border px-4 py-3 text-sm shadow-sm";
  const cls =
    variant === "error"
      ? `${base} border-rose-500/30 bg-rose-500/10 text-rose-100`
      : `${base} border-amber-500/30 bg-amber-500/10 text-amber-100`;

  return (
    <div className={cls}>
      <div className="font-semibold">{title}</div>
      <ul className="mt-2 list-disc pl-5 space-y-1 text-[0.85rem]">
        {items.slice(0, 8).map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      {items.length > 8 ? (
        <div className="mt-2 text-xs opacity-80">…and {items.length - 8} more</div>
      ) : null}
    </div>
  );
}

export default async function ScoresPage() {
  const { meta, rankings } = await loadSnapshot();
  const lastUpdatedLabel = formatUpdatedLabel(meta?.updatedAt);

  if (!meta || !rankings) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10 space-y-4">
        <h1 className="text-3xl font-semibold text-slate-50">Leaderboard</h1>
        <p className="text-xs text-slate-400">Last updated: {lastUpdatedLabel}</p>
        <p className="text-sm text-slate-400">
          Failed to load the v4 snapshot. Please try again later.
        </p>
      </main>
    );
  }

  const { fatal, warn } = validateSnapshot(meta, rankings);

  // If broken, do not render leaderboard.
  if (fatal.length) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10 space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
            AIMS · v4
          </p>
          <h1 className="text-3xl font-semibold text-slate-50 md:text-4xl">
            Leaderboard
          </h1>
          <p className="text-xs text-slate-400">Last updated: {lastUpdatedLabel}</p>
          <p className="text-sm text-slate-400">
            Snapshot validation failed, so the leaderboard is temporarily hidden.
            Please check the snapshot generation/copy/commit pipeline.
          </p>
        </header>

        <AlertBox variant="error" title="Validation errors" items={fatal} />
        <AlertBox variant="warn" title="Warnings" items={warn} />

        <div className="text-sm text-slate-400 space-y-2">
          <div>Snapshot: {meta.version}</div>
          <div>Updated: {lastUpdatedLabel}</div>
          <div className="pt-2">
            <Link
              href="/methodology"
              className="text-xs font-medium text-accent hover:text-accent/80"
            >
              Read methodology →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 space-y-8">
      {/* Header */}
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
          AIMS · v4
        </p>

        <div className="space-y-3">
          <AlertBox variant="warn" title="Snapshot warnings" items={warn} />
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-50 md:text-4xl">
              Leaderboard
            </h1>
            <p className="text-xs text-slate-400">Last updated: {lastUpdatedLabel}</p>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Rankings based on the latest snapshot generated by the AMS v4 engine.
              Total is an aggregate of performance / safety / adoption / openness / cost.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end">
            <div className="text-xs text-slate-400">
              <div>Snapshot: {meta.version}</div>
              <div>Updated: {lastUpdatedLabel}</div>
            </div>
            <div className="flex flex-wrap gap-2 text-[0.7rem] text-slate-300">
              <span className="rounded-full border border-slate-700 px-2 py-0.5">
                Models: {meta.modelsCount}
              </span>
              <span className="rounded-full border border-slate-700 px-2 py-0.5">
                Full: {meta.fullCount}
              </span>
              <span className="rounded-full border border-slate-700 px-2 py-0.5">
                Provisional: {meta.provisionalCount}
              </span>
              <span className="rounded-full border border-slate-700 px-2 py-0.5">
                Not listed: {meta.notListedCount}
              </span>
            </div>
            <Link
              href="/methodology"
              className="text-xs font-medium text-accent hover:text-accent/80"
            >
              Read methodology →
            </Link>
          </div>
        </div>
      </header>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {rankings.map((entry, index) => (
          <div
            key={entry.model}
            className="rounded-2xl border border-slate-800 bg-surface/70 p-4 shadow"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-xs text-slate-500">#{index + 1}</div>
                <div className="text-base font-semibold text-slate-50">
                  {entry.model}
                </div>
                <div className="text-xs text-slate-500">{entry.vendor}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">Total</div>
                <div className="text-xl font-semibold text-slate-50">
                  {entry.score.toFixed(1)}
                </div>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <LayerBadge layer={entry.layer} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-400">
              <div>
                <dt className="text-[0.65rem] uppercase">Performance</dt>
                <dd className="font-medium text-slate-200">
                  {entry.scores.performance.toFixed(1)}
                </dd>
              </div>
              <div>
                <dt className="text-[0.65rem] uppercase">Safety</dt>
                <dd className="font-medium text-slate-200">
                  {entry.scores.safety.toFixed(1)}
                </dd>
              </div>
              <div>
                <dt className="text-[0.65rem] uppercase">Adoption</dt>
                <dd className="font-medium text-slate-200">
                  {entry.scores.adoption.toFixed(1)}
                </dd>
              </div>
              <div>
                <dt className="text-[0.65rem] uppercase">Openness</dt>
                <dd className="font-medium text-slate-200">
                  {entry.scores.openness.toFixed(1)}
                </dd>
              </div>
              <div>
                <dt className="text-[0.65rem] uppercase">Cost</dt>
                <dd className="font-medium text-slate-200">
                  {entry.scores.cost.toFixed(1)}
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </div>

      {/* Desktop table (fixed column mapping) */}
      <div className="hidden overflow-hidden rounded-2xl border border-slate-800 bg-surface/70 shadow md:block">
        <div className="grid grid-cols-9 bg-surface px-4 py-3 text-[0.75rem] font-semibold uppercase tracking-wide text-slate-400">
          <span className="col-span-1">#</span>
          <span className="col-span-3">Model</span>
          <span className="col-span-2">Vendor</span>
          <span className="col-span-1">Layer</span>
          <span className="col-span-1 text-right">Total</span>
          <span className="col-span-1 text-right">Perf</span>
          <span className="col-span-1 text-right">Safety</span>
        </div>

        <div className="divide-y divide-slate-800/80">
          {rankings.map((entry, index) => (
            <div
              key={entry.model}
              className="grid grid-cols-9 items-center px-4 py-3 text-sm text-slate-200 hover:bg-surface/80"
            >
              <span className="col-span-1 text-sm font-semibold text-slate-500">
                {index + 1}
              </span>

              <div className="col-span-3">
                <div className="font-semibold text-slate-50">{entry.model}</div>
              </div>

              <div className="col-span-2">
                <div className="text-sm text-slate-200">{entry.vendor}</div>
              </div>

              <div className="col-span-1">
                <LayerBadge layer={entry.layer} />
              </div>

              <span className="col-span-1 text-right font-semibold text-slate-50">
                {entry.score.toFixed(1)}
              </span>
              <span className="col-span-1 text-right text-slate-200">
                {entry.scores.performance.toFixed(1)}
              </span>
              <span className="col-span-1 text-right text-slate-200">
                {entry.scores.safety.toFixed(1)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
