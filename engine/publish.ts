/**
 * AMS v4 — Publish Module (Skeleton)
 * -----------------------------------
 * Generates static artifacts in /output/ for UI consumption.
 * No scoring logic or formulas are included.
 */

import fs from "fs/promises";
import path from "path";
import {
  AdoptionArtifacts,
  LayerAssignedModel,
  ModelsJsonEntry,
  NotListedEntry,
  PublishPayload,
  EvidenceArtifacts,
  NormalizedModelData,
} from "./types";

export function buildPublishPayload(
  models: LayerAssignedModel[],
  normalized: NormalizedModelData[],
  adoptionArtifacts: AdoptionArtifacts,
  evidenceArtifacts: EvidenceArtifacts,
  options?: { updatedAt?: string; historyDateStamp?: string }
): PublishPayload {
  const updatedAt = options?.updatedAt ?? new Date().toISOString();
  const rankings = [...models]
    .sort((a, b) => {
      if (b.scores.overall !== a.scores.overall) {
        return b.scores.overall - a.scores.overall;
      }
      return a.id.localeCompare(b.id);
    })
    .map((m) => ({
      model: m.id,
      vendor: m.vendor,
      layer: m.layer,
      score: m.scores.overall,
      scores: m.scores,
      updatedAt: m.updatedAt,
    }));

  const modelsMap: Record<string, ModelsJsonEntry> = {};
  const notListed: NotListedEntry[] = [];
  const normalizedMap = new Map(normalized.map((entry) => [entry.id, entry]));

  const sortedModels = [...models].sort((a, b) => a.id.localeCompare(b.id));
  for (const m of sortedModels) {
    const metadata = normalizedMap.get(m.id)?.metadata ?? m.metadata;
    modelsMap[m.id] = {
      name: metadata?.name || m.id,
      vendor: m.vendor,
      released: metadata?.released,
      context: metadata?.context,
      type: metadata?.type,
      pricing: m.pricing,
      notes: metadata?.notes,
      scores: m.scores,
      layer: m.layer,
    };
    if (m.layer === "not-listed") {
      notListed.push({
        modelKey: m.id,
        reasons: ["scoring_layer_not_listed"],
        source: "scoring",
      });
    }
  }

  const deniedEntries = adoptionArtifacts.decisions.decisions
    .filter((entry) => entry.status === "denied")
    .map((entry) => ({
      modelKey: entry.modelKey,
      reasons: entry.reasons,
      source: entry.source,
    }));

  for (const entry of deniedEntries) {
    if (!notListed.some((existing) => existing.modelKey === entry.modelKey)) {
      notListed.push(entry);
    }
  }

  notListed.sort((a, b) => a.modelKey.localeCompare(b.modelKey));

  const fullCount = models.filter((m) => m.layer === "full").length;
  const provisionalCount = models.filter((m) => m.layer === "provisional").length;
  const evidencePaths = Object.keys(evidenceArtifacts.files)
    .sort()
    .map((modelKey) => `evidence/${modelKey}.json`);
  const manifestFiles = [
    "index.json",
    "latest.json",
    "latest.meta.json",
    "rankings.json",
    "models.json",
    "not-listed.json",
    "adoption.json",
    "decisions.json",
    "evidence/index.json",
    ...evidencePaths,
  ];

  return {
    rankings,
    models: modelsMap,
    notListed,
    index: {
      version: "v4",
      updatedAt,
      manifest: {
        index: "index.json",
        rankings: "rankings.json",
        models: "models.json",
        notListed: "not-listed.json",
        adoption: "adoption.json",
        decisions: "decisions.json",
        evidenceIndex: "evidence/index.json",
        evidence: "evidence/",
        files: manifestFiles,
        evidencePaths,
      },
      modelsCount: models.length,
      fullCount,
      provisionalCount,
      notListedCount: notListed.length,
    },
    history: Object.fromEntries(
      rankings.map((r) => [r.model, { score: r.score, layer: r.layer }])
    ),
    auditLog: {},
    adoption: adoptionArtifacts.adoption,
    decisions: adoptionArtifacts.decisions,
    evidenceIndex: evidenceArtifacts.index,
    evidenceFiles: evidenceArtifacts.files,
  };
}

export async function publishArtifacts(
  data: PublishPayload,
  options?: { historyDateStamp?: string }
): Promise<void> {
  const outputDir = path.resolve("output", "v4");
  const historyDir = path.join(outputDir, "history");
  const logsDir = path.join(outputDir, "logs");
  const evidenceDir = path.join(outputDir, "evidence");

  // 1. Ensure directories exist
  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(historyDir, { recursive: true });
  await fs.mkdir(logsDir, { recursive: true });
  await fs.mkdir(evidenceDir, { recursive: true });

  // 2. Write core artifacts
  await writeJson(path.join(outputDir, "rankings.json"), data.rankings);
  await writeJson(path.join(outputDir, "models.json"), data.models);
  await writeJson(path.join(outputDir, "not-listed.json"), data.notListed);
  await writeJson(path.join(outputDir, "index.json"), data.index);
  await writeJson(path.join(outputDir, "adoption.json"), data.adoption);
  await writeJson(path.join(outputDir, "decisions.json"), data.decisions);
  await writeJson(path.join(evidenceDir, "index.json"), data.evidenceIndex);
  const latestMeta = {
    version: data.index.version,
    updatedAt: data.index.updatedAt,
    modelsCount: data.index.modelsCount,
    fullCount: data.index.fullCount,
    provisionalCount: data.index.provisionalCount,
    notListedCount: data.index.notListedCount,
    evidenceCount: Object.keys(data.evidenceFiles).length,
  };
  const latest = {
    meta: latestMeta,
    rankings: data.rankings,
    models: data.models,
    notListed: data.notListed,
    adoption: data.adoption,
    decisions: data.decisions,
    evidenceIndex: data.evidenceIndex,
    evidenceFiles: data.evidenceFiles,
  };
  await writeJson(path.join(outputDir, "latest.json"), latest);
  await writeJson(path.join(outputDir, "latest.meta.json"), latestMeta);

  const modelKeys = Object.keys(data.evidenceFiles).sort();
  for (const modelKey of modelKeys) {
    const filePath = path.join(evidenceDir, `${modelKey}.json`);
    await writeJson(filePath, data.evidenceFiles[modelKey]);
  }

  // 3. Write daily history file
  const today = options?.historyDateStamp ?? getDateStamp();
  await writeJson(path.join(historyDir, `${today}.json`), data.history);

  // 4. Write audit log
  await writeJson(path.join(logsDir, `audit-${today}.json`), data.auditLog);
}

/**
 * Utility to ensure consistent JSON formatting.
 */
async function writeJson(filePath: string, data: any): Promise<void> {
  const json = JSON.stringify(data, null, 2);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, json + "\n", "utf8");
}

/**
 * Returns YYYY-MM-DD format.
 */
function getDateStamp(): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
