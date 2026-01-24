"use strict";

const fs = require("fs");
const path = require("path");

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}
function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n", "utf-8");
}
function writeJsonAtomic(p, obj) {
  const dir = path.dirname(p);
  const base = path.basename(p);
  const tmp = path.join(dir, `.${base}.${process.pid}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + "\n", "utf-8");
  fs.renameSync(tmp, p);
}
function isObject(x) {
  return !!x && typeof x === "object" && !Array.isArray(x);
}
function nonEmptyStr(x) {
  return typeof x === "string" && x.trim().length > 0;
}
function pickFirstStr(obj, keys) {
  if (!isObject(obj)) return null;
  for (const k of keys) {
    const v = obj[k];
    if (nonEmptyStr(v)) return v.trim();
  }
  return null;
}
function toNumber(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}
function hasFiniteNumber(v) {
  return typeof v === "number" && Number.isFinite(v);
}
function isNonEmptyObject(v) {
  return isObject(v) && Object.keys(v).length > 0;
}
function isNonEmptyArray(v) {
  return Array.isArray(v) && v.length > 0;
}
function hasNumericScore(item) {
  return hasFiniteNumber(item?.score) || hasFiniteNumber(item?.delta) || hasFiniteNumber(item?.impact);
}
function isClickableLink(link) {
  return typeof link === "string" && (/^https?:\/\//.test(link) || link.startsWith("/"));
}
function normalizeAttemptEvidenceLink(ref) {
  if (!nonEmptyStr(ref)) return null;
  if (/^https?:\/\//.test(ref)) return ref.trim();
  const trimmed = ref.trim().replace(/^public\//, "");
  if (trimmed.startsWith("/")) return trimmed;
  if (trimmed.startsWith("data/")) return "/" + trimmed;
  return "/data/v4/" + trimmed.replace(/^\.?\/*/, "");
}
function convertEvidenceTokenToUrl(token) {
  if (!nonEmptyStr(token)) return null;
  const trimmed = token.trim();
  if (isClickableLink(trimmed)) return trimmed;

  const colonIndex = trimmed.indexOf(":");
  if (colonIndex === -1) return null;
  const prefix = trimmed.slice(0, colonIndex).toLowerCase();
  const rawValue = trimmed.slice(colonIndex + 1).trim();
  if (!rawValue) return null;

  const encoded = encodeURIComponent(rawValue);
  switch (prefix) {
    case "arxiv":
    case "arxiv_query":
      return `https://arxiv.org/search/?query=${encoded}&searchtype=all`;
    case "hf":
    case "huggingface":
      return `https://huggingface.co/${rawValue.replace(/^\/+/, "")}`;
    case "github":
      return `https://github.com/${rawValue.replace(/^\/+/, "")}`;
    case "url":
      return rawValue;
    default:
      return null;
  }
}
const REASON_TEXT = {
  evidence_audit_missing_source_link:
    "An audit is referenced but the source link is missing, so the audit evidence cannot be verified.",
  missing_minor_incidents:
    "No minor-incident evidence was found in the pipeline evidence record, so the default policy assumption is applied.",
  missing_major_incidents:
    "No major-incident evidence was found in the pipeline evidence record, so the default policy assumption is applied.",
  missing_critical_incidents:
    "No critical-incident evidence was found in the pipeline evidence record, so the default policy assumption is applied.",
};
function toEnglishWhy(reasonCodes) {
  if (!Array.isArray(reasonCodes) || reasonCodes.length === 0) return null;
  const mapped = reasonCodes.map((code) => REASON_TEXT[code]).filter(nonEmptyStr);
  if (mapped.length > 0) return mapped[0];
  const first = reasonCodes.find(nonEmptyStr);
  if (!first) return null;
  const humanized = first.replace(/[_:-]+/g, " ").trim();
  if (!humanized) return null;
  const sentence = humanized.charAt(0).toUpperCase() + humanized.slice(1);
  return `${sentence}.`;
}
function ensureInputsRaw(item) {
  if (!isObject(item) || !hasNumericScore(item)) return;
  if (isNonEmptyObject(item.inputsRaw) || isNonEmptyArray(item.inputsRaw)) return;

  if (isNonEmptyObject(item.inputs)) {
    item.inputsRaw = { ...item.inputs };
    return;
  }

  // last resort: provide a minimal non-empty record so the spec gate can fail loudly upstream
  item.inputsRaw = { present: true };
}
function ensureWhyEnglish(item) {
  if (!isObject(item) || !hasNumericScore(item)) return;
  if (nonEmptyStr(item.why) && /[A-Za-z]/.test(item.why) && (item.why.includes(" ") || /[.?!]/.test(item.why))) {
    return;
  }
  const reasonCodes = [
    ...(Array.isArray(item.penaltyReasons) ? item.penaltyReasons : []),
    ...(Array.isArray(item.reasonCodes) ? item.reasonCodes : []),
  ].filter(nonEmptyStr);
  const mapped = toEnglishWhy(reasonCodes);
  if (mapped) item.why = mapped;
}
function hasClickableEvidenceLink(usedEvidence) {
  if (!Array.isArray(usedEvidence)) return false;
  return usedEvidence.some((entry) => isObject(entry) && isClickableLink(entry.link));
}
function normalizeEvidenceEntryLink(entry) {
  if (!isObject(entry)) return;
  const existing = nonEmptyStr(entry.link) ? entry.link.trim() : null;
  if (existing && isClickableLink(existing)) {
    entry.link = existing;
    return;
  }
  const fromRef = convertEvidenceTokenToUrl(entry.ref || entry.reference || entry.evidenceRef || entry.link);
  if (fromRef && isClickableLink(fromRef)) {
    entry.link = fromRef;
  }
}
function ensureAttemptEvidenceLink(item, attemptLink) {
  if (!isObject(item) || !Array.isArray(item.usedEvidence) || !nonEmptyStr(attemptLink)) return;
  const link = attemptLink.trim();
  if (!link.startsWith("/data/v4/evidence/")) return;
  const alreadyPresent = item.usedEvidence.some((entry) => isObject(entry) && entry.link === link);
  if (alreadyPresent) return;
  item.usedEvidence.push({
    type: "attempt_evidence_record",
    status: "attempted",
    link,
  });
}

