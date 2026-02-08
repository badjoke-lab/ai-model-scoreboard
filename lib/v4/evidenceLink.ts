import { isHttpUrl } from "@/lib/v4/explainability";
import type { EvidenceItem } from "@/types/v4";

const URL_KEYS = ["url", "link", "href"];

function extractUrls(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) {
    return value.flatMap((entry) => extractUrls(entry));
  }
  if (typeof value === "object") {
    return URL_KEYS.flatMap((key) => {
      const record = value as Record<string, unknown>;
      const candidate = record[key];
      return typeof candidate === "string" ? [candidate] : [];
    });
  }
  return [];
}

export function pickEvidenceUrl(item: EvidenceItem): string | null {
  const candidates = [
    ...(Array.isArray(item.refs) ? item.refs : []),
    ...extractUrls(item.extracted),
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    if (isHttpUrl(trimmed)) return trimmed;
  }
  return null;
}
