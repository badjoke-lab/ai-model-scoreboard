import { promises as fs } from "fs";
import path from "path";

import { V4_DIMENSIONS, type V4DimensionKey } from "@/lib/v4-dimensions";
import {
  loadV4Snapshot,
  resolveEvidencePath,
  type V4SnapshotMeta as LoaderSnapshotMeta,
} from "@/lib/v4/loadSnapshot";

export type V4SnapshotMeta = LoaderSnapshotMeta;

export type V4SnapshotFiles = {
  rankings: string;
  models: string;
  notListed: string;
  evidenceIndex: string;
  enrichment: string;
  enrichmentDecisions: string;
  evidenceDir: string;
};

export type V4IndexData = {
  meta: V4SnapshotMeta;
  files?: Partial<V4SnapshotFiles>;
};

export type V4ScoreBreakdown = Record<V4DimensionKey, number>;

type V4RawScoreBreakdown = Record<string, unknown>;

type V4RawScores = {
  overall?: unknown;
  categories?: V4RawScoreBreakdown;
  items?: Record<string, unknown>;
  [key: string]: unknown;
};

export type V4ScoreItemEvidence = {
  type?: string;
  status?: string;
  link?: string;
};

export type V4ScoreItem = {
  label?: string;
  score?: number;
  reason?: string;
  penaltyReasons?: string[];
  penaltyReason?: string;
  __specMissingEvidenceLink?: boolean;
  usedEvidence?: V4ScoreItemEvidence[];
};

type V4RawRankingEntry = {
  model: string;
  vendor: string;
  layer: "full" | "provisional" | "rejected" | "not-listed";
  score: number;
  scores: V4RawScores | V4RawScoreBreakdown;
  updatedAt: string;
};

export type V4RankingEntry = {
  model: string;
  vendor: string;
  layer: "full" | "provisional" | "rejected" | "not-listed";
  score: number;
  scores: {
    overall: number;
    categories: V4ScoreBreakdown;
    items?: Record<string, V4ScoreItem>;
  };
  scoreItems?: Record<string, V4ScoreItem>;
  updatedAt: string;
};

export type V4ModelMetadata = {
  name: string;
  vendor: string;
  released?: string;
  context?: number;
  type?: string;
  pricing?: {
    input?: number;
    output?: number;
    currency?: string;
  };
  layer?: "full" | "provisional" | "rejected" | "not-listed";
  scores?: {
    overall?: number;
    categories?: Record<string, number>;
    items?: Record<string, unknown>;
  };
};

export type V4EnrichmentSignal = {
  status?: string;
  status_code?: string;
};

export type V4EnrichmentEntry = {
  github?: V4EnrichmentSignal | null;
  audit?: V4EnrichmentSignal | null;
};

export type V4EnrichmentSnapshot = Record<string, V4EnrichmentEntry>;

export type V4LeaderboardRow = V4RankingEntry & {
  displayName: string;
  displayVendor: string;
  rank: number;
};

export type V4NotListedEntry =
  | string
  | {
      slug: string;
      reason?: string;
      source?: string;
    };

export type V4EvidenceReference = {
  label?: string;
  url?: string;
  note?: string;
};

export type V4ScoreDetailItem = {
  itemKey: string;
  value: number;
  reasons?: string[];
  evidenceRefs?: V4EvidenceReference[];
};

export type V4EvidenceItem = {
  type: string;
  status?: string;
  reasonCodes?: string[];
  refs?: V4EvidenceReference[];
  summary?: string;
};

export type V4EvidenceSummary = {
  refCount: number;
  refs: V4EvidenceReference[];
  reasonCodes: string[];
  hasEvidence: boolean;
  topReason?: string;
};

export type V4EvidenceSummaryLite = {
  count: number;
  hasEvidence: boolean;
  topReason?: string;
};

