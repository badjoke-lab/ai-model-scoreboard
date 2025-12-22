import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const revalidate = 0;

type ModelScore = {
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
};

type ModelsMap = Record<string, ModelScore>;

function dataPath(file: string) {
  return path.join(process.cwd(), "public", "data", "v4", file);
}

async function readJson<T>(file: string): Promise<T> {
  const raw = await fs.readFile(dataPath(file), "utf8");
  return JSON.parse(raw) as T;
}

export async function GET(
  _req: Request,
  ctx: { params: { slug: string } }
) {
  try {
    const slug = ctx?.params?.slug;
    if (!slug) {
      return NextResponse.json(
        { status: "error", error: "Missing slug" },
        { status: 400, headers: { "X-Robots-Tag": "noindex, nofollow" } }
      );
    }

    const models = await readJson<ModelsMap>("models.json");
    const hit = models?.[slug];

    if (!hit) {
      return NextResponse.json(
        { status: "not_found", slug },
        { status: 404, headers: { "X-Robots-Tag": "noindex, nofollow" } }
      );
    }

    return NextResponse.json(
      { status: "ok", model: hit },
      { headers: { "X-Robots-Tag": "noindex, nofollow" } }
    );
  } catch (err: any) {
    return NextResponse.json(
      { status: "error", error: String(err?.message ?? err) },
      { status: 500, headers: { "X-Robots-Tag": "noindex, nofollow" } }
    );
  }
}
