import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "public", "data", "v4");

function readJson(relativePath) {
  const filePath = path.join(DATA_DIR, relativePath);
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function getCategoryScores(entry) {
  if (!entry || typeof entry !== "object") return {};
  const scores = entry.scores;
  if (scores && typeof scores === "object") {
    if (scores.categories && typeof scores.categories === "object") {
      return scores.categories;
    }
    return scores;
  }
  return {};
}

const failures = [];

let rankings = [];
try {
  rankings = readJson("rankings.json");
} catch (error) {
  failures.push(`Failed to read rankings.json: ${error.message}`);
}

if (rankings.length) {
  const allProvisional = rankings.every((entry) => entry.layer === "provisional");
  if (allProvisional) {
    failures.push("All rankings are provisional.");
  }

  const topRows = rankings.slice(0, 50);
  const rowsWithDepth = topRows.filter((entry) => {
    const categories = getCategoryScores(entry);
    const nonZero = ["performance", "safety", "adoption", "openness", "cost"].filter(
      (key) => typeof categories[key] === "number" && categories[key] > 0
    );
    return nonZero.length >= 3;
  });

  if (topRows.length && rowsWithDepth.length === 0) {
    failures.push("Top 50 rankings contain zero rows with >=3 non-zero categories.");
  }
}

let decisions = null;
try {
  decisions = readJson("decisions.json");
} catch (error) {
  failures.push(`Failed to read decisions.json: ${error.message}`);
}

if (rankings.length && decisions?.decisions) {
  const decisionMap = new Map(
    decisions.decisions.map((entry) => [entry.modelKey, entry.status])
  );
  const knownStatuses = new Set(["adopted", "provisional", "denied"]);
  const unknownCount = rankings.filter((entry) => {
    const status = decisionMap.get(entry.model);
    return !knownStatuses.has(status);
  }).length;

  if (unknownCount === rankings.length) {
    failures.push("All adoption statuses are unknown.");
  }
}

let evidenceIndex = null;
try {
  evidenceIndex = readJson(path.join("evidence", "index.json"));
} catch (error) {
  failures.push(`Failed to read evidence/index.json: ${error.message}`);
}

if (evidenceIndex?.models?.length) {
  let hasReasons = false;
  for (const entry of evidenceIndex.models) {
    if (!entry?.path) continue;
    const evidencePath = entry.path;
    try {
      const evidence = readJson(evidencePath);
      const items = Array.isArray(evidence.evidenceItems)
        ? evidence.evidenceItems
        : Array.isArray(evidence.items)
          ? evidence.items
          : [];
      for (const item of items) {
        const reasons = Array.isArray(item?.reasons) ? item.reasons : [];
        if (reasons.length > 0) {
          hasReasons = true;
          break;
        }
      }
    } catch (error) {
      failures.push(`Failed to read evidence file ${evidencePath}: ${error.message}`);
    }
    if (hasReasons) break;
  }
  if (!hasReasons) {
    failures.push("Evidence reasons are empty.");
  }
}

if (failures.length) {
  failures.forEach((message) => console.error(`v4:verify: ${message}`));
  process.exit(1);
}

console.log("v4:verify: ok");
