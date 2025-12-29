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
};

async function readJsonFile<T>(filename: string): Promise<T> {
  const filePath = path.join(process.cwd(), "public", "data", "v4", filename);
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
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
}> {
  const { index, rankings, models, notListed } = await loadV4SnapshotData();
  const ranking = rankings.find((entry) => entry.model === modelId);

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
      },
      isNotListed: false,
      index,
    };
  }

  return {
    detail: null,
    isNotListed: notListed.includes(modelId),
    index,
  };
}
