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

export type V4SnapshotFiles = {
  rankings: string;
  models: string;
  notListed: string;
  evidenceIndex: string;
  evidenceDir: string;
};

export type V4SnapshotIndex = {
  meta: V4SnapshotMeta;
  files: V4SnapshotFiles;
};

export type V4EvidenceIndexEntry = {
  modelKey: string;
  path: string;
};

export type V4ModelPricing = {
  input?: number;
  output?: number;
  currency?: string;
};

export type V4ModelMetadata = {
  name: string;
  vendor: string;
  released?: string;
  context?: number;
  type?: string;
  pricing?: V4ModelPricing;
  layer?: "full" | "provisional" | "rejected" | "not-listed";
  scores?: {
    overall?: number;
    categories?: Record<string, number>;
    items?: Record<string, any>;
  };
};

export type V4RankingEntry = {
  model: string;
  vendor: string;
  layer: "full" | "provisional" | "rejected" | "not-listed";
  score: number;
  scores: {
    overall?: number;
    categories?: Record<string, number>;
    items?: Record<string, any>;
  };
  updatedAt: string;
};

export type V4SnapshotData = {
  index: V4SnapshotIndex;
  rankings: V4RankingEntry[];
  modelsByKey: Record<string, V4ModelMetadata>;
  modelsArray: Array<V4ModelMetadata & { modelKey: string }>;
  notListed: any[];
  evidenceIndex: V4EvidenceIndexEntry[];
  evidenceIndexByKey: Record<string, string>;
};

const DEFAULT_FILES: V4SnapshotFiles = {
  rankings: "rankings.json",
  models: "models.json",
  notListed: "not-listed.json",
  evidenceIndex: "evidence/index.json",
  evidenceDir: "evidence",
};

function isObject(value: any): value is Record<string, any> {
  return typeof value === "object" && value !== null;
}

function parseSnapshotMeta(source: Record<string, any>): V4SnapshotMeta {
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

function normalizeEvidenceDir(raw: any): string {
  if (typeof raw !== "string") return DEFAULT_FILES.evidenceDir;
  const cleaned = raw.trim();
  if (!cleaned) return DEFAULT_FILES.evidenceDir;
  return cleaned.replace(/\/+$/, "");
}

export function resolveSnapshotFiles(rawIndex: any): V4SnapshotFiles {
  if (!isObject(rawIndex)) return DEFAULT_FILES;

  const manifest = isObject(rawIndex.manifest)
    ? rawIndex.manifest
    : isObject(rawIndex.files)
      ? rawIndex.files
      : {};

  const evidenceDir = normalizeEvidenceDir(
    manifest.evidence ?? manifest.evidenceDir ?? DEFAULT_FILES.evidenceDir
  );
  const evidenceIndex =
    typeof manifest.evidenceIndex === "string"
      ? manifest.evidenceIndex
      : typeof manifest.evidence_index === "string"
        ? manifest.evidence_index
        : path.posix.join(evidenceDir, "index.json");

  return {
    rankings:
      typeof manifest.rankings === "string" ? manifest.rankings : DEFAULT_FILES.rankings,
    models: typeof manifest.models === "string" ? manifest.models : DEFAULT_FILES.models,
    notListed:
      typeof manifest.notListed === "string"
        ? manifest.notListed
        : typeof manifest.not_listed === "string"
          ? manifest.not_listed
          : DEFAULT_FILES.notListed,
    evidenceIndex,
    evidenceDir,
  };
}

function normalizeModelEntry(raw: any): V4ModelMetadata | null {
  if (!isObject(raw)) return null;
  if (typeof raw.name !== "string" || typeof raw.vendor !== "string") return null;
  return {
    name: raw.name as string,
    vendor: raw.vendor as string,
    released: typeof raw.released === "string" ? raw.released : undefined,
    context: typeof raw.context === "number" ? raw.context : undefined,
    type: typeof raw.type === "string" ? raw.type : undefined,
    pricing: isObject(raw.pricing) ? (raw.pricing as V4ModelPricing) : undefined,
    layer:
      raw.layer === "full" ||
      raw.layer === "provisional" ||
      raw.layer === "rejected" ||
      raw.layer === "not-listed"
        ? raw.layer
        : undefined,
    scores: isObject(raw.scores) ? (raw.scores as V4ModelMetadata["scores"]) : undefined,
  };
}

export function normalizeModels(raw: any): {
  modelsByKey: Record<string, V4ModelMetadata>;
  modelsArray: Array<V4ModelMetadata & { modelKey: string }>;
} {
  const modelsByKey: Record<string, V4ModelMetadata> = {};
  const modelsArray: Array<V4ModelMetadata & { modelKey: string }> = [];

  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (!isObject(entry)) continue;
      const modelKey =
        typeof entry.modelKey === "string"
          ? entry.modelKey
          : typeof entry.key === "string"
            ? entry.key
            : typeof entry.id === "string"
              ? entry.id
              : typeof entry.slug === "string"
                ? entry.slug
                : undefined;
      if (!modelKey) continue;
      const model = normalizeModelEntry(entry.model ?? entry);
      if (!model) continue;
      modelsByKey[modelKey] = model;
      modelsArray.push({ modelKey, ...model });
    }
  } else if (isObject(raw)) {
    for (const [modelKey, value] of Object.entries(raw)) {
      const model = normalizeModelEntry(value);
      if (!model) continue;
      modelsByKey[modelKey] = model;
      modelsArray.push({ modelKey, ...model });
    }
  }

  return { modelsByKey, modelsArray };
}

