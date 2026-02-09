import { promises as fs } from "fs";
import path from "path";

import { formatReasonList } from "@/lib/v4/deriveReasons";
import { pickEvidenceUrl } from "@/lib/v4/evidenceLink";
import {
  buildEvidenceBlocks,
  dedupeUrls,
  formatKeyLabel,
  isHttpUrl,
  toEnglishReason,
} from "@/lib/v4/explainability";
import { normalizeReasons, normalizeStatus } from "@/lib/v4/status";
import evidencePolicy from "@/lib/v4/evidence-policy.json";
import {
  OFFICIAL_PAGE_ALLOWED_ITEMS,
  type ScoreItemKey,
} from "@/lib/v4/score-item-policy";
import {
  loadV4ModelDetail,
  loadV4SnapshotWithDiagnostics,
  type V4ScoreItem,
} from "@/lib/v4-snapshot";
import {
  loadModelOverride,
  type EvidenceOverride,
  type ModelOverride,
} from "@/lib/v4/overrides";
import type {
  AbsVal,
  AbsoluteBlock,
  AdoptionBlock,
  EvidenceItem,
  Missing,
  RawInputsBySource,
  RawValue,
  V4EvidenceKey,
  V4EvidenceStatus,
  V4ModelDetailBreakdownItem,
  V4ModelDetailResponse,
} from "@/types/v4";

type EvidenceImpactKey = "official_page" | "dev_activity" | "paper" | "audit";

const REQUIRED_EVIDENCE: Record<string, string[]> = evidencePolicy;
const REQUIRED_EVIDENCE_TYPES: V4EvidenceKey[] = [
  "official_page",
  "dev_activity",
  "paper",
  "audit",
];
const ADOPTION_STATUSES = new Set<AdoptionBlock["status"]>([
  "adopted",
  "provisional",
  "denied",
]);
const ADOPTION_SOURCES = new Set<AdoptionBlock["source"]>([
  "decisions",
  "openrouter",
  "seed",
]);
function formatUpdatedDate(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
  });
}

function isObject(value: any): value is Record<string, any> {
  return typeof value === "object" && value !== null;
}

export function missing(
  status: Missing["status"],
  reasons: string[],
  refs: string[] = []
): Missing {
  return {
    value: null,
    status: normalizeStatus(status, "breakdown"),
    reasons: normalizeReasons(reasons),
    refs,
  };
}

function extractAbsoluteMetrics(
  modelRow: Record<string, any> | null
): Record<string, any> {
  if (!modelRow) return {};
  const direct = modelRow.absoluteMetrics;
  if (isObject(direct)) return direct;
  const identity = modelRow.identity;
  if (isObject(identity) && isObject(identity.absoluteMetrics)) {
    return identity.absoluteMetrics;
  }
  return {};
}

function pickMetric(
  metrics: Record<string, any>,
  keys: string[],
  fallback?: any
): any {
  for (const key of keys) {
    const value = metrics[key];
    if (value !== null && value !== undefined && value !== "") {
      return value;
    }
  }
  return fallback;
}

function asString(value: any): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asNumber(value: any): number | null {
  if (typeof value !== "number") return null;
  return Number.isFinite(value) ? value : null;
}

function asBoolean(value: any): boolean | null {
  if (typeof value !== "boolean") return null;
  return value;
}

function isRawScalar(value: any): value is string | number | boolean {
  return (
    typeof value === "string" ||
    (typeof value === "number" && Number.isFinite(value)) ||
    typeof value === "boolean"
  );
}

function normalizeRawInputBlock(value: any): Record<string, RawValue> {
  if (!isObject(value)) return {};
  const output: Record<string, RawValue> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (isRawScalar(entry)) {
      output[key] = entry;
    }
  }
  return output;
}

function addRawValue(
  target: Record<string, RawValue>,
  key: string,
  value: any
): void {
  if (value === null || value === undefined) return;
  if (isRawScalar(value)) {
    target[key] = value;
  }
}

function asStringArray(value: any): string[] | null {
  if (Array.isArray(value)) {
    const trimmed = value
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter(Boolean);
    return trimmed.length ? trimmed : null;
  }
  const single = asString(value);
  return single ? [single] : null;
}

function normalizeEvidenceStatus(value: any): V4EvidenceStatus {
  return normalizeStatus(value, "evidence");
}

function normalizeEvidenceReasons(value: any): string[] {
  return normalizeReasons(value);
}

function normalizeOverrideReasons(value: any): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => typeof entry === "string" && entry.trim())
    .map((entry) => entry.trim());
}

function normalizeEvidenceRefs(value: any): string[] {
  if (!Array.isArray(value)) return [];
  return value
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
    .filter(Boolean);
}

async function readDecisionsFile(): Promise<any | null> {
  try {
    const filePath = path.join(process.cwd(), "public", "data", "v4", "decisions.json");
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as any;
  } catch {
    return null;
  }
}

