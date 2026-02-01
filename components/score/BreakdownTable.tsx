import Link from "next/link";

import { formatStatusLabel, formatMetricValue } from "@/lib/v4/explainability";

export type BreakdownEvidence = {
  type?: string;
  status?: string;
  link?: string;
};

export type BreakdownItem = {
  key: string;
  label: string;
  impact?: number;
  delta?: number;
  reason: string;
  usedEvidence?: BreakdownEvidence[];
  specMissingEvidence?: boolean;
};

function formatImpact(item: BreakdownItem): string {
  if (typeof item.delta === "number" && Number.isFinite(item.delta)) {
    const sign = item.delta > 0 ? "+" : item.delta < 0 ? "-" : "";
    return `${sign}${formatMetricValue(Math.abs(item.delta))}`;
  }
  if (typeof item.impact === "number" && Number.isFinite(item.impact)) {
    return formatMetricValue(item.impact);
  }
  return "—";
}

export default function BreakdownTable({ items }: { items: BreakdownItem[] }) {
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-surface/70 px-4 py-3 text-sm text-slate-400">
        No breakdown data is available for this model in the current snapshot.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-surface/70 shadow">
      <table className="min-w-full border-separate border-spacing-0 text-left text-sm text-slate-200">
        <thead className="bg-slate-950/50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Item</th>
            <th className="px-4 py-3">Impact</th>
            <th className="px-4 py-3">Reason</th>
            <th className="px-4 py-3">Evidence</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const evidenceEntries = item.usedEvidence ?? [];
            const scoreOk = typeof (item as any).score === "number" && Number.isFinite((item as any).score);
            const evidenceLinks = evidenceEntries.filter(
              (evidence) => typeof evidence.link === "string" && evidence.link.trim()
            );
            const showWarning = scoreOk && (scoreOk && (item.specMissingEvidence || evidenceLinks.length === 0));

            return (
              <tr key={item.key} className="border-t border-slate-800">
                <td className="px-4 py-3 align-top">
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    {item.key}
                  </div>
                  <div className="font-semibold text-slate-50">{item.label}</div>
                </td>
                <td className="px-4 py-3 align-top text-sm text-slate-100">
                  {formatImpact(item)}
                </td>
                <td className="px-4 py-3 align-top text-sm text-slate-200">
                  {item.reason}
                </td>
                <td className="px-4 py-3 align-top text-xs text-slate-300">
                  {!scoreOk ? (
                    <p className="text-xs text-slate-500">Withheld: missing item evidence.</p>
                  ) : evidenceEntries.length ? (
                    <ul className="space-y-1">
                      {evidenceEntries.map((evidence, index) => (
                        <li key={`${item.key}-evidence-${index}`}>
                          {evidence.link ? (
                            <Link
                              href={evidence.link}
                              target="_blank"
                              rel="noreferrer"
                              className="font-semibold text-accent hover:text-accent/80"
                            >
                              [{evidence.type ?? "evidence"}] link
                            </Link>
                          ) : (
                            <span className="text-slate-400">
                              [{evidence.type ?? "evidence"}] link unavailable
                            </span>
                          )}
                          {evidence.status ? (
                            <span className="ml-2 text-[0.65rem] uppercase tracking-wide text-slate-500">
                              {formatStatusLabel(evidence.status)}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500">No evidence links listed.</p>
                  )}
                  {showWarning ? (
                    <p className="mt-2 text-xs font-semibold text-amber-200">
                      Missing evidence link (spec should fail until fixed)
                    </p>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
