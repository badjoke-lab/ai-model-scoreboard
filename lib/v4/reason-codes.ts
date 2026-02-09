// lib/v4/reason-codes.ts
export const REASON = {
  // manual
  MANUAL_OVERRIDE: "manual:override",

  // auto (deterministic)
  AUTO_MODEL_MAP: "auto:model_map",
  AUTO_PROVIDER_MAP: "auto:provider_map",

  // auto (non-deterministic / avoid ok)
  AUTO_GUESSED: "auto:guessed",
  AUTO_NOT_SEARCHED: "auto:not_searched",

  // missing
  MISSING_REASONS: "missing:reasons",
  MISSING_URL: "missing:url",
  MISSING_TYPE_PREFIX: "missing:type:", // + <type>

  // fetch / http
  HTTP_429: "fetch:http_429",
  HTTP_403: "fetch:http_403",
  HTTP_404: "fetch:http_404",
  FETCH_FAILED: "fetch:failed",

  // parse
  PARSE_FAILED: "parse:failed",

  // policy / safety
  POLICY_SAFETY: "policy:safety",
} as const;

export type ReasonCode =
  | (typeof REASON)[keyof typeof REASON]
  | `${typeof REASON.MISSING_TYPE_PREFIX}${string}`;
