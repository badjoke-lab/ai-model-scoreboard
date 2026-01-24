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

const ensureArray = (value) => Array.isArray(value);
const ensureObject = (value) => value && typeof value === "object" && !Array.isArray(value);
const nonEmptyStr = (value) => typeof value === "string" && value.trim().length > 0;

const hasFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

const hasNumericScore = (item) =>
  hasFiniteNumber(item?.score) || hasFiniteNumber(item?.delta) || hasFiniteNumber(item?.impact);

const hasNonEmptyInputsRaw = (inputsRaw) => {
  if (ensureArray(inputsRaw)) return inputsRaw.length > 0;
  if (ensureObject(inputsRaw)) return Object.keys(inputsRaw).length > 0;
  return false;
};

const isClickableLink = (link) =>
  typeof link === "string" && (/^https?:\/\//.test(link) || link.startsWith("/"));

const collectEvidenceLinks = (usedEvidence) => {
  if (!usedEvidence) return [];
  const links = [];
  if (ensureArray(usedEvidence)) {
    usedEvidence.forEach((entry) => {
      if (ensureObject(entry) && typeof entry.link === "string") {
        links.push(entry.link.trim());
      }
    });
    return links;
  }
  if (ensureObject(usedEvidence) && typeof usedEvidence.link === "string") {
    links.push(usedEvidence.link.trim());
  }
  return links;
};

const linkExistsOnDisk = (link, baseDir) => {
  if (!link.startsWith("/")) return true;
  const relativeEvidencePath = link.replace(/^\//, "");
  const evidencePath = path.join(repoRoot, baseDir, relativeEvidencePath);
  return fs.existsSync(evidencePath);
};

const looksLikeEnglishSentence = (value) => {
  if (!nonEmptyStr(value)) return false;
  const trimmed = value.trim();
  if (!/[A-Za-z]/.test(trimmed)) return false;
  // raw code tokens (e.g., missing_major_incidents) should fail
  if (/^[A-Za-z0-9_:-]+$/.test(trimmed) && !trimmed.includes(" ")) return false;
  return true;
};

const describeItem = (item, itemIndex) => {
  if (!ensureObject(item)) return `items[${itemIndex}]`;
  const label = item.label || item.key || item.id || item.name;
  return label ? `${label}` : `items[${itemIndex}]`;
};

const specFixtureRoot = path.join("fixtures", "v4-spec", "public", "data", "v4");
const hasSpecFixtures = fs.existsSync(path.join(repoRoot, specFixtureRoot));
const dataRoot = hasSpecFixtures ? specFixtureRoot : path.join("public", "data", "v4");

scanJapaneseText(["app", "components", "lib"]);
scanConflictMarkers(dataRoot);

const jsonFiles = [
  "index.json",
  "models.json",
  "rankings.json",
  "decisions.json",
  "latest.json",
  "latest.meta.json",
  path.join("evidence", "index.json"),
].map((file) => path.join(dataRoot, file));

const parsedJson = new Map();
for (const jsonFile of jsonFiles) {
  parsedJson.set(jsonFile, parseJsonFile(jsonFile));
}

const modelsPath = path.join(dataRoot, "models.json");
const modelsJson = parsedJson.get(modelsPath);
let modelsCount = 0;
let scoredItemsCount = 0;
let missingEvidenceCount = 0;

if (modelsJson !== null) {
  if (!ensureArray(modelsJson)) {
    errors.push(`${modelsPath} must be an array`);
  } else {
    modelsCount = modelsJson.length;
    modelsJson.forEach((model, index) => {
      const modelLabel = `${modelsPath}[${index}]`;
      if (!ensureObject(model)) {
        errors.push(`${modelLabel} must be an object`);
        return;
      }

      const modelKey = model.modelKey || model.key || model.slug || `index:${index}`;

      if (!nonEmptyStr(modelKey)) {
        errors.push(`${modelLabel} missing modelKey/key/slug`);
      }
      if (!hasFiniteNumber(model.overallScore)) {
        errors.push(`${modelKey} :: overallScore :: R0 overallScore must be a finite number. Fix: set overallScore to a numeric value.`);
      }
      if (!ensureObject(model.categoryScores)) {
        errors.push(`${modelKey} :: categoryScores :: R0 categoryScores must be an object. Fix: provide canonical category score keys.`);
      }

      const items = model.scoreBreakdown?.items;
      if (!ensureArray(items)) {
        errors.push(`${modelKey} :: scoreBreakdown.items :: R0 scoreBreakdown.items must be an array. Fix: emit scoreBreakdown.items as an array.`);
        return;
      }

      items.forEach((item, itemIndex) => {
        if (!ensureObject(item) || !hasNumericScore(item)) {
          return;
        }

        scoredItemsCount += 1;
        const itemLabel = describeItem(item, itemIndex);

        // R1: scored items must carry inputsRaw
        if (!hasNonEmptyInputsRaw(item.inputsRaw)) {
          errors.push(
            `${modelKey} :: ${itemLabel} :: R1 inputsRaw missing for scored item. Fix: populate inputsRaw with the minimal key/value inputs used for scoring.`
          );
        }

        const links = collectEvidenceLinks(item.usedEvidence).filter(isClickableLink);
        const attemptLinks = links.filter((link) => link.startsWith("/data/v4/evidence/"));

        // R2: at least one clickable evidence link
        if (links.length === 0) {
          errors.push(
            `${modelKey} :: ${itemLabel} :: R2 usedEvidence missing clickable link. Fix: add a usedEvidence entry with link set to https://... or /... .`
          );
          return;
        }

        const evidenceStatus = ensureArray(item.usedEvidence)
          ? item.usedEvidence.map((entry) => entry?.status).filter(nonEmptyStr)
          : [];
        const hasNonOkStatus = evidenceStatus.some((status) => status !== "ok");

        // R3: missing/blocked evidence must include attempt evidence record link
        if (hasNonOkStatus && attemptLinks.length === 0) {
          errors.push(
            `${modelKey} :: ${itemLabel} :: R3 attempt evidence record link missing. Fix: include a site-relative link like /data/v4/evidence/<modelKey>.json in usedEvidence.`
          );
        }

        attemptLinks.forEach((link) => {
          if (!linkExistsOnDisk(link, hasSpecFixtures ? path.join("fixtures", "v4-spec", "public") : "public")) {
            missingEvidenceCount += 1;
            errors.push(
              `${modelKey} :: ${itemLabel} :: R3 attempt evidence record not found on disk (${link}). Fix: ensure the referenced evidence JSON exists.`
            );
          }
        });

        // R4: why text must be human English
        if (!looksLikeEnglishSentence(item.why)) {
          errors.push(
            `${modelKey} :: ${itemLabel} :: R4 why text is missing or not human-readable English. Fix: set why to a short English explanation (not just a code).`
          );
        }
      });
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

console.log(`Spec data root: ${dataRoot}`);
console.log(`Models count: ${modelsCount}`);
console.log(`Scored items count: ${scoredItemsCount}`);
console.log(`Missing evidence link count: ${missingEvidenceCount}`);
process.exit(0);
