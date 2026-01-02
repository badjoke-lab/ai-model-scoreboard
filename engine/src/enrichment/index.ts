import fs from "fs";
import path from "path";
import https from "https";
import {
  AdoptionOutput,
  EvidenceArtifacts,
  EvidenceItem,
  EvidenceModelFile,
  EvidenceStatus,
  EvidenceType,
  OpenRouterModelRaw,
} from "../../types";

interface EvidenceSourcesConfig {
  officialPages?: Record<string, string>;
  providerPages?: Record<string, string>;
  repositories?: Record<string, string>;
  papers?: Record<string, string>;
  audits?: Record<string, string>;
}

const DEFAULT_PROVIDER_PAGES: Record<string, string> = {
  openai: "https://openai.com",
  anthropic: "https://www.anthropic.com",
  google: "https://ai.google",
  meta: "https://ai.meta.com",
  mistral: "https://mistral.ai",
  xai: "https://x.ai",
  cohere: "https://cohere.com",
  qwen: "https://qwenlm.ai",
  deepseek: "https://www.deepseek.com",
};

const URL_FIELDS = [
  "website",
  "homepage",
  "url",
  "link",
  "docs",
  "documentation",
  "site_url",
];

const REPO_FIELDS = ["repo", "repository", "github", "github_url", "repo_url"];

export async function buildEvidenceArtifacts(
  adoption: AdoptionOutput,
  openRouterModels: OpenRouterModelRaw[],
  options?: { updatedAt?: string; runId?: string }
): Promise<EvidenceArtifacts> {
  const now = options?.updatedAt ?? new Date().toISOString();
  const runId = options?.runId;
  const config = loadEvidenceSources();
  const openRouterMap = mapOpenRouterModels(openRouterModels);

  const modelKeys = collectModelKeys(adoption);
  const files: Record<string, EvidenceModelFile> = {};

  for (const modelKey of modelKeys) {
    const provider = resolveProvider(adoption, modelKey);
    const openRouter = openRouterMap.get(modelKey);
    files[modelKey] = await buildModelEvidence({
      modelKey,
      provider,
      openRouter,
      config,
      updatedAt: now,
    });
  }

  const index = {
    meta: { version: "v4", updatedAt: now, runId },
    models: modelKeys.map((modelKey) => ({
      modelKey,
      path: `evidence/${modelKey}.json`,
    })),
  };

  return { index, files };
}

function collectModelKeys(adoption: AdoptionOutput): string[] {
  const keys = new Set<string>();
  for (const entry of adoption.adopted) keys.add(entry.modelKey);
  for (const entry of adoption.provisional) keys.add(entry.modelKey);
  return Array.from(keys).sort();
}

function resolveProvider(adoption: AdoptionOutput, modelKey: string): string {
  const entry =
    adoption.adopted.find((item) => item.modelKey === modelKey) ??
    adoption.provisional.find((item) => item.modelKey === modelKey);
  return entry?.provider ?? "";
}

function loadEvidenceSources(): EvidenceSourcesConfig {
  const filePath = path.resolve("data", "config", "evidence-sources.json");
  if (!fs.existsSync(filePath)) {
    return { providerPages: { ...DEFAULT_PROVIDER_PAGES } };
  }
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      officialPages: parsed.officialPages || {},
      providerPages: { ...DEFAULT_PROVIDER_PAGES, ...(parsed.providerPages || {}) },
      repositories: parsed.repositories || {},
      papers: parsed.papers || {},
      audits: parsed.audits || {},
    };
  } catch {
    return { providerPages: { ...DEFAULT_PROVIDER_PAGES } };
  }
}

function mapOpenRouterModels(
  models: OpenRouterModelRaw[]
): Map<string, OpenRouterModelRaw> {
  const map = new Map<string, OpenRouterModelRaw>();
  for (const model of models) {
    const key = normalizeKey(model.canonical_slug || model.id || "");
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, model);
    }
  }
  return map;
}

