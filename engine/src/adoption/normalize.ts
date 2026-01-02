import { OpenRouterModelRaw, SeedModelEntry } from "../../types";

export type AdoptionSource = "openrouter" | "seed";

export interface AdoptionCandidate {
  modelKey: string;
  name?: string;
  provider?: string;
  source: AdoptionSource;
  rawRef: {
    id?: string;
    canonical_slug?: string;
  };
  details: {
    created?: number;
    context_length?: number;
    pricing?: any;
    architecture?: any;
  };
  hasSeed?: boolean;
}

export function normalizeOpenRouterModel(
  raw: OpenRouterModelRaw
): AdoptionCandidate {
  const rawId = safeString(raw.id);
  const rawSlug = safeString(raw.canonical_slug);
  const modelKey = normalizeKey(rawSlug || rawId || "");
  const name =
    safeString(raw.name) || safeString(rawSlug) || safeString(rawId);
  const provider =
    normalizeKey(
      safeString(raw.top_provider?.id) ||
        safeString(raw.top_provider?.name) ||
        deriveProvider(rawId)
    ) || undefined;

  return {
    modelKey,
    name,
    provider,
    source: "openrouter",
    rawRef: {
      id: rawId,
      canonical_slug: rawSlug,
    },
    details: {
      created: typeof raw.created === "number" ? raw.created : undefined,
      context_length:
        typeof raw.context_length === "number" ? raw.context_length : undefined,
      pricing: raw.pricing,
      architecture: raw.architecture,
    },
  };
}

export function normalizeSeedModel(entry: SeedModelEntry): AdoptionCandidate {
  const modelKey = normalizeKey(entry.modelKey);
  return {
    modelKey,
    name: safeString(entry.name),
    provider: normalizeKey(entry.provider) || undefined,
    source: "seed",
    rawRef: {
      id: entry.modelKey,
    },
    details: {},
    hasSeed: true,
  };
}

export function mergeCandidates(
  candidates: AdoptionCandidate[]
): AdoptionCandidate[] {
  const map = new Map<string, AdoptionCandidate>();

  for (const candidate of candidates) {
    if (!candidate.modelKey) continue;
    const existing = map.get(candidate.modelKey);
    if (!existing) {
      map.set(candidate.modelKey, candidate);
      continue;
    }
    map.set(candidate.modelKey, mergeCandidate(existing, candidate));
  }

  return Array.from(map.values());
}

function mergeCandidate(
  a: AdoptionCandidate,
  b: AdoptionCandidate
): AdoptionCandidate {
  const [primary, secondary] =
    infoScore(a) >= infoScore(b) ? [a, b] : [b, a];

  return {
    modelKey: primary.modelKey,
    name: primary.name ?? secondary.name,
    provider: primary.provider ?? secondary.provider,
    source: primary.hasSeed || secondary.hasSeed ? "seed" : primary.source,
    rawRef: {
      id: primary.rawRef.id ?? secondary.rawRef.id,
      canonical_slug:
        primary.rawRef.canonical_slug ?? secondary.rawRef.canonical_slug,
    },
    details: {
      ...secondary.details,
      ...primary.details,
    },
    hasSeed: primary.hasSeed || secondary.hasSeed,
  };
}

function infoScore(candidate: AdoptionCandidate): number {
  let score = 0;
  if (candidate.name) score += 1;
  if (candidate.provider) score += 1;
  if (candidate.details.created) score += 1;
  if (candidate.details.context_length) score += 1;
  if (candidate.details.pricing) score += 1;
  if (candidate.details.architecture) score += 1;
  return score;
}

function normalizeKey(value: string | undefined): string {
  if (!value) return "";
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

function safeString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return undefined;
}

function deriveProvider(id: string | undefined): string | undefined {
  if (!id) return undefined;
  if (id.includes("/")) {
    return id.split("/")[0];
  }
  if (id.includes(":")) {
    return id.split(":")[0];
  }
  return undefined;
}
