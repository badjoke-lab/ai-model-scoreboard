import Link from "next/link";

import { formatKeyLabel, formatMetricValue } from "@/lib/v4/explainability";
import { pickEvidenceUrl } from "@/lib/v4/evidenceLink";
import { getDefaultRule, getFormula } from "@/lib/v4/formulas";
import { checkVerifiableScore } from "@/lib/v4/verifiable-score";
import type { Missing } from "@/types/v4";

export type BreakdownEvidence = {
  type?: string;
  status?: string;
  refs?: string[];
  extracted?: {
    url?: string;
  };
  link?: string;
  url?: string;
};

export type FullBreakdownItem = {
  key: string;
  id?: string;
  label: string;
  score: number | null;
  status?: string;
  inputs: Array<[string, string]>;
  inputMissing?: Missing | null;
  reason: string;
  why: string | null;
  usedEvidence: BreakdownEvidence[];
  specMissingEvidence: boolean;
};

type FullBreakdownTableProps = {
  items: FullBreakdownItem[];
  emptyMessage: string;
};

function formatScore(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "—";
  return value.toFixed(0);
}

function formatEvidenceLabel(item: BreakdownEvidence): string {
  const typeLabel = item.type ? formatKeyLabel(item.type) : "Evidence";
  const statusLabel = item.status ? ` (${item.status})` : "";
  return `${typeLabel}${statusLabel}:`;
}

function isMissingValue(value: Missing | null | undefined): value is Missing {
  if (!value || typeof value !== "object") return false;
  return (
    "value" in value &&
    "status" in value &&
    "reasons" in value &&
    "refs" in value &&
    value.value === null
  );
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

export default function FullBreakdownTable({ items, emptyMessage }: FullBreakdownTableProps) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-surface/70 p-6 shadow-lg">
      <h2 className="text-lg font-semibold text-slate-100">
        D) Full Breakdown (every item must show score + inputs + used evidence + why)
      </h2>
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-800">
        <table className="min-w-full divide-y divide-slate-800 text-sm text-slate-200">
          <thead className="bg-slate-950/40 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left">Item</th>
              <th className="px-4 py-3 text-left">Score</th>
              <th className="px-4 py-3 text-left">Input</th>
              <th className="px-4 py-3 text-left">Evidence</th>
              <th className="px-4 py-3 text-left">Formula</th>
              <th className="px-4 py-3 text-left">Default rule</th>
              <th className="px-4 py-3 text-left">Why</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {items.length ? (
              items.map((item) => (
                <tr key={item.key} className="align-top">
                  <td className="px-4 py-3 font-semibold text-slate-100">{item.label}</td>
                  <td className="px-4 py-3">
                    {(() => {
                      const verification = checkVerifiableScore({
                        score: item.score,
                        inputs: item.inputs,
                        why: item.why,
                        usedEvidence: item.usedEvidence,
                      });
                      const showScore =
                        typeof item.score === "number" &&
                        Number.isFinite(item.score) &&
                        verification.isVerifiable;
                      const missingNote =
                        typeof item.score === "number" && !verification.isVerifiable
                          ? `Unverifiable score (spec violation): missing ${verification.missing.join(
                              "/"
                            )}.`
                          : null;
                      return (
                        <div className="space-y-2">
                          <span>{showScore ? formatScore(item.score) : "—"}</span>
                          {missingNote ? (
                            <p className="rounded-md border border-rose-500/60 bg-rose-500/10 px-2 py-1 text-xs text-rose-200">
                              {missingNote}
                            </p>
                          ) : null}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    {item.inputs.length ? (
                      <ul className="space-y-1 text-xs text-slate-300">
                        {item.inputs.map(([key, value]) => (
                          <li key={`${item.key}-${key}`}>
                            {key}={value}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="space-y-2 text-xs text-slate-400">
                        <div>Missing</div>
                        {isMissingValue(item.inputMissing) ? (
                          <div className="space-y-1">
                            <div>status: {item.inputMissing.status}</div>
                            {item.inputMissing.reasons.length ? (
                              <ul className="list-disc space-y-1 pl-4">
                                {item.inputMissing.reasons.slice(0, 3).map((reason) => (
                                  <li key={reason}>{reason}</li>
                                ))}
                              </ul>
                            ) : null}
                            {item.inputMissing.refs.length ? (
                              <ul className="space-y-1">
                                {item.inputMissing.refs.slice(0, 3).map((ref) => (
                                  <li key={ref}>
                                    <a
                                      href={ref}
                                      className="text-accent underline hover:text-accent/80"
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      {ref}
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        ) : (
                          <div>status: missing</div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-300">
                    <div className="space-y-1">
                      {item.usedEvidence.map((evidence, index) => {
                        const url = pickEvidenceUrl(evidence);
                        return (
                          <div key={`${item.key}-evidence-${index}`} className="space-y-1">
                            {url ? (
                              <Link
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="font-semibold text-accent hover:text-accent/80"
                              >
                                {formatEvidenceLabel(evidence)} {url}
                              </Link>
                            ) : (
                              <span>{formatEvidenceLabel(evidence)} No link provided.</span>
                            )}
                            {!url ? (
                              <p className="rounded-md border border-amber-500/60 bg-amber-500/10 px-2 py-1 text-[0.7rem] text-amber-200">
                                Missing evidence link (spec violation).
                              </p>
                            ) : null}
                          </div>
                        );
                      })}
                      {item.specMissingEvidence ? (
                        typeof item.score === "number" && Number.isFinite(item.score) ? (
                          <p className="rounded-md border border-rose-500/60 bg-rose-500/10 px-2 py-1 text-xs text-rose-200">
                            Missing evidence link (spec violation).
                          </p>
                        ) : (
                          <p className="rounded-md border border-amber-500/60 bg-amber-500/10 px-2 py-1 text-xs text-amber-200">
                            Score withheld: required evidence link is missing (expected until evidence is provided).
                          </p>
                        )
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-300">
                    {getFormula(item.id ?? item.key) || "Formula not specified."}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-300">
                    {getDefaultRule(item.id ?? item.key) || "No default rule provided."}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-300">
                    {(() => {
                      const rawWhy =
                        typeof item.why === "string" && item.why.trim()
                          ? item.why.trim()
                          : "No explanation provided.";
                      const truncatedWhy = truncateText(rawWhy, 120);
                      return (
                        <span title={rawWhy}>
                          {truncatedWhy}
                        </span>
                      );
                    })()}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-sm text-slate-400">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Missing or failed evidence inputs trigger fixed penalties per policy. No placeholder states
        are hidden.
      </p>
    </section>
  );
}

export function extractInputs(raw: Record<string, unknown>): Array<[string, string]> {
  const inputs: Array<[string, string]> = [];
  const directInputs = raw.inputs_raw ?? raw.inputs;
  if (typeof directInputs === "object" && directInputs !== null) {
    for (const [key, value] of Object.entries(directInputs)) {
      inputs.push([key, formatMetricValue(value)]);
    }
  }
  const ignoredKeys = new Set([
    "id",
    "key",
    "label",
    "score",
    "status",
    "reason",
    "why",
    "penaltyReason",
    "penaltyReasons",
    "policyImpact",
    "verified",
    "usedEvidence",
    "__specMissingEvidenceLink",
    "inputs",
    "inputs_raw",
    "evidence_urls",
  ]);
  for (const [key, value] of Object.entries(raw)) {
    if (ignoredKeys.has(key)) continue;
    if (value === null || value === undefined) continue;
    if (typeof value === "object") continue;
    inputs.push([key, formatMetricValue(value)]);
  }
  return inputs;
}