function normalizeAdoptionReasons(value: any): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((entry) => typeof entry === "string" && entry.trim())
      .map((entry) => entry.trim());
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeAdoptionSource(value: any): AdoptionBlock["source"] {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (ADOPTION_SOURCES.has(normalized as AdoptionBlock["source"])) {
    return normalized as AdoptionBlock["source"];
  }
  return "decisions";
}

function normalizeAdoptionRefs(entry: Record<string, any>): string[] {
  const refs = normalizeEvidenceRefs(
    entry.refs ?? entry.references ?? entry.urls ?? entry.sources ?? entry.source_urls
  );
  const directRef =
    typeof entry.url === "string"
      ? entry.url
      : typeof entry.link === "string"
        ? entry.link
        : typeof entry.href === "string"
          ? entry.href
          : undefined;
  if (directRef && directRef.trim()) {
    refs.unshift(directRef.trim());
  }
  if (isObject(entry.rawRef)) {
    const rawRefs = normalizeEvidenceRefs(
      entry.rawRef.refs ??
        entry.rawRef.references ??
        entry.rawRef.urls ??
        entry.rawRef.sources ??
        entry.rawRef.source_urls
    );
    refs.push(...rawRefs);
    const rawDirect =
      typeof entry.rawRef.url === "string"
        ? entry.rawRef.url
        : typeof entry.rawRef.link === "string"
          ? entry.rawRef.link
          : typeof entry.rawRef.href === "string"
            ? entry.rawRef.href
            : undefined;
    if (rawDirect && rawDirect.trim()) {
      refs.push(rawDirect.trim());
    }
  }
  return dedupeUrls(refs.filter((ref) => isHttpUrl(ref)));
}

function normalizeOverrideEvidenceEntry(entry: EvidenceOverride): EvidenceItem | null {
  const type = typeof entry.type === "string" ? entry.type.trim() : "";
  if (!REQUIRED_EVIDENCE_TYPES.includes(type as V4EvidenceKey)) return null;
  const refs = [
    typeof entry.url === "string" ? entry.url.trim() : "",
    ...(Array.isArray(entry.refs) ? entry.refs : []),
  ]
    .filter((ref) => typeof ref === "string" && ref.trim())
    .map((ref) => ref.trim());
  return {
    type: type as V4EvidenceKey,
    status: normalizeEvidenceStatus(entry.status ?? "ok"),
    reasons: normalizeOverrideReasons(entry.reasons),
    refs: dedupeUrls(refs),
    extracted: entry.extracted,
    label:
      typeof entry.label === "string" && entry.label.trim()
        ? entry.label.trim()
        : formatKeyLabel(type),
  };
}

function findDecisionEntry(
  decisionsData: any,
  modelKey: string
): Record<string, any> | null {
  if (!decisionsData) return null;
  const entries = Array.isArray(decisionsData)
    ? decisionsData
    : isObject(decisionsData) && Array.isArray(decisionsData.decisions)
      ? decisionsData.decisions
      : null;
  if (!entries) return null;
  for (const entry of entries) {
    if (!isObject(entry)) continue;
    const key =
      typeof entry.modelKey === "string"
        ? entry.modelKey
        : typeof entry.key === "string"
          ? entry.key
          : typeof entry.id === "string"
            ? entry.id
            : typeof entry.slug === "string"
              ? entry.slug
              : null;
    if (key === modelKey) return entry;
  }
  return null;
}

function buildAdoptionBlock(
  decisionEntry: Record<string, any> | null
): AdoptionBlock | Missing {
  if (!decisionEntry) {
    return missing("not_found", ["missing_decision_entry"], []);
  }
  const rawStatus =
    typeof decisionEntry.status === "string" ? decisionEntry.status.trim().toLowerCase() : "";
  const reasons = normalizeAdoptionReasons(
    decisionEntry.reasons ??
      decisionEntry.reason ??
      decisionEntry.decision_reason ??
      decisionEntry.decisionReason
  );
  let status: AdoptionBlock["status"] = "denied";
  if (ADOPTION_STATUSES.has(rawStatus as AdoptionBlock["status"])) {
    status = rawStatus as AdoptionBlock["status"];
  } else {
    reasons.push("invalid_decision_status");
  }
  if (!reasons.length) {
    reasons.push("missing_decision_reason");
  }
  return {
    status,
    reasons,
    source: normalizeAdoptionSource(
      decisionEntry.source ?? decisionEntry.decision_source ?? decisionEntry.decisionSource
    ),
    refs: normalizeAdoptionRefs(decisionEntry),
  };
}

function buildMissingEvidenceItem(type: V4EvidenceKey): EvidenceItem {
  return {
    type,
    status: normalizeEvidenceStatus("not_found"),
    reasons: normalizeEvidenceReasons([`missing_evidence_type:${type}`]),
    refs: [],
    label: formatKeyLabel(type),
  };
}

