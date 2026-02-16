import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PATH_JSON = path.join(ROOT, "overrides", "v4", "maps", "family-maps.json");

function readJson(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return fallback;
  }
}

export function loadFamilyMaps() {
  const j = readJson(PATH_JSON, { families: [] });
  return Array.isArray(j?.families) ? j.families : [];
}

function safeDecode(k) {
  try {
    return decodeURIComponent(k);
  } catch {
    return k;
  }
}

export function matchFamilyPaper(modelKey) {
  const decoded = safeDecode(modelKey || "");
  if (!decoded) return null;
  const fams = loadFamilyMaps();

  for (const f of fams) {
    const m = f?.match;
    const paper = f?.paper;
    if (!m || !paper) continue;

    if (m.type === "prefix" && typeof m.value === "string") {
      if (decoded.startsWith(m.value)) return { id: f.id || "unknown", paper };
    }

    if (m.type === "regex" && typeof m.value === "string") {
      try {
        const re = new RegExp(m.value);
        if (re.test(decoded)) return { id: f.id || "unknown", paper };
      } catch {}
    }
  }
  return null;
}
