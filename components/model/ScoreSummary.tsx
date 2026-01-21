import { V4_DIMENSIONS } from "@/lib/v4-dimensions";

type ScoreSummaryProps = {
  overallScore?: number | null;
  categoryScores: Record<string, number>;
  topDrivers: string[];
};

function formatScore(value?: number | null): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return value.toFixed(0);
}

export default function ScoreSummary({
  overallScore,
  categoryScores,
  topDrivers,
}: ScoreSummaryProps) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-surface/70 p-6 shadow-lg">
      <h2 className="text-lg font-semibold text-slate-100">Score Summary</h2>
      <div className="mt-4 grid gap-6 md:grid-cols-[1.2fr_1fr]">
        <div className="space-y-3 text-sm text-slate-200">
          <p className="text-base font-semibold text-slate-100">
            Overall: {formatScore(overallScore)} / 100
          </p>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Category Scores (0–100)
            </p>
            <ul className="mt-2 space-y-1">
              {V4_DIMENSIONS.map((dimension) => (
                <li key={dimension.key} className="flex items-center justify-between">
                  <span>{dimension.label.toLowerCase()}</span>
                  <span className="font-semibold">
                    {formatScore(categoryScores[dimension.key])}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-800 pt-4 text-sm text-slate-200 md:border-l md:border-t-0 md:pl-6 md:pt-0">
          <p className="text-xs uppercase tracking-wide text-slate-400">Top drivers</p>
          {topDrivers.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {topDrivers.map((driver) => (
                <li key={driver}>{driver}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-400">
              No score driver details were available.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
