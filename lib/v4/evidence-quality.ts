import { normalizeStatus } from "@/lib/v4/status";
import type { EvidenceItem, V4EvidenceKey } from "@/types/v4";

const EVIDENCE_KEYS: V4EvidenceKey[] = ["official_page", "dev_activity", "paper", "audit"];
const MAX_SCORE = 4.0;

const TYPE_WEIGHTS: Record<V4EvidenceKey, number> = {
  official_page: 1.5,
  dev_activity: 1.0,
  paper: 1.0,
  audit: 0.5,
};

const STATUS_FACTORS: Record<string, number> = {
  ok: 1.0,
  missing_source_link: 0.5,
  ambiguous: 0.25,
  rate_limited: 0.0,
  blocked: 0.0,
  not_found: 0.0,
  invalid: 0.0,
  missing: 0.0,
};

export type EvidenceQualityBreakdown = {
  type: V4EvidenceKey;
  status: string;
  weight: number;
  factor: number;
  points: number;
};

export type EvidenceQualityResult = {
  quality: number;
  earnedPoints: number;
  maxPoints: number;
  breakdown: EvidenceQualityBreakdown[];
};

export function calculateEvidenceQuality(evidence: EvidenceItem[] = []): EvidenceQualityResult {
  const byType = new Map<V4EvidenceKey, EvidenceItem>(evidence.map((item) => [item.type, item]));

  const breakdown = EVIDENCE_KEYS.map((type) => {
    const item = byType.get(type);
    const status = normalizeStatus(item?.status ?? "missing", "evidence");
    const weight = TYPE_WEIGHTS[type];
    const factor = STATUS_FACTORS[status] ?? 0.0;
    const points = weight * factor;

    return {
      type,
      status,
      weight,
      factor,
      points,
    };
  });

  const earnedPoints = breakdown.reduce((total, row) => total + row.points, 0);
  const quality = Math.round((earnedPoints / MAX_SCORE) * 100);

  return {
    quality,
    earnedPoints,
    maxPoints: MAX_SCORE,
    breakdown,
  };
}
