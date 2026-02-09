import Link from "next/link";

import { pickEvidenceUrl } from "@/lib/v4/evidenceLink";
import { formatKeyLabel, formatMetricValue } from "@/lib/v4/explainability";
import { getItemDefaultEn, getItemFormulaEn } from "@/lib/v4/formulas";
import { normalizeReasons, normalizeStatus } from "@/lib/v4/status";
import { checkVerifiableScore } from "@/lib/v4/verifiable-score";
import type { Missing } from "@/types/v4";

export type BreakdownEvidence = {
  type?: string;
  status?: string;
  reasons?: string[];
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
  penaltyReasons?: string[];
  penaltyReason?: string;
  withheld?: boolean;
  withheldReason?: string;
  withheldReasons?: string[];
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
  const statusLabel = item.status ? ` (${normalizeStatus(item.status, "breakdown")})` : " (missing)";
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

function getFormulaText(itemId: string): string {
  return getItemFormulaEn(itemId) || "—";
}

function getDefaultText(itemId: string): string {
  return getItemDefaultEn(itemId) || "—";
}

function normalizeWhy1Line(input: any): { short: string; full: string } {
  const raw = input === null || input === undefined ? "" : String(input);
  const full = raw.replace(/\r\n|\n|\r/g, " ").replace(/\s+/g, " ").trim();
  const short = full.length > 120 ? `${full.slice(0, 120)}…` : full;
  return { short, full };
}

function getPenaltyReasons(item: FullBreakdownItem): string[] {
  const reasons = Array.isArray(item.penaltyReasons)
    ? item.penaltyReasons.filter((reason) => typeof reason === "string" && reason.trim())
    : [];
  if (reasons.length) return reasons;
  if (typeof item.penaltyReason === "string" && item.penaltyReason.trim()) {
    return [item.penaltyReason.trim()];
  }
  return [];
}

function getWithheldReasons(item: FullBreakdownItem): string[] {
  if (Array.isArray(item.withheldReasons)) {
    return item.withheldReasons.filter((reason) => typeof reason === "string" && reason.trim());
  }
  if (typeof item.withheldReason === "string" && item.withheldReason.trim()) {
    return [item.withheldReason.trim()];
  }
  return [];
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
              <th className="px-4 py-3 text-left">Explanation</th>
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
                            <div>
                              status:{" "}
                              <span className="font-mono">
                                {normalizeStatus(item.inputMissing.status, "breakdown")}
                              </span>
                            </div>
                            {normalizeReasons(item.inputMissing.reasons).length ? (
                              <ul className="list-disc space-y-1 pl-4">
                                {normalizeReasons(item.inputMissing.reasons)
                                  .slice(0, 3)
                                  .map((reason) => (
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
                          <div>
                            status:{" "}
                            <span className="font-mono">
                              {normalizeStatus(null, "breakdown")}
                            </span>
                          </div>
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
                    <details className="mt-3 rounded-md border border-slate-800 bg-slate-950/50 p-2 text-xs">
                      <summary className="cursor-pointer font-semibold text-slate-100">
                        Details
                      </summary>
                      {(() => {
                        const evidenceEntries = item.usedEvidence.length
                          ? item.usedEvidence
                          : [{ type: "evidence" as const }];
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
                        return (
                          <div className="mt-3 space-y-4 text-xs text-slate-200">
                            <section className="space-y-2">
                              <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">
                                Evidence status
                              </div>
                              <div className="space-y-3">
                                {evidenceEntries.map((evidence, index) => {
                                  const url = pickEvidenceUrl(evidence);
                                  const status = normalizeStatus(
                                    evidence.status,
                                    "evidence"
                                  );
                                  const reasons = normalizeReasons(evidence.reasons).slice(0, 5);
                                  return (
                                    <div
                                      key={`${item.key}-details-evidence-${index}`}
                                      className="space-y-1 rounded-md border border-slate-800/60 bg-slate-900/40 p-2"
                                    >
                                      {evidenceEntries.length > 1 ? (
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
                        );
                      })()}
                    </details>
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {(() => {
                      const itemId = item.id ?? "";
                      const formulaText = getFormulaText(itemId);
                      const defaultText = getDefaultText(itemId);
                      const whyText = normalizeWhy1Line(item.why);
                      const renderValue = (value: string) =>
                        value === "—" ? (
                          <span className="font-mono opacity-60">{value}</span>
                        ) : (
                          <span>{value}</span>
                        );
                      const whyValue =
                        whyText.short || whyText.full
                          ? whyText.short
                          : "—";
                      return (
                        <div className="space-y-3">
                          <div>
                            <div className="text-xs font-mono opacity-70">Formula</div>
                            <div className="text-sm break-words">{renderValue(formulaText)}</div>
                          </div>
                          <div>
                            <div className="text-xs font-mono opacity-70">Default</div>
                            <div className="text-sm break-words">{renderValue(defaultText)}</div>
                          </div>
                          <div>
                            <div className="text-xs font-mono opacity-70">Why</div>
                            <div className="text-sm break-words">
                              <span
                                className="block overflow-hidden text-ellipsis whitespace-nowrap"
                                title={whyText.full || undefined}
                              >
                                {renderValue(whyValue)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-sm text-slate-400">
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

export function extractInputs(raw: Record<string, any>): Array<[string, string]> {
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
