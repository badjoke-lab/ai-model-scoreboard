import {
  formatEvidenceStatus,
  formatMetricOrMissing,
  type AbsoluteMetricRow,
} from "@/components/model/AbsoluteMetrics";
import { formatReasonList } from "@/lib/v4/deriveReasons";
import {
  buildEvidenceBlocks,
  dedupeUrls,
  formatKeyLabel,
  isHttpUrl,
  toEnglishReason,
} from "@/lib/v4/explainability";
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
import type {
  V4ModelDetailBreakdownItem,
  V4ModelDetailResponse,
} from "@/types/v4";

type EvidenceImpactKey = "official_page" | "dev_activity" | "paper" | "audit";

const REQUIRED_EVIDENCE: Record<string, string[]> = evidencePolicy;

function formatUpdatedDate(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractAbsoluteMetrics(
  modelRow: Record<string, unknown> | null
): Record<string, unknown> {
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
  metrics: Record<string, unknown>,
  keys: string[],
  fallback?: unknown
): unknown {
  for (const key of keys) {
    const value = metrics[key];
    if (value !== null && value !== undefined && value !== "") {
      return value;
    }
  }
  return fallback;
}

function formatPricing(pricing?: { input?: number; output?: number; currency?: string }): string {
  if (!pricing) return "Missing";
  const currency = pricing.currency ?? "USD";
  const input = typeof pricing.input === "number" ? pricing.input : null;
  const output = typeof pricing.output === "number" ? pricing.output : null;
  if (input === null && output === null) return "Missing";
  const inputLabel = input !== null ? `${input.toFixed(2)}` : "—";
  const outputLabel = output !== null ? `${output.toFixed(2)}` : "—";
  return `in: ${currency} ${inputLabel}   out: ${currency} ${outputLabel}`;
}

function formatSupportFlag(value: unknown): string {
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "string" && value.trim()) return value.trim();
  return "Missing";
}