export type V4ModelDetail = {
  id: string;
  name: string;
  vendor: string;
  released?: string;
  context?: number;
  type?: string;
  pricing?: {
    input?: number;
    output?: number;
    currency?: string;
  };
  layer: V4RankingEntry["layer"];
  status: "adopted" | "provisional" | "denied";
  decisionReason?: string | null;
  decisionSource?: string | null;
  score: number;
  scores: V4ScoreBreakdown;
  scoreDetails: V4ScoreDetailItem[];
  scoreItems?: Record<string, V4ScoreItem>;
  updatedAt: string;
  enrichment: V4EnrichmentEntry | null;
  evidenceItems: V4EvidenceItem[];
  evidenceSummary: V4EvidenceSummary;
  evidenceError?: string | null;
};

type SnapshotFileStatus = {
  ok: boolean;
  error?: string;
};

export type V4SnapshotDiagnostics = {
  files: {
    index: SnapshotFileStatus;
    rankings: SnapshotFileStatus;
    models: SnapshotFileStatus;
    notListed: SnapshotFileStatus;
    enrichment: SnapshotFileStatus;
    enrichmentDecisions: SnapshotFileStatus;
  };
  errors: string[];
  warnings?: string[];
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeScoreBreakdown(raw: unknown): V4ScoreBreakdown {
  const base = Object.fromEntries(
    V4_DIMENSIONS.map((dimension) => [dimension.key, 0])
  ) as V4ScoreBreakdown;
  if (!isObject(raw)) return base;

  const source = isObject(raw.categories) ? raw.categories : raw;
  if (isObject(source)) {
    for (const dimension of V4_DIMENSIONS) {
      const value = source[dimension.key];
      if (typeof value === "number" && Number.isFinite(value)) {
        base[dimension.key] = value;
      }
    }
  }

  return base;
}

function normalizeSignal(raw: unknown): V4EnrichmentSignal | null {
  if (!isObject(raw)) return null;
  const status =
    typeof raw.status === "string"
      ? raw.status
      : typeof raw.state === "string"
        ? raw.state
        : undefined;
  const statusCode =
    typeof raw.status_code === "string"
      ? raw.status_code
      : typeof raw.statusCode === "string"
        ? raw.statusCode
        : undefined;
  if (!status && !statusCode) return null;
  return {
    status,
    status_code: statusCode,
  };
}

function normalizeEnrichment(raw: unknown): V4EnrichmentSnapshot {
  if (!isObject(raw)) return {};
  const source = isObject(raw.models) ? raw.models : raw;
  if (!isObject(source)) return {};

  const entries: V4EnrichmentSnapshot = {};
  for (const [key, value] of Object.entries(source)) {
    if (!isObject(value)) continue;
    entries[key] = {
      github: normalizeSignal(value.github),
      audit: normalizeSignal(value.audit),
    };
  }
  return entries;
}

async function readJsonFile<T>(filename: string): Promise<T> {
  const filePath = path.join(process.cwd(), "public", "data", "v4", filename);
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

async function readJsonFileSafe<T>(
  filename: string
): Promise<{ data: T | null; error?: string }> {
  try {
    const data = await readJsonFile<T>(filename);
    return { data };
  } catch (err) {
    const message =
      err && typeof err === "object" && "code" in err && err.code === "ENOENT"
        ? `${filename}: missing`
        : `${filename}: ${err instanceof Error ? err.message : String(err)}`;
    return { data: null, error: message };
  }
}

const DEFAULT_FILES: V4SnapshotFiles = {
  rankings: "rankings.json",
  models: "models.json",
  notListed: "not-listed.json",
  evidenceIndex: "evidence/index.json",
  enrichment: "enrichment.json",
  enrichmentDecisions: "enrichment-decisions.json",
  evidenceDir: "evidence",
};

function resolveSnapshotFiles(index: V4IndexData | null): V4SnapshotFiles {
  if (!index?.files) return DEFAULT_FILES;
  return {
    rankings: index.files.rankings ?? DEFAULT_FILES.rankings,
    models: index.files.models ?? DEFAULT_FILES.models,
    notListed: index.files.notListed ?? DEFAULT_FILES.notListed,
    evidenceIndex: index.files.evidenceIndex ?? DEFAULT_FILES.evidenceIndex,
    enrichment: index.files.enrichment ?? DEFAULT_FILES.enrichment,
    enrichmentDecisions:
      index.files.enrichmentDecisions ?? DEFAULT_FILES.enrichmentDecisions,
    evidenceDir: index.files.evidenceDir ?? DEFAULT_FILES.evidenceDir,
  };
}

function parseSnapshotMeta(source: Record<string, unknown>): V4SnapshotMeta {
  return {
    version: typeof source.version === "string" ? source.version : "v4",
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : "",
    modelsCount: typeof source.modelsCount === "number" ? source.modelsCount : 0,
    fullCount: typeof source.fullCount === "number" ? source.fullCount : 0,
    provisionalCount:
      typeof source.provisionalCount === "number" ? source.provisionalCount : 0,
    notListedCount:
      typeof source.notListedCount === "number" ? source.notListedCount : 0,
  };
}

function normalizeIndexData(raw: unknown): V4IndexData | null {
  if (!isObject(raw)) return null;
  const metaSource = isObject(raw.meta) ? raw.meta : raw;
  const meta = parseSnapshotMeta(metaSource);
  const files = isObject(raw.files) ? raw.files : null;
  const manifest = isObject(raw.manifest) ? raw.manifest : null;

  const normalizedFiles: Partial<V4SnapshotFiles> = {
    rankings:
      (files?.rankings as string | undefined) ??
      (manifest?.rankings as string | undefined),
    models:
      (files?.models as string | undefined) ?? (manifest?.models as string | undefined),
    notListed:
      (files?.notListed as string | undefined) ??
      (manifest?.notListed as string | undefined),
    evidenceIndex:
      (files?.evidenceIndex as string | undefined) ??
      (manifest?.evidenceIndex as string | undefined),
    evidenceDir:
      (files?.evidenceDir as string | undefined) ??
      (manifest?.evidence as string | undefined),
    enrichment:
      (files?.enrichment as string | undefined) ??
      (manifest?.enrichment as string | undefined),
    enrichmentDecisions:
      (files?.enrichmentDecisions as string | undefined) ??
      (manifest?.enrichmentDecisions as string | undefined),
  };

  return {
    meta,
    files: Object.values(normalizedFiles).some(Boolean) ? normalizedFiles : undefined,
  };
}

function normalizeNotListedEntry(
  entry: V4NotListedEntry
): { slug: string; reason?: string; source?: string } | null {
  if (typeof entry === "string") {
    return entry.trim() ? { slug: entry } : null;
  }
  if (!isObject(entry)) return null;
  const slug = typeof entry.slug === "string" ? entry.slug : null;
  if (!slug) return null;
  const reason = typeof entry.reason === "string" ? entry.reason : undefined;
  const source = typeof entry.source === "string" ? entry.source : undefined;
  return { slug, reason, source };
}

function parseEvidenceRefString(raw: string): V4EvidenceReference {
  const trimmed = raw.trim();
  if (!trimmed) return { label: raw };

  const lower = trimmed.toLowerCase();
  if (lower.startsWith("arxiv_id:")) {
    const id = trimmed.slice("arxiv_id:".length).trim();
    return {
      label: id ? `arXiv:${id}` : trimmed,
      url: id ? `https://arxiv.org/abs/${id}` : undefined,
    };
  }
  if (lower.startsWith("openrouter_model_page:")) {
    const url = trimmed.slice("openrouter_model_page:".length).trim();
    return { label: "OpenRouter model page", url: url || undefined };
  }
  if (lower.startsWith("github_repo:")) {
    const url = trimmed.slice("github_repo:".length).trim();
    return { label: "GitHub repository", url: url || undefined };
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return { label: trimmed, url: trimmed };
  }

  return { label: trimmed };
}

function normalizeEvidenceRefEntry(entry: unknown): V4EvidenceReference | null {
  if (typeof entry === "string") {
    return parseEvidenceRefString(entry);
  }
  if (!isObject(entry)) return null;
  const label =
    typeof entry.label === "string"
      ? entry.label
      : typeof entry.title === "string"
        ? entry.title
        : typeof entry.name === "string"
          ? entry.name
          : undefined;
  const url = typeof entry.url === "string" ? entry.url : undefined;
  const note =
    typeof entry.note === "string"
      ? entry.note
      : typeof entry.summary === "string"
        ? entry.summary
        : undefined;
  const value =
    typeof entry.value === "string"
      ? entry.value
      : typeof entry.ref === "string"
        ? entry.ref
        : typeof entry.id === "string"
          ? entry.id
          : undefined;

  if (url) {
    return { label, url, note };
  }
  if (value) {
    const parsed = parseEvidenceRefString(value);
    return {
      label: label ?? parsed.label,
      url: parsed.url,
      note,
    };
  }
  if (label && /^https?:\/\//i.test(label)) {
    return { label, url: label, note };
  }
  if (!label) return null;
  return { label, note };
}

function normalizeEvidenceRefs(raw: unknown): V4EvidenceReference[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const refs = raw
    .map((entry) => normalizeEvidenceRefEntry(entry))
    .filter(Boolean) as V4EvidenceReference[];
  return refs.length ? refs : undefined;
}

function collectEvidenceRefs(...inputs: unknown[]): V4EvidenceReference[] | undefined {
  const refs = inputs.flatMap((input) => normalizeEvidenceRefs(input) ?? []);
  return refs.length ? refs : undefined;
}

function normalizeReasonCodes(raw: unknown): string[] | undefined {
  if (Array.isArray(raw)) {
    const codes = raw.filter((entry) => typeof entry === "string" && entry.trim());
    return codes.length ? codes : undefined;
  }
  if (typeof raw === "string" && raw.trim()) {
    return [raw];
  }
  return undefined;
}

function normalizeScoreItem(raw: unknown): V4ScoreItem | null {
  if (!isObject(raw)) return null;
  const label =
    typeof raw.label === "string"
      ? raw.label
      : typeof raw.name === "string"
        ? raw.name
        : undefined;
  const score =
    typeof raw.score === "number" && Number.isFinite(raw.score) ? raw.score : undefined;
  const reason = typeof raw.reason === "string" ? raw.reason.trim() : undefined;
  const penaltyReasons = normalizeReasonCodes(
    raw.penaltyReasons ?? raw.penalty_reasons ?? raw.reasons ?? raw.reasonCodes
  );
  const penaltyReason =
    typeof raw.penaltyReason === "string"
      ? raw.penaltyReason
      : typeof raw.penalty_reason === "string"
        ? raw.penalty_reason
        : undefined;
  const __specMissingEvidenceLink =
    typeof raw.__specMissingEvidenceLink === "boolean"
      ? raw.__specMissingEvidenceLink
      : undefined;
  const usedEvidenceRaw = Array.isArray(raw.usedEvidence) ? raw.usedEvidence : [];
  const usedEvidence = usedEvidenceRaw
    .map((entry) =>
      isObject(entry)
        ? {
            type: typeof entry.type === "string" ? entry.type : undefined,
            status: typeof entry.status === "string" ? entry.status : undefined,
            link:
              typeof entry.link === "string"
                ? entry.link
                : typeof entry.url === "string"
                  ? entry.url
                  : typeof entry.href === "string"
                    ? entry.href
                    : undefined,
          }
        : null
    )
    .filter(Boolean) as V4ScoreItemEvidence[];

  if (
    score === undefined &&
    !reason &&
    !penaltyReasons?.length &&
    !penaltyReason &&
    !usedEvidence.length &&
    !__specMissingEvidenceLink
  ) {
    return null;
  }

  return {
    label,
    score,
    reason,
    penaltyReasons,
    penaltyReason,
    __specMissingEvidenceLink,
    usedEvidence: usedEvidence.length ? usedEvidence : undefined,
  };
}

function normalizeScoreItems(rawScores: unknown): Record<string, V4ScoreItem> | undefined {
  if (!isObject(rawScores)) return undefined;
  const items = isObject(rawScores.items) ? rawScores.items : null;
  if (!items || !isObject(items)) return undefined;
  const normalized: Record<string, V4ScoreItem> = {};
  for (const [key, value] of Object.entries(items)) {
    const normalizedItem = normalizeScoreItem(value);
    if (normalizedItem) {
      normalized[key] = normalizedItem;
    }
  }
  return Object.keys(normalized).length ? normalized : undefined;
}

function averageScore(values: number[]): number {
  const sum = values.reduce((acc, value) => acc + value, 0);
  return sum / values.length;
}

function collectItemScores(items: Record<string, V4ScoreItem>, prefix: string): number[] {
  return Object.entries(items)
    .filter(([key]) => key.startsWith(prefix))
    .map(([, item]) => item.score)
    .filter((value): value is number => typeof value === "number");
}

function normalizeScoreDetailItem(
  key: string,
  raw: unknown
): V4ScoreDetailItem | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return { itemKey: key, value: raw };
  }
  if (!isObject(raw)) return null;
  const value =
    typeof raw.value === "number"
      ? raw.value
      : typeof raw.score === "number"
        ? raw.score
        : typeof raw.points === "number"
          ? raw.points
          : typeof raw.total === "number"
            ? raw.total
            : null;
  if (value === null || !Number.isFinite(value)) return null;
  const reasons = normalizeReasonCodes(
    raw.reasons ?? raw.reasonCodes ?? raw.reason_codes ?? raw.reason
  );
  const evidenceRefs = collectEvidenceRefs(
    raw.evidenceRefs ?? raw.evidence_refs,
    raw.refs,
    raw.references,
    raw.sources,
    raw.urls
  );
  return {
    itemKey: key,
    value,
    reasons,
    evidenceRefs,
  };
}

