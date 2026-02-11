const DASH_VARIANTS = /[‐‑‒–—―ー－]+/g;
const WHITESPACE_OR_UNDERSCORE = /[\s_]+/g;
const DISALLOWED_CHARS = /[^a-z0-9./-]+/g;
const MULTI_DASH = /-+/g;

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

