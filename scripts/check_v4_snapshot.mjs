import fs from "fs";
import path from "path";

const ROOT = "public/data/v4";

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}
function isObject(x) {
  return !!x && typeof x === "object" && !Array.isArray(x);
}
function nonEmptyStr(x) {
  return typeof x === "string" && x.trim().length > 0;
}

function toRankingsArray(root) {
  if (Array.isArray(root)) return root;
  if (isObject(root) && Array.isArray(root.rankings)) return root.rankings;
  return [];
}

function detectModelKey(m) {
  if (!isObject(m)) return null;
  const k =
    m.modelKey ??
    m.identity?.modelKey ??
    m.meta?.modelKey ??
    m.key ??
    m.id ??
    m.slug ??
    null;
  return nonEmptyStr(k) ? String(k).trim() : null;
}

function buildModelsMap(modelsRoot) {
  // 受け取り形：
  // - [ {...}, ... ]  (配列)
  // - { models: {...} } (辞書)
  // - { models: [ ... ] } (配列ラップ)
  // - { ... } (辞書っぽい)
  const map = new Map();

  const add = (k, v) => {
    if (!nonEmptyStr(k) || !isObject(v)) return;
    map.set(String(k).trim(), v);
  };

  if (Array.isArray(modelsRoot)) {
    for (const m of modelsRoot) {
      const k = detectModelKey(m);
      if (k) add(k, m);
    }
    return map;
  }

  if (isObject(modelsRoot)) {
    if (Array.isArray(modelsRoot.models)) {
      for (const m of modelsRoot.models) {
        const k = detectModelKey(m);
        if (k) add(k, m);
      }
      return map;
    }

    const dict =
      (isObject(modelsRoot.models) && modelsRoot.models) ||
      (isObject(modelsRoot.data) && modelsRoot.data) ||
      (isObject(modelsRoot.items) && modelsRoot.items) ||
      modelsRoot;

    if (isObject(dict)) {
      for (const [k0, v] of Object.entries(dict)) {
        if (!isObject(v)) continue;
        const k = detectModelKey(v) || (nonEmptyStr(k0) ? k0.trim() : null);
        if (k) add(k, v);
      }
    }
  }

  return map;
}

function main() {
  const errors = [];

  const modelsPath = path.join(ROOT, "models.json");
  const rankingsPath = path.join(ROOT, "rankings.json");

  if (!fs.existsSync(modelsPath)) errors.push(`missing ${modelsPath}`);
  if (!fs.existsSync(rankingsPath)) errors.push(`missing ${rankingsPath}`);

  if (errors.length) {
    console.error("v4 snapshot validation failed:\n- " + errors.join("\n- "));
    process.exit(1);
  }

  const modelsRoot = readJson(modelsPath);
  const rankingsRoot = readJson(rankingsPath);

  const modelsMap = buildModelsMap(modelsRoot);
  const rankings = toRankingsArray(rankingsRoot);

  if (modelsMap.size === 0) errors.push("models.json has no usable model entries");
  if (rankings.length === 0) errors.push("rankings.json has no rows");

  for (let i = 0; i < rankings.length; i++) {
    const r = rankings[i];
    if (!isObject(r)) {
      errors.push(`rankings.json[${i}] must be an object`);
      continue;
    }

    const mk0 = r.model ?? r.modelKey ?? r.key ?? r.id ?? null;
    if (!nonEmptyStr(mk0)) {
      errors.push(`rankings.json[${i}] is missing model key (model/modelKey)`);
      continue;
    }
    const mk = String(mk0).trim();

    if (!modelsMap.has(mk)) {
      errors.push(`models.json is missing metadata for rankings.json[${i}].model "${mk}"`);
    }
  }

  if (errors.length) {
    console.error("v4 snapshot validation failed:\n- " + errors.join("\n- "));
    process.exit(1);
  }

  console.log(`OK: v4 snapshot validated (${modelsMap.size} models, ${rankings.length} rankings).`);
}

main();