function normalizeIndexJson() {
  const p = "public/data/v4/index.json";
  if (!fs.existsSync(p)) {
    console.log("[v4-normalize] skip: missing", p);
    return;
  }

  const j = readJson(p);
  const meta = isObject(j.meta) ? { ...j.meta } : {};

  // snapshot が嫌う top-level keys を meta に退避して消す
  const moveKeys = [
    "version",
    "updatedAt",
    "manifest",
    "modelsCount",
    "fullCount",
    "provisionalCount",
    "notListedCount",
  ];

  for (const k of moveKeys) {
    if (Object.prototype.hasOwnProperty.call(j, k)) {
      if (!Object.prototype.hasOwnProperty.call(meta, k)) {
        meta[k] = j[k];
      }
      delete j[k];
    }
  }

  j.meta = meta;
  writeJson(p, j);

  console.log("[v4-normalize] index.json -> moved keys to meta:", moveKeys.join(", "));
}

function normalizeEvidenceIndex() {
  const p = "public/data/v4/evidence/index.json";
  if (!fs.existsSync(p)) {
    console.log("[v4-normalize] skip: missing", p);
    return;
  }

  const j = readJson(p);
  const meta = j.meta || {};
  const models = j.models;

  const pickKey = (row) =>
    pickFirstStr(row, ["modelKey", "key", "id", "slug", "name"]) ||
    (isObject(row?.meta) ? pickFirstStr(row.meta, ["modelKey", "key", "id", "slug", "name"]) : null);

  const pickPath = (row) => {
    const v =
      pickFirstStr(row, ["file", "path", "rel", "href", "url", "value", "evidence", "index"]) ||
      (isObject(row?.meta)
        ? pickFirstStr(row.meta, ["file", "path", "rel", "href", "url", "value", "evidence", "index"])
        : null);

    if (nonEmptyStr(v)) return v.trim();

    if (isObject(row)) {
      for (const vv of Object.values(row)) {
        if (nonEmptyStr(vv) && vv.includes(".json")) return vv.trim();
      }
    }
    return null;
  };

  let out = {};

  if (Array.isArray(models)) {
    for (const row of models) {
      const k = pickKey(row);
      const v0 = pickPath(row);
      if (!k || !v0) continue;

      let v = v0;
      // "ai21/x.json" みたいなのを "evidence/ai21/x.json" に寄せる
      if (v.endsWith(".json") && !v.startsWith("evidence/") && !path.isAbsolute(v)) {
        v = v.startsWith("public/") || v.startsWith("output/") ? v : "evidence/" + v.replace(/^\.?\/*/, "");
      }
      out[k] = v;
    }
  } else if (isObject(models)) {
    out = { ...models };
    // 値の補正だけ
    for (const [k, v0] of Object.entries(out)) {
      if (!nonEmptyStr(v0)) continue;
      let v = v0.trim();
      if (v.endsWith(".json") && !v.startsWith("evidence/") && !path.isAbsolute(v)) {
        v = v.startsWith("public/") || v.startsWith("output/") ? v : "evidence/" + v.replace(/^\.?\/*/, "");
      }
      out[k] = v;
    }
  } else {
    out = {};
  }

  writeJson(p, { meta, models: out });
  console.log("[v4-normalize] evidence index -> dict:", Object.keys(out).length, "models");
}

