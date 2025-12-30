import { promises as fs } from "fs";
import path from "path";

export type V4SnapshotMeta = {
  version: string;
  updatedAt: string;
  modelsCount: number;
  fullCount: number;
  provisionalCount: number;
  notListedCount: number;
};

export type V4IndexData = {
  meta: V4SnapshotMeta;
};

export type V4ScoreBreakdown = {
  performance: number;
  safety: number;
  adoption: number;
  openness: number;
  cost: number;
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

export type V4NotListedEntry = string;

export type V4ModelDetail = {
  id: string;
  name: string;
  vendor: string;
  layer: V4RankingEntry["layer"];
  score: number;
  scores: V4ScoreBreakdown;
  updatedAt: string;
  enrichment: V4EnrichmentEntry | null;
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
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

async function loadV4SnapshotData(): Promise<{
  index: V4IndexData;
  rankings: V4RankingEntry[];
  models: Record<string, V4ModelMetadata>;
  notListed: V4NotListedEntry[];
}> {
  const [index, rankings, models, notListed] = await Promise.all([
    readJsonFile<V4IndexData>("index.json"),
    readJsonFile<V4RankingEntry[]>("rankings.json"),
    readJsonFile<Record<string, V4ModelMetadata>>("models.json"),
    readJsonFile<V4NotListedEntry[]>("not-listed.json"),
  ]);

  return { index, rankings, models, notListed };
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
  index: V4IndexData;
  diagnostics: V4SnapshotDiagnostics;
}> {
  const { index, rankings, models, notListed } = await loadV4SnapshotData();
  const enrichmentResult = await readJsonFileSafe<unknown>("enrichment.json");
  const enrichment = enrichmentResult.data
    ? normalizeEnrichment(enrichmentResult.data)
    : {};
  const ranking = rankings.find((entry) => entry.model === modelId);
  const diagnostics: V4SnapshotDiagnostics = {
    files: {
      index: { ok: true },
      rankings: { ok: true },
      models: { ok: true },
      notListed: { ok: true },
      enrichment: { ok: !enrichmentResult.error, error: enrichmentResult.error },
      enrichmentDecisions: { ok: true },
    },
    errors: enrichmentResult.error ? [enrichmentResult.error] : [],
  };

  if (ranking) {
    const meta = requireModelMetadata(models, ranking.model);
    return {
      detail: {
        id: ranking.model,
        name: meta.name,
        vendor: meta.vendor,
        layer: ranking.layer,
        score: ranking.score,
        scores: ranking.scores,
        updatedAt: ranking.updatedAt,
        enrichment: enrichment[ranking.model] ?? null,
      },
      isNotListed: false,
      index,
      diagnostics,
    };
  }

  return {
    detail: null,
    isNotListed: notListed.includes(modelId),
    index,
    diagnostics,
  };
}

export async function loadV4SnapshotWithDiagnostics(): Promise<{
  index: V4IndexData | null;
  rankings: V4RankingEntry[] | null;
  models: Record<string, V4ModelMetadata> | null;
  notListed: V4NotListedEntry[] | null;
  enrichment: V4EnrichmentSnapshot | null;
  enrichmentDecisions: unknown | null;
  diagnostics: V4SnapshotDiagnostics;
}> {
  const [
    indexResult,
    rankingsResult,
    modelsResult,
    notListedResult,
    enrichmentResult,
    enrichmentDecisionsResult,
  ] = await Promise.all([
    readJsonFileSafe<V4IndexData>("index.json"),
    readJsonFileSafe<V4RankingEntry[]>("rankings.json"),
    readJsonFileSafe<Record<string, V4ModelMetadata>>("models.json"),
    readJsonFileSafe<V4NotListedEntry[]>("not-listed.json"),
    readJsonFileSafe<unknown>("enrichment.json"),
    readJsonFileSafe<unknown>("enrichment-decisions.json"),
  ]);

  const errors = [
    indexResult.error,
    rankingsResult.error,
    modelsResult.error,
    notListedResult.error,
    enrichmentResult.error,
    enrichmentDecisionsResult.error,
  ].filter(Boolean) as string[];

  return {
    index: indexResult.data,
    rankings: rankingsResult.data,
    models: modelsResult.data,
    notListed: notListedResult.data,
    enrichment: enrichmentResult.data ? normalizeEnrichment(enrichmentResult.data) : null,
    enrichmentDecisions: enrichmentDecisionsResult.data,
    diagnostics: {
      files: {
        index: { ok: !indexResult.error, error: indexResult.error },
        rankings: { ok: !rankingsResult.error, error: rankingsResult.error },
        models: { ok: !modelsResult.error, error: modelsResult.error },
        notListed: { ok: !notListedResult.error, error: notListedResult.error },
        enrichment: { ok: !enrichmentResult.error, error: enrichmentResult.error },
        enrichmentDecisions: {
          ok: !enrichmentDecisionsResult.error,
          error: enrichmentDecisionsResult.error,
        },
      },
      errors,
    },
  };
}
