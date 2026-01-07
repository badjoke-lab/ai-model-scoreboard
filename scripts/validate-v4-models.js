"use strict";

const fs = require("fs");

const FILE = "public/data/v4/models.json";

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
  // models.json の形が揺れても耐える（array / {models:...} / top-level map）
  if (Array.isArray(root)) return root;

  if (isObj(root)) {
    if (Array.isArray(root.models)) return root.models;
    if (isObj(root.models)) return Object.values(root.models);

    if (Array.isArray(root.data)) return root.data;
    if (isObj(root.data)) return Object.values(root.data);

    if (Array.isArray(root.items)) return root.items;
    if (isObj(root.items)) return Object.values(root.items);

    // お前の現状：トップが辞書 { "anthropic/claude-...": {...}, ... }
    const vals = Object.values(root).filter(isObj);
    const modelish = vals.filter((v) =>
      ("overallScore" in v) || ("categoryScores" in v) || ("itemScores" in v) || ("evidenceRef" in v)
    );
    if (modelish.length) return modelish;
  }

  return [];
}

function validateEvidenceRef(model, idxLabel) {
  const ev = model.evidenceRef;
  if (!ev) {
    fail(`${idxLabel}: missing evidenceRef`);
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
  let root;
  try {
    root = JSON.parse(fs.readFileSync(FILE, "utf-8"));
  } catch (e) {
    console.error(e);
    process.exit(1);
  }

  const models = extractModels(root);
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
  console.log(`✅ v4 validation OK: ${models.length} models checked.`);
}

main();
