import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const revalidate = 0;

type V4RankingEntry = {
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

async function readJson<T>(fileName: string): Promise<T> {
  const fullPath = path.join(process.cwd(), "public", "data", "v4", fileName);
  const raw = await fs.readFile(fullPath, "utf8");
  return JSON.parse(raw) as T;
}

export async function GET() {
  try {
    const rankings = await readJson<V4RankingEntry[]>("rankings.json");
    const leaderboard = [...rankings].sort((a, b) => b.score - a.score);

    return NextResponse.json(
      { status: "ok", leaderboard },
      { headers: { "X-Robots-Tag": "noindex, nofollow" } }
    );
  } catch {
    return NextResponse.json(
      { status: "error", error: "Failed to load leaderboard" },
      { status: 500, headers: { "X-Robots-Tag": "noindex, nofollow" } }
    );
  }
}
