const fs = require("fs");
const path = require("path");

function exists(p){ return fs.existsSync(p); }
function readText(p){ return fs.readFileSync(p, "utf-8"); }
function readJson(p){
  if(!exists(p)) throw new Error(`missing file: ${p}`);
  const s = readText(p);
  try { return JSON.parse(s); } catch (err) { throw new Error(`invalid json: ${p}\n${err.message}`); }
}
function isObject(x){ return x && typeof x === "object" && !Array.isArray(x); }
function fail(msg){
  console.error("\nFATAL v4-validate-output:", msg);
  process.exit(1);
}
function assert(cond, msg){ if(!cond) fail(msg); }

const ROOT = process.cwd();
const V4_DIR = path.join(ROOT, "public", "data", "v4");
const INDEX_PATH = path.join(V4_DIR, "index.json");

const ALLOWED_EVIDENCE_TYPES = new Set(["official_page","dev_activity","paper","audit"]);
const ALLOWED_EVIDENCE_STATUS = new Set([
  "ok","not_found","missing_source_link","rate_limited","blocked","ambiguous","invalid"
]);

function mustNonEmptyStringArray(arr, label){
  assert(Array.isArray(arr), `${label} must be array`);
  assert(arr.length > 0, `${label} must be non-empty (empty is forbidden)`);
  for (const v of arr) assert(typeof v === "string" && v.trim().length > 0, `${label} must contain non-empty strings`);
}

// ---- model array extractor (shape-agnostic) ----
function extractBestModelArray(root){
  const seen = new Set();
  const arrays = [];

  function walk(node, depth){
    if (depth > 8) return;
    if (!node || typeof node !== "object") return;
    if (seen.has(node)) return;
    seen.add(node);

    if (Array.isArray(node)){
      arrays.push(node);
      for (const it of node) walk(it, depth + 1);
      return;
    }

    for (const k of Object.keys(node)){
      walk(node[k], depth + 1);
    }
  }

  walk(root, 0);

  function scoreArray(arr){
    let mk = 0;
    let rich = 0;
    for (const it of arr){
      if (!isObject(it)) continue;
      if (typeof it.modelKey === "string" && it.modelKey.length > 0) mk++;
      if (isObject(it.identity)) rich += 2;
      if (isObject(it.absoluteMetrics)) rich += 2;
      if (isObject(it.scores)) rich += 2;
      if (isObject(it.scoreBreakdown)) rich += 2;
    }
    // modelKey数を最優先、次にrich
    return mk * 1000 + rich;
  }

  let best = null;
  let bestScore = -1;
  for (const arr of arrays){
    const sc = scoreArray(arr);
    if (sc > bestScore){
      bestScore = sc;
      best = arr;
    }
  }
  return best;
}

function pickFilesFromIndex(idx){
  const manifest = isObject(idx?.manifest)
    ? idx.manifest
    : isObject(idx?.meta?.manifest)
      ? idx.meta.manifest
      : null;

  assert(isObject(manifest), "index.json manifest missing (expected manifest or meta.manifest)");
  assert(typeof manifest.models === "string", "index.json manifest.models missing");
  assert(typeof manifest.evidenceIndex === "string", "index.json manifest.evidenceIndex missing");
  return manifest;
}

function validateIndexJson(idx){
  assert(isObject(idx), "index.json must be an object");
  const meta = isObject(idx.meta) ? idx.meta : {};
  const version = meta.version ?? idx.version;
  const updatedAt = meta.updatedAt ?? idx.updatedAt;
  assert(version === "v4", "index.json version must be 'v4'");
  assert(typeof updatedAt === "string", "index.json.updatedAt missing");
}

function validateEvidenceIndex(eIdx){
  assert(isObject(eIdx), "evidence/index.json must be object");
  assert(isObject(eIdx.meta), "evidence/index.json.meta missing");
  assert(typeof eIdx.meta.updatedAt === "string", "evidence/index.json.meta.updatedAt missing");
  assert(isObject(eIdx.models), "evidence/index.json.models missing");
  return eIdx.models;
}

