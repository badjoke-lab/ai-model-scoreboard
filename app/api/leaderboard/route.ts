import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const revalidate = 0;

type RankingEntry = {
  model: string;
  vendor: string;
  layer: string;
  score: number;
  scores: Record<string, unknown>;
  updatedAt: string;
};

function dataPath(file: string) {
  return path.join(process.cwd(), "public", "data", "v4", file);
}

async function readJson<T>(file: string): Promise<T> {
  const raw = await fs.readFile(dataPath(file), "utf8");
  return JSON.parse(raw) as T;
}

export async function GET() {
  try {
    const leaderboard = await readJson<RankingEntry[]>("rankings.json");
    return NextResponse.json(leaderboard, {
      headers: { "X-Robots-Tag": "noindex, nofollow" },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: String(err?.message ?? err) },
      { status: 500, headers: { "X-Robots-Tag": "noindex, nofollow" } }
    );
  }
}