function normalizeScoreDetails(raw: unknown): V4ScoreDetailItem[] | null {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    const items = raw
      .map((item) => {
        if (!isObject(item)) return null;
        const key =
          typeof item.itemKey === "string"
            ? item.itemKey
            : typeof item.key === "string"
              ? item.key
              : typeof item.metric === "string"
                ? item.metric
                : typeof item.category === "string"
                  ? item.category
                  : undefined;
        if (!key) return null;
        return normalizeScoreDetailItem(key, item);
      })
      .filter(Boolean) as V4ScoreDetailItem[];
    return items.length ? items : null;
  }

  if (isObject(raw)) {
    const source =
      (raw.scoreDetails as unknown) ??
      raw.score_breakdown ??
      raw.scoreBreakdown ??
      raw.breakdown ??
      raw.items ??
      raw.scores ??
      raw.score_items ??
      raw.scoreItems ??
      null;

    if (Array.isArray(source)) {
      return normalizeScoreDetails(source);
    }
    if (isObject(source)) {
      const items = Object.entries(source)
        .map(([key, value]) => normalizeScoreDetailItem(key, value))
        .filter(Boolean) as V4ScoreDetailItem[];
      return items.length ? items : null;
    }
  }

  return null;
}

function normalizeEvidenceItems(raw: unknown): V4EvidenceItem[] {
  const source = Array.isArray(raw)
    ? raw
    : isObject(raw)
      ? (raw.evidenceItems ?? raw.items ?? raw.evidence ?? raw.entries)
      : null;
  if (!Array.isArray(source)) return [];

  return source
    .map((item) => {
      if (!isObject(item)) return null;
      const type =
        typeof item.type === "string"
          ? item.type
          : typeof item.kind === "string"
            ? item.kind
            : "unknown";
      const status =
        typeof item.status === "string"
          ? item.status
          : typeof item.state === "string"
            ? item.state
            : undefined;
      const reasonCodes = normalizeReasonCodes(
        item.reasonCodes ?? item.reason_codes ?? item.reasons ?? item.reason
      );
      const refs = collectEvidenceRefs(
        item.refs,
        item.references,
        item.sources,
        item.urls,
        item.evidenceRefs,
        item.evidence_refs
      );
      const summary =
        typeof item.summary === "string"
          ? item.summary
          : typeof item.description === "string"
            ? item.description
            : undefined;
      return { type, status, reasonCodes, refs, summary };
    })
    .filter(Boolean) as V4EvidenceItem[];
}

