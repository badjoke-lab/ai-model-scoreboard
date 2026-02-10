/**
 * renderModelDetailText.mjs
 * Input: model-detail JSON (from /api/v4/model/:key)
 * Output: stable text for snapshot tests
 */
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

function normDate(x) {
  if (!x) return "";
  const s = String(x);
  if (
    /\d{4}-\d{2}-\d{2}T/.test(s) ||
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/.test(s)
  ) {
    return "<DATE>";
  }
  return s;
}

function uniqSort(arr) {
  return Array.from(new Set((arr || []).filter(Boolean).map(String))).sort();
}

function normStatus(s) {
  const x = String(s || "").trim();
  return ALLOWED_STATUS.has(x) ? x : "invalid";
}

function block(title, lines) {
  return [`## ${title}`, ...lines.filter(Boolean), ""].join("\n");
}

export function renderModelDetailText(j) {
  const header = j?.header || {};
  const abs = j?.absolute || {};
  const evidenceCards = j?.evidenceCards?.blocks || {};
  const raw = j?.rawInputsBySource || {};
  const breakdown = j?.breakdown?.items || [];
  const links = uniqSort(j?.links || []);

  const identity = [
    `provider: ${header.provider || ""}`,
    `displayName: ${abs.displayName || header.title || ""}`,
    `modelKey: ${j?.modelKey || ""}`,
    `updatedAt: ${normDate(header.updatedAt || j?.evidenceCards?.updatedAt || "")}`,
  ];

  const scores = [
    `overall: ${header.overallScore ?? ""}`,
    `categories: ${JSON.stringify(header.categoryScores || {})}`,
    `adoption: ${header.status || ""}`,
  ];

  const evKeys = ["official_page", "dev_activity", "paper", "audit"];
  const evLines = [];
  for (const k of evKeys) {
    const e = evidenceCards?.[k] || {};
    const status = normStatus(e.status);
    const reasons = e.reasons && e.reasons.length ? e.reasons.map(String) : ["missing"];
    const refs = uniqSort([...(e.refs || []), e.extracted?.url].filter(Boolean));
    evLines.push(`- ${k}: ${status}`);
    evLines.push(`  reasons: ${uniqSort(reasons).join(", ")}`);
    evLines.push(`  refs: ${refs.length ? refs.join(" | ") : "(none)"}`);
  }

  const srcKeys = ["openrouter", "huggingface", "github", "arxiv", "ops"];
  const rawLines = [];
  for (const s of srcKeys) {
    const obj = raw?.[s] || {};
    const keys = Object.keys(obj).sort();
    rawLines.push(`- ${s}: keys=${keys.length}`);
    for (const k of keys) {
      const v = obj[k];
      rawLines.push(`  ${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`);
    }
    if (!keys.length) rawLines.push(`  (empty)`);
  }

  const bdLines = [];
  for (const it of breakdown.slice(0, 50)) {
    bdLines.push(
      `- ${it.id || it.key}: ${it.label || ""} | status=${it.status || ""} | score=${it.score ?? ""}`
    );
    if (it.why) bdLines.push(`  why: ${String(it.why).slice(0, 180)}`);
    const eus = uniqSort(it.evidenceUrls || []);
    if (eus.length) bdLines.push(`  evidenceUrls: ${eus.join(" | ")}`);
    if (it.specMissingEvidence) bdLines.push(`  flag: specMissingEvidence`);
    if (it.missingEvidenceRule) bdLines.push(`  flag: missingEvidenceRule`);
  }

  const linkLines = links.length ? links.map((u) => `- ${u}`) : ["(none)"];

  return [
    block("Identity", identity),
    block("Scores", scores),
    block("Evidence", evLines),
    block("RawInputsBySource", rawLines),
    block("Breakdown (first 50)", bdLines),
    block("Links", linkLines),
  ].join("\n");
}