function normalizeEvidenceItem(type: V4EvidenceKey, source: any): EvidenceItem {
  if (!isObject(source)) return buildMissingEvidenceItem(type);
  const refs = normalizeEvidenceRefs(
    source.refs ?? source.references ?? source.urls ?? source.sources
  );
  const directRef =
    typeof source.url === "string"
      ? source.url
      : typeof source.link === "string"
        ? source.link
        : undefined;
  if (directRef && directRef.trim()) {
    refs.unshift(directRef.trim());
  }
  return {
    type,
    status: normalizeEvidenceStatus(
      source.status ?? source.state ?? source.status_code ?? "missing"
    ),
    reasons: normalizeEvidenceReasons(
      source.reasons ?? source.reasonCodes ?? source.reason_codes ?? source.reason
    ),
    refs: dedupeUrls(refs),
    extracted: source.extracted,
    label: typeof source.label === "string" ? source.label : formatKeyLabel(type),
  };
}

function normalizeBaseEvidenceEntry(entry: any): EvidenceItem | null {
  if (!isObject(entry)) return null;
  const type = typeof entry.type === "string" ? entry.type.trim() : "";
  if (!REQUIRED_EVIDENCE_TYPES.includes(type as V4EvidenceKey)) return null;
  return normalizeEvidenceItem(type as V4EvidenceKey, entry);
}

function buildEvidenceMap(
  entries: EvidenceItem[],
  map: Map<V4EvidenceKey, EvidenceItem>
): Map<V4EvidenceKey, EvidenceItem> {
  for (const entry of entries) {
    const existing = map.get(entry.type);
    if (!existing) {
      map.set(entry.type, entry);
      continue;
    }
    if (existing.status !== "ok" && entry.status === "ok") {
      map.set(entry.type, entry);
    }
  }
  return map;
}

