/**
 * AMS v4 — Normalization Module (Skeleton)
 * -----------------------------------------
 * Responsibilities:
 *  - Validate raw model data
 *  - Canonicalize model and vendor names
 *  - Apply schema-level checks
 *  - Sanitize values (remove nulls, fix types, etc.)
 *  - Produce NormalizedModelData[]
 *
 * No scoring logic, thresholds, or formulas are included.
 */

import fs from "fs";
import path from "path";
import { RawModelData, NormalizedModelData, VendorID, ModelID } from "./types";

const canonicalNames: Record<string, string> = loadCanonicalNames();

/**
 * Entry point
 */
export function normalizeData(rawList: RawModelData[]): NormalizedModelData[] {
  const normalized: NormalizedModelData[] = [];

  for (const raw of rawList) {
    const id = canonicalizeModelID(raw.id);
    const vendor = canonicalizeVendor(raw.vendor);

    const cleanMetadata = sanitizeMetadata(raw.metadata);
    const cleanPricing = sanitizePricing(raw.pricing);
    const cleanBenchmarks = sanitizeBenchmarks(raw.benchmarks);
    const cleanIncidents = sanitizeIncidents(raw.incidents);
    const cleanApiStatus = sanitizeApiStatus(raw.apiStatus);

    normalized.push({
      id,
      vendor,
      metadata: cleanMetadata,
      pricing: cleanPricing,
      benchmarks: cleanBenchmarks,
      incidents: cleanIncidents,
      apiStatus: cleanApiStatus,
    });
  }

  return normalized;
}

/* -------------------------------------------------------
 * Canonical Name Mapping
 * -----------------------------------------------------*/

/**
 * Normalize model ID to its canonical form.
 * Uses canonical-names.json mapping table.
 */
function canonicalizeModelID(rawId: string): ModelID {
  const id = (rawId || "").trim().toLowerCase();
  return canonicalNames[id] || id;
}

/**
 * Normalize vendor names (simple skeleton).
 * Additional vendor maps may be added in private engine.
 */
function canonicalizeVendor(rawVendor: string): VendorID {
  return (rawVendor || "").trim();
}

/* -------------------------------------------------------
 * Sanitizers (structure only, no logic)
 * -----------------------------------------------------*/

function sanitizeMetadata(metadata: any): NormalizedModelData["metadata"] {
  return {
    name: safeString(metadata?.name) || "unknown",
    released: safeString(metadata?.released),
    context: safeNumber(metadata?.context),
    type: safeString(metadata?.type),
    notes: safeString(metadata?.notes),
  };
}

function sanitizePricing(pricing: any): NormalizedModelData["pricing"] {
  return {
    input: safeNumber(pricing?.input),
    output: safeNumber(pricing?.output),
    currency: safeString(pricing?.currency) || "USD",
  };
}

function sanitizeBenchmarks(bench: any): any {
  if (!bench || typeof bench !== "object") return {};
  return {
    general: safeNumber(bench.general),
    coding: safeNumber(bench.coding),
    math: safeNumber(bench.math),
    chat: safeNumber(bench.chat),
    arena: safeNumber(bench.arena),
    vendor: safeNumber(bench.vendor),
  };
}

function sanitizeIncidents(inc: any): any {
  if (!inc || typeof inc !== "object") return {};
  return {
    minor: safeNumber(inc.minor),
    major: safeNumber(inc.major),
    critical: safeNumber(inc.critical),
    posture: inc.posture || {},
  };
}

function sanitizeApiStatus(api: any): any {
  if (!api || typeof api !== "object") return {};
  return {
    uptime: safeNumber(api.uptime),
    outages: safeNumber(api.outages),
    updatedAt: safeString(api.updatedAt),
    docs: safeNumber(api.docs),
    sdkClients: api.sdkClients,
    sdkFrameworks: api.sdkFrameworks,
    ossConnectorStars: safeNumber(api.ossConnectorStars),
    ossMaintained: api.ossMaintained,
    versioning: api.versioning,
    changelog: api.changelog,
  };
}

/* -------------------------------------------------------
 * Utility value guards
 * (no logic, only safe coercions)
 * -----------------------------------------------------*/

function safeString(v: any): string | undefined {
  if (typeof v === "string" && v.trim() !== "") return v.trim();
  return undefined;
}

function safeNumber(v: any): number | undefined {
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

/* -------------------------------------------------------
 * Shared normalization helpers
 * -----------------------------------------------------*/

export function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeRange(
  value: number | undefined,
  min: number,
  max: number
): number {
  if (value === undefined || !Number.isFinite(value)) return 0;
  if (max === min) return 0;
  const scaled = ((value - min) / (max - min)) * 100;
  return clamp(scaled);
}

function loadCanonicalNames(): Record<string, string> {
  const filePath = path.join(process.cwd(), "canonical-names.json");
  if (!fs.existsSync(filePath)) return {};
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