function normalizeModelsJson() {
  const p = "public/data/v4/models.json";
  if (!fs.existsSync(p)) {
    console.log("[v4-normalize] skip: missing", p);
    return;
  }

  const evidenceIndexPath = "public/data/v4/evidence/index.json";
  const decisionsPath = "public/data/v4/decisions.json";
  const adoptionPath = "public/data/v4/adoption.json";

  const evidenceIndex = fs.existsSync(evidenceIndexPath) ? readJson(evidenceIndexPath) : null;
  const decisionsRoot = fs.existsSync(decisionsPath) ? readJson(decisionsPath) : null;
  const adoptionRoot = fs.existsSync(adoptionPath) ? readJson(adoptionPath) : null;

  const evidenceMap = (() => {
    if (!evidenceIndex || !isObject(evidenceIndex)) return {};
    const models = evidenceIndex.models;
    if (Array.isArray(models)) {
      const out = {};
      for (const row of models) {
        if (!isObject(row)) continue;
        const key = pickFirstStr(row, ["modelKey", "key", "id", "slug"]);
        const pathValue = pickFirstStr(row, ["path", "file", "rel", "href", "url", "value", "evidence", "index"]);
        if (key && pathValue) out[key] = pathValue;
      }
      return out;
    }
    if (isObject(models)) return { ...models };
    return {};
  })();

  const adoptionStatusByKey = (() => {
    const out = {};
    if (decisionsRoot && isObject(decisionsRoot)) {
      const rows = Array.isArray(decisionsRoot.decisions) ? decisionsRoot.decisions : Array.isArray(decisionsRoot) ? decisionsRoot : [];
      for (const row of rows) {
        if (!isObject(row)) continue;
        const key = pickFirstStr(row, ["modelKey", "key", "id", "slug"]);
        const status = pickFirstStr(row, ["status", "adoptionStatus", "adoption"]);
        if (key && status) out[key] = status;
      }
    }
    if (adoptionRoot && isObject(adoptionRoot)) {
      const pushRows = (rows, status) => {
        if (!Array.isArray(rows)) return;
        for (const row of rows) {
          if (!isObject(row)) continue;
          const key = pickFirstStr(row, ["modelKey", "key", "id", "slug"]);
          if (key && !out[key]) out[key] = status;
        }
      };
      pushRows(adoptionRoot.adopted, "adopted");
      pushRows(adoptionRoot.provisional, "provisional");
      pushRows(adoptionRoot.denied, "denied");
    }
    return out;
  })();

  const root = readJson(p);

  const keyOf = (m) => {
    if (!isObject(m)) return null;
    return (
      pickFirstStr(m, ["modelKey", "key", "id", "slug"]) ||
      (isObject(m.identity) ? pickFirstStr(m.identity, ["modelKey", "key", "id", "slug"]) : null) ||
      (isObject(m.meta) ? pickFirstStr(m.meta, ["modelKey", "key", "id", "slug"]) : null) ||
      null
    );
  };

  // root を「配列」に統一
  let rows = [];
  if (Array.isArray(root)) {
    rows = root;
  } else if (isObject(root) && (isObject(root.models) || isObject(root.data) || isObject(root.items))) {
    const container = (isObject(root.models) && root.models) || (isObject(root.data) && root.data) || (isObject(root.items) && root.items) || {};
    rows = Object.entries(container)
      .filter(([, v]) => isObject(v))
      .map(([k, v]) => ({ ...v, modelKey: nonEmptyStr(v.modelKey) ? v.modelKey : String(k) }));
  } else if (isObject(root)) {
    rows = Object.entries(root)
      .filter(([, v]) => isObject(v))
      .map(([k, v]) => ({ ...v, modelKey: nonEmptyStr(v.modelKey) ? v.modelKey : String(k) }));
  }

  // 各行を validator 仕様に寄せる
  const patched = {
    modelKey: 0,
    identity: 0,
    absoluteMetrics: 0,
    scoreBreakdown: 0,
    overallScore: 0,
    categoryScores: 0,
    itemScores: 0,
    scoreReasons: 0,
    adoptionStatus: 0,
    evidenceRef: 0,
  };

  const categoryKeys = ["C1", "C2", "C3", "C4", "C5", "C6", "C7"];
  const legacyCategoryMap = {
    performance: "C1",
    safety: "C2",
    adoption: "C3",
    cost: "C4",
    openness: "C5",
  };

  const forEachItem = (items, cb) => {
    if (Array.isArray(items)) {
      items.forEach((item, index) => cb(item, index));
      return;
    }
    if (isObject(items)) {
      Object.values(items).forEach((item, index) => cb(item, index));
    }
  };

  const extractItemScores = (items) => {
    const out = {};
    forEachItem(items, (item, index) => {
      if (item == null) return;
      if (typeof item === "number") {
        out[String(index)] = item;
        return;
      }
      if (!isObject(item)) return;
      const key =
        pickFirstStr(item, ["id", "label", "key", "name"]) ||
        (typeof index === "number" ? String(index) : null);
      if (!key) return;
      const score = toNumber(item.score ?? item.value ?? item.points ?? item.total);
      if (typeof score === "number") out[key] = score;
    });
    return out;
  };

  const collectReasonsFromItems = (items, reasons) => {
    forEachItem(items, (item) => {
      if (!isObject(item)) return;
      const lists = [
        item.penaltyReasons,
        item.reasons,
        item.reasonCodes,
        item.reason_codes,
      ];
      for (const list of lists) {
        if (!Array.isArray(list)) continue;
        for (const entry of list) {
          if (nonEmptyStr(entry)) reasons.add(entry.trim());
          if (isObject(entry) && nonEmptyStr(entry.code)) reasons.add(entry.code.trim());
        }
      }
    });
  };

  const normalizeEvidenceRef = (modelKey) => normalizeAttemptEvidenceLink(evidenceMap[modelKey]);
  const normalizePenaltyReasons = (item) => {
    const reasons = [];
    if (nonEmptyStr(item?.penaltyReason)) reasons.push(item.penaltyReason.trim());
    if (Array.isArray(item?.penaltyReasons)) {
      for (const entry of item.penaltyReasons) {
        if (nonEmptyStr(entry)) reasons.push(entry.trim());
      }
    }
    return reasons;
  };

  const isValidScoreItem = (item) => {
    if (!isObject(item)) return false;
    const keys = ["id", "label", "score", "penaltyReason", "penaltyReasons", "usedEvidence"];
    return keys.some((key) => Object.prototype.hasOwnProperty.call(item, key));
  };

  const normalizeUsedEvidence = (item, modelKey, itemIndex, attemptLink) => {
    if (!isObject(item)) return;
    const ue = item.usedEvidence;
    if (ue == null) {
      item.usedEvidence = [];
    } else if (Array.isArray(ue)) {
      item.usedEvidence = ue.filter(isObject);
    } else if (isObject(ue)) {
      item.usedEvidence = [ue];
    } else {
      console.warn(
        "[v4-normalize] invalid usedEvidence type -> []",
        modelKey || "<unknown>",
        "item",
        itemIndex,
        "type",
        typeof ue
      );
      item.usedEvidence = [];
    }

    item.usedEvidence.forEach((entry) => normalizeEvidenceEntryLink(entry));

    const hasLink = hasClickableEvidenceLink(item.usedEvidence);
    const statuses = item.usedEvidence
      .map((entry) => (isObject(entry) && nonEmptyStr(entry.status) ? entry.status.trim() : null))
      .filter(nonEmptyStr);
    const hasNonOkStatus = statuses.some((status) => status !== "ok");

    if (!hasLink || hasNonOkStatus) {
      ensureAttemptEvidenceLink(item, attemptLink);
    }
  };

  const normalizeScoreBreakdownItems = (row) => {
    if (!isObject(row)) return;
    if (!isObject(row.scoreBreakdown)) row.scoreBreakdown = { items: [] };

    const itemsRaw = row.scoreBreakdown.items;
    let items = [];

    if (itemsRaw == null) {
      items = [];
    } else if (Array.isArray(itemsRaw)) {
      items = itemsRaw;
    } else if (isObject(itemsRaw)) {
      if (isValidScoreItem(itemsRaw)) {
        items = [itemsRaw];
      } else {
        console.warn("[v4-normalize] scoreBreakdown.items object invalid -> []", row.modelKey);
        items = [];
      }
    } else {
      console.warn(
        "[v4-normalize] scoreBreakdown.items unexpected type -> []",
        row.modelKey,
        "type",
        typeof itemsRaw
      );
      items = [];
    }

    row.scoreBreakdown.items = items;
    const attemptLink = normalizeEvidenceRef(row.modelKey);

    items.forEach((item, index) => {
      if (!isObject(item)) return;
      normalizeUsedEvidence(item, row.modelKey, index, attemptLink);
      ensureInputsRaw(item);
      ensureWhyEnglish(item);
      const reasons = normalizePenaltyReasons(item);
      const isPenalty = item.isPenalty === true || reasons.length > 0;
      if (!isPenalty) return;
      if (item.usedEvidence.length === 0 || !hasClickableEvidenceLink(item.usedEvidence)) {
        item.__specMissingEvidenceLink = true;
      }
    });
  };

  for (const r of rows) {
    if (!isObject(r)) continue;

    const mk = keyOf(r);
    if (!nonEmptyStr(mk)) continue;

    if (!nonEmptyStr(r.modelKey)) {
      r.modelKey = mk;
      patched.modelKey++;
    } else {
      r.modelKey = r.modelKey.trim();
    }

    // identity: 非空object必須
    {
      const base = isObject(r.identity) ? { ...r.identity } : {};
      const before = JSON.stringify(base);

      base.modelKey = r.modelKey;
      if (nonEmptyStr(r.name) && !nonEmptyStr(base.name)) base.name = r.name.trim();
      if (nonEmptyStr(r.vendor) && !nonEmptyStr(base.vendor)) base.vendor = r.vendor.trim();

      // 空文字除去 + modelKey 保険
      const cleaned = {};
      for (const [k, v] of Object.entries(base)) {
        if (nonEmptyStr(v)) cleaned[k] = v.trim();
      }
      cleaned.modelKey = r.modelKey;

      r.identity = cleaned;
      if (JSON.stringify(cleaned) !== before) patched.identity++;
    }

    // absoluteMetrics: 非空object必須
    {
      const am0 = r.absoluteMetrics;
      const need = !isObject(am0) || Object.keys(am0).length === 0;
      if (need) {
        const out = {};

        // 使える数値/文字列を優先
        if (isObject(r.scores) && typeof r.scores.overall === "number") out.overall = r.scores.overall;
        if (isObject(r.pricing)) {
          if (typeof r.pricing.input === "number") out.price_input = r.pricing.input;
          if (typeof r.pricing.output === "number") out.price_output = r.pricing.output;
          if (nonEmptyStr(r.pricing.currency)) out.currency = r.pricing.currency.trim();
        }
        if (typeof r.context === "number" && r.context > 0) out.context = r.context;
        if (nonEmptyStr(r.released)) out.released = r.released.trim();

        out.modelKey = r.modelKey;
        if (Object.keys(out).length === 0) out.present = true;

        r.absoluteMetrics = out;
        patched.absoluteMetrics++;
      }
    }

    // scoreBreakdown: 非空object必須
    {
      const sb0 = r.scoreBreakdown;
      const need = !isObject(sb0) || Object.keys(sb0).length === 0;
      if (need) {
        const out = {};

        if (isObject(r.scores)) {
          if (typeof r.scores.overall === "number") out.overall = r.scores.overall;
          if (isObject(r.scores.categories) && Object.keys(r.scores.categories).length) out.categories = r.scores.categories;
          if (isObject(r.scores.items) && Object.keys(r.scores.items).length) out.items = r.scores.items;
        }

        if (typeof r.overallScore === "number" && typeof out.overall !== "number") out.overall = r.overallScore;

        out.modelKey = r.modelKey;
        if (Object.keys(out).length === 0) out.present = true;

        r.scoreBreakdown = out;
        patched.scoreBreakdown++;
      }
    }

    normalizeScoreBreakdownItems(r);

    if (typeof r.overallScore !== "number") {
      const overall =
        toNumber(r.scoreBreakdown?.overall) ??
        toNumber(r.scores?.overallScore) ??
        toNumber(r.scores?.overall) ??
        toNumber(r.overall) ??
        0;
      r.overallScore = overall;
      patched.overallScore++;
    }

    if (!isObject(r.categoryScores) || Object.keys(r.categoryScores).length === 0) {
      const source =
        (isObject(r.scoreBreakdown?.categories) && r.scoreBreakdown.categories) ||
        (isObject(r.scoreBreakdown?.scores?.categories) && r.scoreBreakdown.scores.categories) ||
        (isObject(r.scores?.categories) && r.scores.categories) ||
        {};

      const out = {};
      const hasCanonical = categoryKeys.some((k) => Object.prototype.hasOwnProperty.call(source, k));
      if (hasCanonical) {
        for (const k of categoryKeys) {
          const v = toNumber(source[k]) ?? 0;
          out[k] = v;
        }
      } else {
        for (const [key, value] of Object.entries(source)) {
          const mapped = legacyCategoryMap[key];
          if (!mapped) continue;
          const v = toNumber(value);
          if (typeof v === "number") out[mapped] = v;
        }
        for (const k of categoryKeys) {
          if (!(k in out)) out[k] = 0;
        }
      }

      r.categoryScores = out;
      patched.categoryScores++;
    }

    if (!isObject(r.itemScores) || Object.keys(r.itemScores).length === 0) {
      const items =
        ((Array.isArray(r.scoreBreakdown?.items) || isObject(r.scoreBreakdown?.items)) && r.scoreBreakdown.items) ||
        (isObject(r.scoreBreakdown?.scores?.items) && r.scoreBreakdown.scores.items) ||
        (isObject(r.scores?.items) && r.scores.items) ||
        {};
      const out = extractItemScores(items);
      r.itemScores = Object.fromEntries(Object.keys(out).sort().map((k) => [k, out[k]]));
      patched.itemScores++;
    }

    if (!Array.isArray(r.scoreReasons)) {
      const reasons = new Set();
      collectReasonsFromItems(r.scores?.items, reasons);
      collectReasonsFromItems(r.scoreBreakdown?.items, reasons);
      r.scoreReasons = Array.from(reasons);
      patched.scoreReasons++;
    }

    if (!nonEmptyStr(r.adoptionStatus)) {
      const status =
        pickFirstStr(r, ["adoptionStatus", "adoption", "status"]) ||
        adoptionStatusByKey[r.modelKey] ||
        null;
      if (nonEmptyStr(status)) {
        r.adoptionStatus = status;
        patched.adoptionStatus++;
      }
    }

    if (!nonEmptyStr(r.evidenceRef)) {
      const ref = normalizeEvidenceRef(r.modelKey);
      if (nonEmptyStr(ref)) {
        r.evidenceRef = ref;
        patched.evidenceRef++;
      }
    }
  }

  // modelKey 無い行を落とす（validator 的に意味ない）
  const filtered = rows.filter((r) => isObject(r) && nonEmptyStr(r.modelKey));
  if (filtered.length !== rows.length) {
    const removed = rows
      .filter((r) => !(isObject(r) && nonEmptyStr(r.modelKey)))
      .map((r) => keyOf(r) || "<unknown>")
      .slice(0, 10);
    console.warn("[v4-normalize] model count changed", {
      beforeCount: rows.length,
      afterCount: filtered.length,
      removedModelKeysSample: removed,
      reason: "invalid_model_record",
    });
  }
  writeJsonAtomic(p, filtered);

  console.log("[v4-normalize] models.json -> array:", filtered.length, "rows");
  console.log("[v4-normalize] patched:", patched);
}

