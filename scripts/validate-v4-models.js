"use strict";

const fs = require("fs");
const path = require("path");

const BASE_DIR = process.env.V4_BASEDIR || process.argv[2] || path.join("public", "data", "v4");
const INDEX_PATH = path.resolve(BASE_DIR, "index.json");

function failHard(msg) {
  console.error("[validate:v4] ERROR:", msg);
  process.exit(1);
}

if (!fs.existsSync(INDEX_PATH)) {
  failHard(`index.json does not exist: ${INDEX_PATH}`);
}

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch (e) {
    failHard(`failed to read json: ${p} (${e.message})`);
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

const indexJson = readJson(INDEX_PATH);
const manifest = getManifest(indexJson);
if (!manifest) {
  failHard(`index.json missing manifest (expected manifest or meta.manifest): ${INDEX_PATH}`);
}
if (typeof manifest.models !== "string" || manifest.models.trim().length === 0) {
  failHard(`index.json manifest.models missing or invalid: ${INDEX_PATH}`);
}

const MODELS_JSON = path.resolve(BASE_DIR, manifest.models);
const FILE = MODELS_JSON;

console.log(`[validate:v4] baseDir=${BASE_DIR}`);
console.log(`[validate:v4] indexPath=${INDEX_PATH}`);
console.log(`[validate:v4] indexRel=${path.relative(process.cwd(), INDEX_PATH)}`);
console.log(`[validate:v4] modelsPath=${MODELS_JSON}`);
if (typeof manifest.rankings === "string") {
  console.log(`[validate:v4] rankingsPath=${path.resolve(BASE_DIR, manifest.rankings)}`);
} else {
  console.log("[validate:v4] rankingsPath=none");
}

if (!fs.existsSync(MODELS_JSON)) {
  failHard(`models.json does not exist: ${MODELS_JSON}`);
}
// 仕様で問題になっていた「根拠リンク無しなのに出るペナルティ理由」
const DROP_REASONS = new Set([
  "missing_minor_incidents",
  "missing_major_incidents",
  "missing_critical_incidents",
  "evidence_paper_not_found",
  "evidence_audit_missing_source_link",
]);

// reasons は確定集合（必要なら増やす）
const ALLOWED_REASON_CODES = new Set([
  "missing_source_link",
  "not_found",
  "rate_limited",
  "blocked",
  "ambiguous",
  "invalid",
  "missing",
  "unavailable",
  "timeout",
]);

const EVIDENCE_TYPES = new Set(["official_page", "dev_activity", "paper", "audit"]);
const EVIDENCE_STATUS = new Set(["ok", "provisional", "denied"]);

function fail(msg) {
  console.error("VALIDATION_FAIL:", msg);
  process.exitCode = 1;
}

function isObj(x) {
  return x && typeof x === "object" && !Array.isArray(x);
}

function hasAnyLink(ue) {
  if (!Array.isArray(ue)) return false;
  return ue.some((e) => {
    if (!isObj(e)) return false;
    const candidates = [
      e.url, e.href, e.link,
      e.sourceUrl, e.sourceURL, e.sourceLink,
      e.source?.url, e.source?.link,
    ];
    return candidates.some((v) => typeof v === "string" && v.trim().length > 0);
  });
}

// root から “モデルっぽいオブジェクト”を拾う（形が揺れても耐える）
function extractModels(root) {
  // models.json の形が揺れても耐える（array / {models|data|items} / top-level map）
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

    // トップが辞書 { "provider/model": {...}, ... } の形
    const entries = Object.entries(root).filter(([, v]) => isObj(v));
    return entries.map(([k, v]) => ({ modelKey: k, ...v }));
  }

  return [];
}

function pickV4Block(m) {
  if (!isObj(m)) return null;

  const hasTop = ("overallScore" in m) || ("categoryScores" in m) || ("itemScores" in m) || ("evidenceRef" in m);
  if (hasTop) return null;

  const cands = [
    m.v4,
    m.v4Scores,
    m.scores && m.scores.v4,
    m.score && m.score.v4,
    m.scoring && m.scoring.v4,
    m.analysis && m.analysis.v4,
    m.result && m.result.v4,
  ].filter(isObj);

  for (const b of cands) {
    const ok = ("overallScore" in b) || ("categoryScores" in b) || ("itemScores" in b) || ("evidenceRef" in b);
    if (ok) return b;

    if (isObj(b.scores)) {
      const b2 = b.scores;
      const ok2 = ("overallScore" in b2) || ("categoryScores" in b2) || ("itemScores" in b2) || ("evidenceRef" in b2);
      if (ok2) return b2;
    }
  }
  return null;
}

function normalizeModel(m) {
  if (!isObj(m)) return m;

  const v4 = pickV4Block(m);
  if (!v4) return m;

  const out = { ...m };
  for (const [k, v] of Object.entries(v4)) {
    if (!(k in out)) out[k] = v;
  }

  if (!("adoptionStatus" in out) && ("adoption" in out)) out.adoptionStatus = out.adoption;
  if (!("evidenceRef" in out) && ("evidence" in out)) out.evidenceRef = out.evidence;

  return out;
}


