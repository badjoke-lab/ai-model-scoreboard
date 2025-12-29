import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

export const DATA_DIR = path.join(process.cwd(), "public", "data", "v4");
const REQUIRED_COUNT_KEYS = [
  "modelsCount",
  "fullCount",
  "provisionalCount",
  "notListedCount",
];
const REQUIRED_SCORE_KEYS = ["performance", "safety", "adoption", "openness", "cost"];
const ALLOWED_LAYERS = new Set(["full", "provisional", "rejected", "not-listed"]);

function readJson(filename, dataDir = DATA_DIR, errors) {
  const fullPath = path.join(dataDir, filename);
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
  if (!assertObject(data, "index.json", errors)) return;

  if (!assertObject(data.meta, "index.json.meta", errors)) return;

  if (typeof data.meta.version !== "string") {
    errors.push("index.json.meta.version must be a string");
  } else if (data.meta.version !== "v4") {
    errors.push('index.json.meta.version must equal "v4"');
  }

  if (!isIsoDateString(data.meta.updatedAt)) {
    errors.push("index.json.meta.updatedAt must be an ISO 8601 date string");
  }

  REQUIRED_COUNT_KEYS.forEach((key) => {
    if (!(key in data.meta)) {
      errors.push(`index.json.meta is missing required key "${key}"`);
    } else if (!Number.isFinite(data.meta[key]) || data.meta[key] < 0) {
      errors.push(`index.json.meta.${key} must be a non-negative number`);
    }
  });
}

function validateRankings(data, errors) {
  if (!Array.isArray(data)) {
    errors.push("rankings.json must be an array");
    return;
  }

  data.forEach((entry, idx) => {
    const prefix = `rankings.json[${idx}]`;
    if (!assertObject(entry, prefix, errors)) return;

    ["model", "vendor", "layer", "score", "scores", "updatedAt"].forEach((field) => {
      if (!(field in entry)) {
        errors.push(`${prefix} is missing required field "${field}"`);
      }
    });

    ["model", "vendor"].forEach((field) => {
      if (field in entry && typeof entry[field] !== "string") {
        errors.push(`${prefix}.${field} must be a string`);
      }
    });

    if ("layer" in entry && typeof entry.layer === "string") {
      if (!ALLOWED_LAYERS.has(entry.layer)) {
        errors.push(`${prefix}.layer must be one of: ${[...ALLOWED_LAYERS].join(", ")}`);
      }
    } else if ("layer" in entry) {
      errors.push(`${prefix}.layer must be a string`);
    }

    if ("score" in entry && !Number.isFinite(entry.score)) {
      errors.push(`${prefix}.score must be a number`);
    }

    if ("updatedAt" in entry && !isIsoDateString(entry.updatedAt)) {
      errors.push(`${prefix}.updatedAt must be an ISO 8601 date string`);
    }

    if ("scores" in entry) {
      if (!assertObject(entry.scores, `${prefix}.scores`, errors)) return;

      REQUIRED_SCORE_KEYS.forEach((scoreKey) => {
        if (!(scoreKey in entry.scores)) {
          errors.push(`${prefix}.scores is missing "${scoreKey}"`);
        } else if (!Number.isFinite(entry.scores[scoreKey])) {
          errors.push(`${prefix}.scores.${scoreKey} must be a number`);
        }
      });
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
        errors.push(
          `rankings.json must be sorted by score descending (index ${i - 1} before ${i})`
        );
        break;
      }
      if (prev.score === current.score && prev.model.localeCompare(current.model) > 0) {
        errors.push(
          `rankings.json tie-breaker order must be model slug ascending (index ${i - 1} before ${i})`
        );
        break;
      }
    }
  }
}

function validateModels(data, errors) {
  if (!assertObject(data, "models.json", errors)) return;

  Object.entries(data).forEach(([slug, model]) => {
    const prefix = `models.json[${slug}]`;
    if (!slug || typeof slug !== "string") {
      errors.push("models.json keys must be non-empty strings");
    }
    if (!assertObject(model, prefix, errors)) return;

    ["name", "vendor"].forEach((field) => {
      if (!(field in model)) {
        errors.push(`${prefix} is missing required field "${field}"`);
      } else if (typeof model[field] !== "string" || model[field].trim() === "") {
        errors.push(`${prefix}.${field} must be a non-empty string`);
      }
    });
  });
}

function validateNotListed(data, errors) {
  if (!Array.isArray(data)) {
    errors.push("not-listed.json must be an array");
    return;
  }

  data.forEach((entry, idx) => {
    if (typeof entry !== "string" || entry.trim() === "") {
      errors.push(`not-listed.json[${idx}] must be a non-empty string`);
    }
  });

  for (let i = 1; i < data.length; i += 1) {
    const prev = data[i - 1];
    const current = data[i];
    if (typeof prev === "string" && typeof current === "string") {
      if (prev.localeCompare(current) > 0) {
        errors.push("not-listed.json must be sorted by model slug ascending");
        break;
      }
      if (prev === current) {
        errors.push("not-listed.json must not contain duplicate entries");
        break;
      }
    }
  }
}

export function validateSnapshotData(indexData, rankingsData, modelsData, notListedData) {
  const errors = [];
  if (indexData) validateIndex(indexData, errors);
  if (rankingsData) validateRankings(rankingsData, errors);
  if (modelsData) validateModels(modelsData, errors);
  if (notListedData) validateNotListed(notListedData, errors);
  return errors;
}

export function validateSnapshotFiles(dataDir = DATA_DIR) {
  const errors = [];
  const indexData = readJson("index.json", dataDir, errors);
  const rankingsData = readJson("rankings.json", dataDir, errors);
  const modelsData = readJson("models.json", dataDir, errors);
  const notListedData = readJson("not-listed.json", dataDir, errors);

  errors.push(...validateSnapshotData(indexData, rankingsData, modelsData, notListedData));
  return errors;
}

export function runSelfTest() {
  const brokenIndex = {
    meta: {
      version: "v4",
      updatedAt: "not-a-date",
      modelsCount: "5",
      fullCount: 0,
      provisionalCount: 0,
      notListedCount: 0,
    },
  };
  const brokenRankings = [
    {
      model: "alpha",
      vendor: "vendor",
      layer: "full",
      score: "high",
      scores: { performance: 10 },
      updatedAt: "2024-13-01",
    },
  ];
  const brokenModels = {
    "": { name: "", vendor: 123 },
  };
  const brokenNotListed = ["b", "a", 1];

  const errors = validateSnapshotData(
    brokenIndex,
    brokenRankings,
    brokenModels,
    brokenNotListed
  );

  if (errors.length === 0) {
    return ["Validator self-test failed: broken fixture produced no errors."];
  }

  return [];
}

export function main() {
  const errors = [...validateSnapshotFiles(), ...runSelfTest()];

  if (errors.length) {
    console.error("v4 snapshot validation failed:");
    errors.forEach((err) => console.error(`- ${err}`));
    process.exit(1);
  }

  console.log("v4 snapshot validation passed.");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
