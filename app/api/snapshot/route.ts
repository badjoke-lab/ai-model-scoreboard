import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const revalidate = 0;

type V4SnapshotMeta = {
  version: string;
  updatedAt: string;
  modelsCount: number;
  fullCount: number;
  provisionalCount: number;
  notListedCount: number;
};

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
};

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

async function readJson<T>(fileName: string): Promise<T> {
  const fullPath = path.join(process.cwd(), "public", "data", "v4", fileName);
  const raw = await fs.readFile(fullPath, "utf8");
  return JSON.parse(raw) as T;
}

function validateSnapshot(meta: V4SnapshotMeta, models: V4ModelEntry[]) {
  const fatal: string[] = [];
  const warn: string[] = [];

  if (meta.version !== "v4") {
    fatal.push(`index.json: version must be "v4" (got "${String(meta.version)}")`);
  }

  if (!meta.updatedAt || Number.isNaN(new Date(meta.updatedAt).getTime())) {
    warn.push(`index.json: updatedAt looks invalid (${String(meta.updatedAt)})`);
  }

  if (!isFiniteNumber(meta.modelsCount) || meta.modelsCount < 0) {
    fatal.push(`index.json: modelsCount must be a non-negative number`);
  }

  if (!Array.isArray(models)) {
    fatal.push(`models.json: must be an array`);
    return { fatal, warn };
  }

  if (models.length === 0) {
    fatal.push(`models.json: empty (0 entries)`);
  }

  if (
    isFiniteNumber(meta.modelsCount) &&
    models.length > 0 &&
    meta.modelsCount !== models.length
  ) {
    warn.push(
      `Mismatch: index.modelsCount (${meta.modelsCount}) !== models.length (${models.length})`
    );
  }

  // spot-check first N entries
  for (let i = 0; i < Math.min(models.length, 20); i++) {
    const e = models[i];
    if (!e || typeof e !== "object") {
      fatal.push(`models.json: entry[${i}] is not an object`);
      break;
    }
    if (!e.model || typeof e.model !== "string") {
      fatal.push(`models.json: entry[${i}].model is missing/invalid`);
      break;
    }
    if (!e.vendor || typeof e.vendor !== "string") {
      warn.push(`models.json: entry[${i}].vendor is missing/invalid`);
    }
    if (!isFiniteNumber(e.score)) {
      fatal.push(`models.json: entry[${i}].score is missing/invalid`);
      break;
    }
    if (!e.scores || typeof e.scores !== "object") {
      fatal.push(`models.json: entry[${i}].scores is missing/invalid`);
      break;
    }
    const s = e.scores as Record<string, unknown>;
    for (const k of ["performance", "safety", "adoption", "openness", "cost"] as const) {
      if (!isFiniteNumber(s[k])) {
        fatal.push(`models.json: entry[${i}].scores.${k} is missing/invalid`);
        break;
      }
    }
    if (fatal.length) break;
  }

  return { fatal, warn };
}

export async function GET() {
  try {
    const meta = await readJson<V4SnapshotMeta>("index.json");
    const models = await readJson<V4ModelEntry[]>("models.json");

    const { fatal, warn } = validateSnapshot(meta, models);

    if (fatal.length) {
      return NextResponse.json(
        {
          status: "error",
          error: "Snapshot validation failed",
          fatal,
          warn,
        },
        { status: 500, headers: { "X-Robots-Tag": "noindex, nofollow" } }
      );
    }

    return NextResponse.json(
      {
        status: "ok",
        meta,
        models,
        warn,
      },
      { headers: { "X-Robots-Tag": "noindex, nofollow" } }
    );
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        error: "Failed to load snapshot files",
      },
      { status: 500, headers: { "X-Robots-Tag": "noindex, nofollow" } }
    );
  }
}