async function buildModelEvidence({
  modelKey,
  provider,
  openRouter,
  config,
  updatedAt,
}: {
  modelKey: string;
  provider: string;
  openRouter?: OpenRouterModelRaw;
  config: EvidenceSourcesConfig;
  updatedAt: string;
}): Promise<EvidenceModelFile> {
  const evidenceItems: EvidenceItem[] = [];
  evidenceItems.push(
    buildOfficialPageEvidence(modelKey, provider, openRouter, config)
  );
  evidenceItems.push(await buildDevActivityEvidence(modelKey, openRouter, config));
  evidenceItems.push(buildPaperEvidence(modelKey, openRouter, config));
  evidenceItems.push(buildAuditEvidence(modelKey, config));

  return {
    meta: { updatedAt, modelKey },
    evidenceItems: evidenceItems.map((item) => normalizeEvidenceItem(item)),
  };
}

function buildOfficialPageEvidence(
  modelKey: string,
  provider: string,
  openRouter: OpenRouterModelRaw | undefined,
  config: EvidenceSourcesConfig
): EvidenceItem {
  const openRouterRef = buildOpenRouterModelPage(modelKey, openRouter);
  const openRouterUrl = pickUrl(openRouter, URL_FIELDS);
  if (openRouterUrl) {
    return toEvidenceItem("official_page", "ok", {
      reasons: ["openrouter_link", "openrouter_model_page"],
      refs: [openRouterRef, openRouterUrl],
      extracted: { url: openRouterUrl },
    });
  }

  const providerKey = normalizeKey(provider);
  const providerUrl =
    config.officialPages?.[modelKey] ||
    (providerKey ? config.providerPages?.[providerKey] : undefined);
  if (providerUrl) {
    return toEvidenceItem("official_page", "ok", {
      reasons: ["provider_fallback", "openrouter_model_page"],
      refs: [openRouterRef, providerUrl],
      extracted: { url: providerUrl },
    });
  }

  return toEvidenceItem("official_page", "ok", {
    reasons: ["openrouter_model_page_only"],
    refs: [openRouterRef],
    extracted: { url: openRouterRef },
  });
}