function uniqKeepOrder(xs: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const entry of xs) {
    const value = typeof entry === "string" ? entry.trim() : "";
    if (!value) continue;
    if (!isHttpUrl(value)) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function collectBaseLinks(detail: Record<string, any>): string[] {
  const out: string[] = [];
  const candidates = [
    (detail as { links?: any }).links,
    (detail as { link?: any }).link,
    (detail as { urls?: any }).urls,
    (detail as { url?: any }).url,
  ];
  for (const candidate of candidates) {
    const entries = asStringArray(candidate);
    if (entries) out.push(...entries);
  }
  return out;
}

function collectLinksFromEvidenceBlocks(
  evidenceBlocks: ReturnType<typeof buildEvidenceBlocks> | null | undefined
): string[] {
  if (!evidenceBlocks) return [];
  const out: string[] = [];
  for (const block of Object.values(evidenceBlocks)) {
    const refs = (block as { refs?: unknown }).refs;
    if (Array.isArray(refs)) {
      for (const ref of refs) {
        if (typeof ref === "string") out.push(ref);
      }
    }
    const extracted = (block as { extracted?: unknown }).extracted;
    if (isObject(extracted) && typeof extracted.url === "string") {
      out.push(extracted.url);
    }
  }
  return out;
}

function collectLinksFromBreakdownItems(
  items: V4ModelDetailBreakdownItem[] | null | undefined
): string[] {
  if (!Array.isArray(items)) return [];
  const out: string[] = [];
  for (const item of items) {
    if (Array.isArray(item.evidenceUrls)) {
      for (const url of item.evidenceUrls) {
        if (typeof url === "string") out.push(url);
      }
    }
    if (Array.isArray(item.usedEvidence)) {
      for (const evidence of item.usedEvidence) {
        if (typeof evidence?.link === "string") out.push(evidence.link);
        if (typeof evidence?.url === "string") out.push(evidence.url);
        const refs = (evidence as { refs?: unknown }).refs;
        if (Array.isArray(refs)) {
          for (const ref of refs) {
            if (typeof ref === "string") out.push(ref);
          }
        }
      }
    }
  }
  return out;
}

function collectLinksFromReferenceSections(
  references: { urls?: string[] }[] | null | undefined
): string[] {
  if (!Array.isArray(references)) return [];
  const out: string[] = [];
  for (const reference of references) {
    if (Array.isArray(reference?.urls)) {
      for (const url of reference.urls) {
        if (typeof url === "string") out.push(url);
      }
    }
  }
  return out;
}

function collectLinksFromEvidence(evidenceList: any[] | undefined | null): string[] {
  if (!Array.isArray(evidenceList)) return [];
  const out: string[] = [];
  for (const evidence of evidenceList) {
    const picked = pickEvidenceUrl(evidence);
    if (typeof picked === "string" && isHttpUrl(picked.trim())) {
      out.push(picked.trim());
    }

    const refs = evidence?.refs;
    if (Array.isArray(refs)) {
      for (const ref of refs) {
        if (typeof ref === "string" && isHttpUrl(ref.trim())) {
          out.push(ref.trim());
        }
      }
    }
  }
  return out;
}

function collectLinksFromFullBreakdown(fullBreakdown: any): string[] {
  const out: string[] = [];
  const candidates: any[] = [];

  if (Array.isArray(fullBreakdown)) candidates.push(...fullBreakdown);
  else if (Array.isArray(fullBreakdown?.items)) candidates.push(...fullBreakdown.items);
  else if (Array.isArray(fullBreakdown?.rows)) candidates.push(...fullBreakdown.rows);
  else if (Array.isArray(fullBreakdown?.data)) candidates.push(...fullBreakdown.data);

  for (const item of candidates) {
    out.push(...collectLinksFromEvidence(item?.evidence));
    out.push(...collectLinksFromEvidence(item?.evidences));
    out.push(...collectLinksFromEvidence(item?.references));
    out.push(...collectLinksFromEvidence(item?.usedEvidence));
  }
  return out;
}

function asAbsValue(value: any, field: string): AbsVal {
  if (Array.isArray(value)) {
    const arr = asStringArray(value);
    return arr ?? missing("missing", [`missing_field:${field}`]);
  }
  if (typeof value === "string") {
    const str = asString(value);
    return str ?? missing("missing", [`missing_field:${field}`]);
  }
  if (typeof value === "number") {
    const num = asNumber(value);
    return num ?? missing("missing", [`missing_field:${field}`]);
  }
  if (typeof value === "boolean") {
    const bool = asBoolean(value);
    return bool ?? missing("missing", [`missing_field:${field}`]);
  }
  return missing("missing", [`missing_field:${field}`]);
}

function buildAbsoluteBlock(
  modelKey: string,
  detail: {
    context?: number;
    pricing?: { input?: number; output?: number; currency?: string };
    type?: string;
    released?: string;
    vendor?: string;
    name?: string;
  },
  modelRow: Record<string, any> | null,
  metrics: Record<string, any>
): AbsoluteBlock {
  const displayNameValue =
    asString(modelRow?.name) ?? asString(detail.name) ?? null;
  const providerValue =
    asString(modelRow?.vendor) ?? asString(detail.vendor) ?? null;
  const canonicalSlugValue = asString(modelRow?.slug);
  const contextLengthValue = pickMetric(
    metrics,
    ["context_length", "context_window", "max_context_length", "contextLength"],
    detail.context
  );
  const maxOutputTokensValue = pickMetric(
    metrics,
    ["max_output_tokens", "max_output", "maxOutputTokens"]
  );
  const pricingValue = pickMetric(metrics, ["pricing", "price"], detail.pricing);
  const directInputPrice = pickMetric(metrics, [
    "pricing_input_per_1m",
    "pricingInputPer1M",
    "input_price_per_1m",
    "input_price_per_million",
  ]);
  const directOutputPrice = pickMetric(metrics, [
    "pricing_output_per_1m",
    "pricingOutputPer1M",
    "output_price_per_1m",
    "output_price_per_million",
  ]);
  const pricingInput =
    asNumber(directInputPrice) ??
    (isObject(pricingValue) ? asNumber(pricingValue.input) : null);
  const pricingOutput =
    asNumber(directOutputPrice) ??
    (isObject(pricingValue) ? asNumber(pricingValue.output) : null);
  const modalitiesValue =
    asStringArray(pickMetric(metrics, ["modalities", "modality"])) ??
    asStringArray(modelRow?.modality) ??
    asStringArray(detail.type);
  const supportsToolsValue = pickMetric(metrics, [
    "supports_tools",
    "supportsTools",
    "tool_support",
    "tools",
    "tooling",
  ]);
  const supportsJsonValue = pickMetric(metrics, [
    "supports_json",
    "supportsJson",
    "json_support",
    "json_mode",
  ]);
  const releaseDateValue = pickMetric(metrics, ["release_date", "releaseDate"], detail.released);
  const trainingCutoffValue = pickMetric(metrics, [
    "training_cutoff",
    "training_data_cutoff",
    "trainingCutoff",
  ]);

  return {
    modelKey,
    displayName: displayNameValue
      ? displayNameValue
      : missing("missing", ["missing_field:displayName"]),
    provider: providerValue
      ? providerValue
      : missing("missing", ["missing_field:provider"]),
    canonicalSlug: canonicalSlugValue
      ? canonicalSlugValue
      : missing("missing", ["missing_field:canonicalSlug"]),
    contextLength: asAbsValue(contextLengthValue, "contextLength"),
    maxOutputTokens: asAbsValue(maxOutputTokensValue, "maxOutputTokens"),
    pricingInputPer1M:
      pricingInput !== null
        ? pricingInput
        : missing("missing", ["missing_field:pricingInputPer1M"]),
    pricingOutputPer1M:
      pricingOutput !== null
        ? pricingOutput
        : missing("missing", ["missing_field:pricingOutputPer1M"]),
    modalities: modalitiesValue
      ? modalitiesValue
      : missing("missing", ["missing_field:modalities"]),
    supportsTools: asAbsValue(supportsToolsValue, "supportsTools"),
    supportsJson: asAbsValue(supportsJsonValue, "supportsJson"),
    releaseDate: asAbsValue(releaseDateValue, "releaseDate"),
    trainingCutoff: asAbsValue(trainingCutoffValue, "trainingCutoff"),
  };
}

function buildEvidenceImpactSummary(
  breakdownItems: V4ModelDetailBreakdownItem[]
): Record<EvidenceImpactKey, string> {
  const impact: Record<EvidenceImpactKey, string> = {
    official_page: "No scoring items rely on official-page evidence.",
    dev_activity: "No scoring items rely on dev-activity evidence.",
    paper: "No scoring items rely on paper evidence.",
    audit: "No scoring items rely on audit evidence.",
  };
  const itemsByEvidence: Record<EvidenceImpactKey, V4ModelDetailBreakdownItem[]> = {
    official_page: [],
    dev_activity: [],
    paper: [],
    audit: [],
  };

  breakdownItems.forEach((item) => {
    const required = REQUIRED_EVIDENCE[item.id ?? item.key] ?? [];
    required.forEach((type) => {
      if (type in itemsByEvidence) {
        itemsByEvidence[type as EvidenceImpactKey].push(item);
      }
    });
  });

  (Object.keys(itemsByEvidence) as EvidenceImpactKey[]).forEach((key) => {
    const items = itemsByEvidence[key];
    if (!items.length) return;
    const hasUnverifiable = items.some(
      (item) => item.score === null && item.status === "missing_evidence"
    );
    if (hasUnverifiable) {
      impact[key] = "Unverifiable => item not scored.";
      return;
    }
    const hasMissingInputs = items.some(
      (item) => item.score === null && item.status === "missing_inputs"
    );
    if (hasMissingInputs) {
      impact[key] = "Inputs missing => item not scored.";
      return;
    }
    impact[key] = "Evidence verified => scoring enabled (no penalty applied).";
  });

  return impact;
}

function buildReferenceSections(
  evidenceBlocks: ReturnType<typeof buildEvidenceBlocks>,
  breakdownItems: V4ModelDetailBreakdownItem[]
) {
  const sections = {
    official_page: [] as string[],
    "repo/dev": [] as string[],
    paper: [] as string[],
    audit: [] as string[],
    other: [] as string[],
  };

  const addUrl = (section: keyof typeof sections, url: string) => {
    if (!isHttpUrl(url)) return;
    sections[section].push(url);
  };

  for (const block of Object.values(evidenceBlocks)) {
    const target =
      block.key === "official_page"
        ? "official_page"
        : block.key === "dev_activity"
          ? "repo/dev"
          : block.key === "paper"
            ? "paper"
            : block.key === "audit"
              ? "audit"
              : "other";
    block.refs.forEach((ref) => addUrl(target, ref));
  }

  for (const item of breakdownItems) {
    for (const evidence of item.usedEvidence ?? []) {
      if (!evidence.link) continue;
      const type = evidence.type?.toLowerCase() ?? "";
      if (type.includes("paper")) {
        addUrl("paper", evidence.link);
      } else if (type.includes("audit")) {
        addUrl("audit", evidence.link);
      } else if (type.includes("repo") || type.includes("dev")) {
        addUrl("repo/dev", evidence.link);
      } else if (type.includes("official")) {
        addUrl("official_page", evidence.link);
      } else {
        addUrl("other", evidence.link);
      }
    }
  }

  return [
    { label: "official_page", urls: dedupeUrls(sections.official_page) },
    { label: "repo/dev", urls: dedupeUrls(sections["repo/dev"]) },
    { label: "paper", urls: dedupeUrls(sections.paper) },
    { label: "audit", urls: dedupeUrls(sections.audit) },
    { label: "other", urls: dedupeUrls(sections.other) },
  ];
}

function normalizeEvidenceUrls(item: V4ScoreItem): string[] {
  const urls = new Set<string>();
  if (Array.isArray(item.evidence_urls)) {
    item.evidence_urls.forEach((entry) => {
      if (typeof entry === "string" && isHttpUrl(entry)) {
        urls.add(entry.trim());
      }
    });
  }
  if (Array.isArray(item.usedEvidence)) {
    item.usedEvidence.forEach((entry) => {
      const link = typeof entry.link === "string" ? entry.link.trim() : "";
      const url = typeof entry.url === "string" ? entry.url.trim() : "";
      if (link && isHttpUrl(link)) urls.add(link);
      if (url && isHttpUrl(url)) urls.add(url);
    });
  }
  return Array.from(urls);
}

function hasMeaningfulInputs(inputsRaw: Record<string, any> | null): boolean {
  if (!inputsRaw) return false;
  return Object.entries(inputsRaw).some(([key, value]) => {
    if (!key.trim()) return false;
    if (value === null || value === undefined) return false;
    if (typeof value === "string" && !value.trim()) return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
  });
}

function buildRawInputsBySource(
  detail: {
    context?: number;
    pricing?: { input?: number; output?: number; currency?: string };
    type?: string;
    released?: string;
    enrichment?: { github?: { status?: string; status_code?: string } | null } | null;
  },
  absoluteMetrics: Record<string, any>
): RawInputsBySource {
  const openrouter: Record<string, RawValue> = {};
  const github: Record<string, RawValue> = {};
  const ops: Record<string, RawValue> = {};

  addRawValue(openrouter, "context_length", asNumber(detail.context));
  addRawValue(openrouter, "pricing_input_per_1m", asNumber(detail.pricing?.input));
  addRawValue(openrouter, "pricing_output_per_1m", asNumber(detail.pricing?.output));
  addRawValue(openrouter, "pricing_currency", asString(detail.pricing?.currency));
  addRawValue(openrouter, "modality", asString(detail.type));
  addRawValue(openrouter, "release_date", asString(detail.released));

  const githubSignal = detail.enrichment?.github ?? null;
  if (githubSignal) {
    addRawValue(github, "status", asString(githubSignal.status));
    addRawValue(github, "status_code", asString(githubSignal.status_code));
  }

  addRawValue(
    ops,
    "ttft_ms",
    pickMetric(absoluteMetrics, ["ttft_ms", "ttft", "time_to_first_token_ms"])
  );
  addRawValue(
    ops,
    "tps",
    pickMetric(absoluteMetrics, ["tps", "tokens_per_second", "throughput"])
  );
  addRawValue(
    ops,
    "uptime",
    pickMetric(absoluteMetrics, ["uptime", "availability", "reliability"])
  );
  addRawValue(
    ops,
    "success_rate",
    pickMetric(absoluteMetrics, ["success_rate", "success", "successRate"])
  );

  return {
    openrouter,
    huggingface: {},
    github,
    arxiv: {},
    ops,
  };
}

function getOfficialPageUrlSet(
  evidenceBlocks: Record<string, { refs?: string[] }> | null | undefined
): Set<string> {
  const urls = new Set<string>();
  if (!evidenceBlocks) return urls;
  const refs = evidenceBlocks.official_page?.refs ?? [];
  refs.forEach((entry) => {
    if (typeof entry === "string" && isHttpUrl(entry)) {
      urls.add(entry.trim());
    }
  });
  return urls;
}

function buildBreakdownItems(
  scoreItems?: Record<string, V4ScoreItem>,
  officialPageUrls: Set<string> = new Set()
): V4ModelDetailBreakdownItem[] {
  if (!scoreItems) return [];
  return Object.entries(scoreItems)
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([key, item]) => {
      const rawItem = item as Record<string, any>;
      const inputsRaw = isObject(item.inputs_raw)
        ? item.inputs_raw
        : isObject(item.inputs)
          ? item.inputs
          : null;
      const evidenceUrls = normalizeEvidenceUrls(item);
      const rawWhy =
        typeof item.why === "string" && item.why.trim() ? item.why.trim() : null;
      const derivedWhy = rawWhy ?? toEnglishReason(item);
      const baseWhy =
        typeof derivedWhy === "string" && derivedWhy.trim()
          ? derivedWhy.trim()
          : "No explanation provided.";
      const hasInputs = hasMeaningfulInputs(inputsRaw);
      const inputMissing = hasInputs
        ? null
        : missing("missing", ["missing_field:inputs_raw"]);
      const officialPageOnly =
        evidenceUrls.length > 0 && evidenceUrls.every((url) => officialPageUrls.has(url));
      const officialPageAllowed = OFFICIAL_PAGE_ALLOWED_ITEMS.has(key as ScoreItemKey);
      const effectiveEvidenceUrls =
        officialPageOnly && !officialPageAllowed ? [] : evidenceUrls;
      const hasEvidence =
        effectiveEvidenceUrls.length > 0 && !(officialPageOnly && !officialPageAllowed);
      const hasWhy = typeof baseWhy === "string" && baseWhy.trim().length > 0;
      const missingFields: string[] = [];
      if (!hasInputs) missingFields.push("inputs");
      if (!hasEvidence) {
        missingFields.push(
          officialPageOnly && !officialPageAllowed ? "evidence (official-page only)" : "evidence"
        );
      }
      if (!hasWhy) missingFields.push("why");
      const numericScore = typeof item.score === "number" ? item.score : null;
      const shouldWithhold = numericScore !== null && missingFields.length > 0;
      const withheldWhy = shouldWithhold
        ? `Missing item evidence: score withheld (missing ${missingFields.join(", ")}).`
        : baseWhy;
      const status = shouldWithhold
        ? "WITHHELD"
        : typeof item.status === "string" && item.status.trim()
          ? item.status
          : "ok";
      const missingEvidenceRule = (REQUIRED_EVIDENCE[item.id ?? key] ?? []).length === 0;

      const rawUsedEvidence = Array.isArray(item.usedEvidence) ? item.usedEvidence : [];
      const usedEvidence =
        rawUsedEvidence.length > 0
          ? rawUsedEvidence
          : effectiveEvidenceUrls.length > 0
            ? effectiveEvidenceUrls.map((url) => ({
                type: "evidence",
                status: normalizeEvidenceStatus("ok"),
                link: url,
              }))
            : [
                {
                  type: "evidence",
                  status: normalizeEvidenceStatus("missing"),
                },
              ];

      return {
        key,
        id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : key,
        label: item.label ? item.label : formatKeyLabel(key),
        score: shouldWithhold ? null : numericScore,
        status,
        inputsRaw,
        inputMissing,
        evidenceUrls: effectiveEvidenceUrls,
        why: withheldWhy,
        usedEvidence,
        specMissingEvidence: rawItem.__specMissingEvidenceLink === true,
        missingEvidenceRule,
      };
    });
}

