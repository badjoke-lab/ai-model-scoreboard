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

type SnapshotFile = {
  meta?: SnapshotMeta;
  rankings?: RankingEntry[];
  models?: ModelsMap;
  notListed?: unknown[];
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
    name: string;
    vendor: string;
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
    const latest = await readJson<SnapshotFile>("latest.json");
    const meta = await readJson<SnapshotMeta>("latest.meta.json");
    if (!meta) {
      throw new Error("Snapshot meta is missing");
    }

    return NextResponse.json(
      {
        meta,
        rankings: latest.rankings ?? [],
        models: latest.models ?? {},
        notListed: latest.notListed ?? [],
      },
      { headers: { "X-Robots-Tag": "noindex, nofollow" } }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: String(err?.message ?? err) },
      { status: 500, headers: { "X-Robots-Tag": "noindex, nofollow" } }
    );
  }
}
