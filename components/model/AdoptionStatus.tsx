import { formatReasonList } from "@/lib/v4/deriveReasons";
import type { AdoptionBlock, Missing } from "@/types/v4";

type AdoptionStatusProps = {
  adoption: AdoptionBlock | Missing;
};

function isMissing(value: AdoptionBlock | Missing): value is Missing {
  return "value" in value;
}

function getBadgeClasses(status: string): string {
  switch (status) {
    case "adopted":
      return "border-emerald-400/40 bg-emerald-500/20 text-emerald-100";
    case "provisional":
      return "border-amber-400/40 bg-amber-500/20 text-amber-100";
    case "denied":
      return "border-rose-400/40 bg-rose-500/20 text-rose-100";
    default:
      return "border-slate-500/40 bg-slate-600/30 text-slate-100";
  }
}

export default function AdoptionStatus({ adoption }: AdoptionStatusProps) {
  const missing = isMissing(adoption);
  const statusLabel = missing ? "Missing" : adoption.status;
  const reasons = formatReasonList(adoption.reasons ?? []);
  const refs = adoption.refs ?? [];
  return (
    <section className="rounded-2xl border border-slate-800 bg-surface/70 p-6 shadow-lg">
      <h2 className="text-lg font-semibold text-slate-100">
        Adoption &amp; Decision
      </h2>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${getBadgeClasses(
            statusLabel
          )}`}
        >
          {statusLabel}
        </span>
        {!missing ? (
          <span className="text-xs text-slate-400">
            Source: {adoption.source}
          </span>
        ) : null}
      </div>
      <div className="mt-4 space-y-2">
        <p className="text-sm font-semibold text-slate-200">Reasons:</p>
        {reasons.length ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400">No reasons available.</p>
        )}
        <div className="pt-1 text-xs text-slate-500">
          <span className="font-semibold uppercase tracking-wide">References:</span>{" "}
          {refs.length ? (
            <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-slate-400">
              {refs.map((ref) => (
                <li key={ref}>
                  <a
                    href={ref}
                    className="text-accent hover:text-accent/80"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {ref}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <span>None</span>
          )}
        </div>
      </div>
    </section>
  );
}
