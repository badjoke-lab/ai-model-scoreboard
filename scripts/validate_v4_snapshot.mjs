import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "public", "data", "v4");
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

function assertObject(value, name) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    errors.push(`${name} must be an object`);
    return false;
  }
  return true;
}

function validateIndex(data) {
  if (!assertObject(data, "index.json")) return;

  if (!assertObject(data.meta, "index.json.meta")) return;

  if (typeof data.meta.version !== "string") {
    errors.push("index.json.meta.version must be a string");
  }
  if (typeof data.meta.updatedAt !== "string") {
    errors.push("index.json.meta.updatedAt must be a string");
  }

  ["modelsCount", "fullCount", "provisionalCount", "notListedCount"].forEach(
    (key) => {
      if (!Number.isFinite(data[key])) {
        errors.push(`index.json.${key} must be a number`);
      }
    },
  );
}

function validateRankings(data) {
  if (!Array.isArray(data)) {
    errors.push("rankings.json must be an array");
    return;
  }

  const requiredScoreKeys = [
    "performance",
    "safety",
    "adoption",
    "openness",
    "cost",
  ];

  data.forEach((entry, idx) => {
    const prefix = `rankings.json[${idx}]`;
    if (!assertObject(entry, prefix)) return;

    ["model", "vendor", "layer", "score", "scores", "updatedAt"].forEach(
      (field) => {
        if (!(field in entry)) {
          errors.push(`${prefix} is missing required field "${field}"`);
        }
      },
    );

    ["model", "vendor", "layer", "updatedAt"].forEach((field) => {
      if (field in entry && typeof entry[field] !== "string") {
        errors.push(`${prefix}.${field} must be a string`);
      }
    });

    if ("score" in entry && !Number.isFinite(entry.score)) {
      errors.push(`${prefix}.score must be a number`);
    }

    if ("scores" in entry) {
      if (!assertObject(entry.scores, `${prefix}.scores`)) return;

      requiredScoreKeys.forEach((scoreKey) => {
        if (!(scoreKey in entry.scores)) {
          errors.push(`${prefix}.scores is missing "${scoreKey}"`);
        } else if (!Number.isFinite(entry.scores[scoreKey])) {
          errors.push(`${prefix}.scores.${scoreKey} must be a number`);
        }
      });
    }
  });
}

function validateModels(data) {
  if (!assertObject(data, "models.json")) return;

  Object.entries(data).forEach(([slug, model]) => {
    const prefix = `models.json[${slug}]`;
    if (!assertObject(model, prefix)) return;

    ["name", "vendor"].forEach((field) => {
      if (!(field in model)) {
        errors.push(`${prefix} is missing required field "${field}"`);
      } else if (typeof model[field] !== "string" || model[field].trim() === "") {
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
