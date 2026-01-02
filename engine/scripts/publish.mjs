import { execSync } from "node:child_process";
import { existsSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";
import path from "node:path";

function sh(cmd, opts = {}) {
  return execSync(cmd, { stdio: "inherit", ...opts });
}

function shQuiet(cmd, opts = {}) {
  try {
    execSync(cmd, { stdio: "ignore", ...opts });
    return true;
  } catch {
    return false;
  }
}

const engineRoot = process.cwd();
const outDir = path.join(engineRoot, "output", "v4");

const uiRepo = path.resolve(engineRoot, "..", "ai-model-scoreboard");
const uiV4Dir = path.join(uiRepo, "public", "data", "v4");

const files = [
  "index.json",
  "latest.json",
  "latest.meta.json",
  "rankings.json",
  "models.json",
  "not-listed.json",
  "adoption.json",
  "decisions.json",
];
const evidenceDir = path.join(outDir, "evidence");

console.log("[snapshot:publish] Running snapshot...");
sh("npm run snapshot");

for (const f of files) {
  const src = path.join(outDir, f);
  if (!existsSync(src)) {
    console.error(`[snapshot:publish] ERROR: Missing output file: ${src}`);
    process.exit(1);
  }
}
if (!existsSync(evidenceDir)) {
  console.error(`[snapshot:publish] ERROR: Missing evidence directory: ${evidenceDir}`);
  process.exit(1);
}

if (!existsSync(uiRepo)) {
  console.error(`[snapshot:publish] ERROR: UI repo not found: ${uiRepo}`);
  process.exit(1);
}

if (!existsSync(uiV4Dir)) mkdirSync(uiV4Dir, { recursive: true });

console.log("[snapshot:publish] Copying JSON to UI repo...");
for (const f of files) {
  copyFileSync(path.join(outDir, f), path.join(uiV4Dir, f));
}
const uiEvidenceDir = path.join(uiV4Dir, "evidence");
if (!existsSync(uiEvidenceDir)) mkdirSync(uiEvidenceDir, { recursive: true });
for (const entry of readdirSync(evidenceDir)) {
  if (!entry.endsWith(".json")) continue;
  copyFileSync(path.join(evidenceDir, entry), path.join(uiEvidenceDir, entry));
}

const okGit = shQuiet("git rev-parse --is-inside-work-tree", { cwd: uiRepo });
if (!okGit) {
  console.warn("[snapshot:publish] WARN: UI repo is not a git repo. Skipping diff check.");
  process.exit(0);
}

const hasChanges = !shQuiet("git diff --quiet -- public/data/v4", { cwd: uiRepo });

if (!hasChanges) {
  console.log("[snapshot:publish] No changes in public/data/v4 (already up to date).");
  process.exit(0);
}

console.log("[snapshot:publish] Updated public/data/v4. Next:");
console.log("  cd ../ai-model-scoreboard && git add public/data/v4 && git commit -m \"Update v4 snapshot\" && git push");
