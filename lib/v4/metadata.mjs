function normalizeSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function normalizeName(value, fallback) {
  const normalized = String(value ?? "").trim();
  if (normalized) return normalized;
  return fallback;
}

function normalizeVendor(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized || "unknown";
}

function mapDecisionStatus(status) {
  switch (status) {
    case "adopted":
      return "full";
    case "provisional":
      return "provisional";
    case "not-listed":
      return "not-listed";
    case "denied":
      return "deny";
    default:
      return "provisional";
  }
}

export function normalizeDecision(decision) {
  const slug = normalizeSlug(decision?.slug);
  const name = normalizeName(decision?.name, slug || "unknown-model");
  const vendor = normalizeVendor(decision?.vendor);
  const layer = mapDecisionStatus(decision?.status);
  const reason = String(decision?.reason ?? "").trim();
  const source = String(decision?.source ?? "seed").trim();

  return {
    slug,
    name,
    vendor,
    layer,
    reason: reason || "no decision reason provided",
    source,
  };
}
