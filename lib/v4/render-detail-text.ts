import type { V4ModelDetailResponse } from "@/types/v4";

export type ModelDetail = V4ModelDetailResponse;

const EVIDENCE_KEYS = ["official_page", "dev_activity", "paper", "audit"] as const;
const RAW_SOURCE_KEYS = ["openrouter", "huggingface", "github", "arxiv", "ops"] as const;

function section(title: string, lines: string[]): string {
  return [`## ${title}`, ...lines, ""].join("\n");
}

function toInline(value: unknown): string {
  if (value === null || value === undefined) return "missing";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function pickEvidenceUrl(block: {
  refs?: string[];
  extracted?: unknown;
}): string {
  const extractedUrl =
    block.extracted &&
    typeof block.extracted === "object" &&
    "url" in block.extracted &&
    typeof (block.extracted as { url?: unknown }).url === "string"
      ? (block.extracted as { url: string }).url
      : null;

  const refs = Array.isArray(block.refs) ? block.refs.filter((v): v is string => typeof v === "string" && !!v) : [];
  const urls = extractedUrl ? [extractedUrl, ...refs] : refs;
  return urls[0] ?? "No link provided";
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

export function renderModelDetailText(detail: ModelDetail): string {
  const header = detail.header;

  const absoluteDisplayName = detail.absolute?.displayName;
  const displayName =
    absoluteDisplayName && typeof absoluteDisplayName === "object" && "value" in absoluteDisplayName
      ? absoluteDisplayName.value ?? ""
      : absoluteDisplayName ?? header.title ?? "";

  const modelLines = [
    `provider: ${header.provider ?? ""}`,
    `displayName: ${displayName}`,
    `modelKey: ${detail.modelKey ?? ""}`,
  ];

  const overallLines = [
    `overallScore: ${header.overallScore ?? ""}`,
    `categoryScores: ${JSON.stringify(header.categoryScores ?? {})}`,
  ];

  const evidenceLines: string[] = [];
  for (const key of EVIDENCE_KEYS) {
    const block = detail.evidenceCards?.blocks?.[key] ?? {};
    const reasons = Array.isArray(block.reasons)
      ? block.reasons.slice(0, 5).map((reason) => String(reason))
      : [];

    evidenceLines.push(`- ${key}`);
    evidenceLines.push(`  status: ${block.status ?? "missing"}`);
    evidenceLines.push(`  reasons: ${reasons.length ? reasons.join(" | ") : "missing"}`);
    evidenceLines.push(`  url: ${pickEvidenceUrl(block)}`);
  }

  const rawLines: string[] = [];
  for (const source of RAW_SOURCE_KEYS) {
    const sourceObj = detail.rawInputsBySource?.[source];
    if (!sourceObj || typeof sourceObj !== "object") {
      rawLines.push(`- ${source}`);
      rawLines.push("  status: missing");
      rawLines.push("  data: missing");
      continue;
    }

    const entries = Object.entries(sourceObj).sort(([a], [b]) => a.localeCompare(b));
    const statusValue = (sourceObj as Record<string, unknown>).status;
    rawLines.push(`- ${source}`);
    rawLines.push(`  status: ${statusValue !== undefined ? toInline(statusValue) : "present"}`);
    if (!entries.length) {
      rawLines.push("  data: missing");
      continue;
    }
    for (const [k, v] of entries) {
      rawLines.push(`  ${k}: ${toInline(v)}`);
    }
  }

  const breakdownLines: string[] = [];
  for (const item of detail.breakdown?.items ?? []) {
    const id = item.id ?? item.key;
    const flags: string[] = [];
    if (item.status) flags.push(item.status);
    if (item.specMissingEvidence) flags.push("specMissingEvidence");
    if (item.missingEvidenceRule) flags.push("missingEvidenceRule");
    const flagsLabel = flags.length ? flags.join(",") : "none";
    breakdownLines.push(
      `- ${id}: ${item.label} | score=${item.score ?? "null"} | flags=${flagsLabel}`
    );
  }

  if (!breakdownLines.length) {
    breakdownLines.push("missing");
  }

  const aggregatedLinks = dedupe([
    ...(detail.links ?? []),
    ...EVIDENCE_KEYS.flatMap((key) => {
      const block = detail.evidenceCards?.blocks?.[key];
      if (!block) return [];
      const extractedUrl =
        block.extracted &&
        typeof block.extracted === "object" &&
        "url" in block.extracted &&
        typeof (block.extracted as { url?: unknown }).url === "string"
          ? [(block.extracted as { url: string }).url]
          : [];
      return [...(block.refs ?? []), ...extractedUrl];
    }),
    ...(detail.references ?? []).flatMap((entry) => entry.urls ?? []),
    ...(detail.breakdown?.items ?? []).flatMap((item) => item.evidenceUrls ?? []),
  ]).sort((a, b) => a.localeCompare(b));

  const linkLines = aggregatedLinks.length
    ? aggregatedLinks.map((url) => `- ${url}`)
    : ["- No link provided"];

  return [
    section("Model", modelLines),
    section("Overall", overallLines),
    section("Evidence", evidenceLines),
    section("Raw Inputs", rawLines),
    section("Breakdown", breakdownLines),
    section("Links", linkLines),
  ].join("\n");
}
