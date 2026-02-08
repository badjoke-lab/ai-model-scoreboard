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

export type Status = typeof STATUS[number];

const STATUS_SET = new Set<Status>(STATUS);

export function isStatus(value: unknown): value is Status {
  return typeof value === "string" && STATUS_SET.has(value as Status);
}

type StatusContext = "evidence" | "raw" | "breakdown";

export function normalizeStatus(input: unknown, context?: StatusContext): Status {
  if (input === null || input === undefined) return "missing";
  if (typeof input !== "string") return "invalid";
  const trimmed = input.trim();
  if (!trimmed) return "missing";
  const normalized = trimmed.toLowerCase();
  if (isStatus(normalized)) return normalized;

  const missingValues = new Set(["not found", "404", "missing"]);
  if (missingValues.has(normalized)) {
    return context === "raw" ? "missing" : "not_found";
  }
  if (["rate-limit", "rate limit", "429"].includes(normalized)) {
    return "rate_limited";
  }
  if (["forbidden", "403"].includes(normalized)) {
    return "blocked";
  }
  if (["ambig", "multiple matches"].includes(normalized)) {
    return "ambiguous";
  }
  if (["no source link", "missing link"].includes(normalized)) {
    return "missing_source_link";
  }
  return "invalid";
}

export function normalizeReasons(reasons: unknown): string[] {
  const normalized: string[] = [];
  if (Array.isArray(reasons)) {
    reasons.forEach((entry) => {
      if (typeof entry === "string" && entry.trim()) {
        normalized.push(entry.trim());
      }
    });
  } else if (typeof reasons === "string" && reasons.trim()) {
    normalized.push(reasons.trim());
  }

  return normalized.length ? normalized : ["missing_reasons"];
}
