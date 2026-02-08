import { promises as fs } from "fs";
import path from "path";

export type EvidenceType = "official_page" | "dev_activity" | "paper" | "audit";

export type EvidenceOverride = {
  type: EvidenceType;
  status?: string;
  label?: string;
  url?: string;
  refs?: string[];
  reasons?: string[];
  extracted?: unknown;
};

export type ModelOverride = {
  modelKey: string;
  evidence?: EvidenceOverride[];
  rawInputsBySource?: {
    openrouter?: Record<string, unknown>;
    huggingface?: Record<string, unknown>;
    github?: Record<string, unknown>;
    arxiv?: Record<string, unknown>;
    ops?: Record<string, unknown>;
  };
  links?: string[];
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeEvidenceOverrides(
  value: unknown
): EvidenceOverride[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const entries = value.filter((entry) => isObject(entry) && typeof entry.type === "string");
  return entries.length ? (entries as EvidenceOverride[]) : [];
}

function normalizeLinks(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const links = value
    .filter((entry) => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return links.length ? links : [];
}

function normalizeRawInputsBySource(value: unknown): ModelOverride["rawInputsBySource"] {
  if (!isObject(value)) return undefined;
  const rawInputs = value as Record<string, unknown>;
  const normalizeSource = (key: string) =>
    isObject(rawInputs[key]) ? (rawInputs[key] as Record<string, unknown>) : undefined;
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
    const encodedKey = encodeURIComponent(modelKey);
    const filePath = path.join(
      process.cwd(),
      "overrides",
      "v4",
      "models",
      `${encodedKey}.json`
    );
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (!isObject(parsed)) return null;
    const overrideKey = typeof parsed.modelKey === "string" ? parsed.modelKey : "";
    if (!overrideKey || overrideKey !== encodedKey) return null;

    const evidence = normalizeEvidenceOverrides(parsed.evidence);
    const rawInputsBySource = normalizeRawInputsBySource(parsed.rawInputsBySource);
    const links = normalizeLinks(parsed.links);

    return {
      modelKey: overrideKey,
      evidence,
      rawInputsBySource,
      links,
    };
  } catch {
    return null;
  }
}
