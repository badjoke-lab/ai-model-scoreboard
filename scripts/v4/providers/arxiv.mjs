import { getProviderMap, loadProviderMaps, pickMappedUrl } from "./maps.mjs";

function applyProviderMapArxiv(result, provider) {
  const maps = loadProviderMaps();
  const m = getProviderMap(maps, provider);
  if (!m) return result;

  const paper = pickMappedUrl(m, "paper");
  if (!paper) return result;

  const out = { ...(result || {}) };
  out.status = "ok";
  out.label = out.label || "arXiv paper (provider map)";
  out.url = paper;
  out.refs = Array.from(new Set([...(out.refs || []), paper]));
  out.reasons = Array.from(new Set([...(out.reasons || []), "provider_map"]));
  return out;
}

export function guessArxivEvidence(model, provider) {
  // 論文は自動確定が難しいので、既知なら上書き、無ければ not_found
  // 将来: providerごとの既知paperマップを増やす
  const base = {
    type: "paper",
    status: "not_found",
    label: "Paper / technical report",
    reasons: ["auto:no_paper_mapping"],
  };
  return applyProviderMapArxiv(base, provider || model?.provider || model?.org || "");
}
