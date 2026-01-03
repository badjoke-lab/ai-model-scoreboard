import { promises as fs } from "fs";
import path from "path";

export type V4SnapshotMeta = {
  version: string;
  updatedAt: string;
  modelsCount: number;
  fullCount: number;
  provisionalCount: number;
  notListedCount: number;
  evidenceCount?: number;
};

export type V4ScoreCategories = Record<string, number>;

export type V4ScoreItem = {
  score: number;
  weight?: number;
  inputs?: Record<string, unknown>;
  usedEvidence?: Array<{ type?: string; status?: string }>;
  penaltyReasons?: string[];
};

export type V4ScoreBreakdown = {
  overall?: number;
  categories?: V4ScoreCategories;
  items?: Record<string, V4ScoreItem>;
};

export type V4RankingEntry = {
  model: string;
  vendor: string;
  layer: "full" | "provisional" | "rejected" | "not-listed";
  score: number;
  scores: V4ScoreBreakdown;
  updatedAt: string;
};

export type V4ModelMetadata = {
  name: string;
  vendor: string;
  layer?: string;
  scores?: V4ScoreBreakdown;
};

export type V4LeaderboardRow = V4RankingEntry & {
  displayName: string;
  displayVendor: string;
  rank: number;
  evidenceOkCount: number;
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

export type V4EvidenceItem = {
  type: string;
  status?: string;
  reasons?: string[];
  refs?: V4EvidenceReference[];
  summary?: string;
  extracted?: Record<string, unknown>;
};

export type V4ModelDetail = {
  id: string;
  name: string;
  vendor: string;
  layer: V4RankingEntry["layer"];
  status: "adopted" | "provisional" | "denied";
  score: number;
  categories: V4ScoreCategories;
  scoreItems: Record<string, V4ScoreItem> | null;
  scoreGroups: V4ScoreGroup[];
  overallFormula: V4OverallFormula;
  updatedAt: string;
  evidenceItems: V4EvidenceItem[];
  evidenceCount: number;
  rank: number | null;
  raw: Record<string, unknown>;
};

export type V4ScoreGroup = {
  key: "Spec" | "Evidence" | "Ops";
  label: string;
  items: Array<{ key: string; item: V4ScoreItem }>;
  weight: number;
  total: number | null;
};

export type V4OverallFormula = {
  weightedTotal: number | null;
  totalWeight: number;
  categoryTotals: Array<{ key: string; weight: number; total: number | null }>;
};

type SnapshotFileStatus = {
  ok: boolean;
  error?: string;
};

export type V4SnapshotDiagnostics = {
  files: {
    latest: SnapshotFileStatus;
    meta: SnapshotFileStatus;
  };
  errors: string[];
};

type V4LatestSnapshot = {
  meta?: V4SnapshotMeta;
  rankings?: V4RankingEntry[];
  models?: Record<string, V4ModelMetadata>;
  notListed?: V4NotListedEntry[];
  evidenceFiles?: Record<string, unknown>;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function dataPath(file: string) {
  return path.join(process.cwd(), "public", "data", "v4", file);
}

async function readJsonFile<T>(filename: string): Promise<T> {
  const raw = await fs.readFile(dataPath(filename), "utf-8");
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

function normalizeReasons(raw: unknown): string[] | undefined {
  if (Array.isArray(raw)) {
    const codes = raw.filter((entry) => typeof entry === "string" && entry.trim());
    return codes.length ? codes : undefined;
  }
  if (typeof raw === "string" && raw.trim()) {
    return [raw];
  }
  return undefined;
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
      const reasons = normalizeReasons(
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
      const extracted = isObject(item.extracted)
        ? (item.extracted as Record<string, unknown>)
        : undefined;
      return { type, status, reasons, refs, summary, extracted };
    })
    .filter(Boolean) as V4EvidenceItem[];
}

function normalizeCategories(raw: unknown): V4ScoreCategories {
  if (isObject(raw) && isObject(raw.categories)) {
    const categories: V4ScoreCategories = {};
    for (const [key, value] of Object.entries(raw.categories)) {
      if (typeof value === "number" && Number.isFinite(value)) {
        categories[key] = value;
      }
    }
    return categories;
  }

  if (isObject(raw)) {
    const categories: V4ScoreCategories = {};
    for (const key of ["performance", "safety", "adoption", "openness", "cost"]) {
      const value = raw[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        categories[key] = value;
      }
    }
    return categories;
  }

  return {};
}

function normalizeScoreItems(raw: unknown): Record<string, V4ScoreItem> | null {
  if (!isObject(raw)) return null;
  const items = isObject(raw.items) ? raw.items : null;
  if (!items) return null;

  const normalized: Record<string, V4ScoreItem> = {};
  for (const [key, value] of Object.entries(items)) {
    if (!isObject(value)) continue;
    const score =
      typeof value.score === "number"
        ? value.score
        : typeof value.value === "number"
          ? value.value
          : null;
    if (score === null || !Number.isFinite(score)) continue;
    const weight = typeof value.weight === "number" ? value.weight : undefined;
    normalized[key] = {
      score,
      weight,
      inputs: isObject(value.inputs) ? (value.inputs as Record<string, unknown>) : undefined,
      usedEvidence: Array.isArray(value.usedEvidence)
        ? (value.usedEvidence as Array<{ type?: string; status?: string }>)
        : undefined,
      penaltyReasons: normalizeReasons(value.penaltyReasons) ?? normalizeReasons(value.penalties),
    };
  }
  return Object.keys(normalized).length ? normalized : null;
}

function mapLayerToStatus(layer: V4RankingEntry["layer"]): V4ModelDetail["status"] {
  if (layer === "full") return "adopted";
  if (layer === "provisional") return "provisional";
  return "denied";
}

function normalizeEvidenceType(type: string) {
  const normalized = type.toLowerCase();
  if (normalized === "security") return "audit";
  return normalized;
}

function countEvidenceOk(items: V4EvidenceItem[]): number {
  const allowed = new Set(["official_page", "dev_activity", "paper", "audit"]);
  const buckets = new Set<string>();
  for (const item of items) {
    const type = normalizeEvidenceType(item.type);
    if (item.status === "ok" && allowed.has(type)) {
      buckets.add(type);
    }
  }
  return buckets.size;
}

const GROUP_WEIGHTS: Record<V4ScoreGroup["key"], number> = {
  Spec: 0.45,
  Evidence: 0.35,
  Ops: 0.2,
};

function buildScoreGroups(
  scoreItems: Record<string, V4ScoreItem> | null
): V4ScoreGroup[] {
  const groups: Record<V4ScoreGroup["key"], V4ScoreGroup> = {
    Spec: { key: "Spec", label: "Spec (S1–S8)", items: [], weight: GROUP_WEIGHTS.Spec, total: null },
    Evidence: {
      key: "Evidence",
      label: "Evidence (T1–T4)",
      items: [],
      weight: GROUP_WEIGHTS.Evidence,
      total: null,
    },
    Ops: { key: "Ops", label: "Ops (Q1–Q3)", items: [], weight: GROUP_WEIGHTS.Ops, total: null },
  };

  if (scoreItems) {
    for (const [key, item] of Object.entries(scoreItems)) {
      if (key.startsWith("S")) {
        groups.Spec.items.push({ key, item });
      } else if (key.startsWith("T")) {
        groups.Evidence.items.push({ key, item });
      } else if (key.startsWith("Q")) {
        groups.Ops.items.push({ key, item });
      }
    }
  }

  for (const group of Object.values(groups)) {
    if (!group.items.length) continue;
    let weightSum = 0;
    let weightedScore = 0;
    for (const { item } of group.items) {
      const weight = typeof item.weight === "number" ? item.weight : 1;
      weightSum += weight;
      weightedScore += item.score * weight;
    }
    group.total = weightSum ? Math.round((weightedScore / weightSum) * 100) / 100 : null;
  }

  return Object.values(groups);
}

function computeOverallFormula(groups: V4ScoreGroup[]): V4OverallFormula {
  const categoryTotals = groups.map((group) => ({
    key: group.key,
    weight: group.weight,
    total: group.total,
  }));
  let weightedTotal = 0;
  let totalWeight = 0;
  for (const group of categoryTotals) {
    totalWeight += group.weight;
    if (typeof group.total === "number") {
      weightedTotal += group.total * group.weight;
    }
  }
  const total = totalWeight ? Math.round((weightedTotal / totalWeight) * 100) / 100 : null;
  return {
    weightedTotal: total,
    totalWeight,
    categoryTotals,
  };
}

async function loadLatestSnapshotWithMeta(): Promise<{
  latest: V4LatestSnapshot | null;
  meta: V4SnapshotMeta | null;
  diagnostics: V4SnapshotDiagnostics;
}> {
  const latestResult = await readJsonFileSafe<V4LatestSnapshot>("latest.json");
  const metaResult = await readJsonFileSafe<V4SnapshotMeta>("latest.meta.json");
  const meta = metaResult.data ?? latestResult.data?.meta ?? null;

  const errors = [latestResult.error, metaResult.error].filter(Boolean) as string[];

  return {
    latest: latestResult.data,
    meta,
    diagnostics: {
      files: {
        latest: { ok: !latestResult.error, error: latestResult.error },
        meta: { ok: !metaResult.error, error: metaResult.error },
      },
      errors,
    },
  };
}

function resolveRankings(snapshot: V4LatestSnapshot | null): V4RankingEntry[] | null {
  if (!snapshot?.rankings || !Array.isArray(snapshot.rankings)) return null;
  return snapshot.rankings;
}

function resolveModels(snapshot: V4LatestSnapshot | null): Record<string, V4ModelMetadata> | null {
  if (!snapshot?.models || !isObject(snapshot.models)) return null;
  return snapshot.models as Record<string, V4ModelMetadata>;
}

function resolveNotListed(snapshot: V4LatestSnapshot | null): V4NotListedEntry[] | null {
  if (!snapshot?.notListed || !Array.isArray(snapshot.notListed)) return null;
  return snapshot.notListed;
}

export async function loadV4Leaderboard(): Promise<{
  meta: V4SnapshotMeta;
  rankings: V4LeaderboardRow[];
  models: Record<string, V4ModelMetadata>;
}> {
  const { latest, meta } = await loadLatestSnapshotWithMeta();
  if (!latest || !meta) {
    throw new Error("Missing latest v4 snapshot data");
  }

  const rankings = resolveRankings(latest) ?? [];
  const models = resolveModels(latest) ?? {};
  const evidenceFiles = latest.evidenceFiles ?? {};

  const enriched = rankings.map((entry, idx) => {
    const metaEntry = models[entry.model];
    const evidenceItems = normalizeEvidenceItems(evidenceFiles?.[entry.model]);
    return {
      ...entry,
      rank: idx + 1,
      displayName: metaEntry?.name ?? entry.model,
      displayVendor: metaEntry?.vendor ?? entry.vendor,
      evidenceOkCount: countEvidenceOk(evidenceItems),
    } satisfies V4LeaderboardRow;
  });

  return { meta, rankings: enriched, models };
}

export async function loadV4ModelDetail(modelId: string): Promise<{
  detail: V4ModelDetail | null;
  isNotListed: boolean;
  notListedEntry: { slug: string; reason?: string; source?: string } | null;
  meta: V4SnapshotMeta;
  diagnostics: V4SnapshotDiagnostics;
}> {
  const { latest, meta, diagnostics } = await loadLatestSnapshotWithMeta();
  if (!latest || !meta) {
    return {
      detail: null,
      isNotListed: false,
      notListedEntry: null,
      meta: meta ?? {
        version: "v4",
        updatedAt: "",
        modelsCount: 0,
        fullCount: 0,
        provisionalCount: 0,
        notListedCount: 0,
      },
      diagnostics,
    };
  }

  const rankings = resolveRankings(latest) ?? [];
  const models = resolveModels(latest) ?? {};
  const notListed = resolveNotListed(latest) ?? [];
  const evidenceFiles = latest.evidenceFiles ?? {};

  const ranking = rankings.find((entry) => entry.model === modelId) ?? null;
  const modelMeta = models[modelId] ?? null;
  const notListedEntry = notListed
    .map((entry) => normalizeNotListedEntry(entry))
    .find((entry) => entry?.slug === modelId);
  const evidenceEntry = evidenceFiles?.[modelId];
  const evidenceItems = normalizeEvidenceItems(evidenceEntry);

  if (!ranking && !modelMeta) {
    return {
      detail: null,
      isNotListed: Boolean(notListedEntry),
      notListedEntry: notListedEntry ?? null,
      meta,
      diagnostics,
    };
  }

  const layer = (ranking?.layer ?? modelMeta?.layer ?? "not-listed") as V4RankingEntry["layer"];
  const score = ranking?.score ?? modelMeta?.scores?.overall ?? 0;
  const scoreSource = ranking?.scores ?? modelMeta?.scores ?? {};
  const categories = normalizeCategories(scoreSource);
  const scoreItems = normalizeScoreItems(scoreSource);
  const updatedAt = ranking?.updatedAt ?? meta.updatedAt;
  const rank = ranking ? rankings.findIndex((entry) => entry.model === ranking.model) + 1 : null;
  const scoreGroups = buildScoreGroups(scoreItems);
  const overallFormula = computeOverallFormula(scoreGroups);

  return {
    detail: {
      id: modelId,
      name: modelMeta?.name ?? ranking?.model ?? modelId,
      vendor: modelMeta?.vendor ?? ranking?.vendor ?? "",
      layer,
      status: mapLayerToStatus(layer),
      score,
      categories,
      scoreItems,
      scoreGroups,
      overallFormula,
      updatedAt,
      evidenceItems,
      evidenceCount: evidenceItems.length,
      rank,
      raw: {
        ranking: ranking ?? null,
        model: modelMeta ?? null,
        evidence: evidenceEntry ?? null,
      },
    },
    isNotListed: false,
    notListedEntry: null,
    meta,
    diagnostics,
  };
}

export async function loadV4SnapshotWithDiagnostics(): Promise<{
  meta: V4SnapshotMeta | null;
  rankings: V4LeaderboardRow[] | null;
  models: Record<string, V4ModelMetadata> | null;
  notListed: V4NotListedEntry[] | null;
  diagnostics: V4SnapshotDiagnostics;
}> {
  const { latest, meta, diagnostics } = await loadLatestSnapshotWithMeta();
  const rankings = resolveRankings(latest);
  const models = resolveModels(latest);
  const evidenceFiles = latest?.evidenceFiles ?? {};

  const enriched = rankings?.map((entry, idx) => {
    const metaEntry = models?.[entry.model];
    const evidenceItems = normalizeEvidenceItems(evidenceFiles?.[entry.model]);
    return {
      ...entry,
      rank: idx + 1,
      displayName: metaEntry?.name ?? entry.model,
      displayVendor: metaEntry?.vendor ?? entry.vendor,
      evidenceOkCount: countEvidenceOk(evidenceItems),
    } satisfies V4LeaderboardRow;
  });

  return {
    meta,
    rankings: enriched ?? null,
    models: models ?? null,
    notListed: resolveNotListed(latest),
    diagnostics,
  };
}
