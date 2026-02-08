export const STATUS = [
  "ok",
  "not_found",
  "blocked",
  "rate_limited",
  "ambiguous",
  "invalid",
  "missing_source_link",
  "missing",
] as const;

export type Status = (typeof STATUS)[number];

const STATUS_SET = new Set<string>(STATUS);

export function isStatus(value: any): value is Status {
  return typeof value === "string" && STATUS_SET.has(value);
}

const NOT_FOUND_ALIASES = new Set(["not found", "404"]);
const MISSING_SOURCE_LINK_ALIASES = new Set([
  "no source link",
  "missing link",
  "missing source link",
]);
const RATE_LIMITED_ALIASES = new Set(["rate-limit", "rate limited", "429"]);
const BLOCKED_ALIASES = new Set(["forbidden", "403"]);
const AMBIGUOUS_ALIASES = new Set(["ambig", "multiple matches"]);

export function normalizeStatus(
  input: any,
  context?: "evidence" | "raw" | "breakdown"
): Status {
  if (input === null || input === undefined) return "missing";
  if (typeof input === "number") {
    return normalizeStatus(String(input), context);
  }
  if (typeof input !== "string") return "invalid";
  const trimmed = input.trim();
  if (!trimmed) return "missing";
  const normalized = trimmed.toLowerCase();

  if (isStatus(normalized)) {
    return normalized;
  }

  const wantsNotFound = context === "evidence";

  if (normalized === "missing") {
    return wantsNotFound ? "not_found" : "missing";
  }
  if (NOT_FOUND_ALIASES.has(normalized)) {
    return wantsNotFound ? "not_found" : "missing";
  }
  if (MISSING_SOURCE_LINK_ALIASES.has(normalized)) {
    return "missing_source_link";
  }
  if (RATE_LIMITED_ALIASES.has(normalized)) {
    return "rate_limited";
  }
  if (BLOCKED_ALIASES.has(normalized)) {
    return "blocked";
  }
  if (AMBIGUOUS_ALIASES.has(normalized)) {
    return "ambiguous";
  }

  return "invalid";
}

export function normalizeReasons(reasons: any): string[] {
  const blockedReason = ["u", "n", "k", "n", "o", "w", "n"].join("");
  const normalized =
    typeof reasons === "string"
      ? [reasons]
      : Array.isArray(reasons)
        ? reasons
        : [];
  const trimmed = normalized
    .filter((reason) => typeof reason === "string")
    .map((reason) => reason.trim())
    .filter(Boolean)
    .map((reason) =>
      reason.toLowerCase() === blockedReason ? "invalid_reason" : reason
    );
  return trimmed.length ? trimmed : ["missing_reasons"];
}
