import { getProviderMap, loadProviderMaps, pickMappedUrl } from "./maps.mjs";

function applyProviderMapGithub(result, provider) {
  const maps = loadProviderMaps();
  const m = getProviderMap(maps, provider);
  if (!m) return result;

  const org = pickMappedUrl(m, "github_org");
  const repo = pickMappedUrl(m, "default_repo");

  const url = repo || org;
  if (!url) return result;

  const out = { ...(result || {}) };
  out.status = "ok";
  out.label = out.label || (repo ? "GitHub repository" : "GitHub organization");
  out.url = url;
  out.refs = Array.from(new Set([...(out.refs || []), url]));
  out.reasons = Array.from(new Set([...(out.reasons || []), "provider_map"]));
  return out;
}

export function guessGithubEvidence(model, provider) {
  // 既知のメタデータがあれば使う。無ければ provider単位の候補に落とす（ambiguous）
  const providerHint = (provider || model?.provider || model?.org || "").toLowerCase();
  if (providerHint.includes("meta")) {
    const url = "https://github.com/meta-llama";
    return applyProviderMapGithub(
      {
        type: "dev_activity",
        status: "ambiguous",
        label: "GitHub org (guessed)",
        url,
        refs: [url],
        reasons: ["auto:provider_meta"],
      },
      providerHint,
    );
  }
  if (providerHint.includes("openai")) {
    const url = "https://github.com/openai";
    return applyProviderMapGithub(
      {
        type: "dev_activity",
        status: "ambiguous",
        label: "GitHub org (guessed)",
        url,
        refs: [url],
        reasons: ["auto:provider_openai"],
      },
      providerHint,
    );
  }
  return applyProviderMapGithub(
    {
      type: "dev_activity",
      status: "not_found",
      label: "Development activity (not located)",
      reasons: ["auto:no_repo_mapping"],
    },
    providerHint,
  );
}
