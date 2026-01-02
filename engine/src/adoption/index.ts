import fs from "fs";
import path from "path";
import { SeedModelEntry, AdoptionArtifacts, OpenRouterModelRaw } from "../../types";
import { fetchOpenRouterModels } from "../sources/openrouter";
import {
  mergeCandidates,
  normalizeOpenRouterModel,
  normalizeSeedModel,
} from "./normalize";
import { applyAdoptionRules, loadAdoptionRules } from "./rules";
import { buildAdoptionOutput, buildDecisionsLog } from "./decisions";

export async function buildAdoptionArtifacts(options?: {
  seedModels?: SeedModelEntry[];
  openRouterModels?: OpenRouterModelRaw[];
  generatedAt?: string;
}): Promise<AdoptionArtifacts> {
  const seedModels = options?.seedModels ?? loadSeedModels();
  const openRouterModels =
    options?.openRouterModels ?? (await fetchOpenRouterModels());

  const seedCandidates = seedModels.map(normalizeSeedModel);
  const openRouterCandidates = openRouterModels.map(normalizeOpenRouterModel);

  const mergedCandidates = mergeCandidates([
    ...seedCandidates,
    ...openRouterCandidates,
  ]);

  const rules = loadAdoptionRules();
  const decisions = applyAdoptionRules(mergedCandidates, rules);

  return {
    adoption: buildAdoptionOutput(decisions),
    decisions: buildDecisionsLog(decisions, rules, options?.generatedAt),
  };
}

export function loadSeedModels(): SeedModelEntry[] {
  const filePath = path.resolve("data", "bootstrap", "models.seed.json");
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as SeedModelEntry[];
    }
  } catch {
    return [];
  }
  return [];
}
