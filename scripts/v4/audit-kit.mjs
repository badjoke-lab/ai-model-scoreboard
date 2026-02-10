/**
 * audit-kit.mjs
 * Offline-only helper:
 * - generates search queries (no fetch)
 * - ranks priorities
 * - emits override JSON stubs for audit
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function readJson(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return fallback;
  }
}

const MODELS_PATH = path.join(ROOT, "public", "data", "v4", "models.json");
const providerMaps = readJson(
  path.join(ROOT, "overrides", "v4", "maps", "provider-maps.json"),
  { providers: {} }
);
const modelMaps = readJson(
  path.join(ROOT, "overrides", "v4", "maps", "model-maps.json"),
  { models: {} }
);

const raw = readJson(MODELS_PATH, null);
const models = Array.isArray(raw?.models)
  ? raw.models
  : Array.isArray(raw)
  ? raw
  : raw && typeof raw === "object"
  ? Object.entries(raw).map(([modelKey, data]) => ({
      modelKey,
      ...(data || {}),
    }))
  : [];
if (!Array.isArray(models) || models.length === 0) {
  console.error("No models found at", MODELS_PATH);
  process.exit(1);
}

function safeDecode(k) {
  try {
    return decodeURIComponent(k);
  } catch {
    return k;
  }
}

function normProvider(p) {
  const s = (p || "").toString().toLowerCase().trim();
  if (!s) return "";
  if (s.includes("openai")) return "openai";
  if (s.includes("meta")) return "meta";
  if (s.includes("mistral")) return "mistral";
  if (s.includes("anthropic")) return "anthropic";
  if (s.includes("google")) return "google";
  return s;
}

function priorityOf(m) {
  // cheap heuristic: adopted + big provider => High
  const provider = normProvider(m?.provider || m?.org);
  const adopted =
    (m?.status || m?.adoptionStatus || "").toString().toLowerCase() ===
    "adopted";
  if (adopted && ["openai", "meta", "anthropic", "google", "mistral"].includes(provider)) {
    return "HIGH";
  }
  if (adopted) return "MEDIUM";
  return "LOW";
}

function makeQueries({ name, provider }) {
  const prov = provider ? `"${provider}"` : "";
  // “監査”は日本語も混ぜる（人間検索が楽）
  return [
    `"${name}" third-party audit report`,
    `"${name}" security assessment pdf`,
    `"${name}" red teaming report`,
    `${prov} "${name}" audit`,
    `${prov} "${name}" "security review"`,
    `"${name}" 監査 レッドチーム レポート`,
    `"${name}" セキュリティ 評価 レポート`,
  ].filter(Boolean);
}

function writeOut(modelKey, content) {
  const outDir = path.join(ROOT, "overrides", "v4", "audit-candidates", "out");
  const filename = `${encodeURIComponent(modelKey)}.json`;
  const p = path.join(outDir, filename);
  fs.writeFileSync(p, JSON.stringify(content, null, 2) + "\n", "utf-8");
  return p;
}

const index = [];

for (const m of models) {
  const modelKey = (m?.modelKey || m?.key || "").toString();
  if (!modelKey) continue;

  const name = safeDecode(modelKey);
  const providerRaw = (m?.provider || m?.org || "").toString();
  const provider = normProvider(providerRaw);

  const pri = priorityOf(m);
  const queries = makeQueries({ name, provider: providerRaw });
  const modelKeyEncoded = encodeURIComponent(modelKey);

  const stub = {
    modelKey,
    evidence: [
      {
        type: "audit",
        status: "not_found",
        label: "Independent third-party security audit",
        reasons: ["missing_evidence_type:audit", "offline:audit_kit_stub"],
        refs: [],
      },
    ],
    _auditKit: {
      priority: pri,
      provider: providerRaw,
      queries,
      providerMap: providerMaps.providers?.[provider] || null,
      modelMap:
        modelMaps.models?.[modelKey] ||
        modelMaps.models?.[modelKeyEncoded] ||
        null,
    },
  };

  const outPath = writeOut(modelKey, stub);

  index.push({
    modelKey,
    priority: pri,
    provider: providerRaw,
    outPath: path.relative(ROOT, outPath),
    queriesCount: queries.length,
  });
}

const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
index.sort(
  (a, b) => (order[a.priority] - order[b.priority]) || a.modelKey.localeCompare(b.modelKey)
);

const indexPath = path.join(
  ROOT,
  "overrides",
  "v4",
  "audit-candidates",
  "out",
  "_index.json"
);
fs.writeFileSync(indexPath, JSON.stringify(index, null, 2) + "\n", "utf-8");

console.log("Wrote", index.length, "audit stubs.");
console.log("Index:", path.relative(ROOT, indexPath));
console.log("Top 10:");
for (const r of index.slice(0, 10)) {
  console.log(`- [${r.priority}] ${r.modelKey} -> ${r.outPath}`);
}
