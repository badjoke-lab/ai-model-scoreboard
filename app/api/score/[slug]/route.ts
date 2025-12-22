import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const revalidate = 0;

type ModelInfo = {
  name: string;
  vendor: string;
  [key: string]: unknown;
};

type ModelsMap = Record<string, ModelInfo>;

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
        { error: "Missing slug" },
        { status: 400, headers: { "X-Robots-Tag": "noindex, nofollow" } }
      );
    }

    const models = await readJson<ModelsMap>("models.json");
    const hit = models?.[slug];

    if (!hit) {
      return NextResponse.json(
        { error: "Not found", slug },
        { status: 404, headers: { "X-Robots-Tag": "noindex, nofollow" } }
      );
    }

    return NextResponse.json(hit, {
      headers: { "X-Robots-Tag": "noindex, nofollow" },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: String(err?.message ?? err) },
      { status: 500, headers: { "X-Robots-Tag": "noindex, nofollow" } }
    );
  }
}
