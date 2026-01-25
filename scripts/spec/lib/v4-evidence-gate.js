const URL_FIELDS = [
  "link",
  "url",
  "href",
  "sourceUrl",
  "source_url",
  "source",
  "attemptUrl",
  "traceUrl",
  "referenceUrl",
  "evidenceUrl",
];

const ensureArray = (value) => Array.isArray(value);
const ensureObject = (value) => value && typeof value === "object" && !Array.isArray(value);
const nonEmptyStr = (value) => typeof value === "string" && value.trim().length > 0;

const hasFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

const hasNumericScore = (item) =>
  hasFiniteNumber(item?.score) || hasFiniteNumber(item?.delta) || hasFiniteNumber(item?.impact);

const isClickableUrl = (value) =>
  typeof value === "string" && (/^https?:\/\//.test(value) || value.startsWith("/"));

const trimSnippet = (value, maxLength = 360) => {
  let snippet = "";
  try {
    snippet = JSON.stringify(value, null, 2);
  } catch (error) {
    snippet = String(value);
  }
  if (snippet.length > maxLength) {
    return `${snippet.slice(0, maxLength)}…`;
  }
  return snippet;
};

const describeItemKey = (item) => item?.id || item?.key || item?.label || item?.name;

const normalizeInputs = (item) => {
  if (!ensureObject(item)) return null;
  const rawInputs = item.inputs ?? item.inputsRaw ?? item.inputRaw ?? item.inputMap;
  if (ensureObject(rawInputs)) return rawInputs;
  if (!ensureArray(rawInputs)) return null;

  const normalized = {};
  rawInputs.forEach((entry, index) => {
    if (ensureObject(entry)) {
      const key =
        (typeof entry.key === "string" && entry.key.trim()) ||
        (typeof entry.name === "string" && entry.name.trim()) ||
        (typeof entry.label === "string" && entry.label.trim());
      const value = entry.value ?? entry.val ?? entry.input ?? entry.raw;
      if (nonEmptyStr(key) && value !== undefined && value !== null) {
        normalized[key] = value;
      }
      return;
    }
    if (typeof entry === "string" && entry.includes("=")) {
      const [key, ...rest] = entry.split("=");
      const value = rest.join("=").trim();
      if (nonEmptyStr(key) && nonEmptyStr(value)) {
        normalized[key.trim()] = value;
      }
      return;
    }
    if (typeof entry === "string" && nonEmptyStr(entry)) {
      normalized[`input_${index}`] = entry.trim();
    }
  });

  return normalized;
};

const hasNonEmptyInputs = (inputs) => {
  if (!ensureObject(inputs)) return false;
  const entries = Object.entries(inputs).filter(([key, value]) => {
    if (!nonEmptyStr(key)) return false;
    if (typeof value === "string") return nonEmptyStr(value);
    return value !== null && value !== undefined;
  });
  return entries.length > 0;
};

const collectEvidenceLinks = (usedEvidence) => {
  if (!ensureArray(usedEvidence)) return [];
  const links = [];
  usedEvidence.forEach((entry) => {
    if (!ensureObject(entry)) return;
    URL_FIELDS.forEach((field) => {
      const candidate = entry[field];
      if (typeof candidate === "string") {
        const trimmed = candidate.trim();
        if (trimmed) links.push(trimmed);
      }
    });
    if (ensureArray(entry.urls)) {
      entry.urls.forEach((url) => {
        if (typeof url === "string" && url.trim()) {
          links.push(url.trim());
        }
      });
    }
  });
  return links;
};

const buildError = ({
  reasonCode,
  modelKey,
  itemKey,
  missing,
  path,
  item,
}) => {
  const snippet = trimSnippet(item);
  return {
    reasonCode,
    modelKey,
    itemKey,
    message: `${reasonCode} :: ${modelKey} :: ${itemKey} :: missing ${missing} :: expected ${path} :: snippet ${snippet}`,
  };
};

const validateEvidenceGate = (modelsJson) => {
  const errors = [];
  let scoredItemsCount = 0;

  const modelsArray = ensureArray(modelsJson)
    ? modelsJson
    : ensureObject(modelsJson)
      ? Object.entries(modelsJson).map(([key, value]) =>
          ensureObject(value) ? { modelKey: key, ...value } : value
        )
      : null;

  if (!modelsArray) {
    errors.push({
      reasonCode: "spec_invalid_models_root",
      message: "models.json must be an array or an object map of models",
    });
    return { errors, scoredItemsCount };
  }

  modelsArray.forEach((model, modelIndex) => {
    if (!ensureObject(model)) {
      errors.push({
        reasonCode: "spec_invalid_model",
        message: `models.json[${modelIndex}] must be an object`,
      });
      return;
    }

    const modelKey = model.modelKey || model.key || model.slug || `index:${modelIndex}`;
    const items = model.scoreBreakdown?.items;

    if (!ensureArray(items)) {
      errors.push({
        reasonCode: "spec_items_not_array",
        message: `${modelKey} :: scoreBreakdown.items must be an array`,
      });
      return;
    }

    items.forEach((item, itemIndex) => {
      if (!ensureObject(item)) {
        errors.push({
          reasonCode: `spec_invalid_item:${modelKey}:items[${itemIndex}]`,
          message: `${modelKey} :: items[${itemIndex}] must be an object`,
        });
        return;
      }

      if (!hasNumericScore(item)) {
        const itemKey = describeItemKey(item) || `items[${itemIndex}]`;
        errors.push({
          reasonCode: `spec_missing_item_score:${modelKey}:${itemKey}`,
          message: `${modelKey} :: ${itemKey} :: missing numeric score/delta/impact`,
        });
        return;
      }

      scoredItemsCount += 1;
      const itemKey = describeItemKey(item);
      const fallbackItemKey = `items[${itemIndex}]`;
      const itemLabel = itemKey || fallbackItemKey;

      if (!itemKey) {
        errors.push({
          reasonCode: `spec_missing_item_label:${modelKey}:${fallbackItemKey}`,
          message: `${modelKey} :: ${fallbackItemKey} :: missing item id/label/key`,
        });
      }

      const normalizedInputs = normalizeInputs(item);
      if (!hasNonEmptyInputs(normalizedInputs)) {
        errors.push(
          buildError({
            reasonCode: `spec_missing_inputs:${modelKey}:${itemLabel}`,
            modelKey,
            itemKey: itemLabel,
            missing: "inputs",
            path: `scoreBreakdown.items[${itemIndex}].inputs (or inputsRaw)`,
            item,
          })
        );
      }

      if (!ensureArray(item.usedEvidence)) {
        errors.push(
          buildError({
            reasonCode: `spec_missing_evidence_link:${modelKey}:${itemLabel}`,
            modelKey,
            itemKey: itemLabel,
            missing: "usedEvidence array",
            path: `scoreBreakdown.items[${itemIndex}].usedEvidence`,
            item,
          })
        );
        return;
      }

      const links = collectEvidenceLinks(item.usedEvidence).filter(isClickableUrl);
      if (links.length === 0) {
        errors.push(
          buildError({
            reasonCode: `spec_missing_evidence_link:${modelKey}:${itemLabel}`,
            modelKey,
            itemKey: itemLabel,
            missing: "clickable evidence URL",
            path: `scoreBreakdown.items[${itemIndex}].usedEvidence[].(url|link|href|sourceUrl|traceUrl|...)`,
            item,
          })
        );
      }
    });
  });

  return { errors, scoredItemsCount };
};

module.exports = {
  validateEvidenceGate,
  ensureArray,
  ensureObject,
  nonEmptyStr,
};