function buildAbsoluteMetricRows(
  detail: {
    context?: number;
    pricing?: { input?: number; output?: number; currency?: string };
    type?: string;
    released?: string;
  },
  metrics: Record<string, unknown>,
  evidenceStatus?: string
): AbsoluteMetricRow[] {
  const contextLength = formatMetricOrMissing(
    pickMetric(
      metrics,
      ["context_length", "context_window", "max_context_length", "contextLength"],
      detail.context
    ),
    "Missing context length => affects score: performance signals reduced."
  );
  const maxOutputTokens = formatMetricOrMissing(
    pickMetric(metrics, ["max_output_tokens", "max_output", "maxOutputTokens"]),
    "Missing max output tokens => affects score: performance signals reduced."
  );
  const pricing = formatMetricOrMissing(
    pickMetric(metrics, ["pricing", "price"], detail.pricing),
    "Missing pricing => affects score: cost signals reduced.",
    (value) => formatPricing(value as { input?: number; output?: number; currency?: string })
  );
  const modalities = formatMetricOrMissing(
    pickMetric(metrics, ["modalities", "modality"], detail.type),
    "Missing modalities => affects score: modality coverage signals reduced."
  );
  const toolSupport = formatSupportFlag(
    pickMetric(metrics, ["tool_support", "tools", "tooling", "supports_tools"])
  );
  const jsonSupport = formatSupportFlag(
    pickMetric(metrics, ["json_support", "json_mode", "supports_json"])
  );
  const toolJsonValue =
    toolSupport === "Missing" && jsonSupport === "Missing"
      ? "Missing"
      : `tools: ${toolSupport}  json: ${jsonSupport}`;
  const toolJsonNote =
    toolJsonValue === "Missing"
      ? "Missing tool/JSON support => affects score: tooling capability signals reduced."
      : null;

  const trainingCutoffValue = pickMetric(metrics, ["training_cutoff", "training_data_cutoff"]);
  const trainingCutoff = formatMetricOrMissing(
    trainingCutoffValue,
    `Missing training cutoff => affects score: openness signals reduced. ${formatEvidenceStatus(
      evidenceStatus
    )}.`
  );
  const releaseDate = formatMetricOrMissing(
    pickMetric(metrics, ["release_date"], detail.released),
    `Missing release date => affects score: openness signals reduced. ${formatEvidenceStatus(
      evidenceStatus
    )}.`
  );

  return [
    {
      label: "Context length",
      value: contextLength.value,
      note: contextLength.note,
    },
    {
      label: "Max output tokens",
      value: maxOutputTokens.value,
      note: maxOutputTokens.note,
    },
    {
      label: "Pricing (per 1M tokens)",
      value: pricing.value,
      note: pricing.note,
    },
    {
      label: "Modalities",
      value: modalities.value,
      note: modalities.note,
    },
    {
      label: "Tool / JSON support",
      value: toolJsonValue,
      note: toolJsonNote,
    },
    {
      label: "Training cutoff (evidence)",
      value:
        trainingCutoff.value === "Missing"
          ? "Missing"
          : `${trainingCutoff.value} (${formatEvidenceStatus(evidenceStatus)})`,
      note: trainingCutoff.note,
    },
    {
      label: "Release date (evidence)",
      value:
        releaseDate.value === "Missing"
          ? "Missing"
          : `${releaseDate.value} (${formatEvidenceStatus(evidenceStatus)})`,
      note: releaseDate.note,
    },
  ];
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

function hasMeaningfulInputs(inputsRaw: Record<string, unknown> | null): boolean {
  if (!inputsRaw) return false;
  return Object.entries(inputsRaw).some(([key, value]) => {
    if (!key.trim()) return false;
    if (value === null || value === undefined) return false;
    if (typeof value === "string" && !value.trim()) return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
  });
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
      const rawItem = item as Record<string, unknown>;
      const inputsRaw = isObject(item.inputs_raw)
        ? item.inputs_raw
        : isObject(item.inputs)
          ? item.inputs
          : null;
      const evidenceUrls = normalizeEvidenceUrls(item);
      const baseWhy =
        typeof item.why === "string" && item.why.trim()
          ? item.why.trim()
          : toEnglishReason(item);
      const hasInputs = hasMeaningfulInputs(inputsRaw);
      const officialPageOnly =
        evidenceUrls.length > 0 && evidenceUrls.every((url) => officialPageUrls.has(url));
      const officialPageAllowed = OFFICIAL_PAGE_ALLOWED_ITEMS.has(key as ScoreItemKey);
      const effectiveEvidenceUrls =
        officialPageOnly && !officialPageAllowed ? [] : evidenceUrls;
      const hasEvidence =
        effectiveEvidenceUrls.length > 0 && !(officialPageOnly && !officialPageAllowed);
      const hasWhy = typeof baseWhy === "string" && baseWhy.trim().length > 0;
      const missing: string[] = [];
      if (!hasInputs) missing.push("inputs");
      if (!hasEvidence) {
        missing.push(officialPageOnly && !officialPageAllowed ? "evidence (official-page only)" : "evidence");
      }
      if (!hasWhy) missing.push("why");
      const numericScore = typeof item.score === "number" ? item.score : null;
      const shouldWithhold = numericScore !== null && missing.length > 0;
      const withheldWhy = shouldWithhold
        ? `Missing item evidence: score withheld (missing ${missing.join(", ")}).`
        : baseWhy;
      const status = shouldWithhold
        ? "WITHHELD"
        : typeof item.status === "string" && item.status.trim()
          ? item.status
          : "ok";
      const missingEvidenceRule = (REQUIRED_EVIDENCE[item.id ?? key] ?? []).length === 0;

      return {
        key,
        id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : key,
        label: item.label ? item.label : formatKeyLabel(key),
        score: shouldWithhold ? null : numericScore,
        status,
        inputsRaw,
        evidenceUrls: effectiveEvidenceUrls,
        why: withheldWhy,
        usedEvidence: Array.isArray(item.usedEvidence) ? item.usedEvidence : [],
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
  const modelRow = (models[modelKey] ?? null) as Record<string, unknown> | null;
  const { detail, evidenceRaw, evidencePath, index } = await loadV4ModelDetail(modelKey);

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

  const absoluteRows = buildAbsoluteMetricRows(
    detail,
    absoluteMetrics,
    evidenceBlocks.official_page?.status
  );

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

  const sourceLabel =
    typeof modelRow?.source === "string" && modelRow?.source.trim()
      ? modelRow.source
      : detail.layer;

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
    absoluteMetrics: absoluteRows,
    evidenceCards: {
      blocks: evidenceBlocks,
      errorMessage: evidenceErrorMessage,
      impactByKey: evidenceImpact,
      topReasons: topDrivers,
    },
    breakdown: {
      items: breakdownItems,
    },
    references: referenceSections,
  };
}
