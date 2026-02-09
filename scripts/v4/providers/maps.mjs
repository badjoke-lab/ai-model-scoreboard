import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MAP_PATH = path.join(ROOT, "overrides", "v4", "maps", "provider-maps.json");

export function loadProviderMaps() {
  try {
    const s = fs.readFileSync(MAP_PATH, "utf-8");
    const j = JSON.parse(s);
    if (!j || typeof j !== "object") return { version: 0, providers: {} };
    if (!j.providers || typeof j.providers !== "object") return { version: j.version ?? 0, providers: {} };
    return j;
  } catch {
    return { version: 0, providers: {} };
  }
}

export function normProvider(x) {
  const s = (x ?? "").toString().toLowerCase().trim();
  if (!s) return "";
  // “寄せすぎない”が重要：推測を増やさない
  if (s === "meta" || s.includes("meta")) return "meta";
  if (s === "mistral" || s.includes("mistral")) return "mistral";
  if (s === "openai" || s.includes("openai")) return "openai";
  if (s === "anthropic" || s.includes("anthropic")) return "anthropic";
  if (s === "google" || s.includes("google")) return "google";
  return s;
}

export function getProviderMap(maps, provider) {
  const key = normProvider(provider);
  if (!key) return null;
  const m = maps?.providers?.[key];
  if (!m || typeof m !== "object") return null;
  return m;
}

// “辞書にあるURLだけ”を返す（空/不正はnull）
export function pickMappedUrl(m, field) {
  const u = m?.[field];
  if (typeof u !== "string") return null;
  const s = u.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) return null;
  return s;
}