async function buildDevActivityEvidence(
  modelKey: string,
  openRouter: OpenRouterModelRaw | undefined,
  config: EvidenceSourcesConfig
): Promise<EvidenceItem> {
  const repoUrl =
    config.repositories?.[modelKey] || pickUrl(openRouter, REPO_FIELDS);
  if (!repoUrl) {
    return toEvidenceItem("dev_activity", "missing_source_link", {
      reasons: ["repo_link_missing"],
      refs: ["missing:github_repo"],
    });
  }

  const parsed = safeUrl(repoUrl);
  if (!parsed) {
    return toEvidenceItem("dev_activity", "invalid", {
      reasons: ["repo_url_invalid"],
      refs: [repoUrl],
    });
  }

  const githubMatch = parsed.hostname === "github.com"
    ? parsed.pathname.split("/").filter(Boolean)
    : [];
  if (githubMatch.length >= 2) {
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      throw new Error(
        "Missing GITHUB_TOKEN. Set the GitHub Secret GITHUB_TOKEN to enable GitHub enrichment."
      );
    }
    const [owner, repo] = githubMatch;
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;
    try {
      const payload = await fetchJson(apiUrl, {
        Authorization: `Bearer ${githubToken}`,
        "User-Agent": "private-engine-enrichment",
        Accept: "application/vnd.github+json",
      });
      if (payload && typeof payload === "object") {
        const extracted = {
          repo: repoUrl,
          updatedAt: payload.updated_at,
          pushedAt: payload.pushed_at,
          stars: payload.stargazers_count,
        };
        return toEvidenceItem("dev_activity", "ok", {
          reasons: ["github_repo_ok"],
          refs: [repoUrl],
          extracted,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const statusCode = parseStatusCode(message);
      const status =
        statusCode === 429 || message.includes("rate_limited")
          ? "rate_limited"
          : statusCode === 404 || message.includes("not found")
            ? "not_found"
            : statusCode === 403
              ? "blocked"
              : message.includes("json_parse_error")
                ? "invalid"
                : "invalid";
      return toEvidenceItem("dev_activity", status, {
        reasons: ["github_repo_fetch_failed", message],
        refs: [repoUrl],
      });
    }
  }

  return toEvidenceItem("dev_activity", "ambiguous", {
    reasons: ["unsupported_repo_host"],
    refs: [repoUrl],
  });
}

function buildPaperEvidence(
  modelKey: string,
  openRouter: OpenRouterModelRaw | undefined,
  config: EvidenceSourcesConfig
): EvidenceItem {
  const paperUrl = config.papers?.[modelKey];
  if (!paperUrl) {
    const query = openRouter?.name || modelKey;
    return toEvidenceItem("paper", "not_found", {
      reasons: ["no_known_paper_source"],
      refs: [`arxiv_query:"${query}"`],
    });
  }
  const parsed = safeUrl(paperUrl);
  if (!parsed) {
    return toEvidenceItem("paper", "invalid", {
      reasons: ["paper_url_invalid"],
      refs: [paperUrl],
    });
  }
  return toEvidenceItem("paper", "ok", {
    reasons: ["deterministic_source"],
    refs: [paperUrl],
    extracted: { url: paperUrl },
  });
}

function buildAuditEvidence(
  modelKey: string,
  config: EvidenceSourcesConfig
): EvidenceItem {
  const auditUrl = config.audits?.[modelKey];
  if (!auditUrl) {
    return toEvidenceItem("audit", "missing_source_link", {
      reasons: ["no_known_audit_source"],
      refs: ["missing:audit_link"],
    });
  }
  const parsed = safeUrl(auditUrl);
  if (!parsed) {
    return toEvidenceItem("audit", "invalid", {
      reasons: ["audit_url_invalid"],
      refs: [auditUrl],
    });
  }
  return toEvidenceItem("audit", "ok", {
    reasons: ["deterministic_source"],
    refs: [auditUrl],
    extracted: { url: auditUrl },
  });
}

function toEvidenceItem(
  type: EvidenceType,
  status: EvidenceStatus,
  data?: Partial<EvidenceItem>
): EvidenceItem {
  const reasons = [status, ...(data?.reasons ?? [])];
  return {
    type,
    status,
    reasons: sortEvidence(Array.from(new Set(reasons))),
    refs: sortEvidence(data?.refs?.length ? data.refs : [`missing:${type}`]),
    extracted: data?.extracted,
  };
}

function normalizeEvidenceItem(item: EvidenceItem): EvidenceItem {
  return {
    ...item,
    reasons: sortEvidence(item.reasons),
    refs: sortEvidence(item.refs.length ? item.refs : [`missing:${item.type}`]),
  };
}

function sortEvidence(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function buildOpenRouterModelPage(
  modelKey: string,
  openRouter: OpenRouterModelRaw | undefined
): string {
  const canonical = openRouter?.canonical_slug || openRouter?.id || modelKey;
  return `https://openrouter.ai/models/${canonical}`;
}

function pickUrl(
  openRouter: OpenRouterModelRaw | undefined,
  fields: string[]
): string | undefined {
  if (!openRouter) return undefined;
  for (const field of fields) {
    const value = (openRouter as Record<string, unknown>)[field];
    if (typeof value === "string" && value.startsWith("http")) {
      return value;
    }
  }
  const provider = openRouter.top_provider || {};
  for (const field of fields) {
    const value = (provider as Record<string, unknown>)[field];
    if (typeof value === "string" && value.startsWith("http")) {
      return value;
    }
  }
  return undefined;
}

function safeUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

function fetchJson(
  url: string,
  headers: Record<string, string>
): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: "GET",
        headers,
      },
      (res) => {
        const status = res.statusCode || 0;
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          if (status === 403 && body.includes("rate limit")) {
            reject(new Error("rate_limited"));
            return;
          }
          if (status < 200 || status >= 300) {
            reject(
              new Error(
                `request_failed:${status}:${body.slice(0, 200)}`
              )
            );
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (err) {
            reject(new Error(`json_parse_error:${err}`));
          }
        });
      }
    );

    req.on("error", (err) => reject(err));
    req.end();
  });
}

function parseStatusCode(message: string): number | null {
  const match = message.match(/request_failed:(\d+)/);
  if (!match) return null;
  const code = Number(match[1]);
  return Number.isFinite(code) ? code : null;
}
