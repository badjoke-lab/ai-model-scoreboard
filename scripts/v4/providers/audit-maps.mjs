import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const AUDIT_MAP_PATH = path.join(ROOT, "overrides", "v4", "maps", "audit-candidates.json");
const SHORTENER_HOSTS = new Set(["t.co", "bit.ly", "tinyurl.com", "goo.gl", "ow.ly", "is.gd", "buff.ly", "rebrand.ly"]);

function normalizeProvider(value) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

function isAllowedAuditUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    if (SHORTENER_HOSTS.has(parsed.hostname.toLowerCase())) return false;
    return true;
  } catch {
    return false;
  }
}

function normalizeModelKeyWith(normalizeModelKey, value) {
  if (typeof value !== "string") return "";
  return normalizeModelKey(value);
}

function normalizeAuditEntry(normalizeModelKey, entry) {
  if (!entry || typeof entry !== "object") return null;

  const appliesTo = entry.appliesTo && typeof entry.appliesTo === "object" ? entry.appliesTo : {};
  const provider = normalizeProvider(appliesTo.provider);
  const models = Array.isArray(appliesTo.models)
    ? Array.from(new Set(appliesTo.models.map((model) => normalizeModelKeyWith(normalizeModelKey, model)).filter(Boolean)))
    : [];

  if (!provider && models.length === 0) return null;

  const label = typeof entry.label === "string" && entry.label.trim() ? entry.label.trim() : "";
  const url = typeof entry.url === "string" ? entry.url.trim() : "";
  const date = typeof entry.date === "string" && entry.date.trim() ? entry.date.trim() : "";
  const by = typeof entry.by === "string" && entry.by.trim() ? entry.by.trim() : "";
  const scope = typeof entry.scope === "string" && entry.scope.trim() ? entry.scope.trim() : "";

  if (!label || !date || !by || !scope) return null;
  if (!isAllowedAuditUrl(url)) return null;

  return {
    appliesTo: {
      ...(provider ? { provider } : {}),
      ...(models.length ? { models } : {}),
    },
    label,
    url,
    date,
    by,
    scope,
  };
}

export function loadAuditCandidates(normalizeModelKey) {
  if (typeof normalizeModelKey !== "function") return { audits: [] };
  try {
    const raw = fs.readFileSync(AUDIT_MAP_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    const audits = Array.isArray(parsed?.audits) ? parsed.audits : [];
    return {
      audits: audits.map((entry) => normalizeAuditEntry(normalizeModelKey, entry)).filter(Boolean),
    };
  } catch {
    return { audits: [] };
  }
}

export function pickAuditCandidate(auditMaps, modelKey, provider) {
  const audits = Array.isArray(auditMaps?.audits) ? auditMaps.audits : [];
  if (!audits.length) return null;

  const normalizedModelKey = typeof modelKey === "string" ? modelKey : "";
  const normalizedProvider = normalizeProvider(provider);

  for (const entry of audits) {
    const modelTargets = Array.isArray(entry?.appliesTo?.models) ? entry.appliesTo.models : [];
    if (modelTargets.includes(normalizedModelKey)) return entry;
  }

  if (!normalizedProvider) return null;
  for (const entry of audits) {
    if (entry?.appliesTo?.provider === normalizedProvider) return entry;
  }

  return null;
}
