import { promises as fs } from "fs";
import path from "path";

const REQUIRED_EVIDENCE_TYPES = [
  "official_page",
  "dev_activity",
  "paper",
  "audit",
] as const;

type EvidenceType = (typeof REQUIRED_EVIDENCE_TYPES)[number];

export type V4SnapshotMeta = {
  version: string;
  updatedAt: string;
  modelsCount: number;
  fullCount: number;
  provisionalCount: number;
  notListedCount: number;
};

export type V4SnapshotManifest = {
  index: string;
  rankings: string;
  models: string;
  notListed: string;
  adoption: string;
  decisions: string;
  evidenceIndex: string;
  evidence: string;
  files: string[];
};

export type V4IndexData = V4SnapshotMeta & {
  manifest: V4SnapshotManifest;
};

export type V4ScoreBreakdown = {
  spec: number;
  evidence: number;
  ops: number;
};

export type V4RankingEntry = {
  model: string;
  vendor: string;
  layer: "full" | "provisional" | "rejected" | "not-listed";
  score: number;
  scores: V4ScoreBreakdown;
  updatedAt: string;
};

export type V4ModelMetadata = {
  name: string;
  vendor: string;
  released?: string;
  context?: number;
  type?: string;
  pricing?: {
    input?: number;
    output?: number;
    currency?: string;
  };
  [key: string]: unknown;
};

export type V4NotListedEntry =
  | string
  | {
      slug: string;
      reason?: string;
      source?: string;
    };

export type V4EvidenceReference = {
  label?: string;
  url?: string;
  note?: string;
};

export type V4EvidenceItem = {
  type: EvidenceType;
  status: string;
  reasons: string[];
  refs?: V4EvidenceReference[];
  score?: number | null;
  summary?: string;
  extracted?: unknown;
};

export type V4DecisionEntry = {
  modelKey: string;
  status?: string;
  reasons: string[];
  source?: string;
  normalized?: unknown;
  rawRef?: unknown;
};

export type V4ModelDetail = {
  id: string;
  name: string;
  vendor: string;
  layer: V4RankingEntry["layer"];
  status: "adopted" | "provisional" | "denied";
  score: number;
  scores: V4ScoreBreakdown;
  updatedAt: string;
  decision: {
    status?: string;
    reasons: string[];
    source?: string;
  };
  modelMetadata: V4ModelMetadata;
  evidenceItems: V4EvidenceItem[];
  rawInputs: Record<string, unknown>;
};

type SnapshotFileStatus = {
  ok: boolean;
  error?: string;
};

export type V4SnapshotDiagnostics = {
  files: {
    index: SnapshotFileStatus;
    rankings: SnapshotFileStatus;
    models: SnapshotFileStatus;
    notListed: SnapshotFileStatus;
    decisions: SnapshotFileStatus;
    evidenceIndex: SnapshotFileStatus;
  };
  errors: string[];
};

type EvidenceIndexEntry = {
  modelKey: string;
  path: string;
};

type EvidenceIndex = {
  meta?: { version?: string };
  models: EvidenceIndexEntry[];
};

type DecisionSnapshot = {
  meta?: { version?: string };
  decisions: V4DecisionEntry[];
};

