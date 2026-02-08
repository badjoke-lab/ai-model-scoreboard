export function guessGithubEvidence(model) {
  // 既知のメタデータがあれば使う。無ければ provider単位の候補に落とす（ambiguous）
  const provider = (model?.provider || model?.org || "").toLowerCase();
  if (provider.includes("meta")) {
    const url = "https://github.com/meta-llama";
    return {
      type: "dev_activity",
      status: "ambiguous",
      label: "GitHub org (guessed)",
      url,
      refs: [url],
      reasons: ["auto:provider_meta"],
    };
  }
  if (provider.includes("openai")) {
    const url = "https://github.com/openai";
    return {
      type: "dev_activity",
      status: "ambiguous",
      label: "GitHub org (guessed)",
      url,
      refs: [url],
      reasons: ["auto:provider_openai"],
    };
  }
  return {
    type: "dev_activity",
    status: "not_found",
    label: "Development activity (not located)",
    reasons: ["auto:no_repo_mapping"],
  };
}
