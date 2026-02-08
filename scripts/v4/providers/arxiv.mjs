export function guessArxivEvidence(model) {
  // 論文は自動確定が難しいので、既知なら上書き、無ければ not_found
  // 将来: providerごとの既知paperマップを増やす
  return { type: "paper", status: "not_found", label: "Paper / technical report", reasons: ["auto:no_paper_mapping"] };
}
