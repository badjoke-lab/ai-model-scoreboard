// lib/v4/reasons.ts
import { REASON, type ReasonCode } from "./reason-codes";

function uniq<T>(xs: T[]): T[] {
  return Array.from(new Set(xs));
}

function toStrArray(x: any): string[] {
  if (!x) return [];
  if (Array.isArray(x)) return x.map(String).map((s) => s.trim()).filter(Boolean);
  return [String(x).trim()].filter(Boolean);
}

function normalizeMissingType(s: string): string | null {
  // legacy: "missing_evidence_type:audit"
  const m = s.match(/^missing_evidence_type\s*:\s*([a-z_]+)$/i);
  if (m) return `${REASON.MISSING_TYPE_PREFIX}${m[1].toLowerCase()}`;
  return null;
}

function looksLikeHttp(s: string): ReasonCode[] {
  const out: ReasonCode[] = [];
  if (/\b429\b/.test(s)) out.push(REASON.HTTP_429);
  if (/\b403\b/.test(s)) out.push(REASON.HTTP_403);
  if (/\b404\b/.test(s)) out.push(REASON.HTTP_404);
  return out;
}

export function normalizeReasons(raw: any): string[] {
  const inArr = toStrArray(raw);
  if (inArr.length === 0) return [REASON.MISSING_REASONS];

  const codes: string[] = [];
  const notes: string[] = [];

  for (const s0 of inArr) {
    const s = s0.trim();
    if (!s) continue;

    // already new-style code?
    if (
      s.startsWith("manual:") ||
      s.startsWith("auto:") ||
      s.startsWith("missing:") ||
      s.startsWith("fetch:") ||
      s.startsWith("parse:") ||
      s.startsWith("policy:")
    ) {
      codes.push(s);
      continue;
    }

    // legacy conversions
    const missType = normalizeMissingType(s);
    if (missType) {
      codes.push(missType);
      continue;
    }

    if (s === "manual_override") {
      codes.push(REASON.MANUAL_OVERRIDE);
      continue;
    }
    if (s === "auto:model_map") {
      codes.push(REASON.AUTO_MODEL_MAP);
      continue;
    }
    if (s === "auto:provider_map") {
      codes.push(REASON.AUTO_PROVIDER_MAP);
      continue;
    }
    if (s === "auto:not_searched") {
      codes.push(REASON.AUTO_NOT_SEARCHED);
      continue;
    }
    if (
      s.includes("missing_source_link") ||
      s.includes("repo_link_missing") ||
      s.includes("no_known_")
    ) {
      codes.push(REASON.MISSING_URL);
    }

    // http hints
    for (const c of looksLikeHttp(s)) codes.push(c);

    // fallback note (keep limited)
    notes.push(`note:${s}`);
  }

  const out = uniq(codes);
  const outNotes = uniq(notes).slice(0, 2);

  if (out.length === 0) out.push(REASON.MISSING_REASONS);
  return out.concat(outNotes);
}
