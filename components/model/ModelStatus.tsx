import { formatReasonList } from "@/lib/v4/deriveReasons";

type ModelStatusProps = {
  status?: string | null;
  reasons?: string[] | null;
  source?: string | null;
};

function normalizeStatus(value?: string | null): string {
  if (!value) return "Unavailable";
  return value.replace(/[_-]+/g, " ");
}

export default function ModelStatus({ status, reasons, source }: ModelStatusProps) {
  const normalizedReasons = Array.isArray(reasons) ? formatReasonList(reasons) : [];
  return (
    <section className="rounded-2xl border border-slate-800 bg-surface/70 p-6 shadow-lg">
      <h2 className="text-lg font-semibold text-slate-100">Status</h2>
      <p className="mt-2 text-sm text-slate-300">
        {normalizeStatus(status)}
      </p>
      <div className="mt-3 space-y-2">
        <p className="text-sm font-semibold text-slate-200">Reasons (from decisions.json):</p>
        {normalizedReasons.length ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
            {normalizedReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400">No published decision record.</p>
        )}
        {source ? (
          <p className="text-xs uppercase tracking-wide text-slate-500">Source: {source}</p>
        ) : null}
      </div>
    </section>
  );
}
