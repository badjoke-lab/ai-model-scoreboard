import { formatReasonSentence } from "@/lib/v4/deriveReasons";
import { normalizeReasons } from "@/lib/v4/reasons";
import { normalizeStatus } from "@/lib/v4/status";

export type EvidenceKey = "official_page" | "dev_activity" | "paper" | "audit";

export type EvidenceBlock = {
  key: EvidenceKey;
  status: string;
  reasons: string[];
  refs: string[];
  updatedAt?: string;
  extracted?: any;
};

const REASON_TOKEN_MAP: Record<string, string> = {
  ok: "Evidence is verified and current.",
  found: "Evidence is available and verified.",
  verified: "Evidence is verified and current.",
};

const POSITIVE_STATUSES = new Set(["ok"]);
const NEGATIVE_STATUSES = new Set([
  "not_found",
  "missing",
  "missing_source_link",
  "blocked",
  "rate_limited",
  "ambiguous",
  "invalid",
]);

function isObject(value: any): value is Record<string, any> {
  return typeof value === "object" && value !== null;
}

function normalizeRefEntries(value: any): string[] {
  if (!Array.isArray(value)) return [];
  const refs = value
    .map((entry) => {
      if (typeof entry === "string") return entry.trim();
      if (isObject(entry)) {
        const url =
          typeof entry.url === "string"
            ? entry.url
            : typeof entry.link === "string"
              ? entry.link
              : typeof entry.href === "string"
                ? entry.href
                : undefined;
        return typeof url === "string" ? url.trim() : "";
      }
      return "";
    })
    .filter((entry) => entry);
  return refs;
}

function getString(value: any): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function mapReasonToken(token: string): string {
  const normalized = token.trim();
  if (!normalized) {
    return "No reason provided; score derived from available signals.";
  }
  const mapped = REASON_TOKEN_MAP[normalized];
  if (mapped) return mapped;
  return formatReasonSentence(normalized);
}

export function toEnglishReason(item: {
  reason?: string;
  penaltyReasons?: string[];
  penaltyReason?: string;
}): string {
  const direct = typeof item.reason === "string" ? item.reason.trim() : "";
  if (direct) return direct;

  const reasons = Array.isArray(item.penaltyReasons)
    ? item.penaltyReasons.filter((entry) => typeof entry === "string" && entry.trim())
    : [];
  if (reasons.length) {
    const mapped = reasons.map((reason) => mapReasonToken(reason));
    const joined = mapped.join(" ").trim();
    return joined || "No reason provided; score derived from available signals.";
  }

  if (typeof item.penaltyReason === "string" && item.penaltyReason.trim()) {
    return mapReasonToken(item.penaltyReason);
  }

  return "No reason provided; score derived from available signals.";
}

function normalizeEvidenceBlock(
  key: EvidenceKey,
  source: any,
  fallbackUpdatedAt?: string
): EvidenceBlock {
  if (!isObject(source)) {
    return {
      key,
      status: normalizeStatus("missing", "evidence"),
      reasons: normalizeReasons([]),
      refs: [],
      updatedAt: fallbackUpdatedAt,
    };
  }
  const status = normalizeStatus(
    getString(source.status) ??
      getString(source.state) ??
      getString(source.status_code) ??
      "missing",
    "evidence"
  );
  const reasons = normalizeReasons(
    source.reasons ?? source.reasonCodes ?? source.reason_codes ?? source.reason
  );
  const refs = normalizeRefEntries(
    source.refs ?? source.references ?? source.urls ?? source.sources
  );
  const updatedAt =
    getString(source.updatedAt) ??
    getString(source.updated_at) ??
    fallbackUpdatedAt;
  const extracted = isObject(source.extracted) || Array.isArray(source.extracted)
    ? source.extracted
    : undefined;

  return {
    key,
    status,
    reasons,
    refs,
    updatedAt,
    extracted,
  };
}

