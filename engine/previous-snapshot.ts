/** 
 * previous-snapshot.ts
 * 
 * Skeleton for loading previous day's snapshot.
 * This file must NOT implement any logic beyond:
 * - Attempt to load snapshot.json from artifacts directory (or return null)
 * - Do not throw on failure (fail-safe behavior)
 * 
 * Codex will implement the real logic following Section 3.
 */

import fs from "fs";
import path from "path";

export function loadPreviousDaySnapshot(): any | null {
  try {
    const snapshotPath = path.join(process.cwd(), "artifacts", "snapshot.json");

    if (!fs.existsSync(snapshotPath)) {
      return null; // No snapshot exists (first run)
    }

    const raw = fs.readFileSync(snapshotPath, "utf8");
    return JSON.parse(raw);
  } catch {
    // MUST fail safe — never throw
    return null;
  }
}
