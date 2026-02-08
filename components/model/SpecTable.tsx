import { formatKeyLabel, formatMetricValue, orderSpecEntries } from "@/lib/v4/explainability";

export default function SpecTable({ metrics }: { metrics: Record<string, any> | null }) {
  const entries = metrics ? orderSpecEntries(metrics) : [];

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-surface/70 shadow">
      <table className="min-w-full border-separate border-spacing-0 text-left text-sm text-slate-200">
        <thead className="bg-slate-950/50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Metric</th>
            <th className="px-4 py-3">Value</th>
          </tr>
        </thead>
        <tbody>
          {entries.length ? (
            entries.map(([key, value]) => {
              const valueLabel = formatMetricValue(value);
              const isMissing = valueLabel === "—";
              return (
                <tr key={key} className="border-t border-slate-800">
                  <td className="px-4 py-3 align-top font-semibold text-slate-50">
                    {formatKeyLabel(key)}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="text-sm text-slate-100">{valueLabel}</div>
                    {isMissing ? (
                      <div className="text-xs text-slate-500">No value provided.</div>
                    ) : null}
                  </td>
                </tr>
              );
            })
          ) : (
            <tr className="border-t border-slate-800">
              <td className="px-4 py-4 text-sm text-slate-400" colSpan={2}>
                No specs are available for this model yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
