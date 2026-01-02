import { readFile, readdir as readDir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const outputDir = path.resolve("output", "v4");
const targets = {
  "index.json": validateIndex,
  "latest.json": validateLatest,
  "latest.meta.json": validateLatestMeta,
  "rankings.json": validateRankings,
  "models.json": validateModels,
  "not-listed.json": validateNotListed,
  "adoption.json": validateAdoption,
  "decisions.json": validateDecisions,
  "evidence/index.json": validateEvidenceIndex,
};

const SCORE_ITEM_KEYS = [
  "S1",
  "S2",
  "S3",
  "S4",
  "S5",
  "S6",
  "S7",
  "S8",
  "T1",
  "T2",
  "T3",
  "T4",
  "Q1",
  "Q2",
  "Q3",
];

const EVIDENCE_TYPES = ["official_page", "dev_activity", "paper", "audit"];
const EVIDENCE_STATUSES = [
  "ok",
  "not_found",
  "ambiguous",
  "rate_limited",
  "blocked",
  "invalid",
  "missing_source_link",
];

const errors = [];
let expectedEvidenceModels = [];

for (const [file, validator] of Object.entries(targets)) {
  const fullPath = path.join(outputDir, file);
  if (!existsSync(fullPath)) {
    errors.push(`Missing file: ${fullPath}`);
    continue;
  }

  try {
    const raw = await readFile(fullPath, "utf8");
    const parsed = JSON.parse(raw);
    validator(parsed, fullPath);
  } catch (err) {
    errors.push(`Failed to parse ${fullPath}: ${err}`);
  }
}

if (errors.length > 0) {
  console.error("[validate_output] Validation failed:");
  for (const msg of errors) {
    console.error(`- ${msg}`);
  }
  process.exit(1);
}

const evidenceDir = path.join(outputDir, "evidence");
const evidenceIndexPath = path.join(evidenceDir, "index.json");
if (!existsSync(evidenceDir)) {
  errors.push(`Missing directory: ${evidenceDir}`);
} else if (!existsSync(evidenceIndexPath)) {
  errors.push(`Missing evidence index: ${evidenceIndexPath}`);
} else {
  const { readFile } = await import("node:fs/promises");
  const idx = JSON.parse(await readFile(evidenceIndexPath, "utf8"));
  for (const m of idx.models || []) {
    const fullPath = path.join(outputDir, m.path);
    if (!existsSync(fullPath)) {
      errors.push(`Missing evidence file: ${fullPath}`);
      continue;
    }
    const parsed = JSON.parse(await readFile(fullPath, "utf8"));
    validateEvidenceFile(parsed, fullPath);
  }
}

if (errors.length > 0) {
  console.error("[validate_output] Validation failed:");
  for (const msg of errors) {
    console.error(`- ${msg}`);
  }
  process.exit(1);
}

console.log("[validate_output] output/v4 JSON files look valid.");

function validateIndex(data, filePath) {
  if (!isRecord(data) || Array.isArray(data)) {
    errors.push(`${filePath} must be a JSON object.`);
    return;
  }

  if (!isNonEmptyString(data.version)) {
    errors.push(`${filePath} must include a non-empty string field: version.`);
  }

  if (!isNonEmptyString(data.updatedAt)) {
    errors.push(`${filePath} must include a non-empty string field: updatedAt.`);
  }

  validateNonNegativeNumber(filePath, "modelsCount", data.modelsCount);
  validateNonNegativeNumber(filePath, "fullCount", data.fullCount);
  validateNonNegativeNumber(filePath, "provisionalCount", data.provisionalCount);
  validateNonNegativeNumber(filePath, "notListedCount", data.notListedCount);

  if (!isRecord(data.manifest)) {
    errors.push(`${filePath} must include manifest object.`);
  } else {
    if (!Array.isArray(data.manifest.files) || data.manifest.files.length === 0) {
      errors.push(`${filePath} manifest.files must be a non-empty array.`);
    }
    if (
      !Array.isArray(data.manifest.evidencePaths) ||
      data.manifest.evidencePaths.length === 0
    ) {
      errors.push(`${filePath} manifest.evidencePaths must be a non-empty array.`);
    }
  }
}

function validateLatest(data, filePath) {
  if (!isRecord(data) || Array.isArray(data)) {
    errors.push(`${filePath} must be a JSON object.`);
    return;
  }

  if (!isRecord(data.meta)) {
    errors.push(`${filePath} must include meta object.`);
  } else {
    validateLatestMeta(data.meta, `${filePath} meta`);
  }

  validateRankings(data.rankings, `${filePath} rankings`);
  validateModels(data.models, `${filePath} models`);
  validateNotListed(data.notListed, `${filePath} not-listed`);
  validateAdoption(data.adoption, `${filePath} adoption`);
  validateDecisions(data.decisions, `${filePath} decisions`);
  validateEvidenceIndex(data.evidenceIndex, `${filePath} evidence index`);

  if (!isRecord(data.evidenceFiles) || Array.isArray(data.evidenceFiles)) {
    errors.push(`${filePath} evidenceFiles must be an object.`);
  } else {
    Object.entries(data.evidenceFiles).forEach(([modelKey, entry]) => {
      validateEvidenceFile(entry, `${filePath} evidenceFiles.${modelKey}`);
    });
  }
}

function validateLatestMeta(data, filePath) {
  if (!isRecord(data) || Array.isArray(data)) {
    errors.push(`${filePath} must be a JSON object.`);
    return;
  }
  if (!isNonEmptyString(data.version)) {
    errors.push(`${filePath} must include a non-empty string field: version.`);
  }
  if (!isNonEmptyString(data.updatedAt)) {
    errors.push(`${filePath} must include a non-empty string field: updatedAt.`);
  }
  for (const key of [
    "modelsCount",
    "fullCount",
    "provisionalCount",
    "notListedCount",
    "evidenceCount",
  ]) {
    validateNonNegativeNumber(filePath, key, data[key]);
  }
}

function validateRankings(data, filePath) {
  if (!Array.isArray(data)) {
    errors.push(`${filePath} must be an array.`);
    return;
  }

  data.forEach((item, idx) => {
    if (!isRecord(item)) {
      errors.push(`${filePath}[${idx}] must be an object.`);
      return;
    }
    for (const key of ["model", "vendor", "layer", "score"]) {
      if (!(key in item)) {
        errors.push(`${filePath}[${idx}] is missing required field: ${key}`);
      }
    }
    if ("scores" in item) {
      validateScores(item.scores, `${filePath}[${idx}].scores`);
    }
  });
  for (let i = 1; i < data.length; i += 1) {
    const prev = data[i - 1];
    const current = data[i];
    if (prev.score < current.score) {
      errors.push(`${filePath} ordering invalid at index ${i}.`);
      break;
    }
    if (prev.score === current.score && prev.model.localeCompare(current.model) > 0) {
      errors.push(`${filePath} tie-break invalid at index ${i}.`);
      break;
    }
  }
}

function validateModels(data, filePath) {
  if (!isRecord(data) || Array.isArray(data)) {
    errors.push(`${filePath} must be an object (map keyed by slug).`);
    return;
  }

  Object.entries(data).forEach(([slug, entry]) => {
    if (!isRecord(entry)) {
      errors.push(`${filePath} entry for ${slug} must be an object.`);
      return;
    }
    for (const key of ["name", "vendor"]) {
      if (!(key in entry)) {
        errors.push(`${filePath} entry for ${slug} is missing required field: ${key}`);
      }
    }
    if ("scores" in entry) {
      validateScores(entry.scores, `${filePath} entry for ${slug}.scores`);
    }
  });
}

function validateNotListed(data, filePath) {
  if (!Array.isArray(data)) {
    errors.push(`${filePath} must be an array.`);
    return;
  }
  data.forEach((entry, idx) => {
    if (!isRecord(entry)) {
      errors.push(`${filePath}[${idx}] must be an object.`);
      return;
    }
    if (!("modelKey" in entry)) {
      errors.push(`${filePath}[${idx}] missing required field: modelKey`);
    }
    if (!Array.isArray(entry.reasons)) {
      errors.push(`${filePath}[${idx}] field reasons must be an array.`);
    }
  });
}

function validateAdoption(data, filePath) {
  if (!isRecord(data) || Array.isArray(data)) {
    errors.push(`${filePath} must be a JSON object.`);
    return;
  }
  for (const key of ["adopted", "provisional"]) {
    if (!Array.isArray(data[key])) {
      errors.push(`${filePath} field ${key} must be an array.`);
      continue;
    }
    data[key].forEach((entry, idx) => {
      if (!isRecord(entry)) {
        errors.push(`${filePath} ${key}[${idx}] must be an object.`);
        return;
      }
      for (const field of ["modelKey", "source"]) {
        if (!(field in entry)) {
          errors.push(
            `${filePath} ${key}[${idx}] is missing required field: ${field}`
          );
        }
      }
      validateNullableString(filePath, `${key}[${idx}].name`, entry.name);
      validateNullableString(filePath, `${key}[${idx}].provider`, entry.provider);
    });
  }
}

function validateDecisions(data, filePath) {
  if (!isRecord(data) || Array.isArray(data)) {
    errors.push(`${filePath} must be a JSON object.`);
    return;
  }
  if (!isRecord(data.meta)) {
    errors.push(`${filePath} must include meta object.`);
  }
  if (!Array.isArray(data.decisions)) {
    errors.push(`${filePath} must include decisions array.`);
    return;
  }
  data.decisions.forEach((entry, idx) => {
    if (!isRecord(entry)) {
      errors.push(`${filePath} decisions[${idx}] must be an object.`);
      return;
    }
    for (const field of ["modelKey", "source", "status"]) {
      if (!(field in entry)) {
        errors.push(
          `${filePath} decisions[${idx}] is missing required field: ${field}`
        );
      }
    }
    if (!Array.isArray(entry.reasons)) {
      errors.push(`${filePath} decisions[${idx}] field reasons must be an array.`);
    }
    if (!isRecord(entry.normalized)) {
      errors.push(`${filePath} decisions[${idx}] field normalized must be an object.`);
    }
    if (!isRecord(entry.rawRef)) {
      errors.push(`${filePath} decisions[${idx}] field rawRef must be an object.`);
    }
  });
}

function validateEvidenceIndex(data, filePath) {
  if (!isRecord(data) || Array.isArray(data)) {
    errors.push(`${filePath} must be a JSON object.`);
    return;
  }
  if (!isRecord(data.meta)) {
    errors.push(`${filePath} must include meta object.`);
  }
  if (!Array.isArray(data.models)) {
    errors.push(`${filePath} must include models array.`);
  } else {
    expectedEvidenceModels = data.models
      .map((model) => model?.modelKey)
      .filter((modelKey) => typeof modelKey === "string");
    data.models.forEach((model, idx) => {
      if (!isRecord(model)) {
        errors.push(`${filePath} models[${idx}] must be an object.`);
        return;
      }
      if (!isNonEmptyString(model.modelKey)) {
        errors.push(`${filePath} models[${idx}].modelKey must be a string.`);
      }
      if (!isNonEmptyString(model.path)) {
        errors.push(`${filePath} models[${idx}].path must be a string.`);
      }
    });
  }
}

function validateEvidenceFile(data, filePath) {
  if (!isRecord(data) || Array.isArray(data)) {
    errors.push(`${filePath} must be a JSON object.`);
    return;
  }
  if (!isRecord(data.meta)) {
    errors.push(`${filePath} must include meta object.`);
  }
  if (!Array.isArray(data.evidenceItems)) {
    errors.push(`${filePath} must include evidenceItems array.`);
    return;
  }
  if (data.evidenceItems.length !== EVIDENCE_TYPES.length) {
    errors.push(`${filePath} evidenceItems must include exactly 4 items.`);
  }
  data.evidenceItems.forEach((item, idx) => {
    if (!isRecord(item)) {
      errors.push(`${filePath} evidenceItems[${idx}] must be an object.`);
      return;
    }
    for (const key of ["type", "status", "reasons", "refs"]) {
      if (!(key in item)) {
        errors.push(`${filePath} evidenceItems[${idx}] missing field: ${key}`);
      }
    }
    if (!EVIDENCE_TYPES.includes(item.type)) {
      errors.push(`${filePath} evidenceItems[${idx}].type invalid.`);
    }
    if (!EVIDENCE_STATUSES.includes(item.status)) {
      errors.push(`${filePath} evidenceItems[${idx}].status invalid.`);
    }
    if (!Array.isArray(item.reasons)) {
      errors.push(`${filePath} evidenceItems[${idx}].reasons must be array.`);
    } else if (item.reasons.length === 0) {
      errors.push(`${filePath} evidenceItems[${idx}].reasons must not be empty.`);
    }
    if (!Array.isArray(item.refs)) {
      errors.push(`${filePath} evidenceItems[${idx}].refs must be array.`);
    }
  });
  const typesPresent = new Set(data.evidenceItems.map((item) => item.type));
  for (const type of EVIDENCE_TYPES) {
    if (!typesPresent.has(type)) {
      errors.push(`${filePath} missing evidence type: ${type}`);
    }
  }
  if (typesPresent.size !== EVIDENCE_TYPES.length) {
    errors.push(`${filePath} evidenceItems must contain each evidence type once.`);
  }
}

function validateScores(data, label) {
  if (!isRecord(data)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  if (typeof data.overall !== "number") {
    errors.push(`${label}.overall must be a number.`);
  }
  if (!isRecord(data.categories)) {
    errors.push(`${label}.categories must be an object.`);
  } else {
    for (const key of ["performance", "safety", "adoption", "openness", "cost"]) {
      if (typeof data.categories[key] !== "number") {
        errors.push(`${label}.categories.${key} must be a number.`);
      }
    }
  }
  if (!isRecord(data.items)) {
    errors.push(`${label}.items must be an object.`);
    return;
  }
  for (const key of SCORE_ITEM_KEYS) {
    const item = data.items[key];
    if (!isRecord(item)) {
      errors.push(`${label}.items.${key} must be an object.`);
      continue;
    }
    if (typeof item.score !== "number") {
      errors.push(`${label}.items.${key}.score must be a number.`);
    }
    if (!isRecord(item.inputs)) {
      errors.push(`${label}.items.${key}.inputs must be an object.`);
    } else if (hasMissingInputs(item.inputs)) {
      if (!Array.isArray(item.penaltyReasons) || item.penaltyReasons.length === 0) {
        errors.push(
          `${label}.items.${key}.penaltyReasons must be non-empty when inputs missing.`
        );
      }
    }
    if (!Array.isArray(item.usedEvidence)) {
      errors.push(`${label}.items.${key}.usedEvidence must be an array.`);
    } else {
      item.usedEvidence.forEach((usage, idx) => {
        if (!isRecord(usage)) {
          errors.push(`${label}.items.${key}.usedEvidence[${idx}] must be an object.`);
          return;
        }
        if (!EVIDENCE_TYPES.includes(usage.type)) {
          errors.push(`${label}.items.${key}.usedEvidence[${idx}].type invalid.`);
        }
        if (!EVIDENCE_STATUSES.includes(usage.status)) {
          errors.push(`${label}.items.${key}.usedEvidence[${idx}].status invalid.`);
        } else if (usage.status !== "ok") {
          if (!Array.isArray(item.penaltyReasons) || item.penaltyReasons.length === 0) {
            errors.push(
              `${label}.items.${key}.penaltyReasons must be non-empty when evidence status is not ok.`
            );
          }
        }
      });
    }
    if (!Array.isArray(item.penaltyReasons)) {
      errors.push(`${label}.items.${key}.penaltyReasons must be an array.`);
    }
  }
}

async function readEvidenceFiles(evidenceDir) {
  const entries = await readDirSafe(evidenceDir);
  const files = [];
  for (const entry of entries) {
    if (!entry.endsWith(".json") || entry === "index.json") continue;
    const fullPath = path.join(evidenceDir, entry);
    const raw = await readFile(fullPath, "utf8");
    files.push([entry.replace(/\.json$/, ""), JSON.parse(raw)]);
  }
  return files;
}

async function readDirSafe(dir) {
  try {
    return await readDir(dir);
  } catch {
    return [];
  }
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object";
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateNonNegativeNumber(filePath, key, value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    errors.push(`${filePath} field ${key} must be a number.`);
    return;
  }
  if (value < 0) {
    errors.push(`${filePath} field ${key} must be >= 0.`);
  }
}

function validateNullableString(filePath, key, value) {
  if (value === null || value === undefined) {
    return;
  }
  if (typeof value !== "string") {
    errors.push(`${filePath} field ${key} must be a string or null.`);
  }
}

function hasMissingInputs(inputs) {
  return Object.values(inputs).some(
    (value) => value === null || value === undefined
  );
}