function dedupeEvidenceRefs(refs: V4EvidenceReference[]): V4EvidenceReference[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = `${ref.label ?? ""}|${ref.url ?? ""}|${ref.note ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function summarizeEvidenceItems(items: V4EvidenceItem[]): V4EvidenceSummary {
  const refs = dedupeEvidenceRefs(items.flatMap((item) => item.refs ?? []));
  const refsWithUrls = refs.filter((ref) => Boolean(ref.url));
  const reasonCodes = Array.from(
    new Set(items.flatMap((item) => item.reasonCodes ?? []))
  );
  const reasonCodesWithRefs = Array.from(
    new Set(
      items
        .filter((item) => (item.refs ?? []).some((ref) => Boolean(ref.url)))
        .flatMap((item) => item.reasonCodes ?? [])
    )
  );
  const primaryReasons = reasonCodesWithRefs.filter((code) => code !== "ok");
  const topReason = primaryReasons[0] ?? reasonCodesWithRefs[0];

  return {
    refCount: refsWithUrls.length,
    refs,
    reasonCodes: reasonCodesWithRefs.length ? reasonCodesWithRefs : reasonCodes,
    hasEvidence: refsWithUrls.length > 0,
    topReason,
  };
}

function mapLayerToStatus(layer: V4RankingEntry["layer"]): V4ModelDetail["status"] {
  if (layer === "full") return "adopted";
  if (layer === "provisional") return "provisional";
  return "denied";
}

function normalizeScores(
  rawScores: V4RawScores | V4RawScoreBreakdown,
  fallbackOverall: number
): V4RankingEntry["scores"] {
  const overall =
    isObject(rawScores) &&
    typeof rawScores.overall === "number" &&
    Number.isFinite(rawScores.overall)
      ? rawScores.overall
      : fallbackOverall;
  const categories = normalizeScoreBreakdown(rawScores);
  const scoreItems = normalizeScoreItems(rawScores);
  return {
    overall,
    categories,
    items: scoreItems,
  };
}

function normalizeRankingEntry(entry: V4RawRankingEntry): V4RankingEntry {
  const scores = normalizeScores(entry.scores, entry.score);
  return {
    ...entry,
    scores,
    scoreItems: scores.items,
  };
}

function normalizeRankings(data: V4RawRankingEntry[]): V4RankingEntry[] {
  return data.map((entry) => normalizeRankingEntry(entry));
}

async function loadV4SnapshotData(): Promise<{
  index: V4IndexData;
  rankings: V4RankingEntry[];
  models: Record<string, V4ModelMetadata>;
  notListed: V4NotListedEntry[];
  evidenceIndexByKey: Record<string, string>;
}> {
  const snapshot = await loadV4Snapshot();
  const files: V4SnapshotFiles = {
    rankings: snapshot.index.files.rankings,
    models: snapshot.index.files.models,
    notListed: snapshot.index.files.notListed,
    evidenceIndex: snapshot.index.files.evidenceIndex,
    evidenceDir: snapshot.index.files.evidenceDir,
    enrichment: DEFAULT_FILES.enrichment,
    enrichmentDecisions: DEFAULT_FILES.enrichmentDecisions,
  };
  const index: V4IndexData = {
    meta: snapshot.index.meta,
    files,
  };
  return {
    index,
    rankings: normalizeRankings(snapshot.rankings as V4RawRankingEntry[]),
    models: snapshot.modelsByKey,
    notListed: snapshot.notListed as V4NotListedEntry[],
    evidenceIndexByKey: snapshot.evidenceIndexByKey,
  };
}

function requireModelMetadata(
  models: Record<string, V4ModelMetadata>,
  modelId: string
): V4ModelMetadata {
  const meta = models[modelId];
  if (!meta) {
    throw new Error(`Missing models.json entry for "${modelId}"`);
  }
  return meta;
}

export async function loadV4Leaderboard(): Promise<{
  index: V4IndexData;
  rankings: V4LeaderboardRow[];
  models: Record<string, V4ModelMetadata>;
}> {
  const { index, rankings, models } = await loadV4SnapshotData();

  const enriched = rankings.map((entry, idx) => {
    const meta = requireModelMetadata(models, entry.model);
    return {
      ...entry,
      rank: idx + 1,
      displayName: meta.name,
      displayVendor: meta.vendor,
    } satisfies V4LeaderboardRow;
  });

  return { index, rankings: enriched, models };
}

export async function loadV4ModelDetail(modelId: string): Promise<{
  detail: V4ModelDetail | null;
  isNotListed: boolean;
  notListedEntry: { slug: string; reason?: string; source?: string } | null;
  index: V4IndexData;
  diagnostics: V4SnapshotDiagnostics;
  evidenceRaw: unknown | null;
}> {
  const { index, rankings, models, notListed, evidenceIndexByKey } =
    await loadV4SnapshotData();
  const files = resolveSnapshotFiles(index);
  const enrichmentResult = await readJsonFileSafe<unknown>(files.enrichment);
  const enrichment = enrichmentResult.data
    ? normalizeEnrichment(enrichmentResult.data)
    : {};
  const decisionsResult = await readJsonFileSafe<unknown>(files.enrichmentDecisions);
  const decisionsData = decisionsResult.data;
  const evidencePath = resolveEvidencePath(modelId, evidenceIndexByKey, files);
  const evidenceResult = await readJsonFileSafe<unknown>(evidencePath);
  const evidenceRaw = evidenceResult.data ?? null;
  const evidenceItems = evidenceResult.data
    ? normalizeEvidenceItems(evidenceResult.data)
    : [];
  const evidenceSummary = summarizeEvidenceItems(evidenceItems);
  const evidenceScoreDetails = normalizeScoreDetails(evidenceResult.data);
  const ranking = rankings.find((entry) => entry.model === modelId);
  const notListedEntry = notListed
    .map((entry) => normalizeNotListedEntry(entry))
    .find((entry) => entry?.slug === modelId);
  const diagnostics: V4SnapshotDiagnostics = {
    files: {
      index: { ok: true },
      rankings: { ok: true },
      models: { ok: true },
      notListed: { ok: true },
      enrichment: { ok: !enrichmentResult.error, error: enrichmentResult.error },
      enrichmentDecisions: {
        ok: !decisionsResult.error,
        error: decisionsResult.error,
      },
    },
    errors: [
      enrichmentResult.error,
      decisionsResult.error,
      evidenceResult.error,
    ].filter(Boolean) as string[],
  };

  if (ranking) {
    const meta = requireModelMetadata(models, ranking.model);
    const normalizedDetails =
      evidenceScoreDetails ?? normalizeScoreDetails(ranking) ?? null;
    const scoreDetails =
      normalizedDetails ??
      Object.entries(ranking.scores.categories).map(([key, value]) => ({
        itemKey: key,
        value,
      }));
    const decisionEntry =
      isObject(decisionsData) && isObject(decisionsData.models)
        ? (decisionsData.models as Record<string, unknown>)[ranking.model]
        : isObject(decisionsData)
          ? (decisionsData as Record<string, unknown>)[ranking.model]
          : null;
    const decisionReason = isObject(decisionEntry)
      ? (decisionEntry.reason ??
          decisionEntry.reasons ??
          decisionEntry.status_reason ??
          decisionEntry.decision_reason ??
          null)
      : null;
    const decisionSource = isObject(decisionEntry)
      ? (decisionEntry.source ?? decisionEntry.decision_source ?? null)
      : null;
    return {
      detail: {
        id: ranking.model,
        name: meta.name,
        vendor: meta.vendor,
        released: meta.released,
        context: meta.context,
        type: meta.type,
        pricing: meta.pricing,
        layer: ranking.layer,
        status: mapLayerToStatus(ranking.layer),
        decisionReason:
          typeof decisionReason === "string"
            ? decisionReason
            : Array.isArray(decisionReason)
              ? decisionReason.filter((entry) => typeof entry === "string").join(", ")
              : null,
        decisionSource: typeof decisionSource === "string" ? decisionSource : null,
        score: ranking.score,
        scores: ranking.scores.categories,
        scoreDetails,
        scoreItems: ranking.scoreItems,
        updatedAt: ranking.updatedAt,
        enrichment: enrichment[ranking.model] ?? null,
        evidenceItems,
        evidenceSummary,
        evidenceError: evidenceResult.error ?? null,
      },
      isNotListed: false,
      notListedEntry: null,
      index,
      diagnostics,
      evidenceRaw,
    };
  }

  return {
    detail: null,
    isNotListed: Boolean(notListedEntry),
    notListedEntry: notListedEntry ?? null,
    index,
    diagnostics,
    evidenceRaw,
  };
}

export async function loadV4SnapshotWithDiagnostics(): Promise<{
  index: V4IndexData | null;
  rankings: V4RankingEntry[] | null;
  models: Record<string, V4ModelMetadata> | null;
  notListed: V4NotListedEntry[] | null;
  enrichment: V4EnrichmentSnapshot | null;
  enrichmentDecisions: unknown | null;
  evidenceSummaries: Record<string, V4EvidenceSummaryLite> | null;
  diagnostics: V4SnapshotDiagnostics;
}> {
  const indexResult = await readJsonFileSafe<unknown>("index.json");
  const normalizedIndex = indexResult.data ? normalizeIndexData(indexResult.data) : null;
  let snapshotData: Awaited<ReturnType<typeof loadV4Snapshot>> | null = null;
  let snapshotError: string | undefined;

  try {
    snapshotData = await loadV4Snapshot();
  } catch (err) {
    snapshotError = err instanceof Error ? err.message : String(err);
  }

  const resolvedIndex = snapshotData
    ? { meta: snapshotData.index.meta, files: snapshotData.index.files }
    : normalizedIndex;
  const files = resolveSnapshotFiles(resolvedIndex);

  const [enrichmentResult, enrichmentDecisionsResult] = await Promise.all([
    readJsonFileSafe<unknown>(files.enrichment),
    readJsonFileSafe<unknown>(files.enrichmentDecisions),
  ]);

  const resolvedRankings = snapshotData
    ? normalizeRankings(snapshotData.rankings as V4RawRankingEntry[])
    : null;
  const resolvedModels = snapshotData ? snapshotData.modelsByKey : null;
  const resolvedNotListed = snapshotData
    ? (snapshotData.notListed as V4NotListedEntry[])
    : null;

  const evidenceSummaries: Record<string, V4EvidenceSummaryLite> | null =
    resolvedRankings && resolvedRankings.length && snapshotData
      ? Object.fromEntries(
          await Promise.all(
            resolvedRankings.map(async (entry) => {
              const evidencePath = resolveEvidencePath(
                entry.model,
                snapshotData.evidenceIndexByKey,
                files
              );
              const evidenceResult = await readJsonFileSafe<unknown>(evidencePath);
              const items = evidenceResult.data
                ? normalizeEvidenceItems(evidenceResult.data)
                : [];
              const summary = summarizeEvidenceItems(items);
              return [
                entry.model,
                {
                  count: summary.refCount,
                  hasEvidence: summary.hasEvidence,
                  topReason: summary.topReason,
                } satisfies V4EvidenceSummaryLite,
              ] as const;
            })
          )
        )
      : null;

  const warnings = [
    enrichmentResult.error ? `Optional ${enrichmentResult.error}` : null,
    enrichmentDecisionsResult.error ? `Optional ${enrichmentDecisionsResult.error}` : null,
  ].filter(Boolean) as string[];

  const errors: string[] = [];
  if (!resolvedIndex) {
    errors.push(indexResult.error ?? "index.json: missing");
  }
  if (!snapshotData) {
    errors.push(snapshotError ?? "snapshot: failed to load");
  }

  return {
    index: resolvedIndex ?? null,
    rankings: resolvedRankings,
    models: resolvedModels ?? null,
    notListed: resolvedNotListed ?? null,
    enrichment: enrichmentResult.data ? normalizeEnrichment(enrichmentResult.data) : null,
    enrichmentDecisions: enrichmentDecisionsResult.data,
    evidenceSummaries,
    diagnostics: {
      files: {
        index: { ok: !indexResult.error, error: indexResult.error },
        rankings: { ok: !snapshotError, error: snapshotError },
        models: { ok: !snapshotError, error: snapshotError },
        notListed: { ok: !snapshotError, error: snapshotError },
        enrichment: { ok: !enrichmentResult.error, error: enrichmentResult.error },
        enrichmentDecisions: {
          ok: !enrichmentDecisionsResult.error,
          error: enrichmentDecisionsResult.error,
        },
      },
      errors,
      warnings,
    },
  };
}
