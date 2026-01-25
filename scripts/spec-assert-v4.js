const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const japaneseRegex = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
const conflictRegex = /^(<<<<<<<|=======|>>>>>>>)/m;
const { validateEvidenceGate, ensureArray, ensureObject, nonEmptyStr } = require("./spec/lib/v4-evidence-gate");

const errors = [];
const evidenceErrors = [];

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

const hasFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

const specFixtureRoot = path.join("fixtures", "v4-spec", "public", "data", "v4");
const hasSpecFixtures = fs.existsSync(path.join(repoRoot, specFixtureRoot));
const useSpecFixtures = process.env.SPEC_V4_FIXTURES === "1" && hasSpecFixtures;
const dataRoot = useSpecFixtures ? specFixtureRoot : path.join("public", "data", "v4");

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

if (modelsJson !== null) {
  const modelsArray = ensureArray(modelsJson)
    ? modelsJson
    : ensureObject(modelsJson)
      ? Object.entries(modelsJson).map(([key, value]) =>
          ensureObject(value) ? { modelKey: key, ...value } : value
        )
      : null;

  if (!modelsArray) {
    errors.push(`${modelsPath} must be an array or an object map of models`);
  } else {
    modelsCount = modelsArray.length;
    modelsArray.forEach((model, index) => {
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
      if (!ensureObject(model.scoreBreakdown)) {
        errors.push(`${modelKey} :: scoreBreakdown :: R0 scoreBreakdown must be an object. Fix: provide scoreBreakdown with items.`);
      }
    });
  }
}

const evidenceGateResult = validateEvidenceGate(modelsJson);
scoredItemsCount = evidenceGateResult.scoredItemsCount;
evidenceGateResult.errors.forEach((error) => {
  if (error.message) {
    evidenceErrors.push(error.message);
  }
});

if (errors.length > 0) {
  console.error("Spec v4 gate failed:");
  errors.forEach((error) => {
    console.error(`- ${error}`);
  });
  process.exit(1);
}

if (evidenceErrors.length > 0) {
  console.error("Spec v4 evidence gate failed:");
  evidenceErrors.forEach((error) => {
    console.error(`- ${error}`);
  });
  process.exit(1);
}

console.log(`Spec data root: ${dataRoot}`);
console.log(`Models count: ${modelsCount}`);
console.log(`Scored items count: ${scoredItemsCount}`);
process.exit(0);
