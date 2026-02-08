import Link from "next/link";

import { formatKeyLabel, isHttpUrl } from "@/lib/v4/explainability";
import { pickEvidenceUrl } from "@/lib/v4/evidenceLink";
import type { BreakdownItem } from "@/components/score/BreakdownTable";

type EvidenceFileRow = {
  type: string;
  url: string;
  date?: string;
  notes?: string;
};

type UsedEvidenceRow = {
  item: string;
  type: string;
  link?: string;
  status: "ok" | "missing_link";
};

type EvidenceAuditProps = {
  modelKey: string;
  evidenceRaw: unknown | null;
  evidencePath?: string;
  breakdownItems: BreakdownItem[];
  hasScoreItems: boolean;
};

const EVIDENCE_SECTIONS = ["official_page", "dev_activity", "paper", "audit"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isEvidencePayload(value: unknown): value is Record<string, unknown> | unknown[] {
  return isRecord(value) || Array.isArray(value);
}

function getString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function getRefArray(section: Record<string, unknown> | null): unknown[] {
  if (!section) return [];
  const refs =
    section.refs ??
    section.references ??
    section.urls ??
    section.sources ??
    section.links ??
    [];
  return Array.isArray(refs) ? refs : [];
}

function extractEvidenceFileRows(raw: unknown): EvidenceFileRow[] {
  if (!isEvidencePayload(raw)) return [];
  const rows: EvidenceFileRow[] = [];
  const seen = new Set<string>();
  const metaUpdatedAt =
    isRecord(raw) && isRecord(raw.meta) ? getString(raw.meta.updatedAt) : undefined;

  const evidenceItemsSource = isRecord(raw)
    ? raw.evidenceItems ?? raw.items ?? raw.evidence
    : raw;
  const evidenceItems = Array.isArray(evidenceItemsSource) ? evidenceItemsSource : [];

  const addRow = (row: EvidenceFileRow) => {
    const trimmedUrl = row.url.trim();
    if (!trimmedUrl || seen.has(trimmedUrl)) return;
    seen.add(trimmedUrl);
    rows.push({ ...row, url: trimmedUrl });
  };

  for (const sectionKey of EVIDENCE_SECTIONS) {
    const sectionValue = isRecord(raw) ? raw[sectionKey] : null;
    const section = isRecord(sectionValue) ? sectionValue : null;
    const refs = getRefArray(section);
    for (const entry of refs) {
      if (typeof entry === "string") {
        addRow({ type: formatKeyLabel(sectionKey), url: entry });
        continue;
      }
      if (!isRecord(entry)) continue;
      const url =
        getString(entry.url) ??
        getString(entry.link) ??
        getString(entry.href) ??
        getString(entry.source);
      if (!url) continue;
      const type =
        getString(entry.type) ??
        getString(entry.kind) ??
        getString(entry.label) ??
        formatKeyLabel(sectionKey);
      const date =
        getString(entry.date) ??
        getString(entry.updatedAt) ??
        getString(entry.updated_at) ??
        getString(entry.publishedAt) ??
        getString(entry.lastUpdated);
      const notes =
        getString(entry.notes) ??
        getString(entry.note) ??
        getString(entry.summary) ??
        getString(entry.details) ??
        getString(entry.comment);

      addRow({ type, url, date, notes });
    }

    const matchingItems = evidenceItems.filter(
      (entry) => isRecord(entry) && getString(entry.type) === sectionKey
    );
    for (const item of matchingItems) {
      if (!isRecord(item)) continue;
      const itemRefs = getRefArray(item);
      for (const entry of itemRefs) {
        if (typeof entry === "string") {
          addRow({
            type: formatKeyLabel(sectionKey),
            url: entry,
            date: getString(item.updatedAt) ?? getString(item.updated_at) ?? metaUpdatedAt,
            notes: getString(item.summary) ?? getString(item.notes),
          });
          continue;
        }
        if (!isRecord(entry)) continue;
        const url =
          getString(entry.url) ??
          getString(entry.link) ??
          getString(entry.href) ??
          getString(entry.source);
        if (!url) continue;
        const type =
          getString(entry.type) ??
          getString(entry.kind) ??
          getString(entry.label) ??
          formatKeyLabel(sectionKey);
        const date =
          getString(entry.date) ??
          getString(entry.updatedAt) ??
          getString(entry.updated_at) ??
          getString(item.updatedAt) ??
          getString(item.updated_at) ??
          metaUpdatedAt;
        const notes =
          getString(entry.notes) ??
          getString(entry.note) ??
          getString(entry.summary) ??
          getString(entry.details) ??
          getString(item.summary) ??
          getString(item.notes);
        addRow({ type, url, date, notes });
      }
    }
  }

  return rows;
}

function extractUsedEvidenceRows(items: BreakdownItem[]): UsedEvidenceRow[] {
  const rows: UsedEvidenceRow[] = [];
  for (const item of items) {
    const itemLabel = item.label ? `${item.key} · ${item.label}` : item.key;
    const evidenceEntries = Array.isArray(item.usedEvidence) ? item.usedEvidence : [];
    let hasMissingRow = false;
    for (const evidence of evidenceEntries) {
      const link = pickEvidenceUrl(evidence) ?? undefined;
      const type =
        getString(evidence.type) ??
        getString((evidence as Record<string, unknown>).kind) ??
        "unknown";
      const status = link ? "ok" : "missing_link";
      if (status === "missing_link") hasMissingRow = true;
      rows.push({
        item: itemLabel,
        type,
        link,
        status,
      });
    }

    if (item.specMissingEvidence && !hasMissingRow) {
      rows.push({
        item: itemLabel,
        type: "unknown",
        status: "missing_link",
      });
    }
  }

  return rows;
}

export default function EvidenceAudit({
  modelKey,
  evidenceRaw,
  evidencePath,
  breakdownItems,
  hasScoreItems,
}: EvidenceAuditProps) {
  const evidenceFileRows = extractEvidenceFileRows(evidenceRaw);
  const usedEvidenceRows = extractUsedEvidenceRows(breakdownItems);
  const usedEvidenceLinks = usedEvidenceRows
    .map((row) => row.link)
    .filter((link): link is string => typeof link === "string" && link.trim().length > 0);
  const evidenceFileUrls = evidenceFileRows.map((row) => row.url);
  const totalUniqueUrls = Array.from(
    new Set(
      [...evidenceFileUrls, ...usedEvidenceLinks].map((url) => url.trim()).filter(Boolean)
    )
  );
  const evidenceFileCount = evidenceFileRows.length;
  const usedEvidenceCount = usedEvidenceLinks.length;
  const expectedPath = `public/data/v4/evidence/${modelKey}.json`;
  const triedPath = evidencePath ? `public/data/v4/${evidencePath}` : "Unknown";
  const evidenceFileInvalid = !isEvidencePayload(evidenceRaw);

  return (
    <section id="evidence-audit" className="space-y-4 scroll-mt-24">
      <div className="space-y-2">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Evidence audit</h2>
          <p className="text-xs text-slate-400">
            All sources referenced by this model&apos;s score.
          </p>
        </div>
        <div className="text-xs text-slate-400">
          <p>Evidence file refs: {evidenceFileCount}</p>
          <p>UsedEvidence links: {usedEvidenceCount}</p>
          <p>Total unique URLs: {totalUniqueUrls.length}</p>
        </div>
      </div>

      {evidenceFileInvalid ? (
        <div className="space-y-1 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <p className="font-semibold">Evidence file missing or invalid.</p>
          <p>Expected: {expectedPath}</p>
          <p>Tried: {triedPath}</p>
        </div>
      ) : null}

      {!hasScoreItems ? (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Score breakdown items are missing or invalid. The scoring evidence table is empty.
        </div>
      ) : null}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-200">From evidence file</h3>
        <div className="rounded-2xl border border-slate-800 bg-surface/70 shadow">
          <table className="w-full table-auto border-separate border-spacing-0 text-left text-xs text-slate-200">
            <thead className="bg-slate-950/50 text-[0.65rem] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Source URL</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {evidenceFileRows.length ? (
                evidenceFileRows.map((row, index) => (
                  <tr key={`${row.url}-${index}`} className="border-t border-slate-800">
                    <td className="px-4 py-3 align-top text-slate-300">{row.type}</td>
                    <td className="px-4 py-3 align-top text-slate-200">
                      {isHttpUrl(row.url) ? (
                        <Link
                          href={row.url}
                          target="_blank"
                          rel="noreferrer"
                          className="break-all font-semibold text-accent hover:text-accent/80"
                        >
                          {row.url}
                        </Link>
                      ) : (
                        <span className="break-all text-slate-300">{row.url}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-slate-300">
                      {row.date ?? "—"}
                    </td>
                    <td className="px-4 py-3 align-top text-slate-300">
                      <span className="break-words">{row.notes ?? "—"}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr className="border-t border-slate-800">
                  <td className="px-4 py-3 text-slate-500" colSpan={4}>
                    No evidence file references were found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-200">From scoring items</h3>
        <div className="rounded-2xl border border-slate-800 bg-surface/70 shadow">
          <table className="w-full table-auto border-separate border-spacing-0 text-left text-xs text-slate-200">
            <thead className="bg-slate-950/50 text-[0.65rem] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Evidence type</th>
                <th className="px-4 py-3">Link</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {usedEvidenceRows.length ? (
                usedEvidenceRows.map((row, index) => (
                  <tr key={`${row.item}-${index}`} className="border-t border-slate-800">
                    <td className="px-4 py-3 align-top text-slate-300">{row.item}</td>
                    <td className="px-4 py-3 align-top text-slate-300">{row.type}</td>
                    <td className="px-4 py-3 align-top text-slate-200">
                      {row.link ? (
                        isHttpUrl(row.link) ? (
                          <Link
                            href={row.link}
                            target="_blank"
                            rel="noreferrer"
                            className="break-all font-semibold text-accent hover:text-accent/80"
                          >
                            {row.link}
                          </Link>
                        ) : (
                          <span className="break-all text-slate-300">{row.link}</span>
                        )
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-slate-300">{row.status}</td>
                  </tr>
                ))
              ) : (
                <tr className="border-t border-slate-800">
                  <td className="px-4 py-3 text-slate-500" colSpan={4}>
                    No scoring-item evidence links were found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
