export type V4SnapshotMeta = {
  version: string;
  updatedAt: string;
  modelsCount: number;
  fullCount: number;
  provisionalCount: number;
  notListedCount: number;
};

export type V4IndexData = {
  meta: V4SnapshotMeta;
};

export const V4_SCORE_ITEMS = [
  { key: "spec", label: "Spec" },
  { key: "evidence", label: "Evidence" },
  { key: "ops", label: "Ops" },
] as const;

export type V4ScoreKey = (typeof V4_SCORE_ITEMS)[number]["key"];
export type V4ScoreBreakdown = Record<V4ScoreKey, number | null>;

export type V4RankingEntry = {
  model: string;
  vendor: string;
  layer: string;
  score: number | null;
  scores: V4ScoreBreakdown;
  updatedAt: string | null;
};

export type V4ModelMetadata = {
  name: string;
  vendor: string;
};

export type V4NotListedEntry = {
  id: string;
  reason: string | null;
};

export type V4SnapshotDiagnostics = {
  files: {
    index: { ok: boolean; error?: string };
    models: { ok: boolean; error?: string };
    rankings: { ok: boolean; error?: string };
    notListed: { ok: boolean; error?: string };
  };
  errors: string[];
};

const FALLBACK_INDEX: V4IndexData = {
  meta: {
    version: "v4",
    updatedAt: "",
    modelsCount: 0,
    fullCount: 0,
    provisionalCount: 0,
    notListedCount: 0,
  },
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

async function fetchSnapshotJson(file: string): Promise<{ data: unknown | null; error?: string }> {
  const url = `/data/v4/${file}`;
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      return { data: null, error: `${file}: request failed (${response.status})` };
    }
    const text = await response.text();
    try {
      return { data: JSON.parse(text) as unknown };
    } catch (err) {
      return {
        data: null,
        error: `${file}: invalid JSON (${err instanceof Error ? err.message : String(err)})`,
      };
    }
  } catch (err) {
    return {
      data: null,
      error: `${file}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function parseIndex(data: unknown): { data: V4IndexData; errors: string[] } {
  const errors: string[] = [];
  if (!isObject(data)) {
    return { data: FALLBACK_INDEX, errors: ["index.json: expected object"] };
  }
  const metaRaw = isObject(data.meta) ? data.meta : null;
  if (!metaRaw) {
    errors.push("index.json: missing meta object");
  }
  const meta = metaRaw ?? {};
  const normalized: V4SnapshotMeta = {
    version: typeof meta.version === "string" ? meta.version : "v4",
    updatedAt: typeof meta.updatedAt === "string" ? meta.updatedAt : "",
    modelsCount: parseNumber(meta.modelsCount),
    fullCount: parseNumber(meta.fullCount),
    provisionalCount: parseNumber(meta.provisionalCount),
    notListedCount: parseNumber(meta.notListedCount),
  };

  return { data: { meta: normalized }, errors };
}

function normalizeScores(value: unknown): V4ScoreBreakdown {
  const base = Object.fromEntries(
    V4_SCORE_ITEMS.map((item) => [item.key, null])
  ) as V4ScoreBreakdown;

  if (!isObject(value)) return base;

  for (const item of V4_SCORE_ITEMS) {
    const raw = value[item.key];
    base[item.key] = typeof raw === "number" && Number.isFinite(raw) ? raw : null;
  }

  return base;
}

function parseRankings(data: unknown): { data: V4RankingEntry[]; errors: string[] } {
  const errors: string[] = [];
  if (!Array.isArray(data)) {
    return { data: [], errors: ["rankings.json: expected array"] };
  }

  const entries = data.map((entry, index) => {
    const safe = isObject(entry) ? entry : {};
    if (!isObject(entry)) {
      errors.push(`rankings.json: entry[${index}] invalid`);
    }
    const model =
      typeof safe.model === "string" && safe.model.trim().length
        ? safe.model
        : `unknown-model-${index + 1}`;
    const vendor = typeof safe.vendor === "string" ? safe.vendor : "";
    const layer = typeof safe.layer === "string" ? safe.layer : "unknown";
    const score =
      typeof safe.score === "number" && Number.isFinite(safe.score) ? safe.score : null;
    const updatedAt = typeof safe.updatedAt === "string" ? safe.updatedAt : null;

    return {
      model,
      vendor,
      layer,
      score,
      scores: normalizeScores(safe.scores),
      updatedAt,
    } satisfies V4RankingEntry;
  });

  return { data: entries, errors };
}

function parseModels(data: unknown): { data: Record<string, V4ModelMetadata>; errors: string[] } {
  const errors: string[] = [];
  const normalized: Record<string, V4ModelMetadata> = {};
  if (Array.isArray(data)) {
    data.forEach((value, index) => {
      if (!isObject(value)) {
        errors.push(`models.json: entry[${index}] invalid`);
        return;
      }
      const modelKey =
        typeof value.modelKey === "string"
          ? value.modelKey
          : typeof value.key === "string"
            ? value.key
            : typeof value.slug === "string"
              ? value.slug
              : typeof value.id === "string"
                ? value.id
                : typeof (value as { identity?: { modelKey?: string } }).identity?.modelKey ===
                    "string"
                  ? (value as { identity?: { modelKey?: string } }).identity?.modelKey
                  : null;
      if (!modelKey) {
        errors.push(`models.json: entry[${index}] missing model key`);
        return;
      }
      const source = isObject(value.model) ? value.model : value;
      normalized[modelKey] = {
        name: typeof source.name === "string" ? source.name : modelKey,
        vendor: typeof source.vendor === "string" ? source.vendor : "",
      };
    });
    return { data: normalized, errors };
  }

  if (!isObject(data)) {
    return { data: {}, errors: ["models.json: expected object or array"] };
  }

  for (const [key, value] of Object.entries(data)) {
    if (!isObject(value)) {
      errors.push(`models.json: invalid entry for ${key}`);
      continue;
    }
    normalized[key] = {
      name: typeof value.name === "string" ? value.name : key,
      vendor: typeof value.vendor === "string" ? value.vendor : "",
    };
  }

  return { data: normalized, errors };
}

function parseNotListed(data: unknown): { data: V4NotListedEntry[]; errors: string[] } {
  const errors: string[] = [];
  if (!Array.isArray(data)) {
    return { data: [], errors: ["not-listed.json: expected array"] };
  }

  const entries = data.map((entry, index) => {
    if (typeof entry === "string") {
      return { id: entry, reason: null } satisfies V4NotListedEntry;
    }
    if (isObject(entry)) {
      const id =
        typeof entry.id === "string"
          ? entry.id
          : typeof entry.model === "string"
            ? entry.model
            : `unknown-not-listed-${index + 1}`;
      const reason = typeof entry.reason === "string" ? entry.reason : null;
      return { id, reason } satisfies V4NotListedEntry;
    }
    errors.push(`not-listed.json: entry[${index}] invalid`);
    return { id: `unknown-not-listed-${index + 1}`, reason: null } satisfies V4NotListedEntry;
  });

  return { data: entries, errors };
}

async function loadJsonWithParse<T>(
  file: string,
  parser: (data: unknown) => { data: T; errors: string[] },
  fallback: T
): Promise<{ data: T; ok: boolean; errors: string[] }> {
  const { data, error } = await fetchSnapshotJson(file);
  const errors: string[] = [];
  if (error) errors.push(error);
  if (data === null) {
    return { data: fallback, ok: false, errors };
  }
  const parsed = parser(data);
  errors.push(...parsed.errors);
  return { data: parsed.data, ok: errors.length === 0, errors };
}

export async function loadIndex(): Promise<{
  data: V4IndexData;
  ok: boolean;
  errors: string[];
}> {
  return loadJsonWithParse("index.json", parseIndex, FALLBACK_INDEX);
}

export async function loadRankings(): Promise<{
  data: V4RankingEntry[];
  ok: boolean;
  errors: string[];
}> {
  return loadJsonWithParse("rankings.json", parseRankings, []);
}

export async function loadModels(): Promise<{
  data: Record<string, V4ModelMetadata>;
  ok: boolean;
  errors: string[];
}> {
  return loadJsonWithParse("models.json", parseModels, {});
}

export async function loadNotListed(): Promise<{
  data: V4NotListedEntry[];
  ok: boolean;
  errors: string[];
}> {
  return loadJsonWithParse("not-listed.json", parseNotListed, []);
}

export async function loadV4DevSnapshot(): Promise<{
  index: V4IndexData;
  rankings: V4RankingEntry[];
  models: Record<string, V4ModelMetadata>;
  notListed: V4NotListedEntry[];
  diagnostics: V4SnapshotDiagnostics;
}> {
  const [index, rankings, models, notListed] = await Promise.all([
    loadIndex(),
    loadRankings(),
    loadModels(),
    loadNotListed(),
  ]);

  const errors = [...index.errors, ...rankings.errors, ...models.errors, ...notListed.errors];

  return {
    index: index.data,
    rankings: rankings.data,
    models: models.data,
    notListed: notListed.data,
    diagnostics: {
      files: {
        index: { ok: index.ok, error: index.errors[0] },
        rankings: { ok: rankings.ok, error: rankings.errors[0] },
        models: { ok: models.ok, error: models.errors[0] },
        notListed: { ok: notListed.ok, error: notListed.errors[0] },
      },
      errors,
    },
  };
}
