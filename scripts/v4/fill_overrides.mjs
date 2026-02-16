/**
 * fill_overrides.mjs
 * 目的: public/data/v4/models.json を走査し、overrides/v4/models/*.json を「候補URL付き」で生成/更新する。
 * 方針:
 * - デフォルトでは既存overrideを上書きしない（--forceで許可）
 * - manual_overrideがある既存overrideはデフォルト除外（--include-manualで許可）
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
import { matchFamilyPaper } from "./providers/family-maps.mjs";
import { computeFingerprintState, ensureDir, indexPath, readJson } from "./fingerprint.mjs";

const ROOT = process.cwd();
const V4_MODELS = path.join(ROOT, "public", "data", "v4", "models.json");
const OV_DIR = path.join(ROOT, "overrides", "v4", "models");
const ALIASES_FILE = path.join(ROOT, "overrides", "v4", "maps", "aliases.json");

const DASH_VARIANTS = /[‐‑‒–—―ー－]+/g;
const WHITESPACE_OR_UNDERSCORE = /[\s_]+/g;
const DISALLOWED_CHARS = /[^a-z0-9./-]+/g;
const MULTI_DASH = /-+/g;
const MAX_ALIAS_HOPS = 10;

function writeJson(p, obj) {
  fs.writeFileSync(p, `${JSON.stringify(obj, null, 2)}\n`, "utf-8");
}

function normalizeSegment(segment) {
  return segment
    .replace(DASH_VARIANTS, "-")
    .replace(WHITESPACE_OR_UNDERSCORE, "-")
    .replace(DISALLOWED_CHARS, "-")
    .replace(MULTI_DASH, "-")
    .replace(/^-+|-+$/g, "");
}

function safeDecodeOnce(input) {
  if (typeof input !== "string") return "";
  if (!input.includes("%")) return input;
  try {
    return decodeURIComponent(input);
  } catch {
    return input;
  }
}

function normalizeModelKey(raw) {
  if (typeof raw !== "string") return "";
  const normalized = safeDecodeOnce(raw).normalize("NFKC").toLowerCase().trim();
  if (!normalized) return "";

  return normalized
    .split("/")
    .map((segment) => normalizeSegment(segment))
    .filter(Boolean)
    .join("/");
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

function parseArgs(argv) {
  const only = [];
  let onlyFile = null;
  let onlyChanged = false;
  let writeIndex = false;
  let force = false;
  let includeManual = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--only") {
      const value = argv[i + 1];
      if (!value) throw new Error("--only requires a value");
      only.push(value);
      i += 1;
      continue;
    }
    if (arg === "--only-file") {
      const value = argv[i + 1];
      if (!value) throw new Error("--only-file requires a value");
      onlyFile = value;
      i += 1;
      continue;
    }
    if (arg === "--only-changed") {
      onlyChanged = true;
      continue;
    }
    if (arg === "--write-index") {
      writeIndex = true;
      continue;
    }
    if (arg === "--force") {
      force = true;
      continue;
    }
    if (arg === "--include-manual") {
      includeManual = true;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }

  return { only, onlyFile, onlyChanged, writeIndex, force, includeManual };
}

function collectOnlyFromFile(filePath) {
  const content = fs.readFileSync(path.resolve(ROOT, filePath), "utf-8");
  return content
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

function hasManualOverride(existing) {
  if (!existing || typeof existing !== "object") return false;
  if (existing.manual_override === true) return true;
  if (existing?.meta?.manual_override === true) return true;

  if (Array.isArray(existing.evidence)) {
    for (const evidence of existing.evidence) {
      if (evidence?.manual_override === true) return true;
      if (
        Array.isArray(evidence?.reasons) &&
        evidence.reasons.some((reason) => typeof reason === "string" && reason.includes("manual_override"))
      ) {
        return true;
      }
    }
  }

  return false;
}

function loadAliases() {
  if (!fs.existsSync(ALIASES_FILE)) return {};
  try {
    const parsed = readJson(ALIASES_FILE, {});
    const rawAliases = parsed?.aliases ?? {};
    const aliases = {};
    for (const [from, to] of Object.entries(rawAliases)) {
      if (typeof to !== "string") continue;
      const normalizedFrom = normalizeModelKey(from);
      const normalizedTo = normalizeModelKey(to);
      if (!normalizedFrom || !normalizedTo) continue;
      aliases[normalizedFrom] = normalizedTo;
    }
    return aliases;
  } catch {
    return {};
  }
}

function applyAlias(canonicalKey, aliases) {
  const startKey = normalizeModelKey(canonicalKey);
  if (!startKey) return { key: "", hops: [], loop: false };

  const hops = [startKey];
  const visited = new Set([startKey]);
  let currentKey = startKey;

  for (let i = 0; i < MAX_ALIAS_HOPS; i += 1) {
    const nextKey = aliases[currentKey];
    if (!nextKey) return { key: currentKey, hops, loop: false };
    if (visited.has(nextKey)) {
      hops.push(nextKey);
      return { key: currentKey, hops, loop: true };
    }
    visited.add(nextKey);
    hops.push(nextKey);
    currentKey = nextKey;
  }

  return { key: currentKey, hops, loop: false };
}

function validateAliasesOrExit(aliases) {
  for (const key of Object.keys(aliases)) {
    const resolved = applyAlias(key, aliases);
    if (resolved.loop) {
      console.error(
        `[fill_overrides] alias loop detected: ${resolved.hops.join(" -> ")} (from: ${key})`
      );
      process.exit(1);
    }
  }
}

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

function normalizeEvidenceItem(item, type, aliasUsed = false) {
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
  if (aliasUsed) {
    reasons.push("auto:alias");
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

function finalizeEvidenceArray(evidenceArray, aliasUsed = false) {
  const map = byType(evidenceArray);
  return EVIDENCE_TYPES.map((type) =>
    normalizeEvidenceItem(map.get(type) || { type }, type, aliasUsed)
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

function buildFamilyMappedPaperEvidence(modelKey) {
  const hit = matchFamilyPaper(modelKey);
  if (!hit) return null;

  return {
    type: "paper",
    status: "ok",
    label: LABELS.paper,
    url: hit.paper,
    refs: [hit.paper],
    reasons: ["auto:family_map"],
  };
}

const args = parseArgs(process.argv.slice(2));

ensureDir(OV_DIR);
const models = readJson(V4_MODELS, {});
const list = Array.isArray(models?.models)
  ? models.models
  : Array.isArray(models)
    ? models
    : [];

const aliases = loadAliases();
validateAliasesOrExit(aliases);

const selectors = new Set();
for (const onlyValue of args.only) selectors.add(normalizeModelKey(onlyValue));
if (args.onlyFile) {
  for (const key of collectOnlyFromFile(args.onlyFile)) selectors.add(normalizeModelKey(key));
}
if (args.onlyChanged) {
  const changedState = computeFingerprintState();
  for (const key of changedState.changed) selectors.add(normalizeModelKey(key));
}
selectors.delete("");
const hasSelector = selectors.size > 0;

const modelMaps = loadModelMaps();
let updated = 0;
let skippedExisting = 0;
let skippedManual = 0;
let considered = 0;

for (const m of list) {
  const rawModelKey = m?.modelKey || m?.key || m?.id;
  const normalizedModelKey = normalizeModelKey(rawModelKey);
  if (!normalizedModelKey) continue;

  const aliasResult = applyAlias(normalizedModelKey, aliases);
  if (aliasResult.loop) {
    console.error(
      `[fill_overrides] alias loop detected while resolving ${normalizedModelKey}: ${aliasResult.hops.join(" -> ")}`
    );
    process.exit(1);
  }

  const canonicalFinal = aliasResult.key;
  if (hasSelector && !selectors.has(normalizedModelKey) && !selectors.has(canonicalFinal)) {
    continue;
  }

  considered += 1;
  const aliasUsed = canonicalFinal !== normalizedModelKey;
  const encodedModelKey = encodeURIComponent(canonicalFinal);
  const outPath = path.join(OV_DIR, `${encodedModelKey}.json`);
  const hasExisting = fs.existsSync(outPath);
  const existing = hasExisting
    ? readJson(outPath, { modelKey: canonicalFinal, evidence: [], links: [] })
    : { modelKey: canonicalFinal, evidence: [], links: [] };

  if (hasExisting && hasManualOverride(existing) && !args.includeManual) {
    skippedManual += 1;
    continue;
  }

  if (hasExisting && !args.force) {
    skippedExisting += 1;
    continue;
  }

  const map = byType(existing.evidence);
  const modelMap = getModelMap(modelMaps, canonicalFinal);

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
  const familyPaper = buildFamilyMappedPaperEvidence(canonicalFinal);
  const hasModelMapPaper = Boolean(pickModelMappedUrl(modelMap, "paper"));
  const paperProposal = hasModelMapPaper ? ax : familyPaper || ax;

  const proposals = {
    official_page: hf,
    dev_activity: gh,
    paper: paperProposal,
    audit: {
      type: "audit",
      status: "not_found",
      label: "Independent third-party security audit",
      reasons: ["auto: not searched"],
      refs: [],
    },
  };

  const nextEvidence = [];
  for (const t of EVIDENCE_TYPES) {
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

  const normalizedEvidence = finalizeEvidenceArray(nextEvidence, aliasUsed);

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
    modelKey: canonicalFinal,
    evidence: normalizedEvidence,
    links: Array.from(links),
  };

  const prevStr = JSON.stringify(existing);
  const nextStr = JSON.stringify(out);
  if (!hasExisting || prevStr !== nextStr) {
    writeJson(outPath, out);
    updated += 1;
  }
}

if (args.writeIndex) {
  const state = computeFingerprintState();
  const idxPath = indexPath();
  ensureDir(path.dirname(idxPath));
  writeJson(idxPath, { version: state.version, fingerprints: state.fingerprints });
}

console.log(
  `overrides updated: ${updated} (considered=${considered}, skipped_existing=${skippedExisting}, skipped_manual=${skippedManual})`
);
