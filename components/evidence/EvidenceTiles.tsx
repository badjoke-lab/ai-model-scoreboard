import Link from "next/link";

import {
  type EvidenceBlock,
  isHttpUrl,
  summarizeEvidenceBlock,
  truncateJson,
} from "@/lib/v4/explainability";
import { normalizeReasons, normalizeStatus } from "@/lib/v4/status";

const TILE_TITLES: Record<EvidenceBlock["key"], string> = {
  official_page: "Official page",
  dev_activity: "Development activity",
  paper: "Paper / Technical report",
  audit: "Audit / Security",
};

function formatDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export default function EvidenceTiles({
  blocks,
  missingMessage,
}: {
  blocks: EvidenceBlock[];
  missingMessage?: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {blocks.map((block) => {
        const status = normalizeStatus(block.status, "evidence");
        const reasons = normalizeReasons(block.reasons);
        const summary = missingMessage ?? summarizeEvidenceBlock(block);
        const extractedPreview =
          block.extracted !== undefined ? truncateJson(block.extracted) : null;
        return (
          <div
            key={block.key}
            className="rounded-2xl border border-slate-800/80 bg-surface/80 p-4 shadow"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-100">
                {TILE_TITLES[block.key]}
              </h3>
              <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[0.65rem] text-slate-300">
                <span className="font-mono">{status}</span>
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-300">{summary}</p>
            <p className="mt-1 text-[0.65rem] uppercase tracking-wide text-slate-500">
              Updated {formatDate(block.updatedAt)}
            </p>

            <details className="mt-3 text-xs text-slate-300">
              <summary className="cursor-pointer font-semibold text-slate-200">
                Details
              </summary>
              <div className="mt-2 space-y-3">
                {reasons.length ? (
                  <div>
                    <p className="text-[0.65rem] uppercase tracking-wide text-slate-500">
                      Reasons
                    </p>
                    <ul className="mt-1 space-y-1 text-xs text-slate-300">
                      {reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No reasons listed.</p>
                )}
                {block.refs.length ? (
                  <div>
                    <p className="text-[0.65rem] uppercase tracking-wide text-slate-500">
                      References
                    </p>
                    <ul className="mt-1 space-y-1 text-xs text-slate-300">
                      {block.refs.map((ref) => (
                        <li key={ref}>
                          {isHttpUrl(ref) ? (
                            <Link
                              href={ref}
                              target="_blank"
                              rel="noreferrer"
                              className="font-semibold text-accent hover:text-accent/80"
                            >
                              {ref}
                            </Link>
                          ) : (
                            <span className="text-slate-400">{ref}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No references listed.</p>
                )}
                {extractedPreview ? (
                  <details>
                    <summary className="cursor-pointer text-[0.65rem] uppercase tracking-wide text-slate-500">
                      Extracted
                    </summary>
                    <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-[0.65rem] text-slate-200">
                      {extractedPreview}
                    </pre>
                  </details>
                ) : null}
              </div>
            </details>
          </div>
        );
      })}
    </div>
  );
}
