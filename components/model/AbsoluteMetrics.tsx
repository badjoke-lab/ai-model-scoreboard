import { formatMetricValue, formatStatusLabel } from "@/lib/v4/explainability";

export type AbsoluteMetricRow = {
  label: string;
  value: string;
  note?: string | null;
};

type AbsoluteMetricsProps = {
  rows: AbsoluteMetricRow[];
};

export default function AbsoluteMetrics({ rows }: AbsoluteMetricsProps) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-surface/70 p-6 shadow-lg">
      <h2 className="text-lg font-semibold text-slate-100">
        A) Absolute Metrics (must exist for all models)
      </h2>
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-800">
        <table className="min-w-full divide-y divide-slate-800 text-sm text-slate-200">
          <tbody className="divide-y divide-slate-800">
            {rows.map((row) => (
              <tr key={row.label}>
                <td className="w-1/2 px-4 py-3 font-semibold text-slate-100">{row.label}</td>
                <td className="px-4 py-3">
                  <div>{row.value}</div>
                  {row.note ? (
                    <div className="mt-1 text-xs text-slate-400">{row.note}</div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function formatEvidenceStatus(status?: string | null): string {
  if (!status) return "status: unavailable";
  const normalized = formatStatusLabel(status);
  if (normalized.toLowerCase() === "unknown") {
    return "status: unavailable";
  }
  return `status: ${normalized}`;
}

export function formatMetricOrMissing(
  value: unknown,
  missingNote: string,
  formatter: (input: unknown) => string = formatMetricValue
): { value: string; note?: string } {
  if (value === null || value === undefined || value === "") {
    return { value: "Missing", note: missingNote };
  }
  const formatted = formatter(value);
  if (!formatted || formatted === "—") {
    return { value: "Missing", note: missingNote };
  }
  return { value: formatted };
}
