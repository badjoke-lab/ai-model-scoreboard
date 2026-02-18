import type {
  ManualRawInputs,
  RawInputsBySource,
  RawValue,
} from "@/types/v4";

type RawInputsPanelProps = {
  rawInputsBySource: RawInputsBySource;
};

const SOURCE_BLOCKS: Array<{ key: "openrouter" | "huggingface" | "github" | "arxiv" | "ops"; title: string }> = [
  { key: "openrouter", title: "From OpenRouter" },
  { key: "huggingface", title: "From Hugging Face" },
  { key: "github", title: "From GitHub" },
  { key: "arxiv", title: "From arXiv" },
  { key: "ops", title: "Ops (speed/reliability)" },
];

const SENSITIVE_KEY_PARTS = [
  "key",
  "token",
  "secret",
  "password",
  "authorization",
  "bearer",
  "cookie",
];

const MAX_ROWS = 30;
const MAX_JSON_CHARS = 800;

function isSensitiveKey(key: string): boolean {
  const lowered = key.toLowerCase();
  return SENSITIVE_KEY_PARTS.some((part) => lowered.includes(part));
}

function formatRawValue(value: RawValue, masked: boolean): string {
  if (masked) return "***";
  if (value === null) return "null";
  if (value === undefined) return "missing";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    const json = JSON.stringify(value, null, 2);
    if (!json) return "missing";
    return json.length > MAX_JSON_CHARS ? `${json.slice(0, MAX_JSON_CHARS)}…` : json;
  } catch {
    return "unserializable";
  }
}

function SourceBlock({
  title,
  data,
  sourceKey,
}: {
  title: string;
  data: Record<string, RawValue> | null | undefined;
  sourceKey: "openrouter" | "huggingface" | "github" | "arxiv" | "ops";
}) {
  const entries = Object.entries(data ?? {});
  const status = entries.length > 0 ? "ok" : "missing";
  const missingReasons = [`missing_raw_inputs:${sourceKey}`];
  const visibleEntries = entries.slice(0, MAX_ROWS);
  const hiddenCount = Math.max(entries.length - MAX_ROWS, 0);

  return (
    <details
      className="rounded-xl border border-slate-800 bg-slate-950/40 p-4"
      open={sourceKey === "openrouter"}
    >
      <summary className="cursor-pointer text-sm font-semibold text-slate-100">
        {title}
      </summary>
      <div className="mt-3 space-y-3 text-sm text-slate-200">
        <div className="text-xs">
          Status: <span className="font-mono">{status}</span>
        </div>
        {status === "missing" ? (
          <ul className="list-disc space-y-1 pl-5 text-xs font-mono text-slate-300">
            {missingReasons.slice(0, 5).map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : null}
        {status === "ok" ? (
          <div className="overflow-hidden rounded-lg border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/60 text-[11px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="w-1/3 px-3 py-2">Key</th>
                  <th className="px-3 py-2">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/60">
                {visibleEntries.map(([key, value]) => {
                  const masked = isSensitiveKey(key);
                  const formatted = formatRawValue(value, masked);
                  return (
                    <tr key={key} className="align-top">
                      <td className="px-3 py-2 font-mono text-slate-300">{key}</td>
                      <td className="px-3 py-2 whitespace-pre-wrap break-words text-slate-100">
                        {formatted}
                      </td>
                    </tr>
                  );
                })}
                {hiddenCount > 0 ? (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-3 py-2 text-xs italic text-slate-400"
                    >
                      +{hiddenCount} more
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function ManualSourceBlock({ data }: { data: ManualRawInputs }) {
  const entries = Object.entries(data.data);
  return (
    <details className="rounded-xl border border-slate-800 bg-slate-950/40 p-4" open>
      <summary className="cursor-pointer text-sm font-semibold text-slate-100">
        Manual (curated)
      </summary>
      <div className="mt-3 space-y-3 text-sm text-slate-200">
        <div className="text-xs">
          Status: <span className="font-mono">{data.status}</span>
        </div>
        {entries.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/60 text-[11px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="w-1/4 px-3 py-2">Key</th>
                  <th className="w-1/4 px-3 py-2">Value</th>
                  <th className="px-3 py-2">Source URL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/60">
                {entries.map(([key, entry]) => (
                  <tr key={key} className="align-top">
                    <td className="px-3 py-2 font-mono text-slate-300">{key}</td>
                    <td className="px-3 py-2 whitespace-pre-wrap break-words text-slate-100">
                      {String(entry.value)}
                    </td>
                    <td className="px-3 py-2 break-all">
                      <a
                        href={entry.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sky-300 underline-offset-2 hover:underline"
                      >
                        {entry.source_url}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <details className="rounded border border-slate-800 bg-slate-900/50 p-3">
          <summary className="cursor-pointer text-xs font-semibold text-slate-200">
            Missing / invalid reasons ({data.missing.length})
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs font-mono text-slate-300">
            {data.missing.map((item, index) => (
              <li key={`${item.field}-${index}`}>
                {item.field}: {item.reasons.join(", ")}
              </li>
            ))}
          </ul>
        </details>
      </div>
    </details>
  );
}

export default function RawInputsPanel({ rawInputsBySource }: RawInputsPanelProps) {
  return (
    <details className="rounded-2xl border border-slate-800 bg-surface/70 p-6 shadow-lg">
      <summary className="cursor-pointer text-lg font-semibold text-slate-100">
        Raw Inputs
      </summary>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ManualSourceBlock data={rawInputsBySource.manual} />
        {SOURCE_BLOCKS.map((block) => (
          <SourceBlock
            key={block.key}
            title={block.title}
            data={rawInputsBySource[block.key]}
            sourceKey={block.key}
          />
        ))}
      </div>
    </details>
  );
}
