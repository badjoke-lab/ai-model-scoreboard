const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const japaneseRegex = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
const conflictRegex = /^(<<<<<<<|=======|>>>>>>>)/m;

const errors = [];

const walkFiles = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
};

const readFileText = (filePath) => fs.readFileSync(filePath, "utf8");

const scanJapaneseText = (dirs) => {
  for (const dir of dirs) {
    const absoluteDir = path.join(repoRoot, dir);
    if (!fs.existsSync(absoluteDir)) {
      continue;
    }
    for (const filePath of walkFiles(absoluteDir)) {
      const content = readFileText(filePath);
      if (japaneseRegex.test(content)) {
        errors.push(`Japanese characters detected in ${path.relative(repoRoot, filePath)}`);
      }
    }
  }
};

const scanConflictMarkers = (dir) => {
  const absoluteDir = path.join(repoRoot, dir);
  if (!fs.existsSync(absoluteDir)) {
    return;
  }
  for (const filePath of walkFiles(absoluteDir)) {
    const content = readFileText(filePath);
    if (conflictRegex.test(content)) {
      errors.push(`Conflict marker detected in ${path.relative(repoRoot, filePath)}`);
    }
  }
};

const parseJsonFile = (relativePath) => {
  const fullPath = path.join(repoRoot, relativePath);
  try {
    const content = readFileText(fullPath);
    return JSON.parse(content);
  } catch (error) {
    errors.push(`Failed to parse JSON: ${relativePath} (${error.message})`);
    return null;
  }
};

scanJapaneseText(["app", "components", "lib"]);
scanConflictMarkers("public/data/v4");

const jsonFiles = [
  "public/data/v4/index.json",
  "public/data/v4/models.json",
  "public/data/v4/rankings.json",
  "public/data/v4/decisions.json",
  "public/data/v4/latest.json",
  "public/data/v4/latest.meta.json",
  "public/data/v4/evidence/index.json",
];

const parsedJson = new Map();
for (const jsonFile of jsonFiles) {
  parsedJson.set(jsonFile, parseJsonFile(jsonFile));
}

const modelsPath = "public/data/v4/models.json";
const modelsJson = parsedJson.get(modelsPath);
let modelsCount = 0;
let penaltyItemsCount = 0;
let missingEvidenceCount = 0;

const ensureArray = (value) => Array.isArray(value);
const ensureObject = (value) => value && typeof value === "object" && !Array.isArray(value);

if (modelsJson !== null) {
  if (!Array.isArray(modelsJson)) {
    errors.push("models.json must be an array");
  } else {
    modelsCount = modelsJson.length;
    modelsJson.forEach((model, index) => {
      const modelLabel = `models.json[${index}]`;
      if (!model || typeof model !== "object") {
        errors.push(`${modelLabel} must be an object`);
        return;
      }
      if (!(model.modelKey || model.key || model.slug)) {
        errors.push(`${modelLabel} missing modelKey/key/slug`);
      }
      if (typeof model.overallScore !== "number") {
        errors.push(`${modelLabel} overallScore must be a number`);
      }
      if (!ensureObject(model.categoryScores)) {
        errors.push(`${modelLabel} categoryScores must be an object`);
      }
      const items = model.scoreBreakdown?.items;
      if (!ensureArray(items)) {
        errors.push(`${modelLabel} scoreBreakdown.items must be an array`);
      } else {
        items.forEach((item, itemIndex) => {
          if (!item || typeof item !== "object") {
            return;
          }
          const hasPenalty = Boolean(item.penaltyReason || item.penaltyReasons);
          if (hasPenalty) {
            penaltyItemsCount += 1;
            const usedEvidence = item.usedEvidence;
            if (!usedEvidence) {
              errors.push(`${modelLabel} scoreBreakdown.items[${itemIndex}] missing usedEvidence`);
              return;
            }
            const links = [];
            if (typeof usedEvidence === "object") {
              if (ensureArray(usedEvidence)) {
                for (const entry of usedEvidence) {
                  if (entry && typeof entry === "object" && typeof entry.link === "string") {
                    links.push(entry.link);
                  }
                }
              } else if (typeof usedEvidence.link === "string") {
                links.push(usedEvidence.link);
              }
            }
            if (links.length === 0) {
              errors.push(`${modelLabel} scoreBreakdown.items[${itemIndex}] usedEvidence missing link`);
              return;
            }
            links.forEach((link) => {
              if (!link.startsWith("/data/v4/evidence/")) {
                errors.push(`${modelLabel} scoreBreakdown.items[${itemIndex}] link must start with /data/v4/evidence/`);
                return;
              }
              const relativeEvidencePath = link.replace(/^\//, "");
              const evidencePath = path.join(repoRoot, "public", relativeEvidencePath);
              if (!fs.existsSync(evidencePath)) {
                missingEvidenceCount += 1;
                errors.push(`${modelLabel} scoreBreakdown.items[${itemIndex}] missing evidence file: ${link}`);
              }
            });
          }
        });
      }
    });
  }
}

if (errors.length > 0) {
  console.error("Spec v4 gate failed:");
  errors.forEach((error) => {
    console.error(`- ${error}`);
  });
  process.exit(1);
}

console.log(`Models count: ${modelsCount}`);
console.log(`Penalty items count: ${penaltyItemsCount}`);
console.log(`Missing evidence link count: ${missingEvidenceCount}`);
process.exit(0);