const FALLBACK_MANIFEST: V4SnapshotManifest = {
  index: "index.json",
  rankings: "rankings.json",
  models: "models.json",
  notListed: "not-listed.json",
  adoption: "adoption.json",
  decisions: "decisions.json",
  evidenceIndex: "evidence/index.json",
  evidence: "evidence/",
  files: [],
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

async function readJsonFile<T>(filename: string): Promise<T> {
  const filePath = path.join(process.cwd(), "public", "data", "v4", filename);
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

async function readJsonFileSafe<T>(
  filename: string
): Promise<{ data: T | null; error?: string }> {
  try {
    const data = await readJsonFile<T>(filename);
    return { data };
  } catch (err) {
    const message =
      err && typeof err === "object" && "code" in err && err.code === "ENOENT"
        ? `${filename}: missing`
        : `${filename}: ${err instanceof Error ? err.message : String(err)}`;
    return { data: null, error: message };
  }
}

function normalizeManifest(raw: unknown): { manifest: V4SnapshotManifest | null; errors: string[] } {
  const errors: string[] = [];
  if (!isObject(raw)) {
    return { manifest: null, errors: ["index.json: manifest missing or invalid"] };
  }

  const files = Array.isArray(raw.files)
    ? raw.files.filter((entry) => typeof entry === "string")
    : [];

  const getString = (key: string): string => {
    const value = raw[key];
    if (typeof value !== "string" || !value.trim()) {
      errors.push(`index.json: manifest.${key} missing/invalid`);
      return "";
    }
    return value;
  };

  const manifest: V4SnapshotManifest = {
    index: getString("index"),
    rankings: getString("rankings"),
    models: getString("models"),
    notListed: getString("notListed"),
    adoption: getString("adoption"),
    decisions: getString("decisions"),
    evidenceIndex: getString("evidenceIndex"),
    evidence: getString("evidence"),
    files,
  };

  if (!files.length) {
    errors.push("index.json: manifest.files missing/invalid");
  }

  for (const key of [
    "index",
    "rankings",
    "models",
    "notListed",
    "decisions",
    "evidenceIndex",
  ] as const) {
    const file = manifest[key];
    if (file && !files.includes(file)) {
      errors.push(`index.json: manifest.files missing entry for ${file}`);
    }
  }

  return { manifest: errors.length ? (manifest.files.length ? manifest : null) : manifest, errors };
}

function normalizeIndex(raw: unknown): { data: V4IndexData | null; errors: string[] } {
  if (!isObject(raw)) {
    return { data: null, errors: ["index.json: expected object"] };
  }
  const errors: string[] = [];
  const version = typeof raw.version === "string" ? raw.version : "";
  if (version !== "v4") {
    errors.push(`index.json: version must be "v4" (got "${String(raw.version)}")`);
  }
  const updatedAt = typeof raw.updatedAt === "string" ? raw.updatedAt : "";
  if (!updatedAt || Number.isNaN(new Date(updatedAt).getTime())) {
    errors.push(`index.json: updatedAt missing/invalid (${String(raw.updatedAt)})`);
  }
  const manifestResult = normalizeManifest(raw.manifest);
  errors.push(...manifestResult.errors);

  const data: V4IndexData = {
    version: version || "v4",
    updatedAt,
    modelsCount: parseNumber(raw.modelsCount),
    fullCount: parseNumber(raw.fullCount),
    provisionalCount: parseNumber(raw.provisionalCount),
    notListedCount: parseNumber(raw.notListedCount),
    manifest: manifestResult.manifest ?? FALLBACK_MANIFEST,
  };

  return { data, errors };
}

function isManifestFile(manifest: V4SnapshotManifest, file: string) {
  return manifest.files.includes(file);
}

async function readManifestJsonFile<T>(
  manifest: V4SnapshotManifest,
  file: string,
  label: string
): Promise<{ data: T | null; error?: string }> {
  if (!file) {
    return { data: null, error: `${label}: missing manifest entry` };
  }
  if (!isManifestFile(manifest, file)) {
    return { data: null, error: `${label}: "${file}" not listed in manifest.files` };
  }
  return readJsonFileSafe<T>(file);
}

function normalizeNotListedEntry(
  entry: V4NotListedEntry
): { slug: string; reason?: string; source?: string } | null {
  if (typeof entry === "string") {
    return entry.trim() ? { slug: entry } : null;
  }
  if (!isObject(entry)) return null;
  const slug = typeof entry.slug === "string" ? entry.slug : null;
  if (!slug) return null;
  const reason = typeof entry.reason === "string" ? entry.reason : undefined;
  const source = typeof entry.source === "string" ? entry.source : undefined;
  return { slug, reason, source };
}

function parseEvidenceRefString(raw: string): V4EvidenceReference {
  const trimmed = raw.trim();
  if (!trimmed) return { label: raw };

  const lower = trimmed.toLowerCase();
  if (lower.startsWith("arxiv_id:")) {
    const id = trimmed.slice("arxiv_id:".length).trim();
    return {
      label: id ? `arXiv:${id}` : trimmed,
      url: id ? `https://arxiv.org/abs/${id}` : undefined,
    };
  }
  if (lower.startsWith("openrouter_model_page:")) {
    const url = trimmed.slice("openrouter_model_page:".length).trim();
    return { label: "OpenRouter model page", url: url || undefined };
  }
  if (lower.startsWith("github_repo:")) {
    const url = trimmed.slice("github_repo:".length).trim();
    return { label: "GitHub repository", url: url || undefined };
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return { label: trimmed, url: trimmed };
  }

  return { label: trimmed };
}

function normalizeEvidenceRefEntry(entry: unknown): V4EvidenceReference | null {
  if (typeof entry === "string") {
    return parseEvidenceRefString(entry);
  }
  if (!isObject(entry)) return null;
  const label =
    typeof entry.label === "string"
      ? entry.label
      : typeof entry.title === "string"
        ? entry.title
        : typeof entry.name === "string"
          ? entry.name
          : undefined;
  const url = typeof entry.url === "string" ? entry.url : undefined;
  const note =
    typeof entry.note === "string"
      ? entry.note
      : typeof entry.summary === "string"
        ? entry.summary
        : undefined;
  const value =
    typeof entry.value === "string"
      ? entry.value
      : typeof entry.ref === "string"
        ? entry.ref
        : typeof entry.id === "string"
          ? entry.id
          : undefined;

  if (url) {
    return { label, url, note };
  }
  if (value) {
    const parsed = parseEvidenceRefString(value);
    return {
      label: label ?? parsed.label,
      url: parsed.url,
      note,
    };
  }
  if (label && /^https?:\/\//i.test(label)) {
    return { label, url: label, note };
  }
  if (!label) return null;
  return { label, note };
}

function normalizeEvidenceRefs(raw: unknown): V4EvidenceReference[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const refs = raw
    .map((entry) => normalizeEvidenceRefEntry(entry))
    .filter(Boolean) as V4EvidenceReference[];
  return refs.length ? refs : undefined;
}

function normalizeEvidenceItems(
  raw: unknown,
  modelKey: string
): { items: V4EvidenceItem[]; errors: string[] } {
  const errors: string[] = [];
  const source =
    isObject(raw) && Array.isArray(raw.evidenceItems) ? raw.evidenceItems : null;
  if (!Array.isArray(source)) {
    return { items: [], errors: [`evidence/${modelKey}.json: missing evidenceItems array`] };
  }

  const items: V4EvidenceItem[] = [];
  const seenTypes = new Set<string>();

  source.forEach((item, index) => {
    if (!isObject(item)) {
      errors.push(`evidence/${modelKey}.json: evidenceItems[${index}] invalid`);
      return;
    }
    const type = typeof item.type === "string" ? item.type : "";
    if (!REQUIRED_EVIDENCE_TYPES.includes(type as EvidenceType)) {
      errors.push(`evidence/${modelKey}.json: evidenceItems[${index}].type invalid`);
      return;
    }
    seenTypes.add(type);

    const status =
      typeof item.status === "string"
        ? item.status
        : typeof item.state === "string"
          ? item.state
          : "";
    if (!status) {
      errors.push(`evidence/${modelKey}.json: ${type}.status missing/invalid`);
    }

    const reasons = Array.isArray(item.reasons)
      ? item.reasons.filter((entry) => typeof entry === "string" && entry.trim())
      : [];
    if (!reasons.length) {
      errors.push(`evidence/${modelKey}.json: ${type}.reasons missing/empty`);
    }

    const refs = normalizeEvidenceRefs(item.refs ?? item.references ?? item.sources);
    const summary = typeof item.summary === "string" ? item.summary : undefined;
    const score =
      typeof item.score === "number" && Number.isFinite(item.score)
        ? item.score
        : null;

    items.push({
      type: type as EvidenceType,
      status: status || "unknown",
      reasons,
      refs,
      summary,
      score,
      extracted: item.extracted,
    });
  });

  const missingTypes = REQUIRED_EVIDENCE_TYPES.filter((type) => !seenTypes.has(type));
  if (missingTypes.length || seenTypes.size !== REQUIRED_EVIDENCE_TYPES.length) {
    errors.push(
      `evidence/${modelKey}.json: evidence types must be ${REQUIRED_EVIDENCE_TYPES.join(
        ", "
      )}`
    );
  }

  const ordered = REQUIRED_EVIDENCE_TYPES.flatMap((type) =>
    items.filter((item) => item.type === type)
  );

  return { items: ordered, errors };
}

function parseEvidenceIndex(raw: unknown): { data: EvidenceIndex | null; errors: string[] } {
  if (!isObject(raw)) {
    return { data: null, errors: ["evidence/index.json: expected object"] };
  }
  const models = Array.isArray(raw.models) ? raw.models : null;
  if (!models) {
    return { data: null, errors: ["evidence/index.json: models missing/invalid"] };
  }
  const entries: EvidenceIndexEntry[] = [];
  const errors: string[] = [];
  models.forEach((entry, idx) => {
    if (!isObject(entry)) {
      errors.push(`evidence/index.json: models[${idx}] invalid`);
      return;
    }
    const modelKey = typeof entry.modelKey === "string" ? entry.modelKey : "";
    const path = typeof entry.path === "string" ? entry.path : "";
    if (!modelKey || !path) {
      errors.push(`evidence/index.json: models[${idx}] missing modelKey/path`);
      return;
    }
    entries.push({ modelKey, path });
  });

  return { data: { meta: raw.meta as EvidenceIndex["meta"], models: entries }, errors };
}

function parseDecisions(raw: unknown): { data: DecisionSnapshot | null; errors: string[] } {
  if (!isObject(raw)) {
    return { data: null, errors: ["decisions.json: expected object"] };
  }
  const decisionsRaw = Array.isArray(raw.decisions) ? raw.decisions : null;
  if (!decisionsRaw) {
    return { data: null, errors: ["decisions.json: decisions missing/invalid"] };
  }

  const decisions: V4DecisionEntry[] = [];
  const errors: string[] = [];
  decisionsRaw.forEach((entry, idx) => {
    if (!isObject(entry)) {
      errors.push(`decisions.json: decisions[${idx}] invalid`);
      return;
    }
    const modelKey = typeof entry.modelKey === "string" ? entry.modelKey : "";
    if (!modelKey) {
      errors.push(`decisions.json: decisions[${idx}].modelKey missing`);
      return;
    }
    const reasons = Array.isArray(entry.reasons)
      ? entry.reasons.filter((reason) => typeof reason === "string" && reason.trim())
      : [];
    if (!reasons.length) {
      errors.push(`decisions.json: ${modelKey}.reasons missing/empty`);
    }

    decisions.push({
      modelKey,
      status: typeof entry.status === "string" ? entry.status : undefined,
      reasons,
      source: typeof entry.source === "string" ? entry.source : undefined,
      normalized: entry.normalized,
      rawRef: entry.rawRef,
    });
  });

  return { data: { meta: raw.meta as DecisionSnapshot["meta"], decisions }, errors };
}

function mapLayerToStatus(layer: V4RankingEntry["layer"]): V4ModelDetail["status"] {
  if (layer === "full") return "adopted";
  if (layer === "provisional") return "provisional";
  return "denied";
}

function validateScoreBreakdown(
  scores: unknown,
  label: string
): { data: V4ScoreBreakdown | null; errors: string[] } {
  const errors: string[] = [];
  if (!isObject(scores)) {
    return { data: null, errors: [`${label}: scores missing/invalid`] };
  }

  const allowed = ["spec", "evidence", "ops"] as const;
  const keys = Object.keys(scores);
  const unknownKeys = keys.filter((key) => !allowed.includes(key as (typeof allowed)[number]));
  if (unknownKeys.length) {
    errors.push(`${label}: scores contains unknown keys (${unknownKeys.join(", ")})`);
  }

  const breakdown: V4ScoreBreakdown = {
    spec: parseNumber(scores.spec, NaN),
    evidence: parseNumber(scores.evidence, NaN),
    ops: parseNumber(scores.ops, NaN),
  };

  for (const key of allowed) {
    if (!Number.isFinite(breakdown[key])) {
      errors.push(`${label}: scores.${key} missing/invalid`);
    }
  }

  return { data: breakdown, errors };
}

function validateRankings(
  rankings: unknown,
  models: Record<string, V4ModelMetadata>
): { data: V4RankingEntry[]; errors: string[] } {
  const errors: string[] = [];
  if (!Array.isArray(rankings)) {
    return { data: [], errors: ["rankings.json: expected array"] };
  }

  const entries: V4RankingEntry[] = [];
  const seen = new Set<string>();

  rankings.forEach((entry, idx) => {
    if (!isObject(entry)) {
      errors.push(`rankings.json: entry[${idx}] invalid`);
      return;
    }
    const model = typeof entry.model === "string" ? entry.model : "";
    if (!model) {
      errors.push(`rankings.json: entry[${idx}].model missing`);
      return;
    }
    if (seen.has(model)) {
      errors.push(`rankings.json: duplicate model slug "${model}"`);
      return;
    }
    seen.add(model);

    const vendor = typeof entry.vendor === "string" ? entry.vendor : "";
    if (!vendor) {
      errors.push(`rankings.json: entry[${idx}].vendor missing/invalid`);
    }

    const layer = typeof entry.layer === "string" ? entry.layer : "";
    if (![
      "full",
      "provisional",
      "rejected",
      "not-listed",
    ].includes(layer)) {
      errors.push(`rankings.json: entry[${idx}].layer invalid`);
    }

    const score = typeof entry.score === "number" ? entry.score : NaN;
    if (!Number.isFinite(score)) {
      errors.push(`rankings.json: entry[${idx}].score missing/invalid`);
    }

    const updatedAt = typeof entry.updatedAt === "string" ? entry.updatedAt : "";
    if (!updatedAt) {
      errors.push(`rankings.json: entry[${idx}].updatedAt missing/invalid`);
    }

    if (!models[model]) {
      errors.push(`models.json: missing entry for "${model}"`);
    }

    const scoreValidation = validateScoreBreakdown(entry.scores, `rankings.json: ${model}`);
    errors.push(...scoreValidation.errors);

    if (scoreValidation.data) {
      entries.push({
        model,
        vendor: vendor || model,
        layer: layer as V4RankingEntry["layer"],
        score,
        scores: scoreValidation.data,
        updatedAt,
      });
    }
  });

  return { data: entries, errors };
}

function buildDecisionMap(decisions: DecisionSnapshot | null) {
  if (!decisions) return new Map<string, V4DecisionEntry>();
  return new Map(decisions.decisions.map((entry) => [entry.modelKey, entry]));
}

async function loadEvidenceFiles(
  manifest: V4SnapshotManifest,
  evidenceIndex: EvidenceIndex | null
): Promise<{
  itemsByModel: Map<string, V4EvidenceItem[]>;
  statusByModel: Record<string, "ok" | "issue">;
  errors: string[];
}> {
  const errors: string[] = [];
  const itemsByModel = new Map<string, V4EvidenceItem[]>();
  const statusByModel: Record<string, "ok" | "issue"> = {};

  if (!evidenceIndex) {
    return { itemsByModel, statusByModel, errors };
  }

  for (const entry of evidenceIndex.models) {
    if (!isManifestFile(manifest, entry.path)) {
      errors.push(`evidence/index.json: ${entry.path} not listed in manifest.files`);
      continue;
    }
    const result = await readJsonFileSafe<unknown>(entry.path);
    if (result.error) {
      errors.push(result.error);
      continue;
    }
    const normalized = normalizeEvidenceItems(result.data, entry.modelKey);
    errors.push(...normalized.errors);
    itemsByModel.set(entry.modelKey, normalized.items);
    const hasIssue = normalized.items.some((item) => item.status.toLowerCase() !== "ok");
    statusByModel[entry.modelKey] = hasIssue ? "issue" : "ok";
  }

  return { itemsByModel, statusByModel, errors };
}

async function loadSnapshotCore(): Promise<{
  index: V4IndexData | null;
  manifest: V4SnapshotManifest;
  rankings: V4RankingEntry[] | null;
  models: Record<string, V4ModelMetadata> | null;
  notListed: V4NotListedEntry[] | null;
  decisions: DecisionSnapshot | null;
  evidenceIndex: EvidenceIndex | null;
  errors: string[];
  fileErrors: {
    index?: string;
    rankings?: string;
    models?: string;
    notListed?: string;
    decisions?: string;
    evidenceIndex?: string;
  };
}> {
  const errors: string[] = [];
  const fileErrors: Record<string, string | undefined> = {};

  const indexResult = await readJsonFileSafe<unknown>("index.json");
  if (indexResult.error) {
    errors.push(indexResult.error);
  }
  const normalizedIndex = indexResult.data ? normalizeIndex(indexResult.data) : null;
  if (normalizedIndex?.errors?.length) {
    errors.push(...normalizedIndex.errors);
  }

  const index = normalizedIndex?.data ?? null;
  const manifest = index?.manifest ?? FALLBACK_MANIFEST;

  const rankingsResult = await readManifestJsonFile<unknown>(
    manifest,
    manifest.rankings,
    "rankings.json"
  );
  const modelsResult = await readManifestJsonFile<unknown>(
    manifest,
    manifest.models,
    "models.json"
  );
  const notListedResult = await readManifestJsonFile<unknown>(
    manifest,
    manifest.notListed,
    "not-listed.json"
  );
  const decisionsResult = await readManifestJsonFile<unknown>(
    manifest,
    manifest.decisions,
    "decisions.json"
  );
  const evidenceIndexResult = await readManifestJsonFile<unknown>(
    manifest,
    manifest.evidenceIndex,
    "evidence/index.json"
  );

  const rankingErrors = rankingsResult.error ? [rankingsResult.error] : [];
  const modelErrors = modelsResult.error ? [modelsResult.error] : [];
  const notListedErrors = notListedResult.error ? [notListedResult.error] : [];
  const decisionsErrors = decisionsResult.error ? [decisionsResult.error] : [];
  const evidenceIndexErrors = evidenceIndexResult.error ? [evidenceIndexResult.error] : [];

  if (rankingsResult.error) fileErrors.rankings = rankingsResult.error;
  if (modelsResult.error) fileErrors.models = modelsResult.error;
  if (notListedResult.error) fileErrors.notListed = notListedResult.error;
  if (decisionsResult.error) fileErrors.decisions = decisionsResult.error;
  if (evidenceIndexResult.error) fileErrors.evidenceIndex = evidenceIndexResult.error;
  if (indexResult.error) fileErrors.index = indexResult.error;

  errors.push(
    ...rankingErrors,
    ...modelErrors,
    ...notListedErrors,
    ...decisionsErrors,
    ...evidenceIndexErrors
  );

  const models =
    modelsResult.data && isObject(modelsResult.data)
      ? (modelsResult.data as Record<string, V4ModelMetadata>)
      : null;

  const rankingsValidation = validateRankings(rankingsResult.data, models ?? {});
  errors.push(...rankingsValidation.errors);

  const decisionsParsed = decisionsResult.data ? parseDecisions(decisionsResult.data) : null;
  if (decisionsParsed?.errors?.length) {
    errors.push(...decisionsParsed.errors);
  }

  const evidenceIndexParsed = evidenceIndexResult.data
    ? parseEvidenceIndex(evidenceIndexResult.data)
    : null;
  if (evidenceIndexParsed?.errors?.length) {
    errors.push(...evidenceIndexParsed.errors);
  }

  const notListed = Array.isArray(notListedResult.data)
    ? (notListedResult.data as V4NotListedEntry[])
    : null;

  return {
    index,
    manifest,
    rankings: rankingsValidation.data,
    models,
    notListed,
    decisions: decisionsParsed?.data ?? null,
    evidenceIndex: evidenceIndexParsed?.data ?? null,
    errors,
    fileErrors,
  };
}

export async function loadV4Leaderboard(): Promise<{
  index: V4IndexData | null;
  rankings: V4RankingEntry[];
  models: Record<string, V4ModelMetadata>;
}> {
  const snapshot = await loadV4SnapshotWithDiagnostics();

  if (!snapshot.index || !snapshot.rankings || !snapshot.models) {
    return { index: snapshot.index, rankings: [], models: {} };
  }

  return {
    index: snapshot.index,
    rankings: snapshot.rankings,
    models: snapshot.models,
  };
}

export async function loadV4ModelDetail(modelId: string): Promise<{
  detail: V4ModelDetail | null;
  isNotListed: boolean;
  notListedEntry: { slug: string; reason?: string; source?: string } | null;
  index: V4IndexData | null;
  diagnostics: V4SnapshotDiagnostics;
}> {
  const snapshot = await loadSnapshotCore();
  const diagnostics: V4SnapshotDiagnostics = {
    files: {
      index: { ok: !snapshot.fileErrors.index, error: snapshot.fileErrors.index },
      rankings: { ok: !snapshot.fileErrors.rankings, error: snapshot.fileErrors.rankings },
      models: { ok: !snapshot.fileErrors.models, error: snapshot.fileErrors.models },
      notListed: { ok: !snapshot.fileErrors.notListed, error: snapshot.fileErrors.notListed },
      decisions: { ok: !snapshot.fileErrors.decisions, error: snapshot.fileErrors.decisions },
      evidenceIndex: {
        ok: !snapshot.fileErrors.evidenceIndex,
        error: snapshot.fileErrors.evidenceIndex,
      },
    },
    errors: [...snapshot.errors],
  };

  const rankings = snapshot.rankings ?? [];
  const models = snapshot.models ?? {};
  const notListedEntries = snapshot.notListed ?? [];

  const notListedEntry = notListedEntries
    .map((entry) => normalizeNotListedEntry(entry))
    .find((entry) => entry?.slug === modelId);

  const ranking = rankings.find((entry) => entry.model === modelId);
  if (!ranking) {
    return {
      detail: null,
      isNotListed: Boolean(notListedEntry),
      notListedEntry: notListedEntry ?? null,
      index: snapshot.index,
      diagnostics,
    };
  }

  const meta = models[ranking.model];
  if (!meta) {
    diagnostics.errors.push(`models.json: missing entry for "${ranking.model}"`);
    return {
      detail: null,
      isNotListed: false,
      notListedEntry: null,
      index: snapshot.index,
      diagnostics,
    };
  }

  const decisionMap = buildDecisionMap(snapshot.decisions);
  const decision = decisionMap.get(ranking.model);
  if (!decision) {
    diagnostics.errors.push(`decisions.json: missing decision for "${ranking.model}"`);
  }
  if (decision && !decision.reasons.length) {
    diagnostics.errors.push(`decisions.json: ${ranking.model}.reasons missing/empty`);
  }

  const evidenceIndex = snapshot.evidenceIndex;
  const evidenceEntry = evidenceIndex?.models.find((entry) => entry.modelKey === ranking.model);
  if (!evidenceEntry) {
    diagnostics.errors.push(`evidence/index.json: missing entry for "${ranking.model}"`);
  }

  let evidenceItems: V4EvidenceItem[] = [];
  if (evidenceEntry) {
    const evidenceResult = await readManifestJsonFile<unknown>(
      snapshot.manifest,
      evidenceEntry.path,
      evidenceEntry.path
    );
    if (evidenceResult.error) {
      diagnostics.errors.push(evidenceResult.error);
    } else {
      const normalizedEvidence = normalizeEvidenceItems(evidenceResult.data, ranking.model);
      evidenceItems = normalizedEvidence.items;
      diagnostics.errors.push(...normalizedEvidence.errors);
    }
  }

  const detail: V4ModelDetail = {
    id: ranking.model,
    name: meta.name,
    vendor: meta.vendor,
    layer: ranking.layer,
    status: mapLayerToStatus(ranking.layer),
    score: ranking.score,
    scores: ranking.scores,
    updatedAt: ranking.updatedAt,
    decision: {
      status: decision?.status,
      reasons: decision?.reasons ?? [],
      source: decision?.source,
    },
    modelMetadata: meta,
    evidenceItems,
    rawInputs: {
      index: snapshot.index,
      ranking,
      model: meta,
      decision,
      evidence: evidenceItems,
    },
  };

  return {
    detail,
    isNotListed: false,
    notListedEntry: null,
    index: snapshot.index,
    diagnostics,
  };
}

export async function loadV4SnapshotWithDiagnostics(): Promise<{
  index: V4IndexData | null;
  rankings: V4RankingEntry[] | null;
  models: Record<string, V4ModelMetadata> | null;
  notListed: V4NotListedEntry[] | null;
  evidenceStatusByModel: Record<string, "ok" | "issue">;
  diagnostics: V4SnapshotDiagnostics;
}> {
  const snapshot = await loadSnapshotCore();
  const diagnostics: V4SnapshotDiagnostics = {
    files: {
      index: { ok: !snapshot.fileErrors.index, error: snapshot.fileErrors.index },
      rankings: { ok: !snapshot.fileErrors.rankings, error: snapshot.fileErrors.rankings },
      models: { ok: !snapshot.fileErrors.models, error: snapshot.fileErrors.models },
      notListed: { ok: !snapshot.fileErrors.notListed, error: snapshot.fileErrors.notListed },
      decisions: { ok: !snapshot.fileErrors.decisions, error: snapshot.fileErrors.decisions },
      evidenceIndex: {
        ok: !snapshot.fileErrors.evidenceIndex,
        error: snapshot.fileErrors.evidenceIndex,
      },
    },
    errors: [...snapshot.errors],
  };

  if (!snapshot.index) {
    return {
      index: null,
      rankings: null,
      models: null,
      notListed: null,
      evidenceStatusByModel: {},
      diagnostics,
    };
  }

  const decisionMap = buildDecisionMap(snapshot.decisions);
  snapshot.rankings?.forEach((entry) => {
    const decision = decisionMap.get(entry.model);
    if (!decision) {
      diagnostics.errors.push(`decisions.json: missing decision for "${entry.model}"`);
      return;
    }
    if (!decision.reasons.length) {
      diagnostics.errors.push(`decisions.json: ${entry.model}.reasons missing/empty`);
    }
  });

  const evidenceLoad = await loadEvidenceFiles(snapshot.manifest, snapshot.evidenceIndex);
  diagnostics.errors.push(...evidenceLoad.errors);

  return {
    index: snapshot.index,
    rankings: snapshot.rankings,
    models: snapshot.models,
    notListed: snapshot.notListed,
    evidenceStatusByModel: evidenceLoad.statusByModel,
    diagnostics,
  };
}

export const V4_REQUIRED_EVIDENCE_TYPES = REQUIRED_EVIDENCE_TYPES;
