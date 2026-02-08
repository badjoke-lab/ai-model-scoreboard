export function guessHfEvidence(model) {
  const modelKey = model?.modelKey || model?.key || "";
  // modelKey が "org%2Fname" の想定。 decodeしてHFに当てる
  const decoded = safeDecode(modelKey);
  // HFに同名がある保証はないが、候補URLとして置く（ok扱いではなく ambiguous にする）
  const url = decoded ? `https://huggingface.co/${decoded}` : "";
  if (!url) return { type: "official_page", status: "not_found", reasons: ["auto:cannot_build_hf_url"] };
  return {
    type: "official_page",
    status: "ambiguous",
    label: "Hugging Face model card (guessed)",
    url,
    refs: [url],
    reasons: ["auto:guessed_from_modelKey"],
  };
}
function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return "";
  }
}
