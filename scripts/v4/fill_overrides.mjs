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

function shouldKeep(e) {
  const reasons = Array.isArray(e?.reasons) ? e.reasons : [];
  return reasons.includes("manual_override");
}

ensureDir(OV_DIR);

const models = readJson(V4_MODELS);
const list = Array.isArray(models?.models)
  ? models.models
  : Array.isArray(models)
    ? models
    : [];

let updated = 0;

for (const m of list) {
  const modelKey = m?.modelKey || m?.key || m?.id;
  if (!modelKey) continue;

  const outPath = path.join(OV_DIR, `${modelKey}.json`);
  const existing = fs.existsSync(outPath)
    ? readJson(outPath)
    : { modelKey, evidence: [], links: [] };

  const map = byType(existing.evidence);

  // required types
  const required = ["official_page", "dev_activity", "paper", "audit"];

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
    if (cur && shouldKeep(cur)) {
      nextEvidence.push(cur);
      continue;
    }
    const p = proposals[t];
    if (p) nextEvidence.push(p);
    else nextEvidence.push({ type: t, status: "not_found", reasons: [`auto:missing:${t}`] });
  }

  // links (collect from evidence urls/refs)
  const links = new Set(existing.links || []);
  for (const e of nextEvidence) {
    if (typeof e?.url === "string" && e.url) links.add(e.url);
    if (Array.isArray(e?.refs)) {
      for (const u of e.refs) {
        if (typeof u === "string" && u) links.add(u);
      }
    }
  }

  const out = {
    modelKey,
    evidence: nextEvidence,
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
