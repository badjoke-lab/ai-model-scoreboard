const evidencePolicy = require("../../../lib/v4/evidence-policy.json");

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

const isHttpUrl = (value) => typeof value === "string" && /^https?:\/\//.test(value.trim());

const MAX_ERRORS = 25;

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
  expectedEvidenceTypes,
}) => {
  const snippet = trimSnippet(item);
  const expected =
    expectedEvidenceTypes && expectedEvidenceTypes.length
      ? ` :: expectedEvidenceTypes=${expectedEvidenceTypes.join(",")}`
      : "";
  return {
    reasonCode,
    modelKey,
    itemKey,
    message: `${reasonCode} :: ${modelKey} :: ${itemKey} :: missing ${missing} :: expected ${path}${expected} :: snippet ${snippet}`,
  };
};

const getAllowedEvidenceTypes = (itemId) => {
  const allowed = evidencePolicy[itemId];
  return Array.isArray(allowed) ? allowed : [];
};

const validateEvidenceGate = (modelsJson) => {
  const errors = [];
  let scoredItemsCount = 0;
  const pushError = (error) => {
    if (errors.length < MAX_ERRORS) {
      errors.push(error);
    }
  };

  const modelsArray = ensureArray(modelsJson)
    ? modelsJson
    : ensureObject(modelsJson)
      ? Object.entries(modelsJson).map(([key, value]) =>
          ensureObject(value) ? { modelKey: key, ...value } : value
        )
      : null;

  if (!modelsArray) {
    pushError({
      reasonCode: "spec_invalid_models_root",
      message: "models.json must be an array or an object map of models",
    });
    return { errors, scoredItemsCount };
  }

  modelsArray.forEach((model, modelIndex) => {
    if (!ensureObject(model)) {
      pushError({
        reasonCode: "spec_invalid_model",
        message: `models.json[${modelIndex}] must be an object`,
      });
      return;
    }

    const modelKey = model.modelKey || model.key || model.slug || `index:${modelIndex}`;
    const items = model.scoreBreakdown?.items;

    if (!ensureArray(items)) {
      pushError({
        reasonCode: "spec_items_not_array",
        message: `${modelKey} :: scoreBreakdown.items must be an array`,
      });
      return;
    }

    items.forEach((item, itemIndex) => {
      if (!ensureObject(item)) {
        pushError({
          reasonCode: `spec_invalid_item:${modelKey}:items[${itemIndex}]`,
          message: `${modelKey} :: items[${itemIndex}] must be an object`,
        });
        return;
      }

      const stableId = nonEmptyStr(item.id) ? item.id.trim() : null;
      const itemStatus =
        typeof item.status === "string" ? item.status.trim().toLowerCase() : "";
      const missingEvidence = itemStatus === "missing_evidence";
      const missingInputs = itemStatus === "missing_inputs";
      const hasScore = hasNumericScore(item);

      if (!hasScore && !(missingEvidence || missingInputs)) {
        const itemKey = describeItemKey(item) || `items[${itemIndex}]`;
        pushError({
          reasonCode: `spec_missing_item_score:${modelKey}:${itemKey}`,
          message: `${modelKey} :: ${itemKey} :: missing numeric score/delta/impact`,
        });
        return;
      }

      if (hasScore && (missingEvidence || missingInputs)) {
        const itemKey = describeItemKey(item) || `items[${itemIndex}]`;
        pushError({
          reasonCode: `spec_unverifiable_score:${modelKey}:${itemKey}`,
          message: `${modelKey} :: ${itemKey} :: numeric score present while status=${itemStatus}`,
        });
        return;
      }

      if (hasScore) scoredItemsCount += 1;
      const itemKey = describeItemKey(item);
      const fallbackItemKey = `items[${itemIndex}]`;
      const itemLabel = itemKey || fallbackItemKey;

      if (!itemKey) {
        pushError({
          reasonCode: `spec_missing_item_label:${modelKey}:${fallbackItemKey}`,
          message: `${modelKey} :: ${fallbackItemKey} :: missing item id/label/key`,
        });
      }
      if (!stableId) {
        pushError({
          reasonCode: `spec_missing_item_id:${modelKey}:${itemLabel}`,
          message: `${modelKey} :: ${itemLabel} :: missing stable item id`,
        });
      }

      const allowedEvidenceTypes = stableId ? getAllowedEvidenceTypes(stableId) : [];
      if (stableId && allowedEvidenceTypes.length === 0) {
        pushError({
          reasonCode: `spec_missing_evidence_policy:${modelKey}:${itemLabel}`,
          message: `${modelKey} :: ${itemLabel} :: no evidence policy found for item id=${stableId}`,
        });
      }

      if (!nonEmptyStr(item.why)) {
        pushError(
          buildError({
            reasonCode: `spec_missing_why:${modelKey}:${itemLabel}`,
            modelKey,
            itemKey: itemLabel,
            missing: "why",
            path: `scoreBreakdown.items[${itemIndex}].why`,
            item,
          })
        );
      }

      const normalizedInputs = normalizeInputs(item);
      const hasInputs = hasNonEmptyInputs(normalizedInputs);
      if (hasScore && !hasInputs) {
        pushError(
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
        pushError(
          buildError({
            reasonCode: `spec_missing_evidence_link:${modelKey}:${itemLabel}`,
            modelKey,
            itemKey: itemLabel,
            missing: "usedEvidence array",
            path: `scoreBreakdown.items[${itemIndex}].usedEvidence`,
            item,
            expectedEvidenceTypes: allowedEvidenceTypes,
          })
        );
        return;
      }

      item.usedEvidence.forEach((entry) => {
        if (!ensureObject(entry)) return;
        const type = nonEmptyStr(entry.type) ? entry.type.trim() : null;
        if (!type || allowedEvidenceTypes.length === 0) return;
        if (!allowedEvidenceTypes.includes(type)) {
          pushError(
            buildError({
              reasonCode: `spec_disallowed_evidence:${modelKey}:${itemLabel}`,
              modelKey,
              itemKey: itemLabel,
              missing: `disallowed evidence type ${type}`,
              path: `scoreBreakdown.items[${itemIndex}].usedEvidence[].type`,
              item,
              expectedEvidenceTypes: allowedEvidenceTypes,
            })
          );
        }
      });

      if (missingEvidence) {
        if (item.usedEvidence.length > 0) {
          pushError(
            buildError({
              reasonCode: `spec_missing_evidence_link:${modelKey}:${itemLabel}`,
              modelKey,
              itemKey: itemLabel,
              missing: "usedEvidence should be empty when status=missing_evidence",
              path: `scoreBreakdown.items[${itemIndex}].usedEvidence`,
              item,
              expectedEvidenceTypes: allowedEvidenceTypes,
            })
          );
        }
        return;
      }

      const links = collectEvidenceLinks(item.usedEvidence).filter(isHttpUrl);
      if (hasScore && links.length === 0) {
        pushError(
          buildError({
            reasonCode: `spec_missing_evidence_link:${modelKey}:${itemLabel}`,
            modelKey,
            itemKey: itemLabel,
            missing: "clickable evidence URL",
            path: `scoreBreakdown.items[${itemIndex}].usedEvidence[].(url|link|href|sourceUrl|traceUrl|...)`,
            item,
            expectedEvidenceTypes: allowedEvidenceTypes,
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
