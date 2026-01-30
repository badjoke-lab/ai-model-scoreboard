import Link from "next/link";

import { type EvidenceBlock, formatStatusLabel, truncateJson } from "@/lib/v4/explainability";
import { formatReasonList } from "@/lib/v4/deriveReasons";

type EvidenceCardsProps = {
  blocks: Record<string, EvidenceBlock>;
  errorMessage?: string | null;
  impactByKey?: Record<string, string>;
};

const CARD_TITLES: Record<string, string> = {
  official_page: "Official Page",
  dev_activity: "Dev Activity",
  paper: "Paper",
  audit: "Audit",
};

function formatStatusText(status?: string): string {
  if (!status) return "unavailable";
  const normalized = formatStatusLabel(status);
  return normalized.toLowerCase() === "unknown" ? "unavailable" : normalized;
}

function statusIcon(status?: string): string {
  const normalized = (status ?? "").toLowerCase();
  if (["ok", "found", "verified", "available"].includes(normalized)) return "✅";
  if (normalized.includes("block")) return "⛔";
  if (normalized.includes("not_found") || normalized.includes("missing")) return "⚠️";
  return "⚠️";
}

function impactText(
  key: string,
  status?: string,
  override?: string | null
): string {
  if (override) return override;
  const normalized = (status ?? "").toLowerCase();
  if (["ok", "found", "verified", "available"].includes(normalized)) {
    return "Evidence verified => no penalty applied for this signal.";
  }
  const label = formatStatusText(status);
  const base = `${label} =>`;
  switch (key) {
    case "dev_activity":
      return `${base} dev-activity score capped / penalty applied.`;
    case "paper":
      return `${base} transparency score reduced / penalty applied.`;
    case "audit":
      return `${base} audit and safety scores reduced / penalty applied.`;
    case "official_page":
    default:
      return `${base} openness and transparency scores reduced / penalty applied.`;
  }
}

function renderExtracted(extracted: unknown): string | null {
  if (extracted === null || extracted === undefined) return null;
  if (typeof extracted === "string" && extracted.trim()) return extracted.trim();
  if (typeof extracted === "object") {
    return truncateJson(extracted, 220);
  }
  return String(extracted);
}

export default function EvidenceCards({ blocks, errorMessage, impactByKey }: EvidenceCardsProps) {
  const orderedKeys = ["official_page", "dev_activity", "paper", "audit"];
  return (
    <section className="rounded-2xl border border-slate-800 bg-surface/70 p-6 shadow-lg">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-slate-100">
          C) Evidence (4 tiles/cards; reasons required if not ok)
        </h2>
      </div>
      {errorMessage ? (
        <div className="mt-4 rounded-xl border border-amber-500/60 bg-amber-500/10 p-4 text-sm text-amber-100">
          {errorMessage}
        </div>
      ) : null}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {orderedKeys.map((key) => {
          const block = blocks[key];
          const reasons = block ? formatReasonList(block.reasons) : [];
          const extracted = block ? renderExtracted(block.extracted) : null;
          return (
            <div
              key={key}
              className="rounded-xl border border-slate-800 bg-background/60 p-4 text-sm text-slate-200"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-100">{CARD_TITLES[key]}</h3>
                <span className="text-base">
                  {statusIcon(block?.status)} {formatStatusText(block?.status)}
                </span>
              </div>
              <div className="mt-3 space-y-2 text-xs text-slate-300">
                <div>
                  <span className="uppercase text-[0.65rem] text-slate-400">refs:</span>{" "}
                  {block?.refs?.length ? (
                    <ul className="mt-1 space-y-1">
                      {block.refs.map((ref) => (
                        <li key={ref}>
                          <Link
                            href={ref}
                            className="font-semibold text-accent hover:text-accent/80"
                            target="_blank"
                            rel="noreferrer"
                          >
                            {ref}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No references provided.</p>
                  )}
                </div>
                {extracted ? (
                  <div>
                    <span className="uppercase text-[0.65rem] text-slate-400">extracted:</span>
                    <pre className="mt-1 whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950/40 p-2 text-[0.65rem] text-slate-200">
                      {extracted}
                    </pre>
                  </div>
                ) : null}
                {reasons.length ? (
                  <div>
                    <span className="uppercase text-[0.65rem] text-slate-400">reasons:</span>
                    <ul className="mt-1 list-disc space-y-1 pl-4">
                      {reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div>
                    <span className="uppercase text-[0.65rem] text-slate-400">reasons:</span>
                    <p className="mt-1">No additional reasons provided.</p>
                  </div>
                )}
                <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2 text-[0.7rem] text-slate-200">
                  <span className="uppercase text-[0.65rem] text-slate-400">
                    How this affected scoring
                  </span>
                  <p className="mt-1">
                    {impactText(key, block?.status, impactByKey?.[key] ?? null)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
