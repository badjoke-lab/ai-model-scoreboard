import fs from "fs";
import path from "path";
import { AdoptionCandidate } from "./normalize";

export interface AdoptionRules {
  allowlist: string[];
  denylist: string[];
  requiredFields: string[];
}

export interface AdoptionDecision {
  candidate: AdoptionCandidate;
  status: "adopted" | "provisional" | "denied";
  reasons: string[];
}

export function loadAdoptionRules(): AdoptionRules {
  const allowlist = loadList(path.resolve("data", "config", "allowlist.json"));
  const denylist = loadList(path.resolve("data", "config", "denylist.json"));
  return {
    allowlist,
    denylist,
    requiredFields: ["modelKey", "name", "provider"],
  };
}

export function applyAdoptionRules(
  candidates: AdoptionCandidate[],
  rules: AdoptionRules
): AdoptionDecision[] {
  return candidates.map((candidate) => {
    const reasons: string[] = [];

    if (rules.denylist.includes(candidate.modelKey)) {
      reasons.push("denylist");
      return {
        candidate,
        status: "denied",
        reasons,
      };
    }

    const missing = missingRequired(candidate, rules.requiredFields);
    if (rules.allowlist.includes(candidate.modelKey)) {
      reasons.push("allowlist");
      if (missing.length > 0) {
        reasons.push(`missing required fields: ${missing.join(", ")}`);
      }
      return {
        candidate,
        status: "adopted",
        reasons,
      };
    }

    if (missing.length > 0) {
      reasons.push(`missing required fields: ${missing.join(", ")}`);
      return {
        candidate,
        status: "provisional",
        reasons,
      };
    }

    reasons.push("meets required fields");
    return {
      candidate,
      status: "adopted",
      reasons,
    };
  });
}

function missingRequired(
  candidate: AdoptionCandidate,
  requiredFields: string[]
): string[] {
  const missing: string[] = [];
  for (const field of requiredFields) {
    if (field === "modelKey" && !candidate.modelKey) missing.push(field);
    if (field === "name" && !candidate.name) missing.push(field);
    if (field === "provider" && !candidate.provider) missing.push(field);
  }
  return missing;
}

function loadList(filePath: string): string[] {
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((entry) => String(entry).trim()).filter(Boolean);
    }
  } catch {
    return [];
  }
  return [];
}
