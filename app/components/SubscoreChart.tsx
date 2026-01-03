import type { V4DeltaBreakdown } from "@/types/v4";

interface SubscoreChartProps {
  label: keyof V4DeltaBreakdown;
  score: number;
  delta: number;
}

function formatDelta(value: number): string {
  const fixed = value.toFixed(1);
  if (value > 0) return `+${fixed}`;
  if (value < 0) return fixed;
  return "0.0";
}

export function SubscoreChart({ label, score, delta }: SubscoreChartProps) {
  const labelText = label === "overall" ? "Overall" : label.charAt(0).toUpperCase() + label.slice(1);
  const isPositive = delta >= 0;

  return (
    <div className="rounded-xl border border-slate-800 bg-background/60 p-4">
      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-500">
        <span>{labelText}</span>
        <span className={isPositive ? "text-emerald-400" : "text-rose-400"}>
          {formatDelta(delta)} vs 30d
        </span>
      </div>
      <div className="mt-2 flex items-baseline justify-between">
        <span className="text-3xl font-semibold text-slate-50">{score.toFixed(1)}</span>
        <div className="h-2 flex-1 rounded-full bg-slate-800">
          <div
            className={`h-full rounded-full ${isPositive ? "bg-emerald-500" : "bg-rose-500"}`}
            style={{ width: `${Math.min(Math.max(score, 0), 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
