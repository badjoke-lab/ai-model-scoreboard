import {
  EvidenceIndex,
  EvidenceModelFile,
  EvidenceStatus,
  EvidenceType,
  ModelsJsonEntry,
  NotListedEntry,
  PublishPayload,
  RankingsJsonEntry,
  ScoresOutput,
  ScoreItemKey,
} from "../types";

const EVIDENCE_TYPES: EvidenceType[] = [
  "official_page",
  "dev_activity",
  "paper",
  "audit",
];

const EVIDENCE_STATUSES: EvidenceStatus[] = [
  "ok",
  "not_found",
  "ambiguous",
  "rate_limited",
  "blocked",
  "invalid",
  "missing_source_link",
];

const SCORE_ITEM_KEYS: ScoreItemKey[] = [
  "S1",
  "S2",
  "S3",
  "S4",
  "S5",
  "S6",
  "S7",
  "S8",
  "T1",
  "T2",
  "T3",
  "T4",
  "Q1",
  "Q2",
  "Q3",
];

export function validatePublishPayload(payload: PublishPayload): void {
  const errors: string[] = [];

  validateIndex(payload.index, errors);
  validateRankings(payload.rankings, errors);
  validateModels(payload.models, errors);
  validateNotListed(payload.notListed, errors);
  validateEvidenceIndex(payload.evidenceIndex, errors);
  validateEvidenceFiles(payload.evidenceFiles, errors);
  validateEvidenceCoverage(payload.evidenceIndex, payload.evidenceFiles, errors);

  if (errors.length > 0) {
    const message = ["[validate_payload] Validation failed:", ...errors].join(
      "\n- "
    );
    throw new Error(message);
  }
}

function validateEvidenceCoverage(
  index: EvidenceIndex,
  files: Record<string, EvidenceModelFile>,
  errors: string[]
): void {
  if (!isRecord(index) || !Array.isArray(index.models)) {
    return;
  }
  index.models.forEach((model) => {
    if (!files[model.modelKey]) {
      errors.push(`evidence/${model.modelKey}.json is missing from evidenceFiles.`);
    }
  });
}

function validateIndex(data: PublishPayload["index"], errors: string[]): void {
  if (!isRecord(data)) {
    errors.push("index.json must be an object.");
    return;
  }
  requireNonEmptyString("index.json version", data.version, errors);
  requireNonEmptyString("index.json updatedAt", data.updatedAt, errors);
  if (!isRecord(data.manifest)) {
    errors.push("index.json manifest must be an object.");
  }
  if (isRecord(data.manifest)) {
    if (!Array.isArray(data.manifest.files)) {
      errors.push("index.json manifest.files must be an array.");
    } else if (data.manifest.files.length === 0) {
      errors.push("index.json manifest.files must not be empty.");
    }
    if (!Array.isArray(data.manifest.evidencePaths)) {
      errors.push("index.json manifest.evidencePaths must be an array.");
    } else if (data.manifest.evidencePaths.length === 0) {
      errors.push("index.json manifest.evidencePaths must not be empty.");
    }
  }
  validateNonNegativeNumber("index.json modelsCount", data.modelsCount, errors);
  validateNonNegativeNumber("index.json fullCount", data.fullCount, errors);
  validateNonNegativeNumber(
    "index.json provisionalCount",
    data.provisionalCount,
    errors
  );
  validateNonNegativeNumber(
    "index.json notListedCount",
    data.notListedCount,
    errors
  );
}

function validateRankings(
  data: RankingsJsonEntry[],
  errors: string[]
): void {
  if (!Array.isArray(data)) {
    errors.push("rankings.json must be an array.");
    return;
  }
  data.forEach((item, idx) => {
    if (!isRecord(item)) {
      errors.push(`rankings.json[${idx}] must be an object.`);
      return;
    }
    for (const key of ["model", "vendor", "layer", "score"]) {
      if (!(key in item)) {
        errors.push(`rankings.json[${idx}] missing field: ${key}`);
      }
    }
    if (item.scores) {
      validateScores(`rankings.json[${idx}].scores`, item.scores, errors);
    }
  });
  for (let i = 1; i < data.length; i += 1) {
    const prev = data[i - 1];
    const current = data[i];
    if (prev.score < current.score) {
      errors.push(
        `rankings.json ordering invalid at index ${i}: score out of order.`
      );
      break;
    }
    if (prev.score === current.score && prev.model.localeCompare(current.model) > 0) {
      errors.push(
        `rankings.json ordering invalid at index ${i}: tie-break not by modelKey asc.`
      );
      break;
    }
  }
}