function validateEvidenceFile(modelKey, relPath){
  const p = path.join(V4_DIR, relPath);
  const ev = readJson(p);

  assert(isObject(ev.meta), `evidence meta missing: ${modelKey}`);
  assert(ev.meta.modelKey === modelKey, `evidence.meta.modelKey mismatch: expected=${modelKey} got=${ev.meta.modelKey}`);
  assert(typeof ev.meta.updatedAt === "string", `evidence.meta.updatedAt missing: ${modelKey}`);

  assert(Array.isArray(ev.evidenceItems), `evidenceItems missing/invalid: ${modelKey}`);
  assert(ev.evidenceItems.length === 4, `evidenceItems must be exactly 4 (fixed types): ${modelKey}`);

  const seen = new Set();
  for (const [i,item] of ev.evidenceItems.entries()){
    assert(isObject(item), `evidenceItems[${i}] must be object: ${modelKey}`);

    assert(typeof item.type === "string", `evidenceItems[${i}].type missing: ${modelKey}`);
    assert(ALLOWED_EVIDENCE_TYPES.has(item.type), `invalid evidence type '${item.type}' in ${modelKey}`);
    assert(!seen.has(item.type), `duplicate evidence type '${item.type}' in ${modelKey}`);
    seen.add(item.type);

    assert(typeof item.status === "string", `evidenceItems[${i}].status missing: ${modelKey}`);
    assert(ALLOWED_EVIDENCE_STATUS.has(item.status), `invalid evidence status '${item.status}' in ${modelKey}`);

    mustNonEmptyStringArray(item.reasons, `evidenceItems[${i}].reasons (${modelKey}/${item.type})`);

    assert(Array.isArray(item.refs), `evidenceItems[${i}].refs must be array: ${modelKey}`);
    assert(item.refs.length > 0 || item.status !== "ok", `refs must be non-empty when status=ok: ${modelKey}/${item.type}`);
    for (const v of item.refs) assert(typeof v === "string", `refs must be string: ${modelKey}/${item.type}`);

    if (item.status === "ok"){
      assert(item.extracted !== undefined, `extracted must exist when ok: ${modelKey}/${item.type}`);
    }
  }

  for (const t of ALLOWED_EVIDENCE_TYPES) assert(seen.has(t), `missing evidence type '${t}' in ${modelKey}`);
}

function validateModels(modelsRoot, evidenceIndexModels){
  const arr = extractBestModelArray(modelsRoot);
  assert(Array.isArray(arr) && arr.length > 0, "could not find a model array containing modelKey in models file");

  // sorted by modelKey (determinism)
  const keys = arr
    .filter(isObject)
    .map(m => m.modelKey)
    .filter(k => typeof k === "string" && k.length > 0);

  assert(keys.length > 0, "model array found but no modelKey strings present");
  const sorted = [...keys].sort((a,b)=>a.localeCompare(b));
  assert(keys.join("\n") === sorted.join("\n"), "models must be sorted by modelKey asc (determinism)");

  for (const m of arr){
    assert(isObject(m), "models[] must be object");
    assert(typeof m.modelKey === "string" && m.modelKey.length > 0, "models[].modelKey missing");

    // UI contract minimum presence
    assert(isObject(m.identity) && Object.keys(m.identity).length > 0, `${m.modelKey}: identity missing/empty`);
    assert(isObject(m.absoluteMetrics) && Object.keys(m.absoluteMetrics).length > 0, `${m.modelKey}: absoluteMetrics missing/empty`);
    assert(isObject(m.scores) && Object.keys(m.scores).length > 0, `${m.modelKey}: scores missing/empty`);
    assert(isObject(m.scoreBreakdown) && Object.keys(m.scoreBreakdown).length > 0, `${m.modelKey}: scoreBreakdown missing/empty`);

    const overall = m.scores.overallScore ?? m.scores.overall;
    assert(typeof overall === "number" && Number.isFinite(overall), `${m.modelKey}: scores.overallScore (or overall) must be a finite number`);

    assert(typeof evidenceIndexModels[m.modelKey] === "string", `${m.modelKey}: missing in evidence/index.json.models`);
  }

  return keys; // for logging if needed
}

(function main(){
  assert(exists(V4_DIR), `missing dir: ${V4_DIR}`);
  const idx = readJson(INDEX_PATH);
  validateIndexJson(idx);

  const files = pickFilesFromIndex(idx);

  // models / evidenceIndex のパス（存在するものを使う）
  const modelsRel = typeof files.models === "string" ? files.models : "models.json";
  const evidenceIndexRel = typeof files.evidenceIndex === "string" ? files.evidenceIndex : "evidence/index.json";

  const modelsPath = path.join(V4_DIR, modelsRel);
  const evidenceIndexPath = path.join(V4_DIR, evidenceIndexRel);

  const modelsRoot = readJson(modelsPath);
  const evidenceIndex = readJson(evidenceIndexPath);
  const evidenceIndexModels = validateEvidenceIndex(evidenceIndex);

  validateModels(modelsRoot, evidenceIndexModels);

  const entries = Object.entries(evidenceIndexModels);
  assert(entries.length > 0, "evidence/index.json.models must not be empty");
  for (const [modelKey, rel] of entries){
    assert(rel.startsWith("evidence/"), `evidence path must start with 'evidence/': ${modelKey} => ${rel}`);
    validateEvidenceFile(modelKey, rel);
  }

  console.log("OK: v4 output validated (index/models/evidence) with strict rules.");
})();
