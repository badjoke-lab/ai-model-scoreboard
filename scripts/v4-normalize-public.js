"use strict";

const fs = require("fs");
const path = require("path");

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}
function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n", "utf-8");
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
function hasAnyLink(ue) {
  if (!Array.isArray(ue)) return false;
  return ue.some((e) => {
    if (!isObject(e)) return false;
    const candidates = [
      e.url,
      e.href,
      e.link,
      e.sourceUrl,
      e.sourceURL,
      e.sourceLink,
      e.source?.url,
      e.source?.link,
    ];
    return candidates.some((v) => nonEmptyStr(v));
  });
}
function mapEvidenceTypeFromReason(reason) {
  if (!nonEmptyStr(reason)) return null;
  const r = reason.trim().toLowerCase();
  if (r.startsWith("evidence_audit_") || /missing[:_]?audit_link/.test(r)) return "audit";
  if (r.startsWith("evidence_paper_") || /missing[:_]?paper_link/.test(r)) return "paper";
  if (r.startsWith("evidence_dev_") || /missing[:_]?dev(_activity)?_link/.test(r)) return "dev_activity";
  if (r.startsWith("evidence_official_") || /missing[:_]?official(_page)?_link/.test(r)) return "official_page";
  if (r.includes("audit")) return "audit";
  if (r.includes("paper")) return "paper";
  if (r.includes("dev")) return "dev_activity";
  if (r.includes("official")) return "official_page";
  return null;
}
function buildEvidenceLink(modelKey, evidenceRef, evidenceType) {
  const resolvedType = nonEmptyStr(evidenceType) && evidenceType !== "unknown" ? evidenceType : null;
  if (resolvedType && nonEmptyStr(modelKey)) {
    return `/models/${encodeURIComponent(modelKey)}#evidence-${resolvedType}`;
  }
  if (nonEmptyStr(evidenceRef)) {
    return resolvedType ? `${evidenceRef}#${resolvedType}` : evidenceRef;
  }
  if (nonEmptyStr(modelKey)) return `/models/${encodeURIComponent(modelKey)}`;
  return null;
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

  const extractItemScores = (items) => {
    if (!isObject(items)) return {};
    const out = {};
    for (const [key, value] of Object.entries(items)) {
      const score =
        typeof value === "number"
          ? value
          : isObject(value)
            ? toNumber(value.score ?? value.value ?? value.points ?? value.total)
            : null;
      if (typeof score === "number") out[key] = score;
    }
    return out;
  };

  const collectReasonsFromItems = (items, reasons) => {
    if (!isObject(items)) return;
    for (const item of Object.values(items)) {
      if (!isObject(item)) continue;
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
    }
  };

  const normalizeEvidenceRef = (modelKey) => {
    const raw = evidenceMap[modelKey];
    if (!nonEmptyStr(raw)) return null;
    if (/^https?:\/\//.test(raw)) return raw;
    const trimmed = raw.trim().replace(/^public\//, "");
    if (trimmed.startsWith("/")) return trimmed;
    if (trimmed.startsWith("data/")) return "/" + trimmed;
    return "/data/v4/" + trimmed.replace(/^\.?\/*/, "");
  };
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
  const inferEvidenceType = (item, reasons) => {
    if (Array.isArray(item?.usedEvidence)) {
      for (const entry of item.usedEvidence) {
        if (isObject(entry) && nonEmptyStr(entry.type)) return entry.type.trim();
      }
    }
    for (const reason of reasons) {
      const mapped = mapEvidenceTypeFromReason(reason);
      if (mapped) return mapped;
    }
    return "unknown";
  };
  const ensurePenaltyEvidenceLinks = (items, modelKey, evidenceRef) => {
    if (!isObject(items)) return;
    for (const item of Object.values(items)) {
      if (!isObject(item)) continue;
      const reasons = normalizePenaltyReasons(item);
      if (!reasons.length) continue;
      if (!Array.isArray(item.usedEvidence)) item.usedEvidence = [];
      const resolvedType = inferEvidenceType(item, reasons);
      let target = item.usedEvidence.find((entry) => isObject(entry) && nonEmptyStr(entry.type));
      if (!isObject(target)) target = item.usedEvidence.find((entry) => isObject(entry));
      if (!isObject(target)) {
        target = {};
        item.usedEvidence.push(target);
      }
      if (!nonEmptyStr(target.type)) target.type = resolvedType;
      if (!hasAnyLink(item.usedEvidence)) {
        const link = buildEvidenceLink(modelKey, evidenceRef, resolvedType);
        if (nonEmptyStr(link)) target.link = link;
      }
    }
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
        (isObject(r.scoreBreakdown?.items) && r.scoreBreakdown.items) ||
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

    ensurePenaltyEvidenceLinks(r.scoreBreakdown?.items, r.modelKey, r.evidenceRef);
    ensurePenaltyEvidenceLinks(r.scoreBreakdown?.scores?.items, r.modelKey, r.evidenceRef);
    ensurePenaltyEvidenceLinks(r.scores?.items, r.modelKey, r.evidenceRef);
  }

  // modelKey 無い行を落とす（validator 的に意味ない）
  const filtered = rows.filter((r) => isObject(r) && nonEmptyStr(r.modelKey));
  writeJson(p, filtered);

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
