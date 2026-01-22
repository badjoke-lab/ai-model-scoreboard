import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

import { resolveSnapshotFiles } from "@/lib/v4/loadSnapshot";
import type { V4SnapshotMeta } from "@/lib/v4-snapshot";
import type { V4SnapshotApiResponse, V4SnapshotData } from "@/lib/v4/types";

export const revalidate = 0;

type SnapshotIndex = {
  meta?: Partial<V4SnapshotMeta>;
  manifest?: Record<string, unknown>;
  files?: Record<string, unknown>;
};

function dataPath(file: string) {
  return path.join(process.cwd(), "public", "data", "v4", file);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function readJson<T>(file: string): Promise<T> {
  const raw = await fs.readFile(dataPath(file), "utf8");
  return JSON.parse(raw) as T;
}

async function readJsonSafe<T>(
  file: string
): Promise<{ data: T | null; error?: string }> {
  try {
    const data = await readJson<T>(file);
    return { data };
  } catch (err) {
    const message =
      err && typeof err === "object" && "code" in err && err.code === "ENOENT"
        ? `${file}: missing`
        : `${file}: ${err instanceof Error ? err.message : String(err)}`;
    return { data: null, error: message };
  }
}

function parseSnapshotMeta(raw?: Partial<V4SnapshotMeta> | null): V4SnapshotMeta {
  return {
    version: typeof raw?.version === "string" ? raw.version : "v4",
    updatedAt: typeof raw?.updatedAt === "string" ? raw.updatedAt : "",
    modelsCount: typeof raw?.modelsCount === "number" ? raw.modelsCount : 0,
    fullCount: typeof raw?.fullCount === "number" ? raw.fullCount : 0,
    provisionalCount:
      typeof raw?.provisionalCount === "number" ? raw.provisionalCount : 0,
    notListedCount: typeof raw?.notListedCount === "number" ? raw.notListedCount : 0,
  };
}

function buildErrorResponse(
  message: string,
  warnings: string[],
  expectedPath?: string,
  debug?: unknown
): V4SnapshotApiResponse {
  return {
    ok: false,
    warnings,
    error: {
      message,
      expectedPath,
      debug,
    },
  };
}

export async function GET() {
  const headers = { "X-Robots-Tag": "noindex, nofollow" };
  const warnings: string[] = [];

  try {
    const indexResult = await readJsonSafe<SnapshotIndex>("index.json");
    const indexRaw = indexResult.data ?? null;
    const files = resolveSnapshotFiles(indexRaw);
    const metaSource = isObject(indexRaw) ? (indexRaw.meta ?? indexRaw) : null;

    if (indexResult.error) {
      const response = buildErrorResponse(
        "Snapshot index is missing or invalid.",
        warnings,
        dataPath("index.json"),
        { error: indexResult.error }
      );
      return NextResponse.json(response, { headers });
    }
    if (!isObject(metaSource)) {
      const response = buildErrorResponse(
        "Snapshot index is missing meta.",
        warnings,
        dataPath("index.json"),
        { error: "index.json: missing meta" }
      );
      return NextResponse.json(response, { headers });
    }

    const [rankingsResult, modelsResult, notListedResult] = await Promise.all([
      readJsonSafe<V4SnapshotData["rankings"]>(files.rankings),
      readJsonSafe<V4SnapshotData["models"]>(files.models),
      readJsonSafe<unknown[]>(files.notListed),
    ]);

    const [enrichmentResult, enrichmentDecisionsResult] = await Promise.all([
      readJsonSafe<unknown>("enrichment.json"),
      readJsonSafe<unknown>("enrichment-decisions.json"),
    ]);

    if (enrichmentResult.error) {
      warnings.push(`Optional ${enrichmentResult.error}`);
    }
    if (enrichmentDecisionsResult.error) {
      warnings.push(`Optional ${enrichmentDecisionsResult.error}`);
    }

    const missingRequired = [
      rankingsResult.error,
      modelsResult.error,
      notListedResult.error,
    ].filter(Boolean) as string[];

    if (missingRequired.length) {
      const expectedPath = missingRequired[0]?.startsWith(files.rankings)
        ? dataPath(files.rankings)
        : missingRequired[0]?.startsWith(files.models)
          ? dataPath(files.models)
          : missingRequired[0]?.startsWith(files.notListed)
            ? dataPath(files.notListed)
            : undefined;

      const response = buildErrorResponse(
        "Snapshot files are missing or invalid.",
        warnings,
        expectedPath,
        { missing: missingRequired }
      );
      return NextResponse.json(response, { headers });
    }

    const meta = parseSnapshotMeta(metaSource as Partial<V4SnapshotMeta> | null);
    const rankings = rankingsResult.data ?? null;
    const models = modelsResult.data ?? null;

    if (!rankings || !Array.isArray(rankings) || !models || typeof models !== "object") {
      const response = buildErrorResponse(
        "Snapshot payload is missing required fields.",
        warnings,
        dataPath(files.rankings),
        { metaMissing: !meta, rankingsMissing: !rankings, modelsMissing: !models }
      );
      return NextResponse.json(response, { headers });
    }

    const snapshot: V4SnapshotData = {
      meta,
      rankings,
      models,
    };

    const response: V4SnapshotApiResponse = {
      ok: true,
      snapshot,
      warnings,
    };
    return NextResponse.json(response, { headers });
  } catch (err) {
    const response = buildErrorResponse(
      "Snapshot endpoint failed.",
      [],
      undefined,
      { error: err instanceof Error ? err.message : String(err) }
    );
    return NextResponse.json(response, { headers });
  }
}
