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

type V4RankingEntry = {
  model: string;
  vendor: string;
  layer: string; // "full" | "provisional" | "rejected" などを想定（ゆるめにしておく）
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

async function readJson<T>(fileName: string): Promise<T | null> {
  try {
    const fullPath = path.join(process.cwd(), "public", "data", "v4", fileName);
    const raw = await fs.readFile(fullPath, "utf8");
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error("[scores] Failed to read", fileName, err);
    return null;
  }
}

async function loadSnapshot() {
  const meta = await readJson<V4SnapshotMeta>("index.json");
  const rankings = (await readJson<V4RankingEntry[]>("rankings.json")) ?? [];
  return { meta, rankings };
}

function formatDateLabel(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
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

export default async function ScoresPage() {
  const { meta, rankings } = await loadSnapshot();

  // スナップショットが読めなかったときでも落ちないようにする
  if (!meta) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10 space-y-4">
        <h1 className="text-3xl font-semibold text-slate-50">Leaderboard</h1>
        <p className="text-sm text-slate-400">
          v4 のスコアスナップショットを読み込めませんでした。しばらく待ってから再度アクセスしてください。
        </p>
      </main>
    );
  }

  const sorted = [...rankings].sort((a, b) => b.score - a.score);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 space-y-8">
      {/* ヘッダー */}
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
          AIMS · v4
        </p>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-50 md:text-4xl">
              Leaderboard
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              AMS v4 エンジンが生成した最新スナップショットに基づくランキングです。
              スコアは performance / safety / adoption / openness / cost を統合した値です。
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end">
            <div className="text-xs text-slate-400">
              <div>Snapshot: {meta.version}</div>
              <div>Updated: {formatDateLabel(meta.updatedAt)}</div>
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
              Methodology を読む →
            </Link>
          </div>
        </div>
      </header>

      {/* モバイル用カード表示 */}
      <div className="space-y-3 md:hidden">
        {sorted.map((entry, index) => (
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

      {/* PC 用テーブル表示 */}
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
          {sorted.map((entry, index) => (
            <div
              key={entry.model}
              className="grid grid-cols-9 items-center px-4 py-3 text-sm text-slate-200 hover:bg-surface/80"
            >
              <span className="col-span-1 text-sm font-semibold text-slate-500">
                {index + 1}
              </span>
              <div className="col-span-3">
                <div className="font-semibold text-slate-50">
                  {entry.model}
                </div>
                <div className="text-xs text-slate-500">{entry.vendor}</div>
              </div>
              <div className="col-span-2">
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
