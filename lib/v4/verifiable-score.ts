export type V4VerifiableEvidence = {
  type: string;
  url: string;
  date?: string;
  notes?: string;
};

export type V4VerifiableScoreItem = {
  id: string;
  label: string;
  score: number | null;
  inputs: Record<string, unknown> | Array<unknown> | null;
  why: string | null;
  usedEvidence: V4VerifiableEvidence[];
};

export type VerifiableScoreCheck = {
  isVerifiable: boolean;
  missing: string[];
};

const httpUrlRegex = /^https?:\/\//i;

export function isHttpUrl(value: string): boolean {
  return httpUrlRegex.test(value.trim());
}

export function checkVerifiableScore(
  item: {
    score: number | null;
    inputs: Array<[string, string]>;
    why?: string | null;
    usedEvidence: Array<{ link?: string; url?: string }>;
  }
): VerifiableScoreCheck {
  if (typeof item.score !== "number" || Number.isNaN(item.score)) {
    return { isVerifiable: false, missing: [] };
  }

  const missing: string[] = [];
  const hasInputs = item.inputs.some(([key, value]) => {
    if (!key.trim()) return false;
    const normalizedValue = value.trim();
    if (!normalizedValue) return false;
    if (key.trim() === "note" && normalizedValue === "missing_inputs") return false;
    return true;
  });
  if (!hasInputs) missing.push("inputs");

  const hasWhy = typeof item.why === "string" && item.why.trim().length > 0;
  if (!hasWhy) missing.push("why");

  const hasEvidence = item.usedEvidence.some((entry) => {
    const link = typeof entry.link === "string" ? entry.link.trim() : "";
    const url = typeof entry.url === "string" ? entry.url.trim() : "";
    return (link && isHttpUrl(link)) || (url && isHttpUrl(url));
  });
  if (!hasEvidence) missing.push("evidence");

  return { isVerifiable: missing.length === 0, missing };
}
