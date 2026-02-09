/**
 * fill_overrides.mjs
 * 目的: public/data/v4/models.json を走査し、overrides/v4/models/*.json を「候補URL付き」で生成/更新する。
 * 方針:
 * - 既存overrideがあれば尊重（manual_overrideがあるものは上書きしない）
 * - 取れないものは not_found の枠だけ作る
 *
 * 注意:
 * - 無料運営前提: ランタイムfetchではなく、このスクリプトを手動実行してoverrideを更新する
 */
import fs from "node:fs";
import path from "node:path";

import { guessHfEvidence } from "./providers/huggingface.mjs";
import { guessArxivEvidence } from "./providers/arxiv.mjs";
import { guessGithubEvidence } from "./providers/github.mjs";
import { getModelMap, loadModelMaps, pickModelMappedUrl } from "./providers/model-maps.mjs";

const ROOT = process.cwd();
const V4_MODELS = path.join(ROOT, "public", "data", "v4", "models.json");
const OV_DIR = path.join(ROOT, "overrides", "v4", "models");

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}
function writeJson(p, obj) {
  fs.writeFileSync(p, `${JSON.stringify(obj, null, 2)}\n`, "utf-8");
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function byType(arr) {
  const m = new Map();
  for (const e of arr || []) {
    if (e && e.type) m.set(e.type, e);
  }
  return m;
}

const EVIDENCE_TYPES = ["official_page", "dev_activity", "paper", "audit"];
const STATUS_SET = new Set([
  "ok",
  "not_found",
  "blocked",
  "rate_limited",
  "ambiguous",
  "invalid",
  "missing_source_link",
  "missing",
]);
const LABELS = {
  official_page: "Official page",
  dev_activity: "Developer activity (repo/org)",
  paper: "Paper / technical report",
  audit: "Independent third-party security audit",
};

function isHttpUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeStatus(value) {
  if (value === null || value === undefined) return "missing";
  if (typeof value !== "string") return "invalid";
  const trimmed = value.trim();
  if (!trimmed) return "missing";
  const normalized = trimmed.toLowerCase();
  return STATUS_SET.has(normalized) ? normalized : "invalid";
}

function mergeUniq(arrA, arrB) {
  const listA = Array.isArray(arrA) ? arrA : [];
  const listB = Array.isArray(arrB) ? arrB : [];
  return Array.from(new Set([...listA, ...listB]));
}

function normalizeEvidenceItem(item, type) {
  const raw = item && typeof item === "object" ? item : {};
  const status = normalizeStatus(raw.status);
  const url = isHttpUrl(raw.url) ? raw.url : null;
  let refs = mergeUniq([], Array.isArray(raw.refs) ? raw.refs : []).filter(
    (ref) => typeof ref === "string" && ref
  );
  if (url) {
    refs = mergeUniq(refs, [url]);
  }

  const reasons = mergeUniq(
    [],
    Array.isArray(raw.reasons)
      ? raw.reasons.filter((reason) => typeof reason === "string" && reason)
      : []
  );

  if (status === "ok") reasons.push("ok");
  if (status === "ambiguous") reasons.push("ambiguous");
  if (status === "invalid") reasons.push("invalid");
  if (!url && status === "missing_source_link") {
    reasons.push("missing_source_link");
  }
  if (!url && (status === "not_found" || status === "missing")) {
    reasons.push(`missing_evidence_type:${type}`);
  }

  let normalizedReasons = Array.from(new Set(reasons));
  if (!normalizedReasons.length) {
    normalizedReasons = [`missing_evidence_type:${type}`];
  }

  return {
    type,
    status,
    label: LABELS[type] || "",
    url,
    refs,
    reasons: normalizedReasons,
  };
}

function finalizeEvidenceArray(evidenceArray) {
  const map = byType(evidenceArray);
  return EVIDENCE_TYPES.map((type) =>
    normalizeEvidenceItem(map.get(type) || { type }, type)
  );
}

function labelForType(type) {
  switch (type) {
    case "official_page":
      return LABELS.official_page;
    case "dev_activity":
      return LABELS.dev_activity;
    case "paper":
      return LABELS.paper;
    case "audit":
      return LABELS.audit;
    default:
      return "";
  }
}

function applyModelMapOverride(candidate, modelMap, type) {
  const mappedUrl = pickModelMappedUrl(modelMap, type);
  if (!mappedUrl) return candidate;
  const out = { ...(candidate || {}), type };
  out.status = "ok";
  out.label = out.label || labelForType(type);
  out.url = mappedUrl;
  out.refs = Array.from(new Set([...(out.refs || []), mappedUrl]));
  out.reasons = Array.from(new Set([...(out.reasons || []), "auto:model_map"]));
  return out;
}

ensureDir(OV_DIR);

const models = readJson(V4_MODELS);
const list = Array.isArray(models?.models)
  ? models.models
  : Array.isArray(models)
    ? models
    : [];

const modelMaps = loadModelMaps();
let updated = 0;

for (const m of list) {
  const modelKey = m?.modelKey || m?.key || m?.id;
  if (!modelKey) continue;

  const outPath = path.join(OV_DIR, `${modelKey}.json`);
  const existing = fs.existsSync(outPath)
    ? readJson(outPath)
    : { modelKey, evidence: [], links: [] };

  const map = byType(existing.evidence);
  const modelMap = getModelMap(modelMaps, modelKey);

  // required types
  const required = EVIDENCE_TYPES;

  // proposals
  const provider =
    m?.header?.provider ||
    m?.absolute?.provider ||
    m?.adoption?.provider ||
    m?.provider ||
    m?.org ||
    "";
  const hf = guessHfEvidence(m);
  const gh = guessGithubEvidence(m, provider);
  const ax = guessArxivEvidence(m, provider);

  const proposals = {
    official_page: hf,
    dev_activity: gh,
    paper: ax,
    audit: {
      type: "audit",
      status: "not_found",
      label: "Independent third-party security audit",
      reasons: ["auto: not searched"],
      refs: [],
    },
  };

  const nextEvidence = [];
  for (const t of required) {
    const cur = map.get(t);
    if (cur) {
      nextEvidence.push(cur);
      continue;
    }
    const p = proposals[t];
    if (t === "audit") {
      if (p) nextEvidence.push(p);
      else nextEvidence.push({ type: t, status: "not_found", reasons: [`auto:missing:${t}`] });
      continue;
    }
    const candidate = p || { type: t, status: "not_found", reasons: [`auto:missing:${t}`] };
    nextEvidence.push(applyModelMapOverride(candidate, modelMap, t));
  }

  const normalizedEvidence = finalizeEvidenceArray(nextEvidence);

  // links (collect from evidence urls/refs)
  const links = new Set(existing.links || []);
  for (const e of normalizedEvidence) {
    if (typeof e?.url === "string" && e.url) links.add(e.url);
    if (Array.isArray(e?.refs)) {
      for (const u of e.refs) {
        if (typeof u === "string" && u) links.add(u);
      }
    }
  }

  const out = {
    ...existing,
    modelKey,
    evidence: normalizedEvidence,
    links: Array.from(links),
  };

  // write only if changed
  const prevStr = JSON.stringify(existing);
  const nextStr = JSON.stringify(out);
  if (prevStr !== nextStr) {
    writeJson(outPath, out);
    updated++;
  }
}

console.log(`overrides updated: ${updated}`);