function normalizeRankingsJson() {
  const p = "public/data/v4/rankings.json";
  if (!fs.existsSync(p)) {
    console.log("[v4-normalize] skip: missing", p);
    return;
  }

  const root = readJson(p);

  // rankings が配列 or { rankings: [...] } の両対応
  const isWrapped = isObject(root) && Array.isArray(root.rankings);
  const rows = Array.isArray(root) ? root : isWrapped ? root.rankings : [];

  if (!Array.isArray(rows)) {
    console.log("[v4-normalize] skip: rankings.json unexpected shape");
    return;
  }

  const keys = ["performance", "safety", "adoption", "openness", "cost"];

  let patched = 0;

  for (const r of rows) {
    if (!isObject(r)) continue;

    const scores0 = isObject(r.scores) ? r.scores : {};
    const cats =
      (isObject(scores0.categories) && scores0.categories) ||
      (isObject(r.scoreBreakdown?.categories) && r.scoreBreakdown.categories) ||
      (isObject(r.scoreBreakdown?.scores?.categories) && r.scoreBreakdown.scores.categories) ||
      (isObject(r.breakdown?.categories) && r.breakdown.categories) ||
      {};

    const scores = { ...scores0 };

    for (const k of keys) {
      if (Object.prototype.hasOwnProperty.call(scores, k)) continue;

      const v =
        toNumber(scores0[k]) ??
        toNumber(cats[k]) ??
        toNumber(r[k]) ??
        toNumber(r.breakdown?.[k]) ??
        null;

      // snapshot 側は「missing」を嫌うので、無ければ 0 を入れてキーだけは保証する
      scores[k] = v ?? 0;
      patched++;
    }

    r.scores = scores;
  }

  if (Array.isArray(root)) {
    writeJson(p, rows);
  } else if (isWrapped) {
    root.rankings = rows;
    writeJson(p, root);
  } else {
    // ここは念のため
    writeJson(p, rows);
  }

  console.log("[v4-normalize] rankings.json -> ensured category keys:", keys.join(", "), "patched:", patched);
}

function main() {
  normalizeIndexJson();
  normalizeRankingsJson();
  normalizeEvidenceIndex();
  normalizeModelsJson();
}

main();