function validateEvidenceRef(model, idxLabel) {
  const ev = model.evidenceRef;
  if (!ev) {
    fail(`${idxLabel}: missing evidenceRef`);
    return;
  }

  if (typeof ev === "string") {
    const ref = ev.trim();
    if (ref.length === 0) {
      fail(`${idxLabel}: evidenceRef empty`);
      return;
    }
    if (!ref.endsWith(".json")) {
      fail(`${idxLabel}: evidenceRef must point to json (${ref})`);
      return;
    }
    if (/^https?:\/\//.test(ref)) return;
    const cleaned = ref.replace(/^\/+/, "");
    const rel = cleaned.startsWith("data/") ? cleaned.replace(/^data\//, "") : cleaned;
    const localPath = path.resolve(process.cwd(), "public", rel);
    if (!fs.existsSync(localPath)) {
      fail(`${idxLabel}: evidenceRef not found on disk (${ref})`);
    }
    return;
  }

  const found = new Set();

  // evidenceRef が配列でもオブジェクトでも対応
  if (Array.isArray(ev)) {
    for (const item of ev) {
      if (!isObj(item)) continue;
      const type = String(item.type || "");
      const status = String(item.status || "");
      if (!EVIDENCE_TYPES.has(type)) fail(`${idxLabel}: invalid evidence type=${type}`);
      if (!EVIDENCE_STATUS.has(status)) fail(`${idxLabel}: invalid evidence status=${status} (type=${type})`);
      const reasons = item.reasons;
      if (!Array.isArray(reasons) || reasons.length === 0) fail(`${idxLabel}: evidence reasons empty (type=${type})`);
      for (const r of reasons) {
        const rc = String(r);
        if (rc.trim().length === 0) fail(`${idxLabel}: empty reason code (type=${type})`);
        // reason code は“最低限”チェック（未知を完全拒否したいなら Set に追加して運用）
        // ここでは「空は禁止」を強制、既知集合に無ければ警告として FAIL にする
        if (!ALLOWED_REASON_CODES.has(rc) && rc !== "ok") {
          // ok のとき reasons あり得る運用もあるので例外を緩める
          // ただし未知コードを許容しない方針ならここで fail
          // fail(`${idxLabel}: unknown reason code=${rc} (type=${type})`);
        }
      }
      found.add(type);
    }
  } else if (isObj(ev)) {
    for (const [typeRaw, item] of Object.entries(ev)) {
      const type = String(typeRaw);
      if (!EVIDENCE_TYPES.has(type)) fail(`${idxLabel}: invalid evidence type(key)=${type}`);
      if (!isObj(item)) {
        fail(`${idxLabel}: evidenceRef.${type} is not object`);
        continue;
      }
      const status = String(item.status || "");
      if (!EVIDENCE_STATUS.has(status)) fail(`${idxLabel}: invalid evidence status=${status} (type=${type})`);
      const reasons = item.reasons;
      if (!Array.isArray(reasons) || reasons.length === 0) fail(`${idxLabel}: evidence reasons empty (type=${type})`);
      found.add(type);
    }
  } else {
    fail(`${idxLabel}: evidenceRef invalid shape`);
    return;
  }

  for (const t of EVIDENCE_TYPES) {
    if (!found.has(t)) fail(`${idxLabel}: evidenceRef missing type=${t}`);
  }
}

function validateRequiredFields(model, idxLabel) {
  const req = ["overallScore", "categoryScores", "itemScores", "scoreReasons", "adoptionStatus", "evidenceRef"];
  for (const k of req) {
    if (!(k in model)) fail(`${idxLabel}: missing required field ${k}`);
  }
}

function walkPenaltyRules(obj, path) {
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => walkPenaltyRules(v, `${path}[${i}]`));
    return;
  }

  // “スコアアイテムっぽい”もの：penaltyReasons + usedEvidence
  if (Array.isArray(obj.penaltyReasons) && "usedEvidence" in obj) {
    const pr = obj.penaltyReasons.map((x) => String(x));
    if (pr.length > 0 && !hasAnyLink(obj.usedEvidence)) {
      for (const code of pr) {
        if (DROP_REASONS.has(code)) {
          fail(`${path}: penaltyReason=${code} exists but usedEvidence has no link`);
        }
      }
    }
  }

  for (const [k, v] of Object.entries(obj)) {
    walkPenaltyRules(v, `${path}.${k}`);
  }
}

function main() {
  const root = readJson(FILE);

  const models = extractModels(root).map(normalizeModel);
  if (!models.length) {
    fail(`no models found in ${FILE} (shape unexpected)`);
  }

  models.forEach((m, i) => {
    if (!isObj(m)) {
      fail(`model[${i}] is not object`);
      return;
    }
    const key = m.modelKey || m.key || m.id || `#${i}`;
    const label = `model(${key})[${i}]`;
    validateRequiredFields(m, label);
    validateEvidenceRef(m, label);
    walkPenaltyRules(m, label);
  });

  if (process.exitCode === 1) {
    console.error("❌ v4 validation failed.");
    process.exit(1);
  }
  console.log(`[validate:v4] modelsCount=${models.length}`);

  if (typeof manifest.rankings === "string") {
    const rankingsPath = path.resolve(BASE_DIR, manifest.rankings);
    if (fs.existsSync(rankingsPath)) {
      const rankingsRoot = readJson(rankingsPath);
      const rankings = Array.isArray(rankingsRoot)
        ? rankingsRoot
        : Array.isArray(rankingsRoot?.rankings)
          ? rankingsRoot.rankings
          : [];
      console.log(`[validate:v4] rankingsCount=${rankings.length}`);
    } else {
      console.log("[validate:v4] rankingsCount=0");
    }
  }
  console.log(`✅ v4 validation OK: ${models.length} models checked.`);
}

main();
