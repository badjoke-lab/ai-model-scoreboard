const WITHHELD_PATTERN = /withheld/i;

export const SPEC_MISSING_EVIDENCE_MESSAGE =
  "Spec missing evidence: evidence URLs are required for this score.";

type EvidenceRef = {
  link?: string | null;
  refs?: string[] | null;
};

type FlagTarget = {
  status?: string | null;
  score?: number | null;
  why?: string | null;
  withheldReason?: string | null;
  specMissingEvidence?: boolean | null;
  missingEvidenceRule?: boolean | null;
  evidenceUrls?: string[] | null;
  usedEvidence?: EvidenceRef[] | null;
};

function hasWithheldKeyword(value: unknown): boolean {
  return typeof value === "string" && WITHHELD_PATTERN.test(value);
}

function hasEmptyEvidence(target: FlagTarget): boolean {
  const evidenceUrlsEmpty =
    Array.isArray(target.evidenceUrls) && target.evidenceUrls.length === 0;
  const usedEvidenceEmpty =
    Array.isArray(target.usedEvidence) &&
    target.usedEvidence.every(
      (entry) =>
        !entry?.link && !(Array.isArray(entry?.refs) && entry.refs.length > 0)
    );

  return evidenceUrlsEmpty || usedEvidenceEmpty;
}

export function isWithheldScore(target: FlagTarget | null | undefined): boolean {
  if (!target) return false;
  if (target.status === "WITHHELD") return true;
  if ("score" in target && (target.score == null || Number.isNaN(target.score))) return true;
  return hasWithheldKeyword(target.withheldReason) || hasWithheldKeyword(target.why);
}

export function isSpecMissingEvidence(target: FlagTarget | null | undefined): boolean {
  if (!target) return false;
  if (target.specMissingEvidence === true) return true;
  if (target.missingEvidenceRule === true && hasEmptyEvidence(target)) return true;
  return target.status === "missing_source_link";
}

export function getFlagStyle(target: FlagTarget | null | undefined): {
  tone: "default" | "warning" | "danger";
  label: "WITHHELD" | "SPEC VIOLATION" | null;
  message: string | null;
} {
  if (!target) return { tone: "default", label: null, message: null };

  if (isWithheldScore(target)) {
    const reason =
      (typeof target.why === "string" && target.why.trim()) ||
      (typeof target.withheldReason === "string" && target.withheldReason.trim()) ||
      "Score withheld: evidence or input data is unavailable.";
    return {
      tone: "warning",
      label: "WITHHELD",
      message: reason,
    };
  }

  if (isSpecMissingEvidence(target)) {
    return {
      tone: "danger",
      label: "SPEC VIOLATION",
      message: SPEC_MISSING_EVIDENCE_MESSAGE,
    };
  }

  return { tone: "default", label: null, message: null };
}
