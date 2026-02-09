import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MAP_PATH = path.join(ROOT, "overrides", "v4", "maps", "model-maps.json");

export function loadModelMaps() {
  try {
    const s = fs.readFileSync(MAP_PATH, "utf-8");
    const j = JSON.parse(s);
    if (!j || typeof j !== "object") return { version: 0, models: {} };
    if (!j.models || typeof j.models !== "object") return { version: j.version ?? 0, models: {} };
    return j;
  } catch {
    return { version: 0, models: {} };
  }
}

export function getModelMap(maps, modelKey) {
  const k = (modelKey ?? "").toString();
  if (!k) return null;
  const m = maps?.models?.[k];
  if (!m || typeof m !== "object") return null;
  return m;
}

export function isHttpUrl(x) {
  if (typeof x !== "string") return false;
  const s = x.trim();
  if (!s) return false;
  return /^https?:\/\//i.test(s);
}

export function pickModelMappedUrl(modelMap, field) {
  const u = modelMap?.[field];
  if (!isHttpUrl(u)) return null;
  return u.trim();
}

// auditは“入っててもOK”だが、ここでは許可しない（policy側で別途判定）
// ＝このローダは audit ok 判定を持たない
