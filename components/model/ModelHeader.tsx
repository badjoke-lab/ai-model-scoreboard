import Link from "next/link";

type ModelHeaderProps = {
  modelKey: string;
  title: string;
  provider?: string | null;
  source?: string | null;
  overallScore?: number | null;
  updatedAt?: string | null;
};

function formatScore(score?: number | null): string {
  if (typeof score !== "number" || Number.isNaN(score)) return "—";
  return score.toFixed(1);
}

export default function ModelHeader({
  modelKey,
  title,
  provider,
  source,
  overallScore,
  updatedAt,
}: ModelHeaderProps) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-surface/70 p-6 shadow-lg">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <Link href="/v4" className="text-sm font-semibold text-accent hover:text-accent/80">
            ← Back to v4
          </Link>
          <h1 className="text-2xl font-semibold text-slate-50 sm:text-3xl">
            MODEL: {title}
          </h1>
          <div className="flex flex-wrap gap-4 text-sm text-slate-300">
            <span>Provider: {provider ?? "Missing"}</span>
            <span>Source: {source ?? "Missing"}</span>
            <span className="text-slate-400">modelKey: {modelKey}</span>
          </div>
        </div>
        <div className="min-w-[170px] rounded-xl border border-slate-700 bg-background/80 px-4 py-3 text-sm text-slate-200">
          <div className="text-xs uppercase tracking-wide text-slate-400">Overall</div>
          <div className="text-2xl font-semibold text-slate-50">
            {formatScore(overallScore)} / 100
          </div>
          {updatedAt ? (
            <div className="text-xs text-slate-400">Updated {updatedAt}</div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
