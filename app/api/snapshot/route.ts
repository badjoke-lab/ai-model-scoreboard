import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const revalidate = 0;

type SnapshotMeta = {
  version: string;
  updatedAt: string;
  modelsCount: number;
  fullCount: number;
  provisionalCount: number;
  notListedCount: number;
};

type RankingEntry = {
  model: string;
  vendor: string;
  layer: string;
  score: number;
  scores: {
    performance: number;
    safety: number;
    adoption: number;
    openness: number;
    cost: number;
  };
  updatedAt: string;
};

type ModelsMap = Record<
  string,
  {
    model: string;
    vendor: string;
    layer: string;
    total: number;
    scores: {
      performance: number;
      safety: number;
      adoption: number;
      openness: number;
      cost: number;
    };
    updatedAt: string;
  }
>;

function dataPath(file: string) {
  return path.join(process.cwd(), "public", "data", "v4", file);
}

async function readJson<T>(file: string): Promise<T> {
  const raw = await fs.readFile(dataPath(file), "utf8");
  return JSON.parse(raw) as T;
}

export async function GET() {
  try {
    const meta = await readJson<SnapshotMeta>("index.json");
    const leaderboard = await readJson<RankingEntry[]>("rankings.json");
    const models = await readJson<ModelsMap>("models.json");

    return NextResponse.json(
      {
        status: "ok",
        meta,
        leaderboardCount: Array.isArray(leaderboard) ? leaderboard.length : 0,
        modelsCount: models ? Object.keys(models).length : 0,
      },
      { headers: { "X-Robots-Tag": "noindex, nofollow" } }
    );
  } catch (err: any) {
    return NextResponse.json(
      { status: "error", error: String(err?.message ?? err) },
      { status: 500, headers: { "X-Robots-Tag": "noindex, nofollow" } }
    );
  }
}
