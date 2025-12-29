import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

const BOOTSTRAP_DIR = path.join(process.cwd(), "data", "bootstrap");
const OUTPUT_DIR = path.join(process.cwd(), "output");
const SEED_FILE = path.join(BOOTSTRAP_DIR, "models_seed.json");
const ALLOW_DENY_FILE = path.join(BOOTSTRAP_DIR, "model_allow_deny.json");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "decisions.json");

const REQUIRED_FIELDS = ["name", "slug", "vendor"];

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function normalizeSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function normalizeName(value) {
  return String(value ?? "").trim();
}

function normalizeVendor(value) {
  return String(value ?? "").trim().toLowerCase();
}

function buildReasonForMissing(missing) {
  if (missing.length === 1) {
    return `missing required field: ${missing[0]}`;
  }
  return `missing required fields: ${missing.join(", ")}`;
}

function loadAllowDeny() {
  const data = readJson(ALLOW_DENY_FILE);
  const allow = new Map();
  const deny = new Map();

  (data.allow ?? []).forEach((entry) => {
    const slug = normalizeSlug(entry?.slug);
    if (!slug) return;
    allow.set(slug, String(entry?.reason ?? "allow"));
  });

  (data.deny ?? []).forEach((entry) => {
    const slug = normalizeSlug(entry?.slug);
    if (!slug) return;
    deny.set(slug, String(entry?.reason ?? "deny"));
  });

  return { allow, deny };
}

function decideForModel(model, allow, deny, seenSlugs) {
  const normalized = {
    name: normalizeName(model?.name),
    slug: normalizeSlug(model?.slug),
    vendor: normalizeVendor(model?.vendor),
  };

  const missing = REQUIRED_FIELDS.filter((field) => !normalized[field]);

  if (!normalized.slug) {
    return {
      slug: "",
      name: normalized.name || "(missing name)",
      vendor: normalized.vendor,
      status: "provisional",
      reason: "missing required field: slug",
      source: "seed",
    };
  }

  if (seenSlugs.has(normalized.slug)) {
    return {
      ...normalized,
      status: "provisional",
      reason: "duplicate slug in seed",
      source: "seed",
    };
  }

  seenSlugs.add(normalized.slug);

  if (deny.has(normalized.slug)) {
    return {
      ...normalized,
      status: "denied",
      reason: deny.get(normalized.slug),
      source: "deny",
    };
  }

  if (missing.length > 0) {
    return {
      ...normalized,
      status: "provisional",
      reason: buildReasonForMissing(missing),
      source: "seed",
    };
  }

  if (allow.has(normalized.slug)) {
    return {
      ...normalized,
      status: "adopted",
      reason: allow.get(normalized.slug),
      source: "allow",
    };
  }

  return {
    ...normalized,
    status: "not-listed",
    reason: "not in allowlist",
    source: "seed",
  };
}

export function generateDecisions() {
  const seed = readJson(SEED_FILE);
  const { allow, deny } = loadAllowDeny();
  const seenSlugs = new Set();

  const decisions = (seed ?? []).map((model) =>
    decideForModel(model, allow, deny, seenSlugs)
  );

  decisions.sort((a, b) => a.slug.localeCompare(b.slug));

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(decisions, null, 2)}\n`, "utf8");

  return decisions;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  generateDecisions();
  console.log(`Wrote ${OUTPUT_FILE}`);
}
