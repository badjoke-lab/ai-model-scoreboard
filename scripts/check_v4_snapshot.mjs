import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "public", "data", "v4");
const requiredCountKeys = [
  "modelsCount",
  "fullCount",
  "provisionalCount",
  "notListedCount",
];
const requiredScoreKeys = [
  "performance",
  "safety",
  "adoption",
  "openness",
  "cost",
];

const errors = [];

function readJson(filename) {
  const fullPath = path.join(DATA_DIR, filename);

  try {
    const content = fs.readFileSync(fullPath, "utf8");
    return JSON.parse(content);
  } catch (err) {
    errors.push(`Failed to read ${filename}: ${err.message}`);
    return null;
  }
}

function validateIndex(data) {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    errors.push("index.json must be an object");
    return;
  }

  if (!("meta" in data)) {
    errors.push("index.json.meta is required");
    return;
  }

  if (typeof data.meta !== "object" || data.meta === null || Array.isArray(data.meta)) {
    errors.push("index.json.meta must be an object");
    return;
  }

  const { version, updatedAt } = data.meta;
  if (typeof version !== "string") {
    errors.push("index.json.meta.version must be a string");
  } else if (version !== "v4") {
    errors.push('index.json.meta.version must equal "v4"');
  }

  if (typeof updatedAt !== "string") {
    errors.push("index.json.meta.updatedAt must be a string");
  } else if (Number.isNaN(Date.parse(updatedAt))) {
    errors.push("index.json.meta.updatedAt must be an ISO 8601 date string");
  }

  requiredCountKeys.forEach((key) => {
    if (!(key in data)) {
      errors.push(`index.json is missing required key "${key}"`);
    } else if (!Number.isFinite(data[key])) {
      errors.push(`index.json.${key} must be a number`);
    }
  });
}

function validateRankings(data) {
  if (!Array.isArray(data)) {
    errors.push("rankings.json must be an array");
    return;
  }

  data.forEach((entry, idx) => {
    const prefix = `rankings.json[${idx}]`;
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      errors.push(`${prefix} must be an object`);
      return;
    }

    const requiredFields = ["model", "vendor", "layer", "score", "scores", "updatedAt"];
    requiredFields.forEach((field) => {
      if (!(field in entry)) {
        errors.push(`${prefix} is missing required field "${field}"`);
      }
    });

    ["model", "vendor", "layer", "updatedAt"].forEach((field) => {
      if (field in entry && typeof entry[field] !== "string") {
        errors.push(`${prefix}.${field} must be a string`);
      }
    });

    if ("score" in entry && !Number.isFinite(entry.score)) {
      errors.push(`${prefix}.score must be a number`);
    }

    if ("scores" in entry) {
      if (typeof entry.scores !== "object" || entry.scores === null || Array.isArray(entry.scores)) {
        errors.push(`${prefix}.scores must be an object`);
      } else {
        requiredScoreKeys.forEach((scoreKey) => {
          if (!(scoreKey in entry.scores)) {
            errors.push(`${prefix}.scores is missing "${scoreKey}"`);
          } else if (!Number.isFinite(entry.scores[scoreKey])) {
            errors.push(`${prefix}.scores.${scoreKey} must be a number`);
          }
        });
      }
    }
  });
}

function validateModels(data) {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    errors.push("models.json must be an object map (Record<string, object>)");
    return;
  }

  const entries = Object.entries(data);
  entries.forEach(([key, value]) => {
    const prefix = `models.json[${key}]`;
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      errors.push(`${prefix} must be an object`);
      return;
    }

    ["name", "vendor"].forEach((field) => {
      if (!(field in value)) {
        errors.push(`${prefix} is missing required field "${field}"`);
      } else if (typeof value[field] !== "string" || value[field].trim() === "") {
        errors.push(`${prefix}.${field} must be a non-empty string`);
      }
    });
  });
}

function validateNotListed(data) {
  if (!Array.isArray(data)) {
    errors.push("not-listed.json must be an array");
  }
}

function main() {
  const indexData = readJson("index.json");
  const rankingsData = readJson("rankings.json");
  const modelsData = readJson("models.json");
  const notListedData = readJson("not-listed.json");

  if (indexData) validateIndex(indexData);
  if (rankingsData) validateRankings(rankingsData);
  if (modelsData) validateModels(modelsData);
  if (notListedData) validateNotListed(notListedData);

  if (errors.length) {
    console.error("v4 snapshot validation failed:");
    errors.forEach((err) => console.error(`- ${err}`));
    process.exit(1);
  }

  console.log("v4 snapshot validation passed.");
}

main();
