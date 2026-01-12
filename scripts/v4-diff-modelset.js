"use strict";

const fs = require("fs");
const path = require("path");

const DEFAULT_BASEDIR = path.join("public", "data", "v4");
const BASEDIR_A = process.env.V4_BASEDIR_A || process.argv[2] || DEFAULT_BASEDIR;
const BASEDIR_B = process.env.V4_BASEDIR_B || process.argv[3] || DEFAULT_BASEDIR;

function fail(msg) {
  console.error(`[v4-diff-modelset] ERROR: ${msg}`);
  process.exit(1);
}

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch (e) {
    fail(`failed to read json: ${p} (${e.message})`);
  }
}

function getManifest(idx) {
  if (idx && typeof idx === "object") {
    if (idx.manifest && typeof idx.manifest === "object") return idx.manifest;
    if (idx.meta && typeof idx.meta === "object" && idx.meta.manifest && typeof idx.meta.manifest === "object") {
      return idx.meta.manifest;
    }
  }
  return null;
}

function isObj(x) {
  return x && typeof x === "object" && !Array.isArray(x);
}

function extractModels(root) {
  if (Array.isArray(root)) return root;

  if (isObj(root)) {
    if (Array.isArray(root.models)) return root.models;
    if (isObj(root.models)) {
      return Object.entries(root.models)
        .filter(([, v]) => isObj(v))
        .map(([k, v]) => ({ modelKey: k, ...v }));
    }

    if (Array.isArray(root.data)) return root.data;
    if (isObj(root.data)) {
      return Object.entries(root.data)
        .filter(([, v]) => isObj(v))
        .map(([k, v]) => ({ modelKey: k, ...v }));
    }

    if (Array.isArray(root.items)) return root.items;
    if (isObj(root.items)) {
      return Object.entries(root.items)
        .filter(([, v]) => isObj(v))
        .map(([k, v]) => ({ modelKey: k, ...v }));
    }

    const entries = Object.entries(root).filter(([, v]) => isObj(v));
    return entries.map(([k, v]) => ({ modelKey: k, ...v }));
  }

  return [];
}

function loadModelKeys(baseDir) {
  const indexPath = path.resolve(baseDir, "index.json");
  if (!fs.existsSync(indexPath)) {
    fail(`index.json does not exist: ${indexPath}`);
  }
  const idx = readJson(indexPath);
  const manifest = getManifest(idx);
  if (!manifest || typeof manifest.models !== "string") {
    fail(`index.json manifest.models missing: ${indexPath}`);
  }

  const modelsPath = path.resolve(baseDir, manifest.models);
  if (!fs.existsSync(modelsPath)) {
    fail(`models.json does not exist: ${modelsPath}`);
  }

  const root = readJson(modelsPath);
  const models = extractModels(root);
  const keys = models
    .filter(isObj)
    .map((m) => m.modelKey || m.key || m.id)
    .filter((k) => typeof k === "string" && k.trim().length > 0)
    .map((k) => k.trim());

  return {
    baseDir,
    indexPath,
    modelsPath,
    keys,
  };
}

function diffSets(aKeys, bKeys) {
  const aSet = new Set(aKeys);
  const bSet = new Set(bKeys);
  const onlyInA = [...aSet].filter((k) => !bSet.has(k)).sort((x, y) => x.localeCompare(y));
  const onlyInB = [...bSet].filter((k) => !aSet.has(k)).sort((x, y) => x.localeCompare(y));
  return { onlyInA, onlyInB };
}

function logContext(label, data) {
  console.log(`[v4-diff-modelset] ${label}.baseDir=${data.baseDir}`);
  console.log(`[v4-diff-modelset] ${label}.indexPath=${data.indexPath}`);
  console.log(`[v4-diff-modelset] ${label}.modelsPath=${data.modelsPath}`);
  console.log(`[v4-diff-modelset] ${label}.modelsCount=${data.keys.length}`);
}

function main() {
  const a = loadModelKeys(BASEDIR_A);
  const b = loadModelKeys(BASEDIR_B);

  logContext("A", a);
  logContext("B", b);

  const { onlyInA, onlyInB } = diffSets(a.keys, b.keys);
  console.log(`[v4-diff-modelset] onlyInA.count=${onlyInA.length}`);
  if (onlyInA.length) console.log(`[v4-diff-modelset] onlyInA=${onlyInA.join(",")}`);
  console.log(`[v4-diff-modelset] onlyInB.count=${onlyInB.length}`);
  if (onlyInB.length) console.log(`[v4-diff-modelset] onlyInB=${onlyInB.join(",")}`);

  if (onlyInA.length || onlyInB.length) {
    process.exit(1);
  }

  console.log("[v4-diff-modelset] OK: model sets match.");
}

main();
