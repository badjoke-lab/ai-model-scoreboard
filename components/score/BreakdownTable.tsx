import Link from "next/link";

import { formatStatusLabel, formatMetricValue } from "@/lib/v4/explainability";
import { pickEvidenceUrl } from "@/lib/v4/evidenceLink";
import { normalizeReasons } from "@/lib/v4/reasons";
import { normalizeStatus } from "@/lib/v4/status";

export type BreakdownEvidence = {
  type?: string;
  status?: string;
  reasons?: string[];
  link?: string;
  url?: string;
  refs?: string[];
  extracted?: unknown;
};

export type BreakdownItem = {
  key: string;
  label: string;
  impact?: number;
  delta?: number;
  reason: string;
  usedEvidence?: BreakdownEvidence[];
  specMissingEvidence?: boolean;
  penaltyReasons?: string[];
  penaltyReason?: string;
  withheld?: boolean;
  withheldReason?: string;
  withheldReasons?: string[];
};

function getPenaltyReasons(item: BreakdownItem): string[] {
  const reasons = Array.isArray(item.penaltyReasons)
    ? item.penaltyReasons.filter((reason) => typeof reason === "string" && reason.trim())
    : [];
  if (reasons.length) return reasons;
  if (typeof item.penaltyReason === "string" && item.penaltyReason.trim()) {
    return [item.penaltyReason.trim()];
  }
  return [];
}

function getWithheldReasons(item: BreakdownItem): string[] {
  if (Array.isArray(item.withheldReasons)) {
    return item.withheldReasons.filter((reason) => typeof reason === "string" && reason.trim());
  }
  if (typeof item.withheldReason === "string" && item.withheldReason.trim()) {
    return [item.withheldReason.trim()];
  }
  return [];
}

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
            const scoreOk =
              typeof (item as any).score === "number" && Number.isFinite((item as any).score);
            const evidenceLinks = evidenceEntries
              .map((evidence) => pickEvidenceUrl(evidence))
              .filter((link): link is string => typeof link === "string" && !!link.trim());
            const showWarning =
              scoreOk && (scoreOk && (item.specMissingEvidence || evidenceLinks.length === 0));
            const penaltyReasons = getPenaltyReasons(item);
            const withheldReasons = getWithheldReasons(item);
            const specChecks: string[] = [];
            if (item.specMissingEvidence) {
              specChecks.push(
                "spec_missing_evidence: score exists but no verifiable URL is present"
              );
            }
            if (item.withheld) {
              specChecks.push("withheld: evidence or data withheld");
            }
            const detailEvidenceEntries = evidenceEntries.length
              ? evidenceEntries
              : [{ type: "evidence" as const }];

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
                      {evidenceEntries.map((evidence, index) => {
                        const url = pickEvidenceUrl(evidence);
                        return (
                          <li key={`${item.key}-evidence-${index}`}>
                            {url ? (
                              <Link
                                href={url}
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
                            {!url ? (
                              <p className="mt-1 text-[0.7rem] font-semibold text-amber-200">
                                Missing evidence link (spec violation).
                              </p>
                            ) : null}
                            {evidence.status ? (
                              <span className="ml-2 text-[0.65rem] uppercase tracking-wide text-slate-500">
                                {formatStatusLabel(evidence.status)}
                              </span>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500">No evidence links listed.</p>
                  )}
                  {showWarning ? (
                    <p className="mt-2 text-xs font-semibold text-amber-200">
                      Missing evidence link (spec should fail until fixed)
                    </p>
                  ) : null}
                  <details className="mt-3 rounded-md border border-slate-800 bg-slate-950/50 p-2 text-xs">
                    <summary className="cursor-pointer font-semibold text-slate-100">
                      Details
                    </summary>
                    <div className="mt-3 space-y-4 text-xs text-slate-200">
                      <section className="space-y-2">
                        <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">
                          Evidence status
                        </div>
                        <div className="space-y-3">
                          {detailEvidenceEntries.map((evidence, index) => {
                            const url = pickEvidenceUrl(evidence);
                            const status = normalizeStatus(evidence.status, "evidence");
                            const reasons = normalizeReasons(evidence.reasons).slice(0, 5);
                            return (
                              <div
                                key={`${item.key}-details-evidence-${index}`}
                                className="space-y-1 rounded-md border border-slate-800/60 bg-slate-900/40 p-2"
                              >
                                {detailEvidenceEntries.length > 1 ? (
                                  <div className="text-[0.65rem] uppercase tracking-wide text-slate-500">
                                    Evidence {index + 1}
                                  </div>
                                ) : null}
                                <div>
                                  Status: <span className="font-mono">{status}</span>
                                </div>
                                <div>URL: {url ? "present" : "missing"}</div>
                                <div className="space-y-1">
                                  <div>Reasons:</div>
                                  <ul className="list-disc space-y-1 pl-4">
                                    {reasons.map((reason) => (
                                      <li key={reason}>{reason}</li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                      <section className="space-y-2">
                        <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">
                          Penalty
                        </div>
                        {penaltyReasons.length ? (
                          <div className="space-y-1">
                            <div>Penalty: present</div>
                            <div className="space-y-1">
                              <div>Penalty reasons:</div>
                              <ul className="list-disc space-y-1 pl-4">
                                {penaltyReasons.slice(0, 5).map((reason) => (
                                  <li key={reason}>{reason}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        ) : (
                          <div>Penalty: none</div>
                        )}
                      </section>
                      <section className="space-y-2">
                        <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">
                          Spec checks
                        </div>
                        {specChecks.length ? (
                          <div className="space-y-2">
                            <ul className="list-disc space-y-1 pl-4">
                              {specChecks.map((check) => (
                                <li key={check}>{check}</li>
                              ))}
                            </ul>
                            {withheldReasons.length ? (
                              <div className="space-y-1">
                                <div>Withheld reasons:</div>
                                <ul className="list-disc space-y-1 pl-4">
                                  {withheldReasons.slice(0, 5).map((reason) => (
                                    <li key={reason}>{reason}</li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div>Spec checks: none</div>
                        )}
                      </section>
                    </div>
                  </details>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
