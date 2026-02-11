import { promises as fs } from "fs";
import path from "path";

import { normalizeModelKey, toEncodedModelKey } from "@/lib/v4/modelKey";

export type EvidenceType = "official_page" | "dev_activity" | "paper" | "audit";

export type EvidenceOverride = {
  type: EvidenceType;
  status?: string;
  label?: string;
  url?: string;
  refs?: string[];
  reasons?: string[];
  extracted?: any;
};

export type ModelOverride = {
  modelKey: string;
  evidence?: EvidenceOverride[];
  rawInputsBySource?: {
    openrouter?: Record<string, any>;
    huggingface?: Record<string, any>;
    github?: Record<string, any>;
    arxiv?: Record<string, any>;
    ops?: Record<string, any>;
  };
  links?: string[];
};

function isObject(value: any): value is Record<string, any> {
  return typeof value === "object" && value !== null;
}

function normalizeEvidenceOverrides(
  value: any
): EvidenceOverride[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const entries = value.filter((entry) => isObject(entry) && typeof entry.type === "string");
  return entries.length ? (entries as EvidenceOverride[]) : [];
}

function normalizeLinks(value: any): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const links = value
    .filter((entry) => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return links.length ? links : [];
}

function normalizeRawInputsBySource(value: any): ModelOverride["rawInputsBySource"] {
  if (!isObject(value)) return undefined;
  const rawInputs = value as Record<string, any>;
  const normalizeSource = (key: string) =>
    isObject(rawInputs[key]) ? (rawInputs[key] as Record<string, any>) : undefined;
  return {
    openrouter: normalizeSource("openrouter"),
    huggingface: normalizeSource("huggingface"),
    github: normalizeSource("github"),
    arxiv: normalizeSource("arxiv"),
    ops: normalizeSource("ops"),
  };
}

export async function loadModelOverride(modelKey: string): Promise<ModelOverride | null> {
  try {
    const canonicalModelKey = normalizeModelKey(modelKey);
    if (!canonicalModelKey) return null;
    const encodedKey = toEncodedModelKey(canonicalModelKey);
    const filePath = path.join(
      process.cwd(),
      "overrides",
      "v4",
      "models",
      `${encodedKey}.json`
    );
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as any;
    if (!isObject(parsed)) return null;
    const overrideKey =
      typeof parsed.modelKey === "string" ? normalizeModelKey(parsed.modelKey) : "";
    if (overrideKey && overrideKey !== canonicalModelKey) return null;

    const evidence = normalizeEvidenceOverrides(parsed.evidence);
    const rawInputsBySource = normalizeRawInputsBySource(parsed.rawInputsBySource);
    const links = normalizeLinks(parsed.links);

    return {
      modelKey: overrideKey || canonicalModelKey,
      evidence,
      rawInputsBySource,
      links,
    };
  } catch {
    return null;
  }
}
