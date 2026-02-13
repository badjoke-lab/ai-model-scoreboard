import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const MODELS = path.join(ROOT, "public", "data", "v4", "models.json");
const MAPS_DIR = path.join(ROOT, "overrides", "v4", "maps");
const INDEX = path.join(ROOT, "overrides", "v4", "_state", "overrides-index.json");

export function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

export function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function sortedClone(value) {
  if (Array.isArray(value)) return value.map((item) => sortedClone(item));
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortedClone(value[key]);
        return acc;
      }, {});
  }
  return value;
}

export function stable(value) {
  return JSON.stringify(sortedClone(value));
}

export function hash(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function normalizeModelRow(model) {
  const key = model?.modelKey || model?.key || model?.id || null;
  if (!key) return null;

  return {
    modelKey: key,
    provider:
      model?.header?.provider ||
      model?.absolute?.provider ||
      model?.adoption?.provider ||
      model?.provider ||
      model?.org ||
      null,
    releaseDate: model?.releaseDate || null,
    contextLength: model?.context_length || model?.contextLength || null,
    modality: model?.modality || null,
  };
}

function loadMapsInput() {
  if (!fs.existsSync(MAPS_DIR)) return {};

  const files = fs
    .readdirSync(MAPS_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort();

  const maps = {};
  for (const fileName of files) {
    maps[fileName] = readJson(path.join(MAPS_DIR, fileName), {});
  }
  return maps;
}

export function computeFingerprintState() {
  const modelsJ = readJson(MODELS, {});
  const list = Array.isArray(modelsJ?.models)
    ? modelsJ.models
    : Array.isArray(modelsJ)
      ? modelsJ
      : [];

  const maps = loadMapsInput();
  const prev = readJson(INDEX, { version: 1, fingerprints: {} });

  const out = { version: 1, fingerprints: {}, changed: [], added: [], unchanged: [] };

  for (const model of list) {
    const normalized = normalizeModelRow(model);
    if (!normalized?.modelKey) continue;

    const fpInput = {
      model: normalized,
      maps,
    };

    const fp = hash(stable(fpInput));
    out.fingerprints[normalized.modelKey] = fp;

    const prevFp = prev?.fingerprints?.[normalized.modelKey];
    if (!prevFp) {
      out.added.push(normalized.modelKey);
      out.changed.push(normalized.modelKey);
    } else if (prevFp !== fp) {
      out.changed.push(normalized.modelKey);
    } else {
      out.unchanged.push(normalized.modelKey);
    }
  }

  return out;
}

export function indexPath() {
  return INDEX;
}
