import { promises as fs } from "fs";
import path from "path";

const EVIDENCE_KEYS = ["official_page", "dev_activity", "paper", "audit"];

function isObject(value) {
  return typeof value === "object" && value !== null;
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function toEvidenceBlocks(evidenceItems) {
  const grouped = Object.fromEntries(EVIDENCE_KEYS.map((key) => [key, null]));
  if (Array.isArray(evidenceItems)) {
    for (const item of evidenceItems) {
      const key = typeof item?.type === "string" ? item.type : "";
      if (!EVIDENCE_KEYS.includes(key)) continue;
      grouped[key] = {
        status: typeof item.status === "string" ? item.status : "missing",
        reasons: Array.isArray(item.reasons) ? item.reasons.map(String) : [],
        refs: Array.isArray(item.refs) ? item.refs.filter((ref) => typeof ref === "string") : [],
        extracted: isObject(item.extracted) ? item.extracted : null,
      };
    }
  }

  return Object.fromEntries(
    EVIDENCE_KEYS.map((key) => [
      key,
      grouped[key] ?? { status: "missing", reasons: ["missing"], refs: [], extracted: null },
    ])
  );
}

function toBreakdownItems(scoreItems) {
  if (!isObject(scoreItems)) return [];

  return Object.entries(scoreItems)
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([itemKey, item]) => {
      const usedEvidence = Array.isArray(item?.usedEvidence) ? item.usedEvidence : [];
      const evidenceUrls = usedEvidence
        .map((entry) => (typeof entry?.url === "string" ? entry.url : typeof entry?.link === "string" ? entry.link : ""))
        .filter(Boolean);

      return {
        id: itemKey,
        key: itemKey,
        label: typeof item?.label === "string" ? item.label : itemKey,
        score: typeof item?.score === "number" ? item.score : null,
        status: typeof item?.status === "string" ? item.status : "missing",
        specMissingEvidence: Boolean(item?.__specMissingEvidenceLink),
        missingEvidenceRule: false,
        evidenceUrls,
      };
    });
}

function collectLinks(evidenceBlocks, breakdownItems) {
  const links = [];
  for (const key of EVIDENCE_KEYS) {
    const block = evidenceBlocks[key];
    if (!block) continue;
    if (Array.isArray(block.refs)) links.push(...block.refs);
    if (typeof block?.extracted?.url === "string") links.push(block.extracted.url);
  }
  for (const item of breakdownItems) {
    if (Array.isArray(item.evidenceUrls)) links.push(...item.evidenceUrls);
  }
  return Array.from(new Set(links.filter((value) => typeof value === "string" && value))).sort((a, b) =>
    a.localeCompare(b)
  );
}

function readEvidenceIndexRows(indexJson) {
  if (Array.isArray(indexJson?.models)) return indexJson.models;
  if (isObject(indexJson?.models)) return Object.values(indexJson.models);
  return [];
}

export async function loadModelDetailForExport(modelKey) {
  const dataRoot = path.join(process.cwd(), "public", "data", "v4");
  const [rankingsJson, modelsJson, evidenceIndexJson] = await Promise.all([
    readJson(path.join(dataRoot, "rankings.json")),
    readJson(path.join(dataRoot, "models.json")),
    readJson(path.join(dataRoot, "evidence", "index.json")),
  ]);

  const rankings = Array.isArray(rankingsJson)
    ? rankingsJson
    : Array.isArray(rankingsJson?.rankings)
      ? rankingsJson.rankings
      : [];

  const rankingEntry = rankings.find((entry) => entry?.model === modelKey);
  if (!rankingEntry) {
    throw new Error(`ranking entry not found for modelKey: ${modelKey}`);
  }

  const modelMeta = isObject(modelsJson?.[modelKey])
    ? modelsJson[modelKey]
    : Array.isArray(modelsJson)
      ? modelsJson.find((entry) => entry?.modelKey === modelKey || entry?.key === modelKey || entry?.id === modelKey)
      : null;

  const evidenceIndexRow = readEvidenceIndexRows(evidenceIndexJson).find(
    (entry) => entry?.modelKey === modelKey
  );
  const evidencePath = typeof evidenceIndexRow?.path === "string" ? evidenceIndexRow.path : null;
  const evidenceJson = evidencePath
    ? await readJson(path.join(dataRoot, evidencePath))
    : { evidenceItems: [] };

  const evidenceBlocks = toEvidenceBlocks(evidenceJson?.evidenceItems);
  const breakdownItems = toBreakdownItems(rankingEntry?.scores?.items);

  return {
    modelKey,
    header: {
      provider: rankingEntry?.vendor ?? modelMeta?.vendor ?? "",
      title: modelMeta?.name ?? modelKey,
      overallScore: rankingEntry?.scores?.overall ?? rankingEntry?.score ?? "",
      categoryScores: rankingEntry?.scores?.categories ?? {},
    },
    absolute: {
      displayName: modelMeta?.name ?? modelKey,
    },
    evidenceCards: {
      blocks: evidenceBlocks,
    },
    rawInputsBySource: {
      openrouter: {},
      huggingface: {},
      github: {},
      arxiv: {},
      ops: {},
      manual: {},
    },
    breakdown: {
      items: breakdownItems,
    },
    links: collectLinks(evidenceBlocks, breakdownItems),
    references: [],
  };
}
