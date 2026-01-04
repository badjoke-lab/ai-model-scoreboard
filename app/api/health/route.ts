import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const revalidate = 0;

type HealthFile = {
  file: string;
  exists: boolean;
};

type HealthPayload = {
  status: "ok" | "degraded";
  version: "v4";
  updatedAt: string | null;
  requiredFiles: HealthFile[];
  missingFiles?: string[];
  errors?: string[];
};

function dataPath(file: string) {
  return path.join(process.cwd(), "public", "data", "v4", file);
}

async function readJson<T>(file: string): Promise<T> {
  const raw = await fs.readFile(dataPath(file), "utf8");
  return JSON.parse(raw) as T;
}

async function fileExists(file: string): Promise<boolean> {
  try {
    await fs.access(dataPath(file));
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const required = ["latest.json", "latest.meta.json"];
  const requiredFiles: HealthFile[] = await Promise.all(
    required.map(async (file) => ({ file, exists: await fileExists(file) }))
  );

  const missingFiles = requiredFiles.filter((item) => !item.exists).map((item) => item.file);
  const errors: string[] = [];
  let updatedAt: string | null = null;

  try {
    const meta = await readJson<{ updatedAt?: string }>("latest.meta.json");
    if (typeof meta.updatedAt === "string") {
      updatedAt = meta.updatedAt;
    } else {
      errors.push("latest.meta.json: missing updatedAt");
    }
  } catch (err) {
    errors.push(
      `latest.meta.json: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  try {
    await readJson("latest.json");
  } catch (err) {
    errors.push(`latest.json: ${err instanceof Error ? err.message : String(err)}`);
  }

  const status: HealthPayload["status"] =
    missingFiles.length === 0 && errors.length === 0 ? "ok" : "degraded";

  const payload: HealthPayload = {
    status,
    version: "v4",
    updatedAt,
    requiredFiles,
    ...(missingFiles.length ? { missingFiles } : {}),
    ...(errors.length ? { errors } : {}),
  };

  return NextResponse.json(payload, {
    headers: { "X-Robots-Tag": "noindex, nofollow" },
  });
}
