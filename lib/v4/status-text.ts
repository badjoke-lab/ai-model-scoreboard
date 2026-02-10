export type UiStatus =
  | "ok"
  | "not_found"
  | "blocked"
  | "rate_limited"
  | "ambiguous"
  | "invalid"
  | "missing_source_link"
  | "missing";

export const STATUS_TEXT: Record<UiStatus, { label: string; description: string }> = {
  ok: { label: "ok", description: "Source was found and linked." },
  not_found: { label: "not_found", description: "No reliable source was found." },
  blocked: { label: "blocked", description: "Access is restricted (login/403, etc.)." },
  rate_limited: { label: "rate_limited", description: "Rate limited (429, etc.)." },
  ambiguous: {
    label: "ambiguous",
    description: "Multiple candidates exist; cannot disambiguate safely.",
  },
  invalid: { label: "invalid", description: "Unsupported or changed format; cannot parse." },
  missing_source_link: {
    label: "missing_source_link",
    description: "Not enough to claim a primary source link.",
  },
  missing: { label: "missing", description: "Value is missing." },
};

export function toUiStatus(x: unknown): UiStatus {
  const s = (typeof x === "string" ? x : "").trim() as UiStatus;
  return s && s in STATUS_TEXT ? s : "missing";
}
