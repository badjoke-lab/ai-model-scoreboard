import { pickUrl } from "@/lib/v4/evidence-link";

export function pickEvidenceUrl(e: unknown): string | null {
  return pickUrl(e);
}
