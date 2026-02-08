import { V4_DIMENSIONS } from "@/lib/v4-dimensions";
import {
  CATEGORY_LABELS_EN,
  CATEGORY_ORDER,
  CATEGORY_WEIGHTS,
  type CategoryId,
} from "@/lib/v4/scoringSpec";

type ScoreSummaryProps = {
  overallScore?: number | null;
  categoryScores: Record<string, number>;
  topDrivers: string[];
  detail?: {
    categoryScores?: Record<string, number>;
    scores?: {
      categories?: Record<string, number>;
    };
    categories?: Array<{ id?: string; score?: number }>;
  } | null;
  scoreBreakdown?: {
    categories?: Record<string, number>;
  } | null;
};

function formatScore(value?: number | null): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return value.toFixed(0);
}

function resolveCategoryScore(
  categoryId: CategoryId,
  {
    detail,
    scoreBreakdown,
    categoryScores,
  }: Pick<ScoreSummaryProps, "detail" | "scoreBreakdown" | "categoryScores">
): number {
  const sources: Array<any> = [
    detail?.categoryScores,
    detail?.scores?.categories,
    detail?.categories?.find((c) => c.id === categoryId)?.score,
    scoreBreakdown?.categories,
    categoryScores,
  ];

  for (const source of sources) {
    if (typeof source === "number" && Number.isFinite(source)) return source;
    if (typeof source === "object" && source !== null) {
      const candidate = (source as Record<string, any>)[categoryId];
      if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate;
    }
  }

  return 0;
}

function formatWeight(weight: number): string {
  return weight.toFixed(2);
}

function formatContribution(weight: number, score: number): string {
  return (weight * score).toFixed(2);
}

export default function ScoreSummary({
  overallScore,
  categoryScores,
  topDrivers,
  detail = null,
  scoreBreakdown = null,
}: ScoreSummaryProps) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-surface/70 p-6 shadow-lg">
      <h2 className="text-lg font-semibold text-slate-100">Score Summary</h2>
      <div className="mt-4 grid gap-6 md:grid-cols-[1.2fr_1fr]">
        <div className="space-y-3 text-sm text-slate-200">
          <p className="text-base font-semibold text-slate-100">
            Overall: {formatScore(overallScore)} / 100
          </p>
          <p className="text-xs text-slate-400">Overall = Σ(weight × score)</p>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Category Totals</p>
            <div className="mt-2 overflow-hidden rounded-lg border border-slate-800">
              <table className="min-w-full text-xs text-slate-200">
                <thead className="bg-slate-950/40 text-[0.65rem] uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-3 py-2 text-left">Category</th>
                    <th className="px-3 py-2 text-right">Weight</th>
                    <th className="px-3 py-2 text-right">Score</th>
                    <th className="px-3 py-2 text-right">Contrib</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {CATEGORY_ORDER.map((categoryId) => {
                    const score = resolveCategoryScore(categoryId, {
                      detail,
                      scoreBreakdown,
                      categoryScores,
                    });
                    const weight = CATEGORY_WEIGHTS[categoryId];
                    return (
                      <tr key={categoryId}>
                        <td className="px-3 py-2">{CATEGORY_LABELS_EN[categoryId]}</td>
                        <td className="px-3 py-2 text-right">{formatWeight(weight)}</td>
                        <td className="px-3 py-2 text-right">{formatScore(score)}</td>
                        <td className="px-3 py-2 text-right">
                          {formatContribution(weight, score)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
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
