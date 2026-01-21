export const REASON_TEXT_MAP: Record<string, string> = {
  "paper:not_found":
    "No paper or technical report found; transparency and openness scores reduced.",
  "repo_link_missing":
    "No public repository link found; development-activity score reduced.",
  "audit_missing_source_link":
    "No audit source link provided; security and audit score reduced.",
  "not_found": "No verifiable source found; penalty applied per policy.",
  "missing": "Required evidence is missing; penalty applied per policy.",
  "missing_source_link": "A source was referenced but no valid link was provided; penalty applied per policy.",
  "blocked": "Evidence source was blocked; penalty applied per policy.",
  "error": "Evidence lookup failed; penalty applied per policy.",
  "invalid": "Evidence data was invalid; penalty applied per policy.",
  "unknown": "Evidence status unavailable; penalty applied per policy.",
  "outdated": "Evidence exists but is outdated; penalty applied per policy.",
  "openrouter_model_page_only":
    "Only a model registry page was found; primary sources are missing so transparency score was reduced.",
  "no_known_paper_source": "No known paper source found; transparency score reduced.",
  "no_known_audit_source": "No known audit source found; audit score reduced.",
};

const CODE_PATTERN = /^[a-z0-9][a-z0-9._:-]*$/i;

function isLikelyCode(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return CODE_PATTERN.test(trimmed);
}

export function formatReasonSentence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "No reason provided; penalty applied per policy.";
  }
  if (!isLikelyCode(trimmed)) {
    return trimmed;
  }
  const normalized = trimmed.toLowerCase();
  if (REASON_TEXT_MAP[normalized]) {
    return REASON_TEXT_MAP[normalized];
  }
  return `${trimmed} — Evidence indicates missing/failed; penalty applied per policy.`;
}

export function formatReasonList(reasons: string[]): string[] {
  return reasons
    .map((reason) => formatReasonSentence(reason))
    .filter((reason) => reason.trim());
}
