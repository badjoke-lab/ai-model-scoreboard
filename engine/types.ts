/**
 * AMS v4 — Complete Type Definitions
 * ------------------------------------
 * These interfaces formalize all data structures used by the engine.
 *
 * No logic, formulas, or thresholds are included.
 * These types are stable and version-controlled as part of AMS v4.
 */

/* -------------------------------------------------------
 * 0. ID & Vendor Types
 * -----------------------------------------------------*/

export type ModelID = string;      // canonical ID (e.g. "gpt-4.1")
export type VendorID = string;     // normalized vendor name (e.g. "OpenAI")

/* -------------------------------------------------------
 * 1. Raw external data before normalization
 *    (directly fetched; not yet validated)
 * -----------------------------------------------------*/

export interface RawBootstrapModel {
  id: string;
  provider: string;
  family?: string;
  displayName?: string;
  tier?: string;
  releaseDate?: string;
  contextLengthTokens?: number;
  pricing?: {
    inputUsdPer1k?: number;
    outputUsdPer1k?: number;
  };
  benchmarks?: {
    mmlu?: number;
    arenaElo?: number;
  };
  safety?: {
    incidents?: number;
  };
}

export interface OpenRouterModelRaw {
  id: string;
  canonical_slug?: string;
  name?: string;
  created?: number;
  context_length?: number;
  pricing?: any;
  architecture?: any;
  top_provider?: {
    id?: string;
    name?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface SeedModelEntry {
  modelKey: string;
  name: string;
  provider: string;
}

export interface RawModelData {
  id: string;             // as provided by external source
  vendor: string;         // raw vendor label
  metadata: any;          // model metadata (raw)
  pricing?: any;          // raw pricing info
  benchmarks?: any;       // raw benchmark results
  incidents?: any;        // raw safety incidents
  apiStatus?: any;        // raw API/runtime health info
}

/* -------------------------------------------------------
 * 2. Normalized data (canonical & cleaned)
 * -----------------------------------------------------*/

export interface NormalizedModelData {
  id: ModelID;            // canonicalized
  vendor: VendorID;       // canonicalized vendor name
  metadata: {
    name: string;
    released?: string;
    context?: number;
    type?: string;        // "text", "vision", "audio", etc.
    notes?: string;
  };
  pricing: {
    input?: number;       // may be undefined if missing
    output?: number;
    currency?: string;
  };
  benchmarks: any;        // structural form defined in scoring engine
  incidents: any;         // normalized safety incident data
  apiStatus: any;         // uptime/runtime information
}

/* -------------------------------------------------------
 * 3. After fallback rules applied
 * -----------------------------------------------------*/

export interface FallbackAdjustedData extends NormalizedModelData {
  fallbackApplied: boolean;   // true if fallback logic altered the data
  fallbackNotes?: string[];   // optional trace of fallback operations
}

/* -------------------------------------------------------
 * 4. Scored model (before layer assignment)
 * -----------------------------------------------------*/

export type ScoreCategoryKey =
  | "performance"
  | "safety"
  | "adoption"
  | "openness"
  | "cost";

export type ScoreItemKey =
  | "S1"
  | "S2"
  | "S3"
  | "S4"
  | "S5"
  | "S6"
  | "S7"
  | "S8"
  | "T1"
  | "T2"
  | "T3"
  | "T4"
  | "Q1"
  | "Q2"
  | "Q3";

export interface ScoreItemEvidenceUsage {
  type: EvidenceType;
  status: EvidenceStatus;
  link?: string;
  url?: string;
  label?: string;
}

export type ScoreItemStatus = "ok" | "missing_evidence" | "missing_inputs";

export interface ScoreItemDetail {
  label?: string;
  score: number | null;
  status?: ScoreItemStatus;
  verified?: boolean;
  why?: string;
  policyImpact?: string;
  __specMissingEvidenceLink?: boolean;
  inputs: Record<string, any>;
  usedEvidence: ScoreItemEvidenceUsage[];
  penaltyReasons: string[];
}

export interface ScoresOutput {
  overall: number;
  categories: Record<ScoreCategoryKey, number>;
  items: Record<ScoreItemKey, ScoreItemDetail>;
}

export interface ScoredModel {
  id: ModelID;
  vendor: VendorID;
  metadata: NormalizedModelData["metadata"];
  pricing: NormalizedModelData["pricing"];
  scores: ScoresOutput;
  finalScore: number;         // 0–100
  updatedAt: string;          // ISO date string
}

/* -------------------------------------------------------
 * 5. Model with layer assignment
 * -----------------------------------------------------*/

export type Layer = "full" | "provisional" | "not-listed";

export interface LayerAssignedModel extends ScoredModel {
  layer: Layer;
}

/* -------------------------------------------------------
 * 6. Artifacts format for publish() output
 * -----------------------------------------------------*/

export interface RankingsJsonEntry {
  model: ModelID;
  vendor: VendorID;
  layer: Layer;
  score: number;
  scores: ScoresOutput;
  updatedAt: string;
}

export interface ModelsJsonEntry {
  name: string;
  vendor: VendorID;
  released?: string;
  context?: number;
  type?: string;
  pricing?: {
    input?: number;
    output?: number;
    currency?: string;
  };
  notes?: string;
  scores?: ScoresOutput;
  layer?: Layer;
}

export interface NotListedEntry {
  modelKey: ModelID;
  reasons: string[];
  source?: "openrouter" | "seed" | "scoring";
}

export interface PublishPayload {
  rankings: RankingsJsonEntry[];
  models: Record<ModelID, ModelsJsonEntry>;
  notListed: NotListedEntry[];
  index: {
    version: string;
    updatedAt: string;
    manifest: Record<string, string | string[]>;
    modelsCount: number;
    fullCount: number;
    provisionalCount: number;
    notListedCount: number;
  };
  history: Record<ModelID, { score: number; layer: Layer }>;
  auditLog: Record<string, any>;
  adoption: AdoptionOutput;
  decisions: DecisionsLog;
  evidenceIndex: EvidenceIndex;
  evidenceFiles: Record<ModelID, EvidenceModelFile>;
}

export interface AdoptionSummary {
  modelKey: string;
  name: string | null;
  provider: string | null;
  source: "openrouter" | "seed";
}

export interface AdoptionOutput {
  adopted: AdoptionSummary[];
  provisional: AdoptionSummary[];
}

export interface AdoptionDecisionEntry {
  modelKey: string;
  source: "openrouter" | "seed";
  status: "adopted" | "provisional" | "denied";
  reasons: string[];
  normalized: {
    name: string | null;
    slug: string;
    provider: string | null;
  };
  rawRef: {
    id?: string;
    canonical_slug?: string;
  };
}

export interface DecisionsLog {
  meta: {
    generatedAt: string;
    requiredFields: string[];
    allowlistCount: number;
    denylistCount: number;
    totals: {
      total: number;
      adopted: number;
      provisional: number;
      denied: number;
      sources: {
        openrouter: number;
        seed: number;
      };
    };
    rules: {
      allowlist: string[];
      denylist: string[];
    };
  };
  decisions: AdoptionDecisionEntry[];
}

export interface AdoptionArtifacts {
  adoption: AdoptionOutput;
  decisions: DecisionsLog;
}

export type EvidenceType =
  | "official_page"
  | "dev_activity"
  | "paper"
  | "audit";

export type EvidenceStatus =
  | "ok"
  | "not_found"
  | "ambiguous"
  | "rate_limited"
  | "blocked"
  | "invalid"
  | "missing_source_link";

export interface EvidenceItem {
  type: EvidenceType;
  status: EvidenceStatus;
  reasons: string[];
  refs: string[];
  extracted?: Record<string, any>;
}

export interface EvidenceModelFile {
  meta: {
    updatedAt: string;
    modelKey: ModelID;
  };
  evidenceItems: EvidenceItem[];
}

export interface EvidenceIndex {
  meta: {
    version: string;
    updatedAt: string;
    runId?: string;
  };
  models: { modelKey: ModelID; path: string }[];
}

export interface EvidenceArtifacts {
  index: EvidenceIndex;
  files: Record<ModelID, EvidenceModelFile>;
}