function enforceBreakdownItemIntegrity(
  item: V4ModelDetailBreakdownItem,
  officialPageUrls: Set<string>
): V4ModelDetailBreakdownItem {
  const numericScore = typeof item.score === "number" ? item.score : null;
  if (numericScore === null) {
    return item;
  }
  const hasInputs = hasMeaningfulInputs(
    item.inputsRaw && typeof item.inputsRaw === "object" ? item.inputsRaw : null
  );
  const evidenceUrls = Array.isArray(item.evidenceUrls)
    ? item.evidenceUrls.filter((url) => typeof url === "string" && isHttpUrl(url))
    : [];
  const officialPageOnly =
    evidenceUrls.length > 0 && evidenceUrls.every((url) => officialPageUrls.has(url));
  const officialPageAllowed = OFFICIAL_PAGE_ALLOWED_ITEMS.has(item.key as ScoreItemKey);
  const hasEvidence = evidenceUrls.length > 0 && !(officialPageOnly && !officialPageAllowed);
  const hasWhy = typeof item.why === "string" && item.why.trim().length > 0;
  const missing: string[] = [];
  if (!hasInputs) missing.push("inputs");
  if (!hasEvidence) {
    missing.push(officialPageOnly && !officialPageAllowed ? "evidence (official-page only)" : "evidence");
  }
  if (!hasWhy) missing.push("why");
  if (!missing.length) return item;
  return {
    ...item,
    score: null,
    status: "WITHHELD",
    evidenceUrls: hasEvidence ? evidenceUrls : [],
    usedEvidence: hasEvidence ? item.usedEvidence : [],
    why: `Missing item evidence: score withheld (missing ${missing.join(", ")}).`,
  };
}

