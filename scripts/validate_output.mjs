import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { listCriteriaKeys } from "../lib/v4/config.mjs";

const OUTPUT_DIR = path.join(process.cwd(), "output");
const REQUIRED_SCORE_KEYS = [
  "performance",
  "safety",
  "adoption",
  "openness",
  "cost",
];
const REQUIRED_CRITERIA_KEYS = listCriteriaKeys();

function readJson(filename, errors) {
  const fullPath = path.join(OUTPUT_DIR, filename);
  try {
    const content = fs.readFileSync(fullPath, "utf8");
    return JSON.parse(content);
  } catch (err) {
    errors.push(`Failed to read ${filename}: ${err.message}`);
    return null;
  }
}

function assertObject(value, name, errors) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    errors.push(`${name} must be an object`);
    return false;
  }
  return true;
}

function isIsoDateString(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function validateIndex(data, errors) {
  if (!assertObject(data, "output/index.json", errors)) return;
  if (!assertObject(data.meta, "output/index.json.meta", errors)) return;

  if (data.meta.version !== "v4") {
    errors.push('output/index.json.meta.version must equal "v4"');
  }
  if (!isIsoDateString(data.meta.updatedAt)) {
    errors.push("output/index.json.meta.updatedAt must be an ISO 8601 date string");
  }

  ["modelsCount", "fullCount", "provisionalCount", "notListedCount"].forEach((key) => {
    if (!Number.isInteger(data.meta[key]) || data.meta[key] < 0) {
      errors.push(`output/index.json.meta.${key} must be a non-negative integer`);
    }
  });
}

function validateModels(data, errors) {
  if (!Array.isArray(data)) {
    errors.push("output/models.json must be an array");
    return;
  }

  for (let i = 1; i < data.length; i += 1) {
    const prev = data[i - 1];
    const current = data[i];
    if (prev?.model?.slug && current?.model?.slug) {
      if (prev.model.slug.localeCompare(current.model.slug) > 0) {
        errors.push("output/models.json must be sorted by model slug ascending");
        break;
      }
    }
  }

  data.forEach((entry, idx) => {
    const prefix = `output/models.json[${idx}]`;
    if (!assertObject(entry, prefix, errors)) return;

    if (!assertObject(entry.model, `${prefix}.model`, errors)) return;
    if (typeof entry.model.slug !== "string" || entry.model.slug.trim() === "") {
      errors.push(`${prefix}.model.slug must be a non-empty string`);
    }
    if (typeof entry.model.name !== "string" || entry.model.name.trim() === "") {
      errors.push(`${prefix}.model.name must be a non-empty string`);
    }
    if (typeof entry.model.vendor !== "string" || entry.model.vendor.trim() === "") {
      errors.push(`${prefix}.model.vendor must be a non-empty string`);
    }

    if (!assertObject(entry.decision, `${prefix}.decision`, errors)) return;
    if (typeof entry.decision.status !== "string") {
      errors.push(`${prefix}.decision.status must be a string`);
    }

    if (!assertObject(entry.scores, `${prefix}.scores`, errors)) return;
    if (!Number.isFinite(entry.scores.total)) {
      errors.push(`${prefix}.scores.total must be a number`);
    }
    if (!assertObject(entry.scores.breakdown, `${prefix}.scores.breakdown`, errors)) return;
    REQUIRED_SCORE_KEYS.forEach((key) => {
      if (!Number.isFinite(entry.scores.breakdown[key])) {
        errors.push(`${prefix}.scores.breakdown.${key} must be a number`);
      }
    });

    if (!assertObject(entry.criteria, `${prefix}.criteria`, errors)) return;
    REQUIRED_CRITERIA_KEYS.forEach((key) => {
      if (!(key in entry.criteria)) {
        errors.push(`${prefix}.criteria is missing key "${key}"`);
        return;
      }
      const criterion = entry.criteria[key];
      if (!assertObject(criterion, `${prefix}.criteria.${key}`, errors)) return;
      if (criterion.value !== null && !Number.isFinite(criterion.value)) {
        errors.push(`${prefix}.criteria.${key}.value must be a number or null`);
      }
      if (!Number.isFinite(criterion.score)) {
        errors.push(`${prefix}.criteria.${key}.score must be a number`);
      }
      if (criterion.value === null && typeof criterion.missingReason !== "string") {
        errors.push(`${prefix}.criteria.${key}.missingReason must be a string when value is null`);
      }
    });

    if (!isIsoDateString(entry.updatedAt)) {
      errors.push(`${prefix}.updatedAt must be an ISO 8601 date string`);
    }
  });
}

function validateRankings(data, errors) {
  if (!Array.isArray(data)) {
    errors.push("output/rankings.json must be an array");
    return;
  }

  const seen = new Set();
  data.forEach((entry, idx) => {
    const prefix = `output/rankings.json[${idx}]`;
    if (!assertObject(entry, prefix, errors)) return;
    if (typeof entry.model !== "string" || entry.model.trim() === "") {
      errors.push(`${prefix}.model must be a non-empty string`);
    }
    if (typeof entry.vendor !== "string" || entry.vendor.trim() === "") {
      errors.push(`${prefix}.vendor must be a non-empty string`);
    }
    if (typeof entry.layer !== "string") {
      errors.push(`${prefix}.layer must be a string`);
    }
    if (!Number.isFinite(entry.score)) {
      errors.push(`${prefix}.score must be a number`);
    }
    if (!assertObject(entry.scores, `${prefix}.scores`, errors)) return;
    REQUIRED_SCORE_KEYS.forEach((key) => {
      if (!Number.isFinite(entry.scores[key])) {
        errors.push(`${prefix}.scores.${key} must be a number`);
      }
    });
    if (!isIsoDateString(entry.updatedAt)) {
      errors.push(`${prefix}.updatedAt must be an ISO 8601 date string`);
    }

    if (typeof entry.model === "string") {
      if (seen.has(entry.model)) {
        errors.push(`${prefix}.model is duplicated`);
      }
      seen.add(entry.model);
    }
  });

  for (let i = 1; i < data.length; i += 1) {
    const prev = data[i - 1];
    const current = data[i];
    if (
      typeof prev?.score === "number" &&
      typeof current?.score === "number" &&
      typeof prev?.model === "string" &&
      typeof current?.model === "string"
    ) {
      if (prev.score < current.score) {
        errors.push("output/rankings.json must be sorted by score descending");
        break;
      }
      if (prev.score === current.score && prev.model.localeCompare(current.model) > 0) {
        errors.push("output/rankings.json tie-breaker must be model slug ascending");
        break;
      }
    }
  }
}

function validateNotListed(data, errors) {
  if (!Array.isArray(data)) {
    errors.push("output/not-listed.json must be an array");
    return;
  }

  for (let i = 1; i < data.length; i += 1) {
    const prev = data[i - 1];
    const current = data[i];
    if (prev?.slug && current?.slug && prev.slug.localeCompare(current.slug) > 0) {
      errors.push("output/not-listed.json must be sorted by slug ascending");
      break;
    }
  }

  data.forEach((entry, idx) => {
    const prefix = `output/not-listed.json[${idx}]`;
    if (!assertObject(entry, prefix, errors)) return;
    if (typeof entry.slug !== "string" || entry.slug.trim() === "") {
      errors.push(`${prefix}.slug must be a non-empty string`);
    }
    if (typeof entry.reason !== "string" || entry.reason.trim() === "") {
      errors.push(`${prefix}.reason must be a non-empty string`);
    }
  });
}

export function validateOutputFiles() {
  const errors = [];
  const indexData = readJson("index.json", errors);
  const modelsData = readJson("models.json", errors);
  const rankingsData = readJson("rankings.json", errors);
  const notListedData = readJson("not-listed.json", errors);

  if (indexData) validateIndex(indexData, errors);
  if (modelsData) validateModels(modelsData, errors);
  if (rankingsData) validateRankings(rankingsData, errors);
  if (notListedData) validateNotListed(notListedData, errors);

  if (indexData && rankingsData) {
    if (indexData.meta?.modelsCount !== rankingsData.length) {
      errors.push("output/index.json.meta.modelsCount must equal rankings length");
    }
    const fullCount = rankingsData.filter((entry) => entry.layer === "full").length;
    const provisionalCount = rankingsData.filter((entry) => entry.layer === "provisional")
      .length;
    if (indexData.meta?.fullCount !== fullCount) {
      errors.push("output/index.json.meta.fullCount must match rankings full count");
    }
    if (indexData.meta?.provisionalCount !== provisionalCount) {
      errors.push(
        "output/index.json.meta.provisionalCount must match rankings provisional count"
      );
    }
  }

  if (indexData && notListedData) {
    if (indexData.meta?.notListedCount !== notListedData.length) {
      errors.push("output/index.json.meta.notListedCount must equal not-listed length");
    }
  }

  return errors;
}

export function main() {
  const errors = validateOutputFiles();
  if (errors.length) {
    console.error("output validation failed:");
    errors.forEach((err) => console.error(`- ${err}`));
    process.exit(1);
  }
  console.log("output validation passed.");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
