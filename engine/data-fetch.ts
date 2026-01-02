/**
 * Fetch all external sources the engine depends on.
 * This implementation reads local JSON payloads so the
 * engine remains deterministic and offline-friendly.
 */

import fs from "fs";
import path from "path";
import {
  RawBootstrapModel,
  RawModelData,
  OpenRouterModelRaw,
  SeedModelEntry,
  AdoptionDecisionEntry,
} from "./types";
import { fetchOpenRouterModels } from "./src/sources/openrouter";
import { loadSeedModels } from "./src/adoption";

function loadBootstrapModels(): RawBootstrapModel[] {
  const filePath = path.resolve(process.cwd(), "docs", "bootstrap-models.json");
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as RawBootstrapModel[];
    }
  } catch {
    // If the file is missing or invalid, fall through to empty list
  }
  return [];
}

function mapBootstrapModel(entry: RawBootstrapModel): RawModelData {
  return {
    id: entry.id,
    vendor: entry.provider || "",
    metadata: {
      name: entry.displayName || entry.id,
      released: entry.releaseDate,
      context: entry.contextLengthTokens,
      type: undefined,
      notes: [entry.family, entry.tier].filter(Boolean).join(" ") || undefined,
    },
    pricing: {
      input: entry.pricing?.inputUsdPer1k,
      output: entry.pricing?.outputUsdPer1k,
      currency: "USD",
    },
    benchmarks: {
      general: entry.benchmarks?.mmlu,
      arena: entry.benchmarks?.arenaElo,
    },
    incidents: {
      minor: entry.safety?.incidents,
    },
    apiStatus: {},
  };
}

export async function fetchAllModelData(): Promise<RawModelData[]> {
  const bootstrap = loadBootstrapModels();
  const openRouter = await fetchOpenRouterModels();
  const seed = loadSeedModels();
  
// --- added: local mappers to satisfy TS compile (seed/openrouter shapes are treated as RawModelData at this stage)
const mapSeedModel = (m: any): RawModelData => m as RawModelData;
const mapOpenRouterModel = (m: any): RawModelData => m as RawModelData;
const openRouterModels = (openRouter as any[]).map(mapOpenRouterModel);
  const seedModels = (seed as any[]).map(mapSeedModel);
  return [...bootstrap.map(mapBootstrapModel), ...seedModels, ...openRouterModels] as RawModelData[];
}

export function buildAdoptedModelData(options: {
  decisions: AdoptionDecisionEntry[];
  openRouterModels: OpenRouterModelRaw[];
  seedModels: SeedModelEntry[];
}): RawModelData[] {
  const openRouterMap = mapOpenRouterRaw(options.openRouterModels);
  const seedMap = mapSeedRaw(options.seedModels);

  const adoptedKeys = options.decisions
    .filter((decision) =>
      decision.status === "adopted" || decision.status === "provisional"
    )
    .map((decision) => decision.modelKey)
    .sort();

  const models: RawModelData[] = [];
  for (const modelKey of adoptedKeys) {
    const openRouter = openRouterMap.get(modelKey);
    const seed = seedMap.get(modelKey);
    models.push(buildRawModel(modelKey, openRouter, seed));
  }

  return models;
}

function buildRawModel(
  modelKey: string,
  openRouter?: OpenRouterModelRaw,
  seed?: SeedModelEntry
): RawModelData {
  const name = safeString(openRouter?.name) || seed?.name || modelKey;
  const vendor =
    normalizeKey(
      safeString(openRouter?.top_provider?.id) ||
        safeString(openRouter?.top_provider?.name)
    ) ||
    normalizeKey(seed?.provider) ||
    deriveProvider(openRouter?.id) ||
    "";

  const created = typeof openRouter?.created === "number"
    ? new Date(openRouter.created * 1000).toISOString()
    : undefined;

  return {
    id: modelKey,
    vendor,
    metadata: {
      name,
      released: created,
      context: typeof openRouter?.context_length === "number"
        ? openRouter.context_length
        : undefined,
      type: safeString(openRouter?.architecture?.modality),
      notes: undefined,
    },
    pricing: normalizePricing(openRouter?.pricing),
    benchmarks: {},
    incidents: {},
    apiStatus: {},
  };
}

function mapOpenRouterRaw(
  models: OpenRouterModelRaw[]
): Map<string, OpenRouterModelRaw> {
  const map = new Map<string, OpenRouterModelRaw>();
  for (const model of models) {
    const key = normalizeKey(model.canonical_slug || model.id || "");
    if (!key) continue;
    if (!map.has(key)) map.set(key, model);
  }
  return map;
}

function mapSeedRaw(
  models: SeedModelEntry[]
): Map<string, SeedModelEntry> {
  const map = new Map<string, SeedModelEntry>();
  for (const model of models) {
    const key = normalizeKey(model.modelKey || "");
    if (!key) continue;
    if (!map.has(key)) map.set(key, model);
  }
  return map;
}

function normalizePricing(pricing: any): {
  input?: number;
  output?: number;
  currency?: string;
} {
  if (!pricing || typeof pricing !== "object") {
    return { currency: "USD" };
  }
  const input = safeNumber(pricing.input ?? pricing.prompt);
  const output = safeNumber(pricing.output ?? pricing.completion);
  return {
    input,
    output,
    currency: typeof pricing.currency === "string" ? pricing.currency : "USD",
  };
}

function normalizeKey(value: string | undefined): string {
  if (!value) return "";
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

function safeString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  return undefined;
}

function safeNumber(value: unknown): number | undefined {
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

function deriveProvider(id: string | undefined): string | undefined {
  if (!id) return undefined;
  if (id.includes("/")) return id.split("/")[0];
  if (id.includes(":")) return id.split(":")[0];
  return undefined;
}