export function enforceModelDetailEvidenceIntegrity(
  payload: V4ModelDetailResponse
): V4ModelDetailResponse {
  const officialPageUrls = getOfficialPageUrlSet(payload.evidenceCards?.blocks);
  const items = payload.breakdown?.items ?? [];
  return {
    ...payload,
    breakdown: {
      ...payload.breakdown,
      items: items.map((item) => enforceBreakdownItemIntegrity(item, officialPageUrls)),
    },
  };
}

function deriveTopDrivers(
  breakdownItems: V4ModelDetailBreakdownItem[],
  evidenceBlocks: ReturnType<typeof buildEvidenceBlocks>
): string[] {
  const defaultReason = "No reason provided; score derived from available signals.";
  const reasons = breakdownItems
    .map((item) => item.why)
    .filter((reason) => reason && reason !== defaultReason);
  const evidenceReasons = Object.values(evidenceBlocks).flatMap((block) =>
    formatReasonList(block.reasons)
  );
  const combined = [...reasons, ...evidenceReasons];
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const reason of combined) {
    const normalized = reason.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    deduped.push(normalized);
    if (deduped.length >= 5) break;
  }
  while (deduped.length < 3) {
    deduped.push(
      "Missing or blocked evidence triggers fixed penalties under the v4 scoring policy."
    );
  }
  return deduped.slice(0, 5);
}