export function normalizeRankings(raw: any): V4RankingEntry[] {
  if (Array.isArray(raw)) {
    return raw.filter((entry): entry is V4RankingEntry => isObject(entry)) as V4RankingEntry[];
  }
  if (isObject(raw) && Array.isArray(raw.rankings)) {
    return raw.rankings.filter((entry): entry is V4RankingEntry => isObject(entry)) as V4RankingEntry[];
  }
  return [];
}

export function normalizeEvidenceIndex(raw: any): {
  evidenceIndex: V4EvidenceIndexEntry[];
  evidenceIndexByKey: Record<string, string>;
} {
  const evidenceIndex: V4EvidenceIndexEntry[] = [];
  const evidenceIndexByKey: Record<string, string> = {};

  const source = isObject(raw)
    ? (raw.models ?? raw.evidence ?? raw.entries ?? raw.index ?? raw)
    : raw;

  if (Array.isArray(source)) {
    for (const entry of source) {
      if (!isObject(entry)) continue;
      const modelKey =
        typeof entry.modelKey === "string"
          ? entry.modelKey
          : typeof entry.model === "string"
            ? entry.model
            : typeof entry.key === "string"
              ? entry.key
              : undefined;
      const filePath =
        typeof entry.path === "string"
          ? entry.path
          : typeof entry.file === "string"
            ? entry.file
            : typeof entry.filename === "string"
              ? entry.filename
              : undefined;
      if (!modelKey || !filePath) continue;
      evidenceIndex.push({ modelKey, path: filePath });
      evidenceIndexByKey[modelKey] = filePath;
    }
  } else if (isObject(source)) {
    for (const [modelKey, value] of Object.entries(source)) {
      if (typeof value !== "string" && !isObject(value)) continue;
      const filePath =
        typeof value === "string"
          ? value
          : typeof value.path === "string"
            ? value.path
            : typeof value.file === "string"
              ? value.file
              : typeof value.filename === "string"
                ? value.filename
                : undefined;
      if (!filePath) continue;
      evidenceIndex.push({ modelKey, path: filePath });
      evidenceIndexByKey[modelKey] = filePath;
    }
  }

  return { evidenceIndex, evidenceIndexByKey };
}

function normalizeEvidencePath(rawPath: string, evidenceDir: string): string {
  const trimmed = rawPath.trim().replace(/^\/+/, "");
  if (!trimmed) return path.posix.join(evidenceDir, "");
  if (trimmed.startsWith(evidenceDir)) return trimmed;
  if (trimmed.startsWith("evidence/")) return trimmed;
  return path.posix.join(evidenceDir, trimmed);
}

export function resolveEvidencePath(
  modelKey: string,
  evidenceIndexByKey: Record<string, string>,
  files: V4SnapshotFiles
): string {
  const fromIndex = evidenceIndexByKey[modelKey];
  const evidencePath = fromIndex
    ? normalizeEvidencePath(fromIndex, files.evidenceDir)
    : path.posix.join(files.evidenceDir, `${modelKey}.json`);
  return evidencePath;
}

async function readJsonFile<T>(filename: string): Promise<T> {
  const filePath = path.join(process.cwd(), "public", "data", "v4", filename);
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

export async function loadEvidenceForModel(
  modelKey: string,
  evidenceIndexByKey: Record<string, string>,
  files: V4SnapshotFiles
): Promise<any> {
  const evidencePath = resolveEvidencePath(modelKey, evidenceIndexByKey, files);
  return readJsonFile<any>(evidencePath);
}

export async function loadV4Snapshot(): Promise<V4SnapshotData> {
  const indexRaw = await readJsonFile<any>("index.json");
  const indexMetaSource = isObject(indexRaw)
    ? isObject(indexRaw.meta)
      ? indexRaw.meta
      : indexRaw
    : {};
  const meta = parseSnapshotMeta(indexMetaSource as Record<string, any>);
  const files = resolveSnapshotFiles(indexRaw);

  const [rankingsRaw, modelsRaw, notListedRaw, evidenceIndexRaw] = await Promise.all([
    readJsonFile<any>(files.rankings),
    readJsonFile<any>(files.models),
    readJsonFile<any>(files.notListed),
    readJsonFile<any>(files.evidenceIndex),
  ]);

  const { modelsByKey, modelsArray } = normalizeModels(modelsRaw);
  const rankings = normalizeRankings(rankingsRaw);
  const notListed = Array.isArray(notListedRaw) ? notListedRaw : [];
  const { evidenceIndex, evidenceIndexByKey } = normalizeEvidenceIndex(evidenceIndexRaw);

  return {
    index: { meta, files },
    rankings,
    modelsByKey,
    modelsArray,
    notListed,
    evidenceIndex,
    evidenceIndexByKey,
  };
}
