import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DIR = path.join(ROOT, "overrides", "v4", "models");

// strict: CIでは常に4タイプ必須にする（運用をブレさせない）
const REQUIRED_TYPES = ["official_page", "dev_activity", "paper", "audit"];

const ALLOWED_STATUS = new Set([
  "ok",
  "not_found",
  "blocked",
  "rate_limited",
  "ambiguous",
  "invalid",
  "missing_source_link",
  "missing",
]);

function fail(msg) {
  console.error("FAIL:", msg);
  process.exitCode = 1;
}

function isNonEmptyString(x) {
  return typeof x === "string" && x.trim().length > 0;
}

function readJson(filePath) {
  const s = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(s);
}

if (!fs.existsSync(DIR)) {
  console.log("ok: overrides dir not found");
  process.exit(0);
}

const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".json"));
for (const f of files) {
  const p = path.join(DIR, f);

  let j;
  try {
    j = readJson(p);
  } catch (e) {
    fail(`${f}: invalid json`);
    continue;
  }

  // modelKey
  if (!isNonEmptyString(j?.modelKey)) {
    fail(`${f}: missing modelKey (non-empty string required)`);
  } else {
    // filename must equal modelKey + ".json"
    const expected = `${j.modelKey}.json`;
    if (f !== expected) {
      fail(`${f}: filename mismatch (expected: ${expected})`);
    }
  }

  // evidence
  const ev = Array.isArray(j?.evidence) ? j.evidence : null;
  if (!ev) {
    fail(`${f}: evidence must be an array`);
    continue;
  }

  // type uniqueness
  const typeCounts = new Map();
  for (const e of ev) {
    const t = e?.type;
    if (isNonEmptyString(t)) {
      typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
    }
  }
  for (const [t, c] of typeCounts.entries()) {
    if (c > 1) fail(`${f}: duplicate evidence type "${t}" (${c})`);
  }

  // required types present
  const typeSet = new Set(ev.map((x) => x?.type).filter(isNonEmptyString));
  for (const t of REQUIRED_TYPES) {
    if (!typeSet.has(t)) fail(`${f}: missing evidence type "${t}"`);
  }

  // evidence item validation
  for (const e of ev) {
    if (!e || typeof e !== "object") {
      fail(`${f}: evidence item must be object`);
      continue;
    }

    if (!isNonEmptyString(e.type)) {
      fail(`${f}: evidence missing type`);
    } else if (!REQUIRED_TYPES.includes(e.type)) {
      // 4枠固定運用。余計なtypeは事故源なので弾く
      fail(
        `${f}: evidence type "${e.type}" is not allowed (must be one of ${REQUIRED_TYPES.join(",")})`,
      );
    }

    if (!isNonEmptyString(e.status)) {
      fail(`${f}: ${e?.type || "unknown"}: missing status`);
    } else if (!ALLOWED_STATUS.has(e.status)) {
      fail(`${f}: ${e.type}: invalid status "${e.status}"`);
    }

    // reasons required and must include at least 1 non-empty string
    if (!Array.isArray(e.reasons) || e.reasons.length === 0) {
      fail(`${f}: ${e?.type || "unknown"}: reasons required (non-empty array)`);
    } else {
      const ok = e.reasons.some(isNonEmptyString);
      if (!ok) {
        fail(`${f}: ${e.type}: reasons must contain at least 1 non-empty string`);
      }
    }

    // url optional, but if present must be non-empty string
    if ("url" in e && e.url != null && !isNonEmptyString(e.url)) {
      fail(`${f}: ${e.type}: url must be non-empty string when provided`);
    }

    // refs optional, but if present must be string[]
    if ("refs" in e && e.refs != null) {
      if (!Array.isArray(e.refs)) fail(`${f}: ${e.type}: refs must be array`);
      else {
        const bad = e.refs.find((x) => !isNonEmptyString(x));
        if (bad !== undefined) fail(`${f}: ${e.type}: refs must be non-empty strings`);
      }
    }
  }

  // links optional, but if present must be string[]
  if ("links" in j && j.links != null) {
    if (!Array.isArray(j.links)) {
      fail(`${f}: links must be array when provided`);
    } else {
      const bad = j.links.find((x) => !isNonEmptyString(x));
      if (bad !== undefined) fail(`${f}: links must be non-empty strings`);
    }
  }
}

if (process.exitCode) process.exit(1);
console.log(`ok: ${files.length} override files`);
