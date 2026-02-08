import type { AbsVal, AbsoluteBlock, Missing } from "@/types/v4";

type AbsoluteMetricsProps = {
  absolute: AbsoluteBlock;
};

const FIELD_LABELS: Array<{ key: keyof AbsoluteBlock; label: string }> = [
  { key: "modelKey", label: "Model key" },
  { key: "displayName", label: "Display name" },
  { key: "provider", label: "Provider" },
  { key: "canonicalSlug", label: "Canonical slug" },
  { key: "contextLength", label: "Context length" },
  { key: "maxOutputTokens", label: "Max output tokens" },
  { key: "pricingInputPer1M", label: "Pricing input per 1M" },
  { key: "pricingOutputPer1M", label: "Pricing output per 1M" },
  { key: "modalities", label: "Modalities" },
  { key: "supportsTools", label: "Supports tools" },
  { key: "supportsJson", label: "Supports JSON" },
  { key: "releaseDate", label: "Release date" },
  { key: "trainingCutoff", label: "Training cutoff" },
];

const isMissingValue = (value: AbsVal): value is Missing => {
  if (!value || typeof value !== "object") return false;
  return (
    "value" in value &&
    "status" in value &&
    "reasons" in value &&
    "refs" in value &&
    (value as Missing).value === null
  );
};

const formatValue = (value: AbsVal): string => {
  if (isMissingValue(value)) {
    return "Missing";
  }
  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : "Missing";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? `${value}` : "Missing";
  }
  if (typeof value === "string") {
    return value.trim() ? value : "Missing";
  }
  return "Missing";
};

export default function AbsoluteMetrics({ absolute }: AbsoluteMetricsProps) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-surface/70 p-6 shadow-lg">
      <h2 className="text-lg font-semibold text-slate-100">
        A) Absolute Metrics (must exist for all models)
      </h2>
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-800">
        <table className="min-w-full divide-y divide-slate-800 text-sm text-slate-200">
          <tbody className="divide-y divide-slate-800">
            {FIELD_LABELS.map(({ key, label }) => {
              const value = absolute[key];
              const missing = isMissingValue(value) ? value : null;
              return (
                <tr key={key}>
                  <td className="w-1/2 px-4 py-3 font-semibold text-slate-100">{label}</td>
                  <td className="px-4 py-3">
                    <div>{formatValue(value)}</div>
                    {missing ? (
                      <div className="mt-2 space-y-1 text-xs text-slate-400">
                        <div>status: {missing.status}</div>
                        {missing.reasons.length ? (
                          <ul className="list-disc space-y-1 pl-4">
                            {missing.reasons.slice(0, 3).map((reason) => (
                              <li key={reason}>{reason}</li>
                            ))}
                          </ul>
                        ) : null}
                        {missing.refs.length ? (
                          <ul className="space-y-1">
                            {missing.refs.slice(0, 3).map((ref) => (
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
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
