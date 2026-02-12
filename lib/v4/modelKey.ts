import fs from "node:fs";
import path from "node:path";

const DASH_VARIANTS = /[‐‑‒–—―ー－]+/g;
const WHITESPACE_OR_UNDERSCORE = /[\s_]+/g;
const DISALLOWED_CHARS = /[^a-z0-9./-]+/g;
const MULTI_DASH = /-+/g;
const ALIAS_PATH = path.join(process.cwd(), "overrides", "v4", "maps", "aliases.json");
const MAX_ALIAS_HOPS = 10;

type AliasMap = Record<string, string>;

let aliasesCache: AliasMap | null = null;

function normalizeSegment(segment: string): string {
  return segment
    .replace(DASH_VARIANTS, "-")
    .replace(WHITESPACE_OR_UNDERSCORE, "-")
    .replace(DISALLOWED_CHARS, "-")
    .replace(MULTI_DASH, "-")
    .replace(/^-+|-+$/g, "");
}

export function safeDecodeOnce(input: string): string {
  if (!input.includes("%")) return input;
  try {
    return decodeURIComponent(input);
  } catch {
    return input;
  }
}

export function normalizeModelKey(raw: string): string {
  const normalized = raw.normalize("NFKC").toLowerCase().trim();
  if (!normalized) return "";

  return normalized
    .split("/")
    .map((segment) => normalizeSegment(segment))
    .filter(Boolean)
    .join("/");
}

export function toEncodedModelKey(canonical: string): string {
  return encodeURIComponent(canonical);
}

export function fromRouteParam(param: string): string {
  return normalizeModelKey(safeDecodeOnce(param));
}

export function loadAliases(): AliasMap {
  if (aliasesCache) return aliasesCache;
  if (!fs.existsSync(ALIAS_PATH)) {
    aliasesCache = {};
    return aliasesCache;
  }

  try {
    const raw = fs.readFileSync(ALIAS_PATH, "utf-8");
    const parsed = JSON.parse(raw) as { aliases?: Record<string, unknown> };
    const aliases = parsed?.aliases ?? {};
    const normalized: AliasMap = {};

    for (const [from, to] of Object.entries(aliases)) {
      if (typeof to !== "string") continue;
      const normalizedFrom = normalizeModelKey(from);
      const normalizedTo = normalizeModelKey(to);
      if (!normalizedFrom || !normalizedTo) continue;
      normalized[normalizedFrom] = normalizedTo;
    }

    aliasesCache = normalized;
    return aliasesCache;
  } catch {
    aliasesCache = {};
    return aliasesCache;
  }
}

export function applyAlias(canonicalKey: string): {
  key: string;
  hops: string[];
  loop: boolean;
} {
  const aliases = loadAliases();
  const startKey = normalizeModelKey(canonicalKey);
  if (!startKey) {
    return { key: "", hops: [], loop: false };
  }

  const hops = [startKey];
  const visited = new Set<string>([startKey]);
  let currentKey = startKey;

  for (let i = 0; i < MAX_ALIAS_HOPS; i += 1) {
    const nextKey = aliases[currentKey];
    if (!nextKey) {
      return { key: currentKey, hops, loop: false };
    }
    if (visited.has(nextKey)) {
      hops.push(nextKey);
      return { key: currentKey, hops, loop: true };
    }
    visited.add(nextKey);
    hops.push(nextKey);
    currentKey = nextKey;
  }

  return { key: currentKey, hops, loop: false };
}
