import { describe, expect, it } from "vitest";

import { calculateEvidenceQuality } from "@/lib/v4/evidence-quality";
import type { EvidenceItem } from "@/types/v4";

describe("calculateEvidenceQuality", () => {
  it("calculates weighted quality with status factors", () => {
    const evidence: EvidenceItem[] = [
      { type: "official_page", status: "ok", reasons: [], refs: [] },
      { type: "dev_activity", status: "missing_source_link", reasons: [], refs: [] },
      { type: "paper", status: "ambiguous", reasons: [], refs: [] },
      { type: "audit", status: "blocked", reasons: [], refs: [] },
    ];

    const result = calculateEvidenceQuality(evidence);

    expect(result.earnedPoints).toBe(2.25);
    expect(result.quality).toBe(56);
  });

  it("treats missing evidence types as missing with zero points", () => {
    const evidence: EvidenceItem[] = [{ type: "official_page", status: "ok", reasons: [], refs: [] }];

    const result = calculateEvidenceQuality(evidence);

    expect(result.breakdown).toHaveLength(4);
    expect(result.breakdown.find((row) => row.type === "dev_activity")?.status).toBe("missing");
    expect(result.quality).toBe(38);
  });
});
