#!/usr/bin/env node
import { promises as fs } from "fs";
import path from "path";

import { loadModelDetailForExport } from "../../lib/v4/model-detail-export.mjs";
import { renderModelDetailText } from "../../lib/v4/render-detail-text.ts";

const REQUIRED_SECTIONS = [
  "Model",
  "Overall",
  "Category totals",
  "Evidence",
  "Raw inputs",
  "Breakdown",
  "Links",
];

function parseArgs(argv) {
  const args = { top: 10, keysFile: null };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--top") {
      const value = Number.parseInt(argv[i + 1] ?? "", 10);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("--top must be a positive integer");
      }
      args.top = value;
      i += 1;
      continue;
    }
    if (token === "--keys") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("--keys requires a file path");
      }
      args.keysFile = value;
      i += 1;
      continue;
    }
    throw new Error(`unknown argument: ${token}`);
  }
  return args;
}

function sanitizeModelKey(modelKey) {
  return modelKey
    .replaceAll("%", "_")
    .replaceAll("/", "__")
    .replace(/[<>:"\\|?*\u0000-\u001F]/g, "_");
}

function normalizeRankings(raw) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.rankings)) return raw.rankings;
  return [];
}

function readModelKeysFromModels(raw) {
  if (Array.isArray(raw)) {
    return raw
      .map((entry) =>
        typeof entry?.modelKey === "string"
          ? entry.modelKey
          : typeof entry?.key === "string"
            ? entry.key
            : typeof entry?.id === "string"
              ? entry.id
              : null
      )
      .filter(Boolean);
  }
  if (raw && typeof raw === "object") {
    return Object.keys(raw);
  }
  return [];
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function resolveTopModelKeys(top) {
  const rankingsPath = path.join(process.cwd(), "public", "data", "v4", "rankings.json");
  const modelsPath = path.join(process.cwd(), "public", "data", "v4", "models.json");

  try {
    const rankingsJson = await readJson(rankingsPath);
    const rankings = normalizeRankings(rankingsJson)
      .map((entry) => (typeof entry?.model === "string" ? entry.model : null))
      .filter(Boolean);
    if (rankings.length > 0) {
      return rankings.slice(0, top);
    }
  } catch {
    // Fallback to models.json below.
  }

  const modelsJson = await readJson(modelsPath);
  return readModelKeysFromModels(modelsJson).slice(0, top);
}

async function readKeysFile(filePath) {
  const raw = await fs.readFile(path.resolve(filePath), "utf8");
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

function validateOutput(modelKey, text) {
  const missing = REQUIRED_SECTIONS.filter((section) => !text.includes(`## ${section}\n`));
  if (missing.length > 0) {
    throw new Error(`missing required sections (${missing.join(", ")}) for modelKey: ${modelKey}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const modelKeys = args.keysFile ? await readKeysFile(args.keysFile) : await resolveTopModelKeys(args.top);

  if (modelKeys.length === 0) {
    throw new Error("no model keys resolved");
  }

  const outputDir = path.join(process.cwd(), "docs", "examples", "model-detail");
  await fs.mkdir(outputDir, { recursive: true });

  const failures = [];
  let successCount = 0;

  for (const modelKey of modelKeys) {
    try {
      const detail = await loadModelDetailForExport(modelKey);
      let text = renderModelDetailText(detail);
      if (!text.endsWith("\n")) text = `${text}\n`;
      validateOutput(modelKey, text);

      const fileName = `${sanitizeModelKey(modelKey)}.txt`;
      await fs.writeFile(path.join(outputDir, fileName), text, "utf8");
      successCount += 1;
      console.log(`wrote ${fileName}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ modelKey, message });
      console.error(`failed ${modelKey}: ${message}`);
    }
  }

  if (failures.length > 0) {
    console.error(`export failed for ${failures.length} model(s)`);
    process.exitCode = 1;
    return;
  }

  console.log(`exported ${successCount} model detail text file(s)`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