export async function getModelDetailPayload(
  modelKey: string
): Promise<V4ModelDetailResponse | null> {
  const snapshot = await loadV4SnapshotWithDiagnostics();
  const models = snapshot.models ?? {};
  const modelRow = (models[modelKey] ?? null) as Record<string, any> | null;
  const { detail, evidenceRaw, evidencePath, index } = await loadV4ModelDetail(modelKey);
  const decisionsData = await readDecisionsFile();

  if (!detail) return null;

  const absoluteMetrics = extractAbsoluteMetrics(modelRow);
  const updatedAt = formatUpdatedDate(index.meta?.updatedAt) ?? null;
  const evidenceBlocks = buildEvidenceBlocks(evidenceRaw);
  const officialPageUrls = getOfficialPageUrlSet(evidenceBlocks);
  const evidenceErrorMessage = detail.evidenceError
    ? `Evidence file issue: ${detail.evidenceError}. Expected path: ${evidencePath}`
    : evidenceRaw
      ? null
      : `Evidence file missing or unreadable. Expected path: ${evidencePath}`;

  const modelScoreItems =
    isObject(modelRow?.scores) && isObject(modelRow.scores.items)
      ? (modelRow.scores.items as Record<string, V4ScoreItem>)
      : undefined;
  const breakdownItems = buildBreakdownItems(
    detail.scoreItems ?? modelScoreItems,
    officialPageUrls
  );
  const topDrivers = deriveTopDrivers(breakdownItems, evidenceBlocks);

  const absolute = buildAbsoluteBlock(modelKey, detail, modelRow, absoluteMetrics);

  const decisionReasons = detail.decisionReasons?.length
    ? detail.decisionReasons
    : detail.decisionReason
      ? detail.decisionReason
          .split(",")
          .map((reason) => reason.trim())
          .filter(Boolean)
      : [];

  const evidenceImpact = buildEvidenceImpactSummary(breakdownItems);
  const referenceSections = buildReferenceSections(evidenceBlocks, breakdownItems);
  const rawInputsBySource = buildRawInputsBySource(detail, absoluteMetrics);
  const baseEvidence = (detail as { evidence?: any }).evidence ?? [];
  let override: ModelOverride | null = null;

  try {
    override = await loadModelOverride(modelKey);
  } catch {
    override = null;
  }

  const overrideEvidence = override?.evidence ?? [];
  const baseEvidenceEntries = Array.isArray(baseEvidence)
    ? baseEvidence
        .map((entry) => normalizeBaseEvidenceEntry(entry))
        .filter((entry): entry is EvidenceItem => Boolean(entry))
    : [];
  const overrideEvidenceEntries = Array.isArray(overrideEvidence)
    ? overrideEvidence
        .map((entry) => normalizeOverrideEvidenceEntry(entry as EvidenceOverride))
        .filter((entry): entry is EvidenceItem => Boolean(entry))
    : [];
  const baseMap = buildEvidenceMap(baseEvidenceEntries, new Map<V4EvidenceKey, EvidenceItem>());
  const overrideMap = buildEvidenceMap(
    overrideEvidenceEntries,
    new Map<V4EvidenceKey, EvidenceItem>()
  );
  const finalEvidence = REQUIRED_EVIDENCE_TYPES.map((type) => {
    const selected =
      overrideMap.get(type) ??
      baseMap.get(type) ?? {
        type,
        status: normalizeEvidenceStatus("not_found"),
        label: type === "audit" ? "Independent third-party security audit" : undefined,
        reasons: normalizeEvidenceReasons([`missing_evidence_type:${type}`]),
        refs: [],
      };
    const reasons = normalizeEvidenceReasons(selected.reasons);
    return {
      ...selected,
      status: normalizeEvidenceStatus(selected.status ?? "missing"),
      reasons,
      refs: Array.isArray(selected.refs) ? selected.refs : [],
    };
  });

  const rawInputsOverride = (detail as { rawInputsBySource?: any }).rawInputsBySource;
  const baseRaw =
    isObject(rawInputsOverride) || rawInputsOverride === undefined
      ? (rawInputsOverride ?? rawInputsBySource)
      : rawInputsBySource;
  const ovRaw = override?.rawInputsBySource ?? {};
  const finalRawInputsBySource: RawInputsBySource = {
    openrouter: {
      ...normalizeRawInputBlock(baseRaw.openrouter),
      ...normalizeRawInputBlock(ovRaw.openrouter),
    },
    huggingface: {
      ...normalizeRawInputBlock(baseRaw.huggingface),
      ...normalizeRawInputBlock(ovRaw.huggingface),
    },
    github: {
      ...normalizeRawInputBlock(baseRaw.github),
      ...normalizeRawInputBlock(ovRaw.github),
    },
    arxiv: {
      ...normalizeRawInputBlock(baseRaw.arxiv),
      ...normalizeRawInputBlock(ovRaw.arxiv),
    },
    ops: {
      ...normalizeRawInputBlock(baseRaw.ops),
      ...normalizeRawInputBlock(ovRaw.ops),
    },
  };

  const overrideLinks = Array.isArray(override?.links) ? override.links : [];
  const evidenceLinks = collectLinksFromEvidence((detail as { evidence?: any }).evidence);
  const evidenceCardLinks = collectLinksFromEvidenceBlocks(evidenceBlocks);
  const breakdownSource =
    (detail as { fullBreakdown?: any }).fullBreakdown ??
    (detail as { scoreItems?: any }).scoreItems ??
    (detail as { breakdown?: any }).breakdown;
  const breakdownLinks = collectLinksFromFullBreakdown(breakdownSource);
  const breakdownItemLinks = collectLinksFromBreakdownItems(breakdownItems);
  const referenceLinks = collectLinksFromReferenceSections(referenceSections);
  const mergedLinks = uniqKeepOrder([
    ...collectBaseLinks(detail),
    ...overrideLinks,
    ...evidenceLinks,
    ...evidenceCardLinks,
    ...breakdownLinks,
    ...breakdownItemLinks,
    ...referenceLinks,
  ]);

  const sourceLabel =
    typeof modelRow?.source === "string" && modelRow?.source.trim()
      ? modelRow.source
      : detail.layer;
  const adoption = buildAdoptionBlock(findDecisionEntry(decisionsData, modelKey));
  return {
    status: "ok",
    modelKey,
    header: {
      title: `${detail.vendor} ${detail.name}`,
      provider: detail.vendor,
      source: sourceLabel,
      overallScore: detail.score,
      categoryScores: detail.scores,
      updatedAt,
      status: detail.status,
      decisionReasons,
      decisionSource: detail.decisionSource ?? null,
    },
    absolute,
    adoption,
    evidence: finalEvidence,
    evidenceCards: {
      blocks: evidenceBlocks,
      errorMessage: evidenceErrorMessage,
      impactByKey: evidenceImpact,
      topReasons: topDrivers,
    },
    breakdown: {
      items: breakdownItems,
    },
    rawInputsBySource: finalRawInputsBySource,
    links: mergedLinks,
    references: referenceSections,
  };
}