function validateModels(
  data: Record<string, ModelsJsonEntry>,
  errors: string[]
): void {
  if (!isRecord(data)) {
    errors.push("models.json must be an object (map keyed by slug).");
    return;
  }
  Object.entries(data).forEach(([slug, entry]) => {
    if (!isRecord(entry)) {
      errors.push(`models.json entry for ${slug} must be an object.`);
      return;
    }
    for (const key of ["name", "vendor"]) {
      if (!(key in entry)) {
        errors.push(`models.json entry for ${slug} missing field: ${key}`);
      }
    }
    if (entry.scores) {
      validateScores(`models.json ${slug}.scores`, entry.scores, errors);
    }
  });
}

function validateScores(
  label: string,
  data: ScoresOutput,
  errors: string[]
): void {
  if (!isRecord(data)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  if (typeof data.overall !== "number") {
    errors.push(`${label}.overall must be a number.`);
  }
  if (!isRecord(data.categories)) {
    errors.push(`${label}.categories must be an object.`);
  } else {
    for (const key of ["performance", "safety", "adoption", "openness", "cost"]) {
      if (typeof (data.categories as Record<string, unknown>)[key] !== "number") {
        errors.push(`${label}.categories.${key} must be a number.`);
      }
    }
  }
  if (!isRecord(data.items)) {
    errors.push(`${label}.items must be an object.`);
    return;
  }
  for (const key of SCORE_ITEM_KEYS) {
    const item = (data.items as Record<string, unknown>)[key];
    if (!isRecord(item)) {
      errors.push(`${label}.items.${key} must be an object.`);
      continue;
    }
    const status = typeof item.status === "string" ? item.status : "ok";
    const missingEvidence = status === "missing_evidence";
    const missingInputs = status === "missing_inputs";
    const hasNumericScore = typeof item.score === "number";
    if (hasNumericScore && (missingEvidence || missingInputs)) {
      errors.push(
        `${label}.items.${key}.score must be null when status is ${status}.`
      );
    }
    if (!hasNumericScore && !(missingEvidence || missingInputs)) {
      errors.push(`${label}.items.${key}.score must be a number.`);
    }
    if (!isRecord(item.inputs)) {
      errors.push(`${label}.items.${key}.inputs must be an object.`);
    } else if (hasMissingInputs(item.inputs) && !missingInputs) {
      if (!Array.isArray(item.penaltyReasons) || item.penaltyReasons.length === 0) {
        errors.push(
          `${label}.items.${key}.penaltyReasons must be non-empty when inputs missing.`
        );
      }
    }
    if (!Array.isArray(item.usedEvidence)) {
      errors.push(`${label}.items.${key}.usedEvidence must be an array.`);
    } else {
      if (missingEvidence && item.usedEvidence.length > 0) {
        errors.push(
          `${label}.items.${key}.usedEvidence must be empty when status is missing_evidence.`
        );
      }
      if (!missingEvidence && item.usedEvidence.length === 0) {
        errors.push(
          `${label}.items.${key}.usedEvidence must include at least one entry when status is ok.`
        );
      }
      item.usedEvidence.forEach((usage: any, idx: number) => {
        if (!isRecord(usage)) {
          errors.push(
            `${label}.items.${key}.usedEvidence[${idx}] must be an object.`
          );
          return;
        }
        if (!EVIDENCE_TYPES.includes(usage.type)) {
          errors.push(
            `${label}.items.${key}.usedEvidence[${idx}].type invalid.`
          );
        }
        if (!EVIDENCE_STATUSES.includes(usage.status)) {
          errors.push(
            `${label}.items.${key}.usedEvidence[${idx}].status invalid.`
          );
        } else if (usage.status !== "ok") {
          if (!Array.isArray(item.penaltyReasons) || item.penaltyReasons.length === 0) {
            errors.push(
              `${label}.items.${key}.penaltyReasons must be non-empty when evidence status is not ok.`
            );
          }
        }
        if (usage.status === "ok" && typeof usage.link !== "string" && typeof usage.url !== "string") {
          errors.push(
            `${label}.items.${key}.usedEvidence[${idx}] must include a link/url when status is ok.`
          );
        }
      });
    }
    if (!Array.isArray(item.penaltyReasons)) {
      errors.push(`${label}.items.${key}.penaltyReasons must be an array.`);
    }
  }
}

function validateNotListed(
  data: NotListedEntry[],
  errors: string[]
): void {
  if (!Array.isArray(data)) {
    errors.push("not-listed.json must be an array.");
    return;
  }
  data.forEach((entry, idx) => {
    if (!isRecord(entry)) {
      errors.push(`not-listed.json[${idx}] must be an object.`);
      return;
    }
    if (!entry.modelKey) {
      errors.push(`not-listed.json[${idx}] missing modelKey.`);
    }
    if (!Array.isArray(entry.reasons)) {
      errors.push(`not-listed.json[${idx}] reasons must be an array.`);
    }
  });
}

function validateEvidenceIndex(
  data: EvidenceIndex,
  errors: string[]
): void {
  if (!isRecord(data)) {
    errors.push("evidence/index.json must be an object.");
    return;
  }
  if (!isRecord(data.meta)) {
    errors.push("evidence/index.json meta must be an object.");
  } else {
    requireNonEmptyString(
      "evidence/index.json meta.version",
      data.meta.version,
      errors
    );
    requireNonEmptyString(
      "evidence/index.json meta.updatedAt",
      data.meta.updatedAt,
      errors
    );
  }
  if (!Array.isArray(data.models)) {
    errors.push("evidence/index.json models must be an array.");
  } else {
    data.models.forEach((model, idx) => {
      if (!isRecord(model)) {
        errors.push(`evidence/index.json models[${idx}] must be an object.`);
        return;
      }
      requireNonEmptyString(
        `evidence/index.json models[${idx}].modelKey`,
        model.modelKey,
        errors
      );
      requireNonEmptyString(
        `evidence/index.json models[${idx}].path`,
        model.path,
        errors
      );
    });
  }
}

function validateEvidenceFiles(
  data: Record<string, EvidenceModelFile>,
  errors: string[]
): void {
  if (!isRecord(data)) {
    errors.push("evidence files must be an object.");
    return;
  }
  Object.entries(data).forEach(([modelKey, file]) => {
    if (!isRecord(file)) {
      errors.push(`evidence/${modelKey}.json must be an object.`);
      return;
    }
    if (!isRecord(file.meta)) {
      errors.push(`evidence/${modelKey}.json meta must be an object.`);
      return;
    }
    if (!Array.isArray(file.evidenceItems)) {
      errors.push(`evidence/${modelKey}.json evidenceItems must be an array.`);
      return;
    }
    if (file.evidenceItems.length !== EVIDENCE_TYPES.length) {
      errors.push(
        `evidence/${modelKey}.json evidenceItems must include exactly ${EVIDENCE_TYPES.length} items.`
      );
    }
    file.evidenceItems.forEach((item, idx) => {
      if (!isRecord(item)) {
        errors.push(
          `evidence/${modelKey}.json evidenceItems[${idx}] must be an object.`
        );
        return;
      }
      if (!EVIDENCE_TYPES.includes(item.type)) {
        errors.push(
          `evidence/${modelKey}.json evidenceItems[${idx}].type invalid.`
        );
      }
      if (!EVIDENCE_STATUSES.includes(item.status)) {
        errors.push(
          `evidence/${modelKey}.json evidenceItems[${idx}].status invalid.`
        );
      }
      if (!Array.isArray(item.reasons)) {
        errors.push(
          `evidence/${modelKey}.json evidenceItems[${idx}].reasons must be array.`
        );
      } else if (item.reasons.length === 0) {
        errors.push(
          `evidence/${modelKey}.json evidenceItems[${idx}].reasons must not be empty.`
        );
      }
      if (!Array.isArray(item.refs)) {
        errors.push(
          `evidence/${modelKey}.json evidenceItems[${idx}].refs must be array.`
        );
      }
    });
    const typesPresent = new Set(file.evidenceItems.map((item) => item.type));
    for (const type of EVIDENCE_TYPES) {
      if (!typesPresent.has(type)) {
        errors.push(`evidence/${modelKey}.json missing evidence type: ${type}`);
      }
    }
    if (typesPresent.size !== EVIDENCE_TYPES.length) {
      errors.push(
        `evidence/${modelKey}.json evidenceItems must contain each evidence type exactly once.`
      );
    }
  });
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object";
}

function validateNonNegativeNumber(
  label: string,
  value: number,
  errors: string[]
): void {
  if (typeof value !== "number" || Number.isNaN(value)) {
    errors.push(`${label} must be a number.`);
    return;
  }
  if (value < 0) {
    errors.push(`${label} must be >= 0.`);
  }
}

function requireNonEmptyString(
  label: string,
  value: unknown,
  errors: string[]
): void {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${label} must be a non-empty string.`);
  }
}

function hasMissingInputs(inputs: Record<string, any>): boolean {
  const entries = Object.entries(inputs).filter(([key, value]) => {
    if (!key) return false;
    return value !== null && value !== undefined;
  });
  return entries.length === 0;
}
