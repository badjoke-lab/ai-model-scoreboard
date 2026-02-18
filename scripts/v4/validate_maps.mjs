import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MAP_DIR = path.join(ROOT, "overrides", "v4", "maps");

const FILES = {
  modelMaps: "model-maps.json",
  providerMaps: "provider-maps.json",
  aliases: "aliases.json",
};

const SHORTENER_HOSTS = new Set([
  "t.co",
  "bit.ly",
  "tinyurl.com",
  "goo.gl",
  "is.gd",
  "buff.ly",
  "ow.ly",
]);

let hasError = false;

function fail(file, pointer, reason) {
  hasError = true;
  const pathPart = pointer && pointer.length > 0 ? pointer : "root";
  console.error(`${file}:${pathPart}:${reason}`);
}

function isObject(x) {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

function isString(x) {
  return typeof x === "string";
}

function validateUrl(file, pointer, value) {
  if (!isString(value)) {
    fail(file, pointer, "invalid_url_type");
    return;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    fail(file, pointer, "empty_url");
    return;
  }

  if (!/^https?:\/\//.test(trimmed)) {
    fail(file, pointer, "invalid_url_scheme");
    return;
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    fail(file, pointer, "invalid_url");
    return;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    fail(file, pointer, "invalid_url_protocol");
    return;
  }

  if (SHORTENER_HOSTS.has(parsed.hostname.toLowerCase())) {
    fail(file, pointer, "shortener_host_forbidden");
  }
}

function readJsonIfExists(fileName) {
  const filePath = path.join(MAP_DIR, fileName);
  if (!fs.existsSync(filePath)) return null;

  try {
    const text = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(text);
  } catch {
    fail(fileName, "root", "invalid_json");
    return null;
  }
}

function validateAllowedKeys(fileName, pointer, objectValue, allowedKeys) {
  for (const key of Object.keys(objectValue)) {
    if (!allowedKeys.has(key)) {
      fail(fileName, `${pointer}.${key}`, "unknown_key");
    }
  }
}

function validateModelMaps(doc) {
  const fileName = FILES.modelMaps;
  if (doc === null) return;

  if (!isObject(doc)) {
    fail(fileName, "root", "root_must_be_object");
    return;
  }

  if (!isObject(doc.models)) {
    fail(fileName, "models", "models_must_be_object");
    return;
  }

  const allowed = new Set(["official_page", "dev_activity", "paper", "audit"]);

  for (const modelKey of Object.keys(doc.models)) {
    if (!isString(modelKey)) {
      fail(fileName, "models", "model_key_must_be_string");
      continue;
    }

    const modelValue = doc.models[modelKey];
    const pointer = `models.${modelKey}`;

    if (!isObject(modelValue)) {
      fail(fileName, pointer, "model_entry_must_be_object");
      continue;
    }

    validateAllowedKeys(fileName, pointer, modelValue, allowed);

    for (const urlKey of allowed) {
      if (Object.prototype.hasOwnProperty.call(modelValue, urlKey)) {
        validateUrl(fileName, `${pointer}.${urlKey}`, modelValue[urlKey]);
      }
    }
  }
}

function validateProviderMaps(doc) {
  const fileName = FILES.providerMaps;
  if (doc === null) return;

  if (!isObject(doc)) {
    fail(fileName, "root", "root_must_be_object");
    return;
  }

  if (!isObject(doc.providers)) {
    fail(fileName, "providers", "providers_must_be_object");
    return;
  }

  const allowed = new Set(["github_org", "default_repo", "paper"]);

  for (const providerKey of Object.keys(doc.providers)) {
    const providerValue = doc.providers[providerKey];
    const pointer = `providers.${providerKey}`;

    if (!isObject(providerValue)) {
      fail(fileName, pointer, "provider_entry_must_be_object");
      continue;
    }

    validateAllowedKeys(fileName, pointer, providerValue, allowed);

    for (const urlKey of allowed) {
      if (Object.prototype.hasOwnProperty.call(providerValue, urlKey)) {
        validateUrl(fileName, `${pointer}.${urlKey}`, providerValue[urlKey]);
      }
    }
  }
}

function validateAliasLoops(aliases) {
  const fileName = FILES.aliases;
  const state = new Map(); // 0/undefined=unvisited,1=visiting,2=done
  const stack = [];

  function dfs(node) {
    state.set(node, 1);
    stack.push(node);

    const next = aliases[node];
    if (Object.prototype.hasOwnProperty.call(aliases, next)) {
      const nextState = state.get(next);
      if (nextState === 1) {
        const idx = stack.indexOf(next);
        const cyclePath = [...stack.slice(idx), next].join("->");
        fail(fileName, `aliases.${node}`, `alias_cycle:${cyclePath}`);
      } else if (nextState !== 2) {
        dfs(next);
      }
    }

    stack.pop();
    state.set(node, 2);
  }

  for (const key of Object.keys(aliases)) {
    if (state.get(key) !== 2) dfs(key);
  }
}

function validateAliases(doc) {
  const fileName = FILES.aliases;
  if (doc === null) return;

  if (!isObject(doc)) {
    fail(fileName, "root", "root_must_be_object");
    return;
  }

  if (!isObject(doc.aliases)) {
    fail(fileName, "aliases", "aliases_must_be_object");
    return;
  }

  const aliases = doc.aliases;

  for (const key of Object.keys(aliases)) {
    const value = aliases[key];

    if (!isString(key)) {
      fail(fileName, "aliases", "alias_key_must_be_string");
      continue;
    }

    if (!isString(value)) {
      fail(fileName, `aliases.${key}`, "alias_value_must_be_string");
      continue;
    }

    if (key === value) {
      fail(fileName, `aliases.${key}`, "self_reference_forbidden");
    }
  }

  validateAliasLoops(aliases);
}

if (!fs.existsSync(MAP_DIR)) {
  console.log("ok: maps dir not found");
  process.exit(0);
}

const modelMaps = readJsonIfExists(FILES.modelMaps);
const providerMaps = readJsonIfExists(FILES.providerMaps);
const aliases = readJsonIfExists(FILES.aliases);

validateModelMaps(modelMaps);
validateProviderMaps(providerMaps);
validateAliases(aliases);

if (hasError) process.exit(1);

const existingFiles = Object.values(FILES).filter((f) => fs.existsSync(path.join(MAP_DIR, f)));
console.log(`ok: ${existingFiles.length} map files`);
