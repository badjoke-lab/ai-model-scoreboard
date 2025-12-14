import { promises as fs } from "fs";
import path from "path";

export type V4IndexData = {
  version: string;
  updatedAt: string;
  modelsCount: number;
  fullCount: number;
  provisionalCount: number;
  notListedCount: number;
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
  layer: "full" | "provisional" | "not-listed";
  score: number;
  scores: V4ScoreBreakdown;
  updatedAt?: string;
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

async function readJsonFile<T>(filename: string): Promise<T> {
  const filePath = path.join(process.cwd(), "public", "data", "v4", filename);
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

export async function loadV4Leaderboard(): Promise<{
  index: V4IndexData;
  rankings: V4LeaderboardRow[];
  models: Record<string, V4ModelMetadata>;
}> {
  const [index, rankings, models] = await Promise.all([
    readJsonFile<V4IndexData>("index.json"),
    readJsonFile<V4RankingEntry[]>("rankings.json"),
    readJsonFile<Record<string, V4ModelMetadata>>("models.json"),
  ]);

  const sortedRankings = [...rankings]
    .filter((entry) => typeof entry.score === "number")
    .sort((a, b) => b.score - a.score);

  const enriched = sortedRankings.map((entry, idx) => {
    const meta = models[entry.model];
    return {
      ...entry,
      rank: idx + 1,
      displayName: meta?.name ?? entry.model,
      displayVendor: meta?.vendor ?? entry.vendor,
    } satisfies V4LeaderboardRow;
  });

  return { index, rankings: enriched, models };
}
