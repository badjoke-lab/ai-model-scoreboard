import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DIR = path.join(ROOT, "overrides", "v4", "models");
const MAPS_DIR = path.join(ROOT, "overrides", "v4", "maps");
const ALLOWED_SOURCES_PATH = path.join(MAPS_DIR, "allowed-official-sources.json");
const MODEL_MAPS_PATH = path.join(MAPS_DIR, "model-maps.json");
const PROVIDER_MAPS_PATH = path.join(MAPS_DIR, "provider-maps.json");

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

function matchesAllowedDomain(hostname, allowedDomain) {
  return hostname === allowedDomain || hostname.endsWith(`.${allowedDomain}`);
}

function normalizeHostname(hostname) {
  return hostname.toLowerCase().replace(/\.+$/, "");
}

function validateOfficialPageUrl(rawUrl, location, allowedSources) {
  if (!isNonEmptyString(rawUrl)) {
    fail(`${location}: official_page URL is required`);
    return;
  }

  if (!/^https?:\/\//i.test(rawUrl)) {
    fail(`${location}: official_page URL must start with http:// or https://`);
    return;
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    fail(`${location}: official_page URL is invalid`);
    return;
  }

  const hostname = normalizeHostname(parsed.hostname);
  if (!hostname) {
    fail(`${location}: official_page URL hostname is empty`);
    return;
  }

  if (allowedSources.blockedDomains.some((d) => hostname === d)) {
    fail(`${location}: official_page URL uses blocked domain "${hostname}"`);
    return;
  }

  if (hostname === "huggingface.co") {
    const segments = parsed.pathname.split("/").filter(Boolean);
    const namespace = segments[0]?.toLowerCase();
    if (!namespace || !allowedSources.allowedHfNamespaces.includes(namespace)) {
      fail(
        `${location}: official_page URL must use an allowed Hugging Face namespace (got "${namespace || "(none)"}")`,
      );
    }
    return;
  }

  const allowed = allowedSources.allowedDomains.some((d) =>
    matchesAllowedDomain(hostname, d),
  );
  if (!allowed) {
    fail(`${location}: official_page URL domain "${hostname}" is not allowlisted`);
  }
}

function validateAllowedSourcesFile() {
  let j;
  try {
    j = readJson(ALLOWED_SOURCES_PATH);
  } catch {
    fail(`allowed-official-sources.json: invalid or missing JSON (${ALLOWED_SOURCES_PATH})`);
    return null;
  }

  const normalizeStringArray = (arr, key) => {
    if (!Array.isArray(arr)) {
      fail(`allowed-official-sources.json: ${key} must be an array`);
      return [];
    }
    const out = [];
    for (const x of arr) {
      if (!isNonEmptyString(x)) {
        fail(`allowed-official-sources.json: ${key} must contain non-empty strings`);
        continue;
      }
      out.push(x.toLowerCase());
    }
    return out;
  };

  return {
    allowedDomains: normalizeStringArray(j.allowedDomains, "allowedDomains"),
    allowedHfNamespaces: normalizeStringArray(j.allowedHfNamespaces, "allowedHfNamespaces"),
    blockedDomains: normalizeStringArray(j.blockedDomains, "blockedDomains"),
  };
}

if (!fs.existsSync(DIR)) {
  console.log("ok: overrides dir not found");
  process.exit(0);
}

const allowedSources = validateAllowedSourcesFile();

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

    if (e.type === "official_page" && allowedSources) {
      const sourceUrl = isNonEmptyString(e.url)
        ? e.url
        : Array.isArray(e.refs) && isNonEmptyString(e.refs[0])
          ? e.refs[0]
          : null;
      validateOfficialPageUrl(sourceUrl, `${f}: official_page`, allowedSources);
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

try {
  const modelMaps = readJson(MODEL_MAPS_PATH);
  if (!modelMaps?.models || typeof modelMaps.models !== "object") {
    fail("model-maps.json: models must be an object");
  } else if (allowedSources) {
    for (const [modelKey, modelData] of Object.entries(modelMaps.models)) {
      if (!modelData || typeof modelData !== "object") continue;
      if ("official_page" in modelData) {
        validateOfficialPageUrl(
          modelData.official_page,
          `model-maps.json: ${modelKey}.official_page`,
          allowedSources,
        );
      }
    }
  }
} catch {
  fail("model-maps.json: invalid or missing JSON");
}

try {
  const providerMaps = readJson(PROVIDER_MAPS_PATH);
  if (!providerMaps?.providers || typeof providerMaps.providers !== "object") {
    fail("provider-maps.json: providers must be an object");
  } else {
    for (const [providerKey, providerData] of Object.entries(providerMaps.providers)) {
      if (providerData && typeof providerData === "object" && "official_page" in providerData) {
        fail(`provider-maps.json: ${providerKey}.official_page is forbidden`);
      }
    }
  }
} catch {
  fail("provider-maps.json: invalid or missing JSON");
}

if (process.exitCode) process.exit(1);
console.log(`ok: ${files.length} override files`);
