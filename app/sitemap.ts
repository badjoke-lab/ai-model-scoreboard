import type { MetadataRoute } from "next";
import fs from "node:fs";
import path from "node:path";

function safeReadJson(p: string): any | null {
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

export default function sitemap(): MetadataRoute.Sitemap {
  const site =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    "https://ai-model-scoreboard.pages.dev";

  const now = new Date();

  const base: MetadataRoute.Sitemap = [
    { url: `${site.replace(/\/+$/, "")}/`, lastModified: now },
    { url: `${site.replace(/\/+$/, "")}/v4`, lastModified: now },
  ];

  // Never throw here; fall back to base even if data is malformed.
  const modelsPath = path.join(process.cwd(), "public", "data", "v4", "models.json");
  const models = safeReadJson(modelsPath);

  if (!models || typeof models !== "object") {
    return base;
  }

  const seen = new Set<string>();
  const keys: string[] = [];

  const entries = Array.isArray(models) ? models : Object.values(models);
  for (const v of entries) {
    if (!v || typeof v !== "object" || Array.isArray(v)) continue;
    const mk = String(
      (v as any).modelKey ||
        (v as any).key ||
        (v as any).slug ||
        (v as any)?.identity?.modelKey ||
        ""
    ).trim();
    if (!mk) continue;
    if (seen.has(mk)) continue;
    seen.add(mk);
    keys.push(mk);
  }

  keys.sort((a, b) => a.localeCompare(b));

  const pages: MetadataRoute.Sitemap = keys.map((mk) => ({
    url: `${site.replace(/\/+$/, "")}/models/${encodeURIComponent(mk)}`,
    lastModified: now,
  }));

  return base.concat(pages);
}
