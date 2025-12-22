import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const revalidate = 0;

type V4ModelEntry = {
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

  // models.json 側に追加情報があっても落ちないようにする
  [key: string]: unknown;
};

async function readJson<T>(fileName: string): Promise<T> {
  const fullPath = path.join(process.cwd(), "public", "data", "v4", fileName);
  const raw = await fs.readFile(fullPath, "utf8");
  return JSON.parse(raw) as T;
}

function normalizeSlug(s: string) {
  return String(s || "").trim().toLowerCase();
}

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const slug = normalizeSlug(params?.slug);

    if (!slug) {
      return NextResponse.json(
        { status: "error", error: "Missing slug" },
        { status: 400, headers: { "X-Robots-Tag": "noindex, nofollow" } }
      );
    }

    const models = await readJson<V4ModelEntry[]>("models.json");

    const found =
      models.find((m) => normalizeSlug(m.model) === slug) ??
      models.find((m) =>
        normalizeSlug(`${m.vendor}-${m.model}`.replace(/\s+/g, "-")) === slug
      );

    if (!found) {
      return NextResponse.json(
        { status: "error", error: "Not found" },
        { status: 404, headers: { "X-Robots-Tag": "noindex, nofollow" } }
      );
    }

    return NextResponse.json(
      { status: "ok", model: found },
      { headers: { "X-Robots-Tag": "noindex, nofollow" } }
    );
  } catch {
    return NextResponse.json(
      { status: "error", error: "Failed to load model score" },
      { status: 500, headers: { "X-Robots-Tag": "noindex, nofollow" } }
    );
  }
}
