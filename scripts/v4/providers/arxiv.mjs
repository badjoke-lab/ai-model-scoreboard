export function guessArxivEvidence() {
  // 論文は family-map / model-map でのみ自動確定する
  return {
    type: "paper",
    status: "not_found",
    label: "Paper / technical report",
    reasons: ["auto:no_paper_mapping"],
  };
}
