import { formatKeyLabel, formatMetricValue } from "@/lib/v4/explainability";
import { normalizeReasons } from "@/lib/v4/reasons";
import { normalizeStatus } from "@/lib/v4/status";
import type { RawInputsBySource, RawValue, MissingInfo } from "@/types/v4";

type RawInputsPanelProps = {
  rawInputsBySource: RawInputsBySource;
};

const SOURCE_BLOCKS: Array<{ key: keyof RawInputsBySource; title: string }> = [
  { key: "openrouter", title: "From OpenRouter" },
  { key: "huggingface", title: "From Hugging Face" },
  { key: "github", title: "From GitHub" },
  { key: "arxiv", title: "From arXiv" },
  { key: "ops", title: "Ops (speed/reliability)" },
];

function isMissingInfo(value: RawValue): value is MissingInfo {
  if (!value || typeof value !== "object") return false;
  return "status" in value && "reasons" in value && "value" in value && value.value === null;
}

function renderValue(value: RawValue) {
  if (value === null || value === undefined) {
    return <span className="text-xs text-slate-400">missing</span>;
  }

  if (isMissingInfo(value)) {
    const refs = value.refs ?? [];
    const normalizedStatus = normalizeStatus(value.status, "raw");
    const normalizedReasons = normalizeReasons(value.reasons);
    return (
      <div className="space-y-1 text-xs text-slate-300">
        <div>
          status: <span className="font-mono">{normalizedStatus}</span>
        </div>
        {normalizedReasons.length ? (
          <ul className="list-disc space-y-1 pl-4">
            {normalizedReasons.slice(0, 5).map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : null}
        {refs.length ? (
          <ul className="space-y-1">
            {refs.slice(0, 3).map((ref) => (
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
    );
  }

  return <span className="text-sm text-slate-100">{formatMetricValue(value)}</span>;
}

function SourceBlock({ title, data }: { title: string; data: Record<string, RawValue> }) {
  const entries = Object.entries(data ?? {});
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
      <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
      {entries.length ? (
        <div className="mt-3 space-y-3 text-sm">
          {entries.map(([key, value]) => (
            <div key={key} className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {formatKeyLabel(key)}
              </div>
              {renderValue(value)}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-400">No data</p>
      )}
    </div>
  );
}

export default function RawInputsPanel({ rawInputsBySource }: RawInputsPanelProps) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-surface/70 p-6 shadow-lg">
      <h2 className="text-lg font-semibold text-slate-100">
        Raw Inputs (source-by-source)
      </h2>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {SOURCE_BLOCKS.map((block) => (
          <SourceBlock
            key={block.key}
            title={block.title}
            data={rawInputsBySource[block.key]}
          />
        ))}
      </div>
    </section>
  );
}