export function buildEvidenceBlocks(rawEvidence: any): Record<EvidenceKey, EvidenceBlock> {
  const keys: EvidenceKey[] = ["official_page", "dev_activity", "paper", "audit"];
  if (!isObject(rawEvidence)) {
    return Object.fromEntries(keys.map((key) => [key, normalizeEvidenceBlock(key, null)])) as Record<
      EvidenceKey,
      EvidenceBlock
    >;
  }

  const metaUpdatedAt = isObject(rawEvidence.meta)
    ? getString(rawEvidence.meta.updatedAt)
    : undefined;
  const evidenceItems = Array.isArray(rawEvidence.evidenceItems)
    ? rawEvidence.evidenceItems
    : Array.isArray(rawEvidence.items)
      ? rawEvidence.items
      : Array.isArray(rawEvidence.evidence)
        ? rawEvidence.evidence
        : [];

  return Object.fromEntries(
    keys.map((key) => {
      const directBlock = rawEvidence[key];
      if (isObject(directBlock)) {
        return [key, normalizeEvidenceBlock(key, directBlock, metaUpdatedAt)];
      }
      const item = evidenceItems.find(
        (entry) => isObject(entry) && getString(entry.type) === key
      );
      if (item) {
        return [
          key,
          normalizeEvidenceBlock(
            key,
            {
              status: (item as Record<string, any>).status,
              reasons: (item as Record<string, any>).reasons,
              reasonCodes: (item as Record<string, any>).reasonCodes,
              refs: (item as Record<string, any>).refs,
              extracted: (item as Record<string, any>).extracted,
              updatedAt: (item as Record<string, any>).updatedAt,
            },
            metaUpdatedAt
          ),
        ];
      }
      return [key, normalizeEvidenceBlock(key, null, metaUpdatedAt)];
    })
  ) as Record<EvidenceKey, EvidenceBlock>;
}

export function summarizeEvidenceBlock(block: EvidenceBlock): string {
  if (block.reasons.length) {
    const summary = mapReasonToken(block.reasons[0]);
    return summary || "No evidence details available.";
  }
  const status = block.status.toLowerCase();
  if (POSITIVE_STATUSES.has(status)) {
    return "Evidence found and verified.";
  }
  if (NEGATIVE_STATUSES.has(status)) {
    return "No verified evidence available yet.";
  }
  return "No evidence details available.";
}

function normalizeUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    const normalized = `${parsed.protocol.toLowerCase()}//${parsed.host.toLowerCase()}${parsed.pathname}${parsed.search}${parsed.hash}`;
    return normalized;
  } catch {
    return trimmed.toLowerCase();
  }
}

export function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function dedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const url of urls) {
    const trimmed = url.trim();
    if (!trimmed) continue;
    const key = normalizeUrl(trimmed);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(trimmed);
  }
  return output;
}

export function formatStatusLabel(status?: string): string {
  return normalizeStatus(status, "evidence");
}

export function formatKeyLabel(key: string): string {
  const normalized = key.replace(/[_-]+/g, " ").trim();
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : key;
}

export function orderSpecEntries(metrics: Record<string, any>): Array<[string, any]> {
  const curatedOrder = [
    "parameters",
    "context_length",
    "context_window",
    "max_context_length",
    "training_cutoff",
    "training_data_cutoff",
    "release_date",
  ];
  const entries = Object.entries(metrics);
  const curated = curatedOrder
    .map((key) => entries.find(([entryKey]) => entryKey === key))
    .filter(Boolean) as Array<[string, any]>;
  const remaining = entries
    .filter(([entryKey]) => !curatedOrder.includes(entryKey))
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
  return [...curated, ...remaining];
}

export function formatMetricValue(value: any): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return Number.isFinite(value) ? value.toLocaleString("en-US") : "—";
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "—";
    }
  }
  return String(value);
}

export function truncateJson(value: any, maxLength = 800): string {
  const raw = JSON.stringify(value, null, 2);
  if (!raw) return "";
  if (raw.length <= maxLength) return raw;
  return `${raw.slice(0, maxLength)}\n…`;
}
